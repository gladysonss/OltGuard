import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryEventsDto } from './dto/query-events.dto';

const RECENT_EVENTS_LIMIT = 200;

@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryEventsDto) {
    return this.prisma.event.findMany({
      where: { oltId: query.oltId },
      include: {
        olt: { select: { id: true, name: true } },
        onu: { select: { id: true, serialNumber: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: RECENT_EVENTS_LIMIT,
    });
  }
}
