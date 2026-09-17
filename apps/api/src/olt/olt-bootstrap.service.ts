import { Injectable, Logger } from '@nestjs/common';
import { OltBootstrapStatus, OnuStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { createSnmpSession, getOid, walkSubtree, type SnmpVarbind } from './snmp-client.util';
import { formatOnuSerialNumber } from './onu-serial.util';

/** ifName (IF-MIB::ifXTable) - nome de cada interface da OLT, indexado por ifIndex. */
const IF_NAME_OID = '1.3.6.1.2.1.31.1.1.1.1';

/**
 * OIDs da Parks pra cada ONU cadastrada na OLT - tabelas indexadas por
 * slot.pon.posicao (os 3 ultimos numeros do OID de cada instancia, ex:
 * "...62.1.1.21" = alias da ONU 1/1/21). Guardamos aqui so o prefixo fixo
 * da coluna (sem os 3 indices), que e o que se anda com walkSubtree() -
 * SEM incluir o "slot" na base, mesmo ele sendo sempre 1 nos exemplos: e
 * parte do indice que varia, nao do OID fixo (confirmado com dado real de
 * producao - usar ".62.1" como base fazia o indice parecer ter so 2 partes
 * em vez de 3, e nenhuma ONU batia no parsing).
 */
const ONU_ALIAS_OID = '1.3.6.1.4.1.6771.10.1.5.1.62';
const ONU_SERIAL_OID = '1.3.6.1.4.1.6771.10.1.5.1.18';
const ONU_STATUS_OID = '1.3.6.1.4.1.6771.10.1.5.1.5';

/** oltOnuStatus - estado administrativo da ONU reportado pela Parks. */
const ONU_STATUS_MAP: Record<number, OnuStatus> = {
  0: OnuStatus.INVALID,
  1: OnuStatus.INACTIVE,
  2: OnuStatus.ACTIVATE_PENDING,
  3: OnuStatus.ACTIVE,
  4: OnuStatus.DEACTIVATE_PENDING,
  5: OnuStatus.DISABLE_PENDING,
  6: OnuStatus.DISABLE,
};

export interface OnuPosition {
  slotNo: number;
  portNo: number;
  logicalPortNo: number;
}

function onuPositionKey(pos: OnuPosition): string {
  return `${pos.slotNo}.${pos.portNo}.${pos.logicalPortNo}`;
}

/** Extrai slot.pon.posicao dos 3 ultimos numeros do OID (ver ONU_*_OID acima). */
function parseOnuPosition(oid: string, baseOid: string): OnuPosition | null {
  const suffix = oid.slice(baseOid.length + 1);
  const parts = suffix.split('.').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [slotNo, portNo, logicalPortNo] = parts;
  return { slotNo, portNo, logicalPortNo };
}

function indexByPosition(varbinds: SnmpVarbind[], baseOid: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const vb of varbinds) {
    const pos = parseOnuPosition(vb.oid, baseOid);
    if (!pos) continue;
    map.set(onuPositionKey(pos), vb.value.trim());
  }
  return map;
}

@Injectable()
export class OltBootstrapService {
  private readonly logger = new Logger(OltBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Bootstrap de uma OLT: passo 1 anda ifName (IF-MIB) e guarda so as
   * interfaces GPON; passo 2 anda alias/serial/status de cada ONU
   * cadastrada na OLT. Disparado fire-and-forget na criacao da OLT (ver
   * OltService.create) e sob demanda pelo botao "Sincronizar" (ver
   * OltService.syncGpons) - por isso nunca lanca, so registra o resultado
   * em bootstrapStatus/bootstrapError.
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
      const gponCount = await this.walkGponInterfaces(oltId, session);
      const onuCount = await this.walkOnus(oltId, session);

      await this.prisma.olt.update({
        where: { id: oltId },
        data: { bootstrapStatus: OltBootstrapStatus.ACTIVE, bootstrapCompletedAt: new Date() },
      });
      this.logger.log(
        `Bootstrap concluido para OLT ${olt.name}: ${gponCount} GPON(s), ${onuCount} ONU(s)`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.olt.update({
        where: { id: oltId },
        data: { bootstrapStatus: OltBootstrapStatus.FAILED, bootstrapError: message },
      });
      this.logger.error(`Bootstrap falhou para OLT ${olt.name}: ${message}`);
    } finally {
      session.close();
    }
  }

