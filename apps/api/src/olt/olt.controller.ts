import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { OltService } from './olt.service';
import { CreateOltDto } from './dto/create-olt.dto';
import { UpdateOltDto } from './dto/update-olt.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('olts')
export class OltController {
  constructor(private readonly oltService: OltService) {}

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateOltDto) {
    return this.oltService.create(dto);
  }

  @Get()
  findAll() {
    return this.oltService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.oltService.findOne(id);
  }

  @Get(':id/gpon-interfaces')
  listGponInterfaces(@Param('id') id: string) {
    return this.oltService.listGponInterfaces(id);
  }

  @Roles('ADMIN')
  @Post(':id/sync-gpons')
  syncGpons(@Param('id') id: string) {
    return this.oltService.syncGpons(id);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOltDto) {
    return this.oltService.update(id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.oltService.remove(id);
  }
}
