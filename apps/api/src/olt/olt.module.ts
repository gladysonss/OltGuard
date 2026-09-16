import { Module } from '@nestjs/common';
import { OltController } from './olt.controller';
import { OltService } from './olt.service';
import { EncryptionService } from '../common/encryption.service';
import { OltRegistryService } from './olt-registry.service';
import { TrapReceiverService } from './trap-receiver.service';
import { AlarmModule } from '../alarm/alarm.module';

@Module({
  imports: [AlarmModule],
  controllers: [OltController],
  providers: [OltService, EncryptionService, OltRegistryService, TrapReceiverService],
})
export class OltModule {}
