import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({ select: USER_SELECT, orderBy: { name: 'asc' } });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Ja existe um usuario com este e-mail');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash, role: dto.role },
      select: USER_SELECT,
    });
  }

  private async findOneOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario ${id} nao encontrado`);
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOneOrThrow(id);

    if (dto.role === 'VIEWER') {
      await this.assertNotLastAdmin(id);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        role: dto.role,
        passwordHash: dto.password ? await bcrypt.hash(dto.password, 10) : undefined,
      },
      select: USER_SELECT,
    });
  }

  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException('Voce nao pode remover a propria conta');
    }
    await this.findOneOrThrow(id);
    await this.assertNotLastAdmin(id);
    await this.prisma.user.delete({ where: { id } });
  }

  /** Impede rebaixar/remover o ultimo ADMIN e deixar o sistema sem ninguem para gerenciar OLTs. */
  private async assertNotLastAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'ADMIN') return;

    const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) {
      throw new BadRequestException('Nao e possivel remover o ultimo administrador do sistema');
    }
  }
}
