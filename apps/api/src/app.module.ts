import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { OltModule } from './olt/olt.module';
import { AlarmModule } from './alarm/alarm.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, OltModule, AlarmModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
