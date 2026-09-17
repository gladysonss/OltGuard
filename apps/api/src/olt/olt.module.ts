import { Module } from '@nestjs/common';
import { OltController } from './olt.controller';
import { OltService } from './olt.service';
import { EncryptionService } from '../common/encryption.service';
import { OltRegistryService } from './olt-registry.service';
import { OltBootstrapService } from './olt-bootstrap.service';
import { TrapReceiverService } from './trap-receiver.service';
import { TrapController } from './trap.controller';
import { AllowedNetworkService } from './allowed-network.service';
import { AllowedNetworkController } from './allowed-network.controller';
import { CityService } from './city.service';
import { CityController } from './city.controller';
import { AlarmModule } from '../alarm/alarm.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AlarmModule, AuthModule],
  controllers: [OltController, TrapController, AllowedNetworkController, CityController],
  providers: [
    OltService,
    EncryptionService,
    OltRegistryService,
    OltBootstrapService,
    TrapReceiverService,
    AllowedNetworkService,
    CityService,
  ],
})
export class OltModule {}
