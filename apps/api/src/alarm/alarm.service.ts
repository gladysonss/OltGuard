import { Injectable, NotFoundException } from '@nestjs/common';
import { AlarmCondition, AlarmSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAlarmsDto } from './dto/query-alarms.dto';
import { ConfirmAlarmDto } from './dto/confirm-alarm.dto';

@Injectable()
export class AlarmService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryAlarmsDto) {
    return this.prisma.alarm.findMany({
      where: {
        oltId: query.oltId,
        slotNo: query.slotNo,
        portNo: query.portNo,
        severity: query.severity,
        condition: query.condition ?? AlarmCondition.ACTIVE,
      },
      include: {
        olt: { select: { id: true, name: true } },
        onu: { select: { id: true, serialNumber: true } },
      },
      orderBy: { raisedAt: 'desc' },
    });
  }

  /** Contagem de alarmes ativos por severidade - alimenta o grafico de barras. */
  async summary(oltId?: string) {
    const groups = await this.prisma.alarm.groupBy({
      by: ['severity'],
      where: { condition: AlarmCondition.ACTIVE, oltId },
      _count: { _all: true },
    });

    const counts = Object.fromEntries(Object.values(AlarmSeverity).map((s) => [s, 0])) as Record<
      AlarmSeverity,
      number
    >;
    for (const group of groups) {
      counts[group.severity] = group._count._all;
    }
    return counts;
  }

  private async findOneActive(id: string) {
    const alarm = await this.prisma.alarm.findUnique({ where: { id } });
    if (!alarm) {
      throw new NotFoundException(`Alarme ${id} nao encontrado`);
    }
    return alarm;
  }

  async confirm(id: string, dto: ConfirmAlarmDto) {
    await this.findOneActive(id);
    return this.prisma.alarm.update({
      where: { id },
      data: {
        confirmed: true,
        confirmedAt: new Date(),
        confirmedByUserId: dto.confirmedByUserId,
      },
    });
  }

  async clear(id: string) {
    await this.findOneActive(id);
    return this.prisma.alarm.update({
      where: { id },
      data: {
        condition: AlarmCondition.CLEARED,
        severity: AlarmSeverity.CLEAR,
        clearedAt: new Date(),
      },
    });
  }

  async confirmAndClear(id: string, dto: ConfirmAlarmDto) {
    await this.findOneActive(id);
    return this.prisma.alarm.update({
      where: { id },
      data: {
        confirmed: true,
        confirmedAt: new Date(),
        confirmedByUserId: dto.confirmedByUserId,
        condition: AlarmCondition.CLEARED,
        severity: AlarmSeverity.CLEAR,
        clearedAt: new Date(),
      },
    });
  }
}
