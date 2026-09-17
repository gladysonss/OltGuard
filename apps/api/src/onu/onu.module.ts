import { Module } from '@nestjs/common';
import { OnuController } from './onu.controller';
import { OnuService } from './onu.service';

@Module({
  controllers: [OnuController],
  providers: [OnuService],
})
export class OnuModule {}
