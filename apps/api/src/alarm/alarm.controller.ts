import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { AlarmService } from './alarm.service';
import { QueryAlarmsDto } from './dto/query-alarms.dto';
import { ConfirmAlarmDto } from './dto/confirm-alarm.dto';

@Controller('alarms')
export class AlarmController {
  constructor(private readonly alarmService: AlarmService) {}

  @Get()
  findAll(@Query() query: QueryAlarmsDto) {
    return this.alarmService.findAll(query);
  }

  @Get('summary')
  summary(@Query('oltId') oltId?: string) {
    return this.alarmService.summary(oltId);
  }

  @Patch(':id/confirm')
  confirm(@Param('id') id: string, @Body() dto: ConfirmAlarmDto) {
    return this.alarmService.confirm(id, dto);
  }

  @Patch(':id/clear')
  clear(@Param('id') id: string) {
    return this.alarmService.clear(id);
  }

  @Patch(':id/confirm-and-clear')
  confirmAndClear(@Param('id') id: string, @Body() dto: ConfirmAlarmDto) {
    return this.alarmService.confirmAndClear(id, dto);
  }
}
