import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OltRegistryService } from './olt-registry.service';
import { CreateAllowedNetworkDto } from './dto/create-allowed-network.dto';

@Injectable()
export class AllowedNetworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: OltRegistryService,
  ) {}

  list() {
    return this.prisma.allowedNetwork.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async create(dto: CreateAllowedNetworkDto) {
    const existing = await this.prisma.allowedNetwork.findUnique({ where: { cidr: dto.cidr } });
    if (existing) {
      throw new ConflictException('Este IP/rede ja esta autorizado');
    }

    const created = await this.prisma.allowedNetwork.create({
      data: { cidr: dto.cidr, label: dto.label },
    });
    await this.registry.refresh();
    return created;
  }

  async remove(id: string) {
    const network = await this.prisma.allowedNetwork.findUnique({ where: { id } });
    if (!network) {
      throw new NotFoundException('IP/rede autorizada nao encontrada');
    }
    await this.prisma.allowedNetwork.delete({ where: { id } });
    await this.registry.refresh();
  }
}
