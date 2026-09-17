import { Injectable, Logger } from '@nestjs/common';
import { OltBootstrapStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { createSnmpSession, walkSubtree } from './snmp-client.util';

/** ifName (IF-MIB::ifXTable) - nome de cada interface da OLT, indexado por ifIndex. */
const IF_NAME_OID = '1.3.6.1.2.1.31.1.1.1.1';

@Injectable()
export class OltBootstrapService {
  private readonly logger = new Logger(OltBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Passo 1 do bootstrap de uma OLT: anda ifName (IF-MIB) e guarda so as
   * interfaces GPON (nome comecando com "gpon", case-insensitive - convencao
   * Parks pra porta PON, ex: "gpon0/1"). Disparado fire-and-forget na criacao
   * da OLT (ver OltService.create) - por isso nunca lanca, so registra o
   * resultado em bootstrapStatus/bootstrapError.
   */
  async walkGpons(oltId: string): Promise<void> {
    const olt = await this.prisma.olt.findUnique({ where: { id: oltId } });
    if (!olt) return;

    await this.prisma.olt.update({
      where: { id: oltId },
      data: {
        bootstrapStatus: OltBootstrapStatus.WALKING,
        bootstrapStartedAt: new Date(),
        bootstrapLastOid: IF_NAME_OID,
        bootstrapError: null,
      },
    });

    const session = createSnmpSession({
      ipAddress: olt.ipAddress,
      snmpPort: olt.snmpPort,
      community: this.encryption.decrypt(olt.snmpCommunity),
    });

    try {
      const varbinds = await walkSubtree(session, IF_NAME_OID);
      const gpons = varbinds
        .map((vb) => ({
          ifIndex: Number(vb.oid.slice(IF_NAME_OID.length + 1)),
          ifName: vb.value.trim(),
        }))
        .filter((iface) => iface.ifName.toLowerCase().startsWith('gpon'));

      await this.prisma.$transaction([
        this.prisma.gponInterface.deleteMany({ where: { oltId } }),
        ...(gpons.length
          ? [this.prisma.gponInterface.createMany({ data: gpons.map((g) => ({ ...g, oltId })) })]
          : []),
      ]);

      await this.prisma.olt.update({
        where: { id: oltId },
        data: { bootstrapStatus: OltBootstrapStatus.ACTIVE, bootstrapCompletedAt: new Date() },
      });
      this.logger.log(`Walk de GPONs concluido para OLT ${olt.name}: ${gpons.length} encontrada(s)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.olt.update({
        where: { id: oltId },
        data: { bootstrapStatus: OltBootstrapStatus.FAILED, bootstrapError: message },
      });
      this.logger.error(`Walk de GPONs falhou para OLT ${olt.name}: ${message}`);
    } finally {
      session.close();
    }
  }
}
