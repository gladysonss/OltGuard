import { Injectable, NotFoundException } from '@nestjs/common';
import { AlarmCondition, AlarmSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAlarmsDto } from './dto/query-alarms.dto';
import { ConfirmAlarmDto } from './dto/confirm-alarm.dto';

@Injectable()
export class AlarmService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryAlarmsDto) {
    // condition omitido = Todos (ativos + historico). ACTIVE ou CLEARED filtra so um dos dois.
    const condition = query.condition;
    return this.prisma.alarm.findMany({
      where: {
        oltId: query.oltId,
        slotNo: query.slotNo,
        portNo: query.portNo,
        logicalPortNo: query.logicalPortNo,
        severity: query.severity?.length ? { in: query.severity } : undefined,
        condition,
        raisedAt:
          query.from || query.to
            ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined }
            : undefined,
      },
      include: {
        olt: { select: { id: true, name: true } },
        onu: { select: { id: true, serialNumber: true } },
      },
      // Historico (CLEARED) ordena por quando foi resolvido; Ativos e Todos por
      // quando foi levantado. CLEARED e Todos sao limitados pra nao devolver a
      // tabela inteira conforme ela cresce.
      orderBy: condition === AlarmCondition.CLEARED ? { clearedAt: 'desc' } : { raisedAt: 'desc' },
      take: condition === AlarmCondition.ACTIVE ? undefined : 200,
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
