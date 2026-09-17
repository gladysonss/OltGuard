import { Injectable, NotFoundException } from '@nestjs/common';
import { AlarmCondition, AlarmSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAlarmsDto } from './dto/query-alarms.dto';
import { ConfirmAlarmDto } from './dto/confirm-alarm.dto';

@Injectable()
export class AlarmService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryAlarmsDto) {
    const condition = query.condition ?? AlarmCondition.ACTIVE;
    return this.prisma.alarm.findMany({
      where: {
        oltId: query.oltId,
        slotNo: query.slotNo,
        portNo: query.portNo,
        severity: query.severity,
        condition,
        olt: query.neStatus ? { reachable: query.neStatus === 'active' } : undefined,
      },
      include: {
        olt: { select: { id: true, name: true, reachable: true } },
        onu: { select: { id: true, serialNumber: true } },
      },
      // Historico (CLEARED) ordena por quando foi resolvido, nao por quando comecou,
      // e e limitado pra nao devolver a tabela inteira conforme ela cresce.
      orderBy: condition === AlarmCondition.CLEARED ? { clearedAt: 'desc' } : { raisedAt: 'desc' },
      take: condition === AlarmCondition.CLEARED ? 200 : undefined,
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
