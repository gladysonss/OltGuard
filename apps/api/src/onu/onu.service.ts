import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseOltPortKeys } from '../common/olt-port.util';
import { QueryOnusDto } from './dto/query-onus.dto';

const DEFAULT_PAGE_SIZE = 50;

@Injectable()
export class OnuService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryOnusDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const oltPorts = parseOltPortKeys(query.oltPort);
    // oltPort (GPON individual selecionada na arvore) e mais especifico que
    // oltId - quando presente, substitui em vez de combinar.
    const scopeWhere: Prisma.OnuWhereInput = oltPorts.length
      ? { OR: oltPorts.map((p) => ({ oltId: p.oltId, slotNo: p.slotNo, portNo: p.portNo })) }
      : { oltId: query.oltId?.length ? { in: query.oltId } : undefined };
    // Busca livre por serial/alias - OR proprio, combinado via AND com o
    // resto pra nao colidir com o OR de oltPort acima (mesma chave "OR" num
    // objeto so sobrescreveria o anterior, ver AlarmService.findAll).
    const searchWhere: Prisma.OnuWhereInput | undefined = query.search
      ? {
          OR: [
            { serialNumber: { contains: query.search, mode: 'insensitive' } },
            { alias: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const where: Prisma.OnuWhereInput = {
      AND: [scopeWhere, ...(searchWhere ? [searchWhere] : []), { status: query.status }],
    };

    const [data, total] = await Promise.all([
      this.prisma.onu.findMany({
        where,
        include: { olt: { select: { id: true, name: true } } },
        orderBy: [{ olt: { name: 'asc' } }, { slotNo: 'asc' }, { portNo: 'asc' }, { logicalPortNo: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.onu.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }
}
