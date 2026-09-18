import { Injectable, NotFoundException } from '@nestjs/common';
import { AlarmCondition, AlarmSeverity, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseOltPortKeys } from '../common/olt-port.util';
import { QueryAlarmsDto } from './dto/query-alarms.dto';
import { ConfirmAlarmDto } from './dto/confirm-alarm.dto';

const DEFAULT_PAGE_SIZE = 50;

const SEVERITY_RANK: Record<AlarmSeverity, number> = {
  CLEAR: 0,
  INFO: 1,
  WARNING: 2,
  MINOR: 3,
  MAJOR: 4,
  CRITICAL: 5,
};

@Injectable()
export class AlarmService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryAlarmsDto) {
    // condition omitido = Todos (ativos + historico). ACTIVE ou CLEARED filtra so um dos dois.
    const condition = query.condition;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const oltPorts = parseOltPortKeys(query.oltPort);
    // onuId/removedOnuId (botao "Ver alarmes" na aba ONUs) e o filtro mais
    // especifico de todos - substitui oltPort/oltId/slotNo/portNo por
    // completo, ja que uma ONU so pertence a uma OLT/posicao.
    const scopeWhere: Prisma.AlarmWhereInput =
      query.onuId || query.removedOnuId
        ? { onuId: query.onuId, removedOnuId: query.removedOnuId }
        : oltPorts.length
          ? { OR: oltPorts.map((p) => ({ oltId: p.oltId, slotNo: p.slotNo, portNo: p.portNo })) }
          : {
              oltId: query.oltId?.length ? { in: query.oltId } : undefined,
              slotNo: query.slotNo,
              portNo: query.portNo,
            };
    // Busca livre por ONU (serial/alias) - OR proprio, combinado via AND com
    // o resto pra nao colidir com o OR de oltPorts acima (mesma chave "OR"
    // num objeto so sobrescreveria a anterior).
    const searchWhere: Prisma.AlarmWhereInput | undefined = query.onuSearch
      ? {
          OR: [
            { serialNumber: { contains: query.onuSearch, mode: 'insensitive' } },
            { onu: { serialNumber: { contains: query.onuSearch, mode: 'insensitive' } } },
            { onu: { alias: { contains: query.onuSearch, mode: 'insensitive' } } },
            { removedOnu: { serialNumber: { contains: query.onuSearch, mode: 'insensitive' } } },
            { removedOnu: { alias: { contains: query.onuSearch, mode: 'insensitive' } } },
          ],
        }
      : undefined;
    const where: Prisma.AlarmWhereInput = {
      AND: [
        scopeWhere,
        ...(searchWhere ? [searchWhere] : []),
        {
          logicalPortNo: query.onuId || query.removedOnuId ? undefined : query.logicalPortNo,
          severity: query.severity?.length ? { in: query.severity } : undefined,
          condition,
          raisedAt:
            query.from || query.to
              ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined }
              : undefined,
        },
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.alarm.findMany({
        where,
        include: {
          // city incluida pra distinguir OLTs com nomes iguais em cidades
          // diferentes na tabela de Alarmes (ver AlarmsPage.tsx).
          olt: { select: { id: true, name: true, city: { select: { id: true, name: true } } } },
          // removedOnu cobre o caso da ONU ja ter sido removida (ver
          // OnuRemoved) depois que o alarme foi levantado - sem isso a
          // coluna de identificacao do cliente ficaria vazia pra todo
          // alarme historico de uma posicao que ja nao existe mais.
          onu: { select: { id: true, serialNumber: true, alias: true } },
          removedOnu: { select: { id: true, serialNumber: true, alias: true } },
        },
        // Historico (CLEARED) ordena por quando foi resolvido; Ativos e Todos
        // por quando foi levantado.
        orderBy: condition === AlarmCondition.CLEARED ? { clearedAt: 'desc' } : { raisedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.alarm.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  /** Contagem de alarmes ativos por severidade - alimenta o grafico de barras. */
  async summary(oltIds?: string[], oltPortKeys?: string[]) {
    const oltPorts = parseOltPortKeys(oltPortKeys);
    const groups = await this.prisma.alarm.groupBy({
      by: ['severity'],
      where: {
        condition: AlarmCondition.ACTIVE,
        ...(oltPorts.length
          ? { OR: oltPorts.map((p) => ({ oltId: p.oltId, slotNo: p.slotNo, portNo: p.portNo })) }
          : { oltId: oltIds?.length ? { in: oltIds } : undefined }),
      },
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

  /**
   * Pior severidade ativa por OLT - usado pra colorir o indicador de cada OLT
   * na arvore da tela de Alarmes. Precisa ser independente de paginacao/
   * filtros da lista principal, senao uma OLT sem alarme na pagina atual
   * apareceria como "sem problema" mesmo tendo alarmes criticos ativos.
   */
  async summaryByOlt(): Promise<Record<string, AlarmSeverity>> {
    const groups = await this.prisma.alarm.groupBy({
      by: ['oltId', 'severity'],
      where: { condition: AlarmCondition.ACTIVE },
      _count: { _all: true },
    });

    const worst: Record<string, AlarmSeverity> = {};
    for (const group of groups) {
      const current = worst[group.oltId];
      if (!current || SEVERITY_RANK[group.severity] > SEVERITY_RANK[current]) {
        worst[group.oltId] = group.severity;
      }
    }
    return worst;
  }

  /**
   * Pior severidade ativa por GPON (oltId:slotNo:portNo, mesma chave de
   * `oltPort`/`gponKey()` no front) - usado pra colorir o indicador de cada
   * GPON na sub-arvore de uma OLT, igual ja existe por OLT (summaryByOlt).
   * Agrupa alarmes de ONU e de PON-link juntos (ambos tem portNo setado -
   * so alarmes de nivel OLT, sem porta, ficam de fora) porque os dois tipos
   * sao "problema nessa GPON" pra quem esta olhando a arvore.
   */
  async summaryByGpon(): Promise<Record<string, AlarmSeverity>> {
    const groups = await this.prisma.alarm.groupBy({
      by: ['oltId', 'slotNo', 'portNo', 'severity'],
      where: { condition: AlarmCondition.ACTIVE, portNo: { not: null } },
      _count: { _all: true },
    });

    const worst: Record<string, AlarmSeverity> = {};
    for (const group of groups) {
      if (group.portNo === null) continue;
      const key = `${group.oltId}:${group.slotNo}:${group.portNo}`;
      const current = worst[key];
      if (!current || SEVERITY_RANK[group.severity] > SEVERITY_RANK[current]) {
        worst[key] = group.severity;
      }
    }
    return worst;
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

  /**
   * So marca condition: CLEARED (+ clearedAt) - a severidade original
   * (ex: MAJOR, CRITICAL) e mantida, nao vira CLEAR. Quem indica que o
   * alarme foi resolvido e o condition, nao a severidade; sobrescrever a
   * severidade perderia a informacao de quao grave o problema era.
   */
  async clear(id: string) {
    await this.findOneActive(id);
    return this.prisma.alarm.update({
      where: { id },
      data: {
        condition: AlarmCondition.CLEARED,
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
        clearedAt: new Date(),
      },
    });
  }
}
