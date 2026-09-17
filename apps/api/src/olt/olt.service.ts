import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { OltRegistryService } from './olt-registry.service';
import { OltBootstrapService } from './olt-bootstrap.service';
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
    private readonly bootstrap: OltBootstrapService,
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
    // Fire-and-forget: walkGpons nunca lanca (erro vira bootstrapStatus
    // FAILED), entao nao precisa bloquear a resposta do cadastro nem tratar
    // rejeicao aqui.
    void this.bootstrap.walkGpons(olt.id);
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

  async listGponInterfaces(oltId: string) {
    await this.findOne(oltId);
    return this.prisma.gponInterface.findMany({ where: { oltId }, orderBy: { ifIndex: 'asc' } });
  }

  async listOnus(oltId: string) {
    await this.findOne(oltId);
    return this.prisma.onu.findMany({
      where: { oltId },
      orderBy: [{ slotNo: 'asc' }, { portNo: 'asc' }, { logicalPortNo: 'asc' }],
    });
  }

  /**
   * Sincronizacao manual do bootstrap (walk de GPONs + ONUs) - pras OLTs
   * cadastradas antes dessa feature existir (bootstrapStatus ainda PENDING,
   * nunca andou) ou pra tentar de novo depois de uma falha. Ao contrario do
   * disparo automatico em create() (fire-and-forget), aqui o caller pediu
   * explicitamente e espera ver o resultado, entao awaita o walk inteiro
   * antes de responder.
   */
  async syncGpons(oltId: string) {
    await this.findOne(oltId);
    await this.bootstrap.walkGpons(oltId);
    return this.findOne(oltId);
  }
}
