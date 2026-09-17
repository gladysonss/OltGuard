import { Module } from '@nestjs/common';
import { OltController } from './olt.controller';
import { OltService } from './olt.service';
import { EncryptionService } from '../common/encryption.service';
import { OltRegistryService } from './olt-registry.service';
import { TrapReceiverService } from './trap-receiver.service';
import { TrapController } from './trap.controller';
import { OltTrustedIpService } from './olt-trusted-ip.service';
import { OltTrustedIpController } from './olt-trusted-ip.controller';
import { AlarmModule } from '../alarm/alarm.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AlarmModule, AuthModule],
  controllers: [OltController, TrapController, OltTrustedIpController],
  providers: [OltService, EncryptionService, OltRegistryService, TrapReceiverService, OltTrustedIpService],
})
export class OltModule {}
