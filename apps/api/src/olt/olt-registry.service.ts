import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { TrapSecurityService, type TrustedOlt, type TrapValidationResult } from './trap-security.service';

const REFRESH_INTERVAL_MS = 30_000;

/**
 * Mantem em memoria a lista de OLTs cadastradas (ip + community descriptografada)
 * para o trap receiver validar a origem de cada trap sem bater no banco a cada pacote.
 * Recarrega periodicamente para pegar OLTs recem-cadastradas/editadas.
 */
@Injectable()
export class OltRegistryService implements OnModuleInit {
  private readonly logger = new Logger(OltRegistryService.name);
  private trustedOlts: TrustedOlt[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async onModuleInit() {
    await this.refresh();
    setInterval(() => this.refresh().catch((err) => this.logger.error(err)), REFRESH_INTERVAL_MS);
  }

  async refresh() {
    const olts = await this.prisma.olt.findMany({
      select: { id: true, ipAddress: true, snmpCommunity: true },
    });
    this.trustedOlts = olts.map((olt) => ({
      id: olt.id,
      ipAddress: olt.ipAddress,
      snmpCommunity: this.encryption.decrypt(olt.snmpCommunity),
    }));
  }

  validateTrap(trap: { sourceIp: string; community: string; oid: string }): TrapValidationResult {
    return new TrapSecurityService(this.trustedOlts).validate(trap);
  }
}
