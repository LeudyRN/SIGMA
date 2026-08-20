import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import {
  CreateConfigurationDto,
  UpdateConfigurationDto,
} from './dto/audit.dto';

export interface AuditRecord {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  data?: unknown;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async record(input: AuditRecord) {
    try {
      await this.prisma.auditoria.create({
        data: {
          id_usuario: input.userId ? parseId(input.userId) : null,
          accion: input.action.slice(0, 100),
          entidad: input.entity.slice(0, 100),
          entidad_id: input.entityId?.slice(0, 100) || null,
          datos_nuevos: toJsonValue(input.data),
          ip: input.ip?.slice(0, 45) || null,
          user_agent: input.userAgent?.slice(0, 500) || null,
          request_id: input.requestId?.slice(0, 100) || null,
        },
      });
    } catch {
      /* La auditoría nunca debe romper la operación principal. */
    }
  }
  async list(filters: {
    search?: string;
    action?: string;
    entity?: string;
    page?: string;
    pageSize?: string;
  }) {
    const page = Math.max(Number(filters.page) || 1, 1);
    const pageSize = Math.min(
      Math.max(Number(filters.pageSize) || 20, 10),
      100,
    );
    const search = filters.search?.trim();
    const where = {
      ...(filters.action && { accion: filters.action }),
      ...(filters.entity && { entidad: filters.entity }),
      ...(search && {
        OR: [
          { accion: { contains: search } },
          { entidad: { contains: search } },
          { entidad_id: { contains: search } },
          {
            usuarios: {
              OR: [
                { nombres: { contains: search } },
                { apellidos: { contains: search } },
                { codigo_empleado: { contains: search } },
              ],
            },
          },
        ],
      }),
    };
    const [items, total, actions, entities] = await Promise.all([
      this.prisma.auditoria.findMany({
        where,
        include: {
          usuarios: {
            select: { nombres: true, apellidos: true, codigo_empleado: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditoria.count({ where }),
      this.prisma.auditoria.findMany({
        distinct: ['accion'],
        select: { accion: true },
        orderBy: { accion: 'asc' },
      }),
      this.prisma.auditoria.findMany({
        distinct: ['entidad'],
        select: { entidad: true },
        orderBy: { entidad: 'asc' },
      }),
    ]);
    return {
      items: items.map((x) => ({
        id: x.id_auditoria.toString(),
        action: x.accion,
        entity: x.entidad,
        entityId: x.entidad_id,
        data: x.datos_nuevos,
        ip: x.ip,
        requestId: x.request_id,
        createdAt: x.created_at,
        user: x.usuarios
          ? {
              employeeCode: x.usuarios.codigo_empleado,
              name: `${x.usuarios.nombres} ${x.usuarios.apellidos}`,
            }
          : null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.max(Math.ceil(total / pageSize), 1),
      },
      filters: {
        actions: actions.map((x) => x.accion),
        entities: entities.map((x) => x.entidad),
      },
    };
  }
  async configurations() {
    const rows = await this.prisma.configuraciones.findMany({
      include: { usuarios: { select: { nombres: true, apellidos: true } } },
      orderBy: { clave: 'asc' },
    });
    return {
      items: rows.map((x) => ({
        id: x.id_configuracion.toString(),
        key: x.clave,
        value: x.valor,
        type: x.tipo,
        description: x.descripcion,
        public: x.es_publica,
        updatedAt: x.updated_at,
        updatedBy: x.usuarios
          ? `${x.usuarios.nombres} ${x.usuarios.apellidos}`
          : null,
      })),
    };
  }
  async createConfiguration(userId: string, dto: CreateConfigurationDto) {
    validateValue(dto.type, dto.value);
    try {
      const row = await this.prisma.configuraciones.create({
        data: {
          clave: dto.key.trim().toUpperCase(),
          valor: dto.value?.trim() || null,
          tipo: dto.type,
          descripcion: dto.description?.trim() || null,
          es_publica: dto.public ?? false,
          updated_by: parseId(userId),
        },
      });
      return { id: row.id_configuracion.toString() };
    } catch {
      throw new ConflictException('La clave de configuración ya existe.');
    }
  }
  async updateConfiguration(
    userId: string,
    id: string,
    dto: UpdateConfigurationDto,
  ) {
    if (dto.type && dto.value !== undefined) validateValue(dto.type, dto.value);
    try {
      const row = await this.prisma.configuraciones.update({
        where: { id_configuracion: parseId(id) },
        data: {
          ...(dto.key && { clave: dto.key.trim().toUpperCase() }),
          ...(dto.value !== undefined && { valor: dto.value?.trim() || null }),
          ...(dto.type && { tipo: dto.type }),
          ...(dto.description !== undefined && {
            descripcion: dto.description?.trim() || null,
          }),
          ...(dto.public !== undefined && { es_publica: dto.public }),
          updated_by: parseId(userId),
        },
      });
      return { id: row.id_configuracion.toString() };
    } catch {
      throw new ConflictException(
        'No fue posible actualizar la configuración.',
      );
    }
  }
  async removeConfiguration(id: string) {
    try {
      await this.prisma.configuraciones.delete({
        where: { id_configuracion: parseId(id) },
      });
      return { deleted: true };
    } catch {
      throw new NotFoundException('Configuración no encontrada.');
    }
  }
}
function validateValue(type: string, value?: string) {
  if (!value) return;
  if (type === 'INTEGER' && !/^-?\d+$/.test(value))
    throw new BadRequestException('El valor debe ser un entero.');
  if (type === 'DECIMAL' && !/^-?\d+(\.\d+)?$/.test(value))
    throw new BadRequestException('El valor debe ser decimal.');
  if (type === 'BOOLEAN' && !['true', 'false'].includes(value.toLowerCase()))
    throw new BadRequestException('El valor booleano debe ser true o false.');
  if (type === 'JSON') {
    try {
      JSON.parse(value);
    } catch {
      throw new BadRequestException('El valor no contiene JSON válido.');
    }
  }
}
function parseId(value: string) {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador inválido.');
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .map(toJsonValue)
      .filter((item): item is Prisma.InputJsonValue => item !== undefined);
  }
  if (typeof value === 'object') {
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      const converted = toJsonValue(item);
      if (converted !== undefined) result[key] = converted;
    }
    return result;
  }
  return undefined;
}
