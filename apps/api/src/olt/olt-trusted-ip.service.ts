import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OltRegistryService } from './olt-registry.service';
import { CreateTrustedIpDto } from './dto/create-trusted-ip.dto';

@Injectable()
export class OltTrustedIpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: OltRegistryService,
  ) {}

  async listByOlt(oltId: string) {
    await this.assertOltExists(oltId);
    return this.prisma.oltTrustedIp.findMany({ where: { oltId }, orderBy: { createdAt: 'asc' } });
  }

  async create(oltId: string, dto: CreateTrustedIpDto) {
    await this.assertOltExists(oltId);

    const existing = await this.prisma.oltTrustedIp.findUnique({
      where: { oltId_ipAddress: { oltId, ipAddress: dto.ipAddress } },
    });
    if (existing) {
      throw new ConflictException('Este IP ja esta autorizado para esta OLT');
    }

    const created = await this.prisma.oltTrustedIp.create({
      data: { oltId, ipAddress: dto.ipAddress, label: dto.label },
    });
    await this.registry.refresh();
    return created;
  }

  async remove(oltId: string, trustedIpId: string) {
    const trustedIp = await this.prisma.oltTrustedIp.findUnique({ where: { id: trustedIpId } });
    if (!trustedIp || trustedIp.oltId !== oltId) {
      throw new NotFoundException('IP autorizado nao encontrado para esta OLT');
    }
    await this.prisma.oltTrustedIp.delete({ where: { id: trustedIpId } });
    await this.registry.refresh();
  }

  private async assertOltExists(oltId: string) {
    const olt = await this.prisma.olt.findUnique({ where: { id: oltId } });
    if (!olt) {
      throw new NotFoundException(`OLT ${oltId} nao encontrada`);
    }
  }
}
