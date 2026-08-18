import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.permisos.findMany({
      orderBy: [{ modulo: 'asc' }, { nombre: 'asc' }],
    });
    return { items: items.map(mapPermission), total: items.length };
  }

  async get(id: string) {
    const permission = await this.prisma.permisos.findUnique({
      where: { id_permiso: parseId(id) },
    });
    if (!permission) throw new NotFoundException('Permiso no encontrado.');
    return mapPermission(permission);
  }

  async create(dto: CreatePermissionDto) {
    try {
      return mapPermission(
        await this.prisma.permisos.create({
          data: {
            codigo: dto.code.trim().toUpperCase(),
            descripcion: dto.description?.trim() || null,
            modulo: dto.module.trim().toUpperCase(),
            nombre: dto.name.trim(),
          },
        }),
      );
    } catch {
      throw new ConflictException(
        'No se pudo crear el permiso. Verifica que el código sea único.',
      );
    }
  }

  async update(id: string, dto: UpdatePermissionDto) {
    try {
      return mapPermission(
        await this.prisma.permisos.update({
          where: { id_permiso: parseId(id) },
          data: {
            ...(dto.code ? { codigo: dto.code.trim().toUpperCase() } : {}),
            ...(dto.name ? { nombre: dto.name.trim() } : {}),
            ...(dto.module ? { modulo: dto.module.trim().toUpperCase() } : {}),
            ...(dto.description !== undefined
              ? { descripcion: dto.description.trim() || null }
              : {}),
            ...(dto.status ? { estado: dto.status } : {}),
          },
        }),
      );
    } catch {
      throw new ConflictException('No se pudo actualizar el permiso.');
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.permisos.delete({
        where: { id_permiso: parseId(id) },
      });
      return { deleted: true, id };
    } catch {
      throw new NotFoundException('Permiso no encontrado.');
    }
  }
}

function mapPermission(permission: {
  id_permiso: bigint;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  modulo: string;
  estado: string;
}) {
  return {
    id: permission.id_permiso.toString(),
    code: permission.codigo,
    name: permission.nombre,
    description: permission.descripcion,
    module: permission.modulo,
    status: permission.estado,
  };
}

function parseId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador inválido.');
  }
}