  /**
   * Cria/atualiza uma unica ONU a partir da trap pROVISIONED (ver
   * TrapReceiverService) - ela ja traz slot/pon/posicao e serial, so falta
   * o alias, que essa trap nao carrega. Em vez de andar as 3 tabelas
   * inteiras de novo (walkOnus), faz so um GET pontual no alias dessa ONU.
   * Fire-and-forget (chamado sem `await` no trap receiver) - nunca lanca,
   * so loga se o GET do alias falhar (a ONU ainda e salva sem alias, que
   * fica pra um proximo "Sincronizar" preencher).
   */
  async upsertOnuFromProvisionedTrap(oltId: string, position: OnuPosition, serialNumber: string): Promise<void> {
    const olt = await this.prisma.olt.findUnique({ where: { id: oltId } });
    if (!olt) return;

    const session = createSnmpSession({
      ipAddress: olt.ipAddress,
      snmpPort: olt.snmpPort,
      community: this.encryption.decrypt(olt.snmpCommunity),
    });

    let alias: string | null = null;
    try {
      const aliasOid = `${ONU_ALIAS_OID}.${position.slotNo}.${position.portNo}.${position.logicalPortNo}`;
      alias = (await getOid(session, aliasOid))?.trim() || null;
    } catch (err) {
      this.logger.warn(
        `Falha ao buscar alias da ONU recem-provisionada (OLT ${olt.name}, ` +
          `${position.slotNo}/${position.portNo}/${position.logicalPortNo}): ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      session.close();
    }

    await this.prisma.onu.upsert({
      where: {
        oltId_slotNo_portNo_logicalPortNo: {
          oltId,
          slotNo: position.slotNo,
          portNo: position.portNo,
          logicalPortNo: position.logicalPortNo,
        },
      },
      create: { oltId, ...position, serialNumber, alias, status: OnuStatus.ACTIVE, lastSeenAt: new Date() },
      update: { serialNumber, alias, status: OnuStatus.ACTIVE, lastSeenAt: new Date() },
    });
  }

  /**
   * Passo 1: anda ifName e substitui (delete + insert) as GponInterface da
   * OLT pelas que comecam com "gpon" (case-insensitive - convencao Parks).
   */
  private async walkGponInterfaces(oltId: string, session: ReturnType<typeof createSnmpSession>): Promise<number> {
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

    return gpons.length;
  }

  /**
   * Passo 2: anda alias/serial/status de cada ONU (3 tabelas Parks
   * indexadas por slot.pon.posicao) e faz upsert em Onu por
   * (oltId, slotNo, portNo, logicalPortNo). So cria/atualiza uma ONU quando
   * ha serial (sem serial nao da pra identificar ela de forma estavel entre
   * walks). Ao contrario de GponInterface, nunca deleta ONUs que sumiram do
   * walk - Alarm/Event tem onDelete: Cascade em onuId, entao apagar a ONU
   * apagaria o historico de alarmes dela junto.
   */
  private async walkOnus(oltId: string, session: ReturnType<typeof createSnmpSession>): Promise<number> {
    const [aliasVarbinds, serialVarbinds, statusVarbinds] = await Promise.all([
      walkSubtree(session, ONU_ALIAS_OID),
      walkSubtree(session, ONU_SERIAL_OID),
      walkSubtree(session, ONU_STATUS_OID),
    ]);

    // Diagnostico temporario: essas 3 tabelas nunca foram validadas contra
    // uma OLT Parks real (so contra um agente SNMP simulado nos testes) -
    // se uma OLT real devolver 0 ONUs, esse log mostra exatamente o que
    // cada walk recebeu (nada, ou algo que nao bateu com o formato
    // esperado) sem precisar reproduzir o problema de novo.
    this.logger.debug(
      `walkOnus (OLT ${oltId}): alias=${aliasVarbinds.length} serial=${serialVarbinds.length} status=${statusVarbinds.length} varbind(s) retornado(s)`,
    );
    for (const [label, varbinds] of [
      ['alias', aliasVarbinds],
      ['serial', serialVarbinds],
      ['status', statusVarbinds],
    ] as const) {
      for (const vb of varbinds.slice(0, 3)) {
        this.logger.debug(`walkOnus sample ${label}: ${vb.oid} = ${JSON.stringify(vb.value)}`);
      }
    }

    const aliasByKey = indexByPosition(aliasVarbinds, ONU_ALIAS_OID);
    const serialByKey = indexByPosition(serialVarbinds, ONU_SERIAL_OID);
    const statusRawByKey = indexByPosition(statusVarbinds, ONU_STATUS_OID);

    let count = 0;
    for (const [key, serialRaw] of serialByKey) {
      const [slotNo, portNo, logicalPortNo] = key.split('.').map(Number);
      const serialNumber = formatOnuSerialNumber(serialRaw);
      const alias = aliasByKey.get(key) || null;
      const statusRaw = statusRawByKey.get(key);
      const status = statusRaw !== undefined ? ONU_STATUS_MAP[Number(statusRaw)] : undefined;

      await this.prisma.onu.upsert({
        where: { oltId_slotNo_portNo_logicalPortNo: { oltId, slotNo, portNo, logicalPortNo } },
        create: {
          oltId,
          slotNo,
          portNo,
          logicalPortNo,
          serialNumber,
          alias,
          status: status ?? OnuStatus.INACTIVE,
          lastSeenAt: new Date(),
        },
        update: {
          serialNumber,
          alias,
          status,
          lastSeenAt: new Date(),
        },
      });
      count += 1;
    }
    return count;
  }
}
