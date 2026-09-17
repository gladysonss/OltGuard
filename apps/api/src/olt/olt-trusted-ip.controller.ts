import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { OltTrustedIpService } from './olt-trusted-ip.service';
import { CreateTrustedIpDto } from './dto/create-trusted-ip.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('olts/:oltId/trusted-ips')
export class OltTrustedIpController {
  constructor(private readonly trustedIpService: OltTrustedIpService) {}

  @Get()
  list(@Param('oltId') oltId: string) {
    return this.trustedIpService.listByOlt(oltId);
  }

  @Roles('ADMIN')
  @Post()
  create(@Param('oltId') oltId: string, @Body() dto: CreateTrustedIpDto) {
    return this.trustedIpService.create(oltId, dto);
  }

  @Roles('ADMIN')
  @Delete(':trustedIpId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('oltId') oltId: string, @Param('trustedIpId') trustedIpId: string) {
    return this.trustedIpService.remove(oltId, trustedIpId);
  }
}
