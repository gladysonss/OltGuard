import { Injectable, Logger } from '@nestjs/common';
import { AlarmCondition, AlarmSeverity, AlarmSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SEVERITY_MAP: Record<'info' | 'minor' | 'major' | 'critical', AlarmSeverity> = {
  info: AlarmSeverity.INFO,
  minor: AlarmSeverity.MINOR,
  major: AlarmSeverity.MAJOR,
  critical: AlarmSeverity.CRITICAL,
};

export interface ParsedTrapAlarm {
  oltId: string;
  trapOid: string;
  mibName: string;
  /** Explicacao em portugues do que o alarme/evento significa (ver ParksTrapDefinition.description). */
  description: string;
  severity: 'info' | 'minor' | 'major' | 'critical';
  isAlarm: boolean;
  /** undefined para traps de evento (sem par de limpeza); presente para traps de alarme. */
  condition?: 'CLEAR' | 'SET';
  slotNo: number;
  portNo?: number;
  logicalPortNo?: number;
  serialNumber?: string;
}

@Injectable()
export class AlarmIngestService {
  private readonly logger = new Logger(AlarmIngestService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingest(trap: ParsedTrapAlarm) {
    const source = this.resolveSource(trap);
    const onu = trap.serialNumber
      ? await this.prisma.onu.findFirst({
          where: { oltId: trap.oltId, serialNumber: trap.serialNumber },
        })
      : null;

    if (!trap.isAlarm) {
      return this.recordEvent(trap, source, onu?.id ?? null);
    }

    if (trap.condition === 'CLEAR') {
      return this.clearMatchingAlarm(trap, source);
    }

    return this.raiseOrRefreshAlarm(trap, source, onu?.id ?? null);
  }

  /**
   * Traps dos grupos "Event"/"Avc" (isAlarm: false) nao tem par de limpeza -
   * cada ocorrencia vira uma linha nova aqui, sem estado ACTIVE/CLEARED como
   * o Alarm tem. Mantidas separadas pra nao entupir a tela de Alarmes com
   * coisas que nao sao problemas em aberto (ver GPON-OLT-FAULT.mib: grupos
   * "Alarm" tem oltAlarmCondition, grupos "Event"/"Avc" nao).
   */
  private async recordEvent(trap: ParsedTrapAlarm, source: AlarmSource, onuId: string | null) {
    return this.prisma.event.create({
      data: {
        oltId: trap.oltId,
        onuId,
        source,
        slotNo: trap.slotNo,
        portNo: trap.portNo,
        logicalPortNo: trap.logicalPortNo,
        trapOid: trap.trapOid,
        eventName: trap.mibName,
        description: trap.description,
        severity: SEVERITY_MAP[trap.severity],
        occurredAt: new Date(),
      },
    });
  }

  private resolveSource(trap: ParsedTrapAlarm): AlarmSource {
    if (trap.logicalPortNo !== undefined) return AlarmSource.ONU;
    if (trap.portNo !== undefined) return AlarmSource.PON_LINK;
    return AlarmSource.OLT;
  }

  private async clearMatchingAlarm(trap: ParsedTrapAlarm, source: AlarmSource) {
    const active = await this.prisma.alarm.findFirst({
      where: {
        oltId: trap.oltId,
        trapOid: trap.trapOid,
        source,
        slotNo: trap.slotNo,
        portNo: trap.portNo ?? null,
        logicalPortNo: trap.logicalPortNo ?? null,
        condition: AlarmCondition.ACTIVE,
      },
    });

    if (!active) {
      this.logger.debug(`Trap de limpeza sem alarme ativo correspondente: ${trap.mibName}`);
      return null;
    }

    return this.prisma.alarm.update({
      where: { id: active.id },
      data: { condition: AlarmCondition.CLEARED, severity: AlarmSeverity.CLEAR, clearedAt: new Date() },
    });
  }

  private async raiseOrRefreshAlarm(trap: ParsedTrapAlarm, source: AlarmSource, onuId: string | null) {
    const existing = await this.prisma.alarm.findFirst({
      where: {
        oltId: trap.oltId,
        trapOid: trap.trapOid,
        source,
        slotNo: trap.slotNo,
        portNo: trap.portNo ?? null,
        logicalPortNo: trap.logicalPortNo ?? null,
        condition: AlarmCondition.ACTIVE,
      },
    });

    if (existing) {
      return this.prisma.alarm.update({ where: { id: existing.id }, data: { raisedAt: new Date() } });
    }

    return this.prisma.alarm.create({
      data: {
        oltId: trap.oltId,
        onuId,
        source,
        slotNo: trap.slotNo,
        portNo: trap.portNo,
        logicalPortNo: trap.logicalPortNo,
        trapOid: trap.trapOid,
        alarmName: trap.mibName,
        description: trap.description,
        severity: SEVERITY_MAP[trap.severity],
        condition: AlarmCondition.ACTIVE,
        raisedAt: new Date(),
      },
    });
  }
}
