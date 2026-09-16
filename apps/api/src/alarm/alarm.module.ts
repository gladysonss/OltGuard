import { Module } from '@nestjs/common';
import { AlarmController } from './alarm.controller';
import { AlarmService } from './alarm.service';
import { AlarmIngestService } from './alarm-ingest.service';

@Module({
  controllers: [AlarmController],
  providers: [AlarmService, AlarmIngestService],
  exports: [AlarmIngestService],
})
export class AlarmModule {}
