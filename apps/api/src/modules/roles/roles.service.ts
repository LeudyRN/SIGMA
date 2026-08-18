import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const ROLE_INCLUDE = {
  rol_permisos: { include: { permisos: true } },
  _count: { select: { usuario_roles: true } },
} as const;

const HIDDEN_ROLE_CODE = 'ADMIN';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const roles = await this.prisma.roles.findMany({
      where: { codigo: { not: HIDDEN_ROLE_CODE } },
      include: ROLE_INCLUDE,
      orderBy: { nombre: 'asc' },
    });
    return { items: roles.map(mapRole), total: roles.length };
  }

  async listPermissions() {
    const permissions = await this.prisma.permisos.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: [{ modulo: 'asc' }, { nombre: 'asc' }],
    });
    return {
      items: permissions.map((permission) => ({
        id: permission.id_permiso.toString(),
        code: permission.codigo,
        name: permission.nombre,
        description: permission.descripcion,
        module: permission.modulo,
      })),
    };
  }

  async get(id: string) {
    const roleId = parseId(id);
    const role = await this.prisma.roles.findFirst({
      where: {
        id_rol: roleId,
        codigo: { not: HIDDEN_ROLE_CODE },
      },
      include: ROLE_INCLUDE,
    });
    if (!role) throw new NotFoundException('Rol no encontrado.');
    return mapRole(role);
  }

  async create(dto: CreateRoleDto) {
    assertManageableRoleCode(dto.code);
    try {
      const role = await this.prisma.roles.create({
        data: {
          codigo: dto.code.trim().toUpperCase(),
          nombre: dto.name.trim(),
          descripcion: dto.description?.trim() || null,
        },
        include: { _count: { select: { usuario_roles: true } } },
      });
      return mapRole({ ...role, rol_permisos: [] });
    } catch {
      throw new ConflictException('Ya existe un rol con ese código o nombre.');
    }
  }

  async update(id: string, dto: UpdateRoleDto) {
    const roleId = parseId(id);
    await this.ensureManageableRole(roleId);
    if (dto.code) assertManageableRoleCode(dto.code);

    try {
      const role = await this.prisma.roles.update({
        where: { id_rol: roleId },
        data: {
          ...(dto.code ? { codigo: dto.code.trim().toUpperCase() } : {}),
          ...(dto.name ? { nombre: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { descripcion: dto.description.trim() || null }
            : {}),
          ...(dto.status ? { estado: dto.status } : {}),
        },
        include: { _count: { select: { usuario_roles: true } } },
      });
      return mapRole({ ...role, rol_permisos: [] });
    } catch {
      throw new ConflictException(
        'No se pudo actualizar el rol. Revisa sus datos únicos.',
      );
    }
  }

  async remove(id: string) {
    const roleId = parseId(id);
    const role = await this.prisma.roles.findFirst({
      where: {
        id_rol: roleId,
        codigo: { not: HIDDEN_ROLE_CODE },
      },
      include: { _count: { select: { usuario_roles: true } } },
    });
    if (!role) throw new NotFoundException('Rol no encontrado.');
    if (role._count.usuario_roles > 0) {
      throw new ConflictException(
        'No puedes eliminar un rol que tiene usuarios asignados.',
      );
    }
    await this.prisma.roles.delete({ where: { id_rol: roleId } });
    return { deleted: true, id };
  }

  async assignPermissions(
    id: string,
    permissionIds: string[],
    actorId: string,
  ) {
    const roleId = parseId(id);
    await this.ensureManageableRole(roleId);
    const parsedPermissionIds = permissionIds.map((permissionId) =>
      parseId(permissionId),
    );
    const availablePermissions = await this.prisma.permisos.count({
      where: {
        id_permiso: { in: parsedPermissionIds },
        estado: 'ACTIVO',
      },
    });
    if (availablePermissions !== parsedPermissionIds.length) {
      throw new BadRequestException(
        'Uno o más permisos no existen o están inactivos.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.rol_permisos.deleteMany({ where: { id_rol: roleId } }),
      this.prisma.rol_permisos.createMany({
        data: parsedPermissionIds.map((permissionId) => ({
          asignado_por: BigInt(actorId),
          id_permiso: permissionId,
          id_rol: roleId,
        })),
      }),
    ]);

    return mapRole(
      await this.prisma.roles.findUniqueOrThrow({
        where: { id_rol: roleId },
        include: ROLE_INCLUDE,
      }),
    );
  }

  private async ensureManageableRole(roleId: bigint) {
    const role = await this.prisma.roles.findFirst({
      where: {
        id_rol: roleId,
        codigo: { not: HIDDEN_ROLE_CODE },
      },
      select: { id_rol: true },
    });
    if (!role) throw new NotFoundException('Rol no encontrado.');
  }
}

function mapRole(role: {
  id_rol: bigint;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
  _count: { usuario_roles: number };
  rol_permisos: Array<{
    permisos: {
      id_permiso: bigint;
      codigo: string;
      nombre: string;
      modulo: string;
    };
  }>;
}) {
  return {
    id: role.id_rol.toString(),
    code: role.codigo,
    name: role.nombre,
    description: role.descripcion,
    status: role.estado,
    userCount: role._count.usuario_roles,
    permissions: role.rol_permisos.map(({ permisos }) => ({
      id: permisos.id_permiso.toString(),
      code: permisos.codigo,
      name: permisos.nombre,
      module: permisos.modulo,
    })),
  };
}

function parseId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador inválido.');
  }
}

function assertManageableRoleCode(value: string) {
  if (value.trim().toUpperCase() === HIDDEN_ROLE_CODE) {
    throw new BadRequestException('El código de rol no está disponible.');
  }
}
