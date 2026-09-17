import { Controller, Get, Query } from '@nestjs/common';
import { OnuService } from './onu.service';
import { QueryOnusDto } from './dto/query-onus.dto';

@Controller('onus')
export class OnuController {
  constructor(private readonly onuService: OnuService) {}

  @Get()
  findAll(@Query() query: QueryOnusDto) {
    return this.onuService.findAll(query);
  }
}
