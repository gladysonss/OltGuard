import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { OltRegistryService } from './olt-registry.service';
import { CreateOltDto } from './dto/create-olt.dto';
import { UpdateOltDto } from './dto/update-olt.dto';

const OLT_SUMMARY_SELECT = {
  id: true,
  name: true,
  ipAddress: true,
  cityId: true,
  city: { select: { id: true, name: true } },
  manufacturer: true,
  snmpPort: true,
  sshUsername: true,
  sshPort: true,
  bootstrapStatus: true,
  bootstrapError: true,
  reconciliationEnabled: true,
  reconciliationIntervalMinutes: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { onus: true } },
};

@Injectable()
export class OltService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly registry: OltRegistryService,
  ) {}

  async create(dto: CreateOltDto) {
    const olt = await this.prisma.olt.create({
      data: {
        name: dto.name,
        ipAddress: dto.ipAddress,
        cityId: dto.cityId,
        manufacturer: dto.manufacturer,
        snmpCommunity: this.encryption.encrypt(dto.snmpCommunity),
        snmpPort: dto.snmpPort ?? 161,
        sshUsername: dto.sshUsername,
        sshPassword: dto.sshPassword ? this.encryption.encrypt(dto.sshPassword) : undefined,
        sshPort: dto.sshPort ?? 22,
      },
      select: OLT_SUMMARY_SELECT,
    });
    await this.registry.refresh();
    return olt;
  }

  async findAll() {
    return this.prisma.olt.findMany({
      select: OLT_SUMMARY_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const olt = await this.prisma.olt.findUnique({
      where: { id },
      select: OLT_SUMMARY_SELECT,
    });
    if (!olt) {
      throw new NotFoundException(`OLT ${id} nao encontrada`);
    }
    return olt;
  }

  async update(id: string, dto: UpdateOltDto) {
    await this.findOne(id);
    const olt = await this.prisma.olt.update({
      where: { id },
      data: {
        name: dto.name,
        ipAddress: dto.ipAddress,
        cityId: dto.cityId,
        manufacturer: dto.manufacturer,
        snmpCommunity: dto.snmpCommunity ? this.encryption.encrypt(dto.snmpCommunity) : undefined,
        snmpPort: dto.snmpPort,
        sshUsername: dto.sshUsername,
        sshPassword: dto.sshPassword ? this.encryption.encrypt(dto.sshPassword) : undefined,
        sshPort: dto.sshPort,
      },
      select: OLT_SUMMARY_SELECT,
    });
    await this.registry.refresh();
    return olt;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.olt.delete({ where: { id } });
    await this.registry.refresh();
  }
}
