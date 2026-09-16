import { Module } from '@nestjs/common';
import { OltController } from './olt.controller';
import { OltService } from './olt.service';
import { EncryptionService } from '../common/encryption.service';

@Module({
  controllers: [OltController],
  providers: [OltService, EncryptionService],
})
export class OltModule {}
