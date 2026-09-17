import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { AllowedNetworkService } from './allowed-network.service';
import { CreateAllowedNetworkDto } from './dto/create-allowed-network.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('allowed-networks')
export class AllowedNetworkController {
  constructor(private readonly allowedNetworkService: AllowedNetworkService) {}

  @Get()
  list() {
    return this.allowedNetworkService.list();
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateAllowedNetworkDto) {
    return this.allowedNetworkService.create(dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.allowedNetworkService.remove(id);
  }
}
