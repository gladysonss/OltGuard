import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CityService } from './city.service';
import { CreateCityDto } from './dto/create-city.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('cities')
export class CityController {
  constructor(private readonly cityService: CityService) {}

  @Get()
  list() {
    return this.cityService.list();
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateCityDto) {
    return this.cityService.create(dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.cityService.remove(id);
  }
}
