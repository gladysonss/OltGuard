import { Controller, Get, Query } from '@nestjs/common';
import { EventService } from './event.service';
import { QueryEventsDto } from './dto/query-events.dto';

@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  findAll(@Query() query: QueryEventsDto) {
    return this.eventService.findAll(query);
  }
}
