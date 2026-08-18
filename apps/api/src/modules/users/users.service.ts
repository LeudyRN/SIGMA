import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_INCLUDE = {
  usuario_roles_usuario_roles_id_usuarioTousuarios: {
    include: { roles: true },
  },
} as const;

const EXCLUDED_USER_ROLE_CODES = ['ADMIN', 'ESTUDIANTE'];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async list(search?: string) {
    const term = search?.trim();
    const users = await this.prisma.usuarios.findMany({
      where: {
        deleted_at: null,
        usuario_roles_usuario_roles_id_usuarioTousuarios: {
          none: { roles: { codigo: { in: EXCLUDED_USER_ROLE_CODES } } },
        },
        ...(term
          ? {
              OR: [
                { codigo_empleado: { contains: term } },
                { nombres: { contains: term } },
                { apellidos: { contains: term } },
                { email: { contains: term } },
              ],
            }
          : {}),
      },
      include: USER_INCLUDE,
      orderBy: [{ estado: 'asc' }, { apellidos: 'asc' }, { nombres: 'asc' }],
      take: 100,
    });

    return { items: users.map(mapUser), total: users.length };
  }

  async get(id: string) {
    const user = await this.prisma.usuarios.findFirst({
      where: {
        id_usuario: parseId(id),
        deleted_at: null,
        usuario_roles_usuario_roles_id_usuarioTousuarios: {
          none: { roles: { codigo: { in: EXCLUDED_USER_ROLE_CODES } } },
        },
      },
      include: USER_INCLUDE,
    });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return mapUser(user);
  }

  async create(dto: CreateUserDto, actorId: string) {
    const employeeCode = normalize(dto.employeeCode);
    if (!employeeCode)
      throw new BadRequestException('El código de empleado es obligatorio.');

    try {
      const user = await this.prisma.$transaction(async (database) => {
        const created = await database.usuarios.create({
          data: {
            apellidos: dto.lastName.trim(),
            codigo_empleado: employeeCode,
            email: dto.email.trim().toLowerCase(),
            estado: 'ACTIVO',
            matricula: null,
            nombres: dto.firstName.trim(),
            password_hash: await this.auth.hashPassword(dto.password),
            uuid: randomUUID(),
          },
        });

        const roleIds = dto.roleIds.map((roleId) => BigInt(roleId));
        const roles = await database.roles.findMany({
          where: {
            id_rol: { in: roleIds },
            codigo: { notIn: EXCLUDED_USER_ROLE_CODES },
            estado: 'ACTIVO',
          },
        });
        if (roles.length !== roleIds.length) {
          throw new BadRequestException(
            'El rol seleccionado no está disponible.',
          );
        }

        await database.usuario_roles.createMany({
          data: dto.roleIds.map((roleId) => ({
            asignado_por: BigInt(actorId),
            id_rol: BigInt(roleId),
            id_usuario: created.id_usuario,
          })),
        });

        if (roles.some((role) => role.codigo === 'DOCENTE')) {
          await database.docentes.create({
            data: {
              codigo_docente: employeeCode,
              estado: 'ACTIVO',
              id_usuario: created.id_usuario,
            },
          });
        }

        return database.usuarios.findUniqueOrThrow({
          where: { id_usuario: created.id_usuario },
          include: USER_INCLUDE,
        });
      });

      return mapUser(user);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ConflictException(
        'No se pudo crear el usuario. Verifica que el correo y el código de empleado sean únicos y que el rol exista.',
      );
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const userId = parseId(id);
    try {
      const user = await this.prisma.usuarios.update({
        where: { id_usuario: userId, deleted_at: null },
        data: {
          ...(dto.firstName ? { nombres: dto.firstName.trim() } : {}),
          ...(dto.lastName ? { apellidos: dto.lastName.trim() } : {}),
          ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
          ...(dto.password
            ? { password_hash: await this.auth.hashPassword(dto.password) }
            : {}),
          ...(dto.employeeCode
            ? { codigo_empleado: normalize(dto.employeeCode) }
            : {}),
          ...(dto.status ? { estado: dto.status } : {}),
        },
        include: USER_INCLUDE,
      });
      if (dto.employeeCode) {
        await this.prisma.docentes.updateMany({
          where: { id_usuario: userId },
          data: { codigo_docente: normalize(dto.employeeCode) ?? undefined },
        });
      }
      return mapUser(user);
    } catch {
      throw new ConflictException(
        'No se pudo actualizar el usuario. Revisa los datos únicos enviados.',
      );
    }
  }

  async assignRoles(id: string, roleIds: string[], actorId: string) {
    const userId = parseId(id);
    const exists = await this.prisma.usuarios.count({
      where: { id_usuario: userId, deleted_at: null },
    });
    if (!exists) throw new NotFoundException('Usuario no encontrado.');

    const selectedRoles = await this.prisma.roles.findMany({
      where: {
        id_rol: { in: roleIds.map((roleId) => BigInt(roleId)) },
        codigo: { notIn: EXCLUDED_USER_ROLE_CODES },
        estado: 'ACTIVO',
      },
    });
    if (selectedRoles.length !== roleIds.length) {
      throw new BadRequestException('El rol seleccionado no está disponible.');
    }

    const userData = await this.prisma.usuarios.findUniqueOrThrow({
      where: { id_usuario: userId },
      select: { codigo_empleado: true },
    });
    const isTeacher = selectedRoles.some((role) => role.codigo === 'DOCENTE');
    if (isTeacher && !userData.codigo_empleado) {
      throw new BadRequestException(
        'Debes asignar un código de empleado antes de seleccionar el rol Docente.',
      );
    }

    await this.prisma.$transaction(async (database) => {
      await database.usuario_roles.deleteMany({
        where: { id_usuario: userId },
      });
      await database.usuario_roles.createMany({
        data: roleIds.map((roleId) => ({
          asignado_por: BigInt(actorId),
          id_rol: BigInt(roleId),
          id_usuario: userId,
        })),
      });
      if (isTeacher && userData.codigo_empleado) {
        await database.docentes.upsert({
          where: { id_usuario: userId },
          update: {
            codigo_docente: userData.codigo_empleado,
            estado: 'ACTIVO',
          },
          create: {
            codigo_docente: userData.codigo_empleado,
            estado: 'ACTIVO',
            id_usuario: userId,
          },
        });
      } else {
        await database.docentes.updateMany({
          where: { id_usuario: userId },
          data: { estado: 'INACTIVO' },
        });
      }
    });

    const user = await this.prisma.usuarios.findUniqueOrThrow({
      where: { id_usuario: userId },
      include: USER_INCLUDE,
    });
    return mapUser(user);
  }

  async remove(id: string, actorId: string) {
    const userId = parseId(id);
    if (userId === parseId(actorId)) {
      throw new BadRequestException(
        'No puedes eliminar tu propia cuenta activa.',
      );
    }

    const exists = await this.prisma.usuarios.findFirst({
      where: { id_usuario: userId, deleted_at: null },
      select: { id_usuario: true },
    });
    if (!exists) throw new NotFoundException('Usuario no encontrado.');

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.sesiones.updateMany({
        where: { id_usuario: userId, revocada_at: null },
        data: { revocada_at: now },
      }),
      this.prisma.docentes.updateMany({
        where: { id_usuario: userId },
        data: { estado: 'INACTIVO' },
      }),
      this.prisma.usuarios.update({
        where: { id_usuario: userId },
        data: { deleted_at: now, estado: 'INACTIVO' },
      }),
    ]);
    return { deleted: true, id };
  }
}

function mapUser(user: {
  id_usuario: bigint;
  uuid: string;
  matricula: string | null;
  codigo_empleado: string | null;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  estado: string;
  ultimo_acceso_at: Date | null;
  created_at: Date;
  usuario_roles_usuario_roles_id_usuarioTousuarios: Array<{
    roles: { id_rol: bigint; codigo: string; nombre: string };
  }>;
}) {
  return {
    id: user.id_usuario.toString(),
    uuid: user.uuid,
    matricula: user.matricula,
    employeeCode: user.codigo_empleado,
    name: `${user.nombres} ${user.apellidos}`.trim(),
    firstName: user.nombres,
    lastName: user.apellidos,
    email: user.email,
    phone: user.telefono,
    status: user.estado,
    lastAccessAt: user.ultimo_acceso_at,
    createdAt: user.created_at,
    roles: user.usuario_roles_usuario_roles_id_usuarioTousuarios.map(
      ({ roles }) => ({
        id: roles.id_rol.toString(),
        code: roles.codigo,
        name: roles.nombre,
      }),
    ),
  };
}

function parseId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador inválido.');
  }
}

function normalize(value?: string): string | null {
  return value?.trim().toUpperCase() || null;
}
