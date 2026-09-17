import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryEventsDto } from './dto/query-events.dto';

const DEFAULT_PAGE_SIZE = 50;

@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryEventsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = { oltId: query.oltId?.length ? { in: query.oltId } : undefined };

    const [data, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          olt: { select: { id: true, name: true } },
          onu: { select: { id: true, serialNumber: true } },
        },
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.event.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }
}
