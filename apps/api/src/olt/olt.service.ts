import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { OltRegistryService } from './olt-registry.service';
import { CreateOltDto } from './dto/create-olt.dto';
import { UpdateOltDto } from './dto/update-olt.dto';

const OLT_SUMMARY_SELECT = {
  id: true,
  name: true,
  ipAddress: true,
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
    await this.assertCommunityUnique(dto.snmpCommunity);
    const olt = await this.prisma.olt.create({
      data: {
        name: dto.name,
        ipAddress: dto.ipAddress,
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
    if (dto.snmpCommunity) {
      await this.assertCommunityUnique(dto.snmpCommunity, id);
    }
    const olt = await this.prisma.olt.update({
      where: { id },
      data: {
        name: dto.name,
        ipAddress: dto.ipAddress,
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

  /**
   * A community identifica de qual OLT veio uma trap (ver trap-security.service.ts) -
   * duas OLTs com a mesma community seriam indistinguiveis. A comparacao e feita
   * descriptografando, ja que o AES-GCM usado gera ciphertexts diferentes para o
   * mesmo texto, entao um @unique no banco nao pegaria duplicatas.
   */
  private async assertCommunityUnique(community: string, excludeId?: string) {
    const others = await this.prisma.olt.findMany({
      where: excludeId ? { id: { not: excludeId } } : undefined,
      select: { snmpCommunity: true },
    });
    const duplicate = others.some((o) => this.encryption.decrypt(o.snmpCommunity) === community);
    if (duplicate) {
      throw new ConflictException(
        'Esta community SNMP ja esta em uso por outra OLT - cada OLT precisa de uma community unica para ser identificada nas traps',
      );
    }
  }
}
