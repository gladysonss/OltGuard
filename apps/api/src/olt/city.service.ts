import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCityDto } from './dto/create-city.dto';

@Injectable()
export class CityService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.city.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateCityDto) {
    const existing = await this.prisma.city.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('Esta cidade ja esta cadastrada');
    }
    return this.prisma.city.create({ data: { name: dto.name } });
  }

  async remove(id: string) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      include: { _count: { select: { olts: true } } },
    });
    if (!city) {
      throw new NotFoundException('Cidade nao encontrada');
    }
    if (city._count.olts > 0) {
      throw new ConflictException('Existem OLTs cadastradas nessa cidade - troque a cidade delas antes de remover');
    }
    await this.prisma.city.delete({ where: { id } });
  }
}
