import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const snmp = require('net-snmp');

const TICK_INTERVAL_MS = 60_000;
const GET_TIMEOUT_MS = 5_000;
const SYS_UPTIME_OID = '1.3.6.1.2.1.1.3.0';

interface OltHealthCheckTarget {
  id: string;
  ipAddress: string;
  snmpCommunity: string;
  snmpPort: number;
  reconciliationIntervalMinutes: number;
  lastPolledAt: Date | null;
}

/**
 * Trap nao serve como heartbeat - e um aviso pontual, uma OLT saudavel pode
 * ficar horas sem mandar nada porque nao tem nada pra alarmar. Pra saber de
 * verdade se uma OLT esta alcancavel (Active/Inactive NE), a app precisa
 * perguntar: um SNMP GET simples (sysUpTime) periodico, no intervalo
 * configurado por OLT (reconciliationIntervalMinutes).
 */
@Injectable()
export class OltHealthCheckService implements OnModuleInit {
  private readonly logger = new Logger(OltHealthCheckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  onModuleInit() {
    setInterval(() => this.tick().catch((err) => this.logger.error(err)), TICK_INTERVAL_MS);
  }

  private async tick() {
    const olts = await this.prisma.olt.findMany({
      where: { reconciliationEnabled: true },
      select: {
        id: true,
        ipAddress: true,
        snmpCommunity: true,
        snmpPort: true,
        reconciliationIntervalMinutes: true,
        lastPolledAt: true,
      },
    });

    const now = Date.now();
    for (const olt of olts) {
      const dueInMs = olt.reconciliationIntervalMinutes * 60_000;
      if (olt.lastPolledAt && now - olt.lastPolledAt.getTime() < dueInMs) {
        continue;
      }
      this.checkOlt(olt).catch((err) => this.logger.error(`Falha ao checar OLT ${olt.id}: ${err.message}`));
    }
  }

  private async checkOlt(olt: OltHealthCheckTarget) {
    const community = this.encryption.decrypt(olt.snmpCommunity);
    const reachable = await this.probe(olt.ipAddress, olt.snmpPort, community);
    const polledAt = new Date();

    await this.prisma.olt.update({
      where: { id: olt.id },
      data: {
        reachable,
        lastPolledAt: polledAt,
        ...(reachable ? { lastSeenAt: polledAt } : {}),
      },
    });

    this.logger.debug(`OLT ${olt.id} (${olt.ipAddress}): ${reachable ? 'alcancavel' : 'inalcancavel'}`);
  }

  private probe(ipAddress: string, port: number, community: string): Promise<boolean> {
    return new Promise((resolve) => {
      const session = snmp.createSession(ipAddress, community, {
        port,
        timeout: GET_TIMEOUT_MS,
        retries: 0,
      });

      session.get([SYS_UPTIME_OID], (error: Error | null) => {
        session.close();
        resolve(!error);
      });
    });
  }
}
