import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { TrapSecurityService, type TrustedOlt, type TrapValidationResult } from './trap-security.service';

const REFRESH_INTERVAL_MS = 30_000;

/**
 * Mantem em memoria a lista de OLTs cadastradas (community descriptografada,
 * usada para identificar de qual OLT veio uma trap - o IP de origem nao serve
 * pra isso quando varias OLTs saem atras do mesmo roteador/NAT) e a lista
 * global de redes autorizadas, para o trap receiver validar cada trap sem
 * bater no banco a cada pacote. Recarrega periodicamente, e sob demanda
 * (refresh()) quando uma OLT ou uma rede autorizada e cadastrada/editada, para
 * nao esperar o intervalo.
 */
@Injectable()
export class OltRegistryService implements OnModuleInit {
  private readonly logger = new Logger(OltRegistryService.name);
  private trustedOlts: TrustedOlt[] = [];
  private allowedNetworks: string[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async onModuleInit() {
    await this.refresh();
    setInterval(() => this.refresh().catch((err) => this.logger.error(err)), REFRESH_INTERVAL_MS);
  }

  async refresh() {
    const [olts, networks] = await Promise.all([
      this.prisma.olt.findMany({
        select: { id: true, name: true, snmpCommunity: true },
      }),
      this.prisma.allowedNetwork.findMany({ select: { cidr: true } }),
    ]);
    this.trustedOlts = olts.map((olt) => ({
      id: olt.id,
      name: olt.name,
      snmpCommunity: this.encryption.decrypt(olt.snmpCommunity),
    }));
    this.allowedNetworks = networks.map((n) => n.cidr);
  }

  validateTrap(trap: { sourceIp: string; community: string; oid: string }): TrapValidationResult {
    return new TrapSecurityService(this.trustedOlts, this.allowedNetworks).validate(trap);
  }
}
