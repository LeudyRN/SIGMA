import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import {
  CreateCatalogDto,
  CreateOfferDto,
  CreatePeriodDto,
  UpdateCatalogDto,
  UpdateOfferDto,
  UpdatePeriodDto,
} from './dto/ucotesis.dto';

export type CatalogKind = 'modalities' | 'areas' | 'requirements';

@Injectable()
export class UcotesisService {
  constructor(private readonly prisma: PrismaService) {}

  async catalogs() {
    const [modalities, areas, requirements, periods, campusCareers] =
      await Promise.all([
        this.listCatalog('modalities'),
        this.listCatalog('areas'),
        this.listCatalog('requirements'),
        this.periods(),
        this.prisma.recinto_carreras.findMany({
          where: { estado: 'ACTIVO' },
          include: {
            recintos: true,
            carreras: {
              include: { escuelas: { include: { facultades: true } } },
            },
          },
          orderBy: [
            { recintos: { nombre: 'asc' } },
            { carreras: { nombre: 'asc' } },
          ],
        }),
      ]);
    return {
      modalities: modalities.items,
      areas: areas.items,
      requirements: requirements.items,
      periods: periods.items,
      campusCareers: campusCareers.map((item) => ({
        id: item.id_recinto_carrera.toString(),
        campus: item.recintos.nombre,
        career: item.carreras.nombre,
        school: item.carreras.escuelas.nombre,
        faculty: item.carreras.escuelas.facultades.nombre,
      })),
    };
  }

  async listCatalog(kind: CatalogKind) {
    assertKind(kind);
    if (kind === 'modalities')
      return {
        items: (
          await this.prisma.modalidades.findMany({ orderBy: { nombre: 'asc' } })
        ).map((row) => ({
          id: row.id_modalidad.toString(),
          code: row.codigo,
          name: row.nombre,
          description: row.descripcion,
          status: row.estado,
        })),
      };
    if (kind === 'areas')
      return {
        nextCode: await this.nextAreaCode(),
        items: (
          await this.prisma.areas_investigacion.findMany({
            orderBy: { nombre: 'asc' },
          })
        ).map((row) => ({
          id: row.id_area.toString(),
          code: row.codigo,
          name: row.nombre,
          description: row.descripcion,
          status: row.estado,
        })),
      };
    return {
      items: (
        await this.prisma.requisitos.findMany({ orderBy: { nombre: 'asc' } })
      ).map((row) => ({
        id: row.id_requisito.toString(),
        code: row.codigo,
        name: row.nombre,
        description: row.descripcion,
        validationType: row.tipo_validacion,
        status: row.estado,
      })),
    };
  }

  async createCatalog(kind: CatalogKind, dto: CreateCatalogDto) {
    assertKind(kind);
    try {
      if (kind === 'modalities')
        return mapCatalog(
          await this.prisma.modalidades.create({
            data: {
              codigo: requireManualCode(dto.codigo),
              nombre: dto.nombre.trim(),
              descripcion: clean(dto.descripcion),
            },
          }),
          'id_modalidad',
        );
      if (kind === 'areas') {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            return mapCatalog(
              await this.prisma.areas_investigacion.create({
                data: {
                  codigo: await this.nextAreaCode(),
                  nombre: dto.nombre.trim(),
                  descripcion: clean(dto.descripcion),
                },
              }),
              'id_area',
            );
          } catch (error) {
            if (attempt === 2) throw error;
          }
        }
      }
      return mapCatalog(
        await this.prisma.requisitos.create({
          data: {
            codigo: requireManualCode(dto.codigo),
            nombre: dto.nombre.trim(),
            descripcion: clean(dto.descripcion),
            tipo_validacion: dto.tipoValidacion ?? 'MANUAL',
          },
        }),
        'id_requisito',
      );
    } catch {
      throw new ConflictException(
        'Ya existe un registro con ese código o nombre.',
      );
    }
  }

  async updateCatalog(kind: CatalogKind, id: string, dto: UpdateCatalogDto) {
    assertKind(kind);
    const parsed = parseId(id);
    const common = {
      ...(kind !== 'areas' &&
        dto.codigo && {
          codigo: dto.codigo.trim().toUpperCase(),
        }),
      ...(dto.nombre && { nombre: dto.nombre.trim() }),
      ...(dto.descripcion !== undefined && {
        descripcion: clean(dto.descripcion),
      }),
      ...(dto.estado && { estado: dto.estado }),
    };
    try {
      if (kind === 'modalities')
        return mapCatalog(
          await this.prisma.modalidades.update({
            where: { id_modalidad: parsed },
            data: common,
          }),
          'id_modalidad',
        );
      if (kind === 'areas')
        return mapCatalog(
          await this.prisma.areas_investigacion.update({
            where: { id_area: parsed },
            data: common,
          }),
          'id_area',
        );
      return mapCatalog(
        await this.prisma.requisitos.update({
          where: { id_requisito: parsed },
          data: {
            ...common,
            ...(dto.tipoValidacion && { tipo_validacion: dto.tipoValidacion }),
          },
        }),
        'id_requisito',
      );
    } catch {
      throw new ConflictException(
        'No fue posible actualizar; verifica código, nombre y relaciones.',
      );
    }
  }

  async removeCatalog(kind: CatalogKind, id: string) {
    assertKind(kind);
    const parsed = parseId(id);
    try {
      if (kind === 'modalities')
        await this.prisma.modalidades.delete({
          where: { id_modalidad: parsed },
        });
      else if (kind === 'areas')
        await this.prisma.areas_investigacion.delete({
          where: { id_area: parsed },
        });
      else
        await this.prisma.requisitos.delete({
          where: { id_requisito: parsed },
        });
      return { deleted: true };
    } catch {
      throw new ConflictException(
        'El registro está vinculado a una oferta y no puede eliminarse. Puedes inactivarlo.',
      );
    }
  }

  async periods() {
    return {
      nextCode: await this.nextPeriodCode(),
      items: (
        await this.prisma.periodos_academicos.findMany({
          orderBy: { fecha_inicio: 'desc' },
        })
      ).map((row) => ({
        id: row.id_periodo.toString(),
        code: row.codigo,
        name: row.nombre,
        startDate: row.fecha_inicio,
        endDate: row.fecha_fin,
        status: row.estado,
      })),
    };
  }
  async createPeriod(dto: CreatePeriodDto) {
    validateDates(dto.fechaInicio, dto.fechaFin);
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const row = await this.prisma.periodos_academicos.create({
            data: {
              codigo: await this.nextPeriodCode(),
              nombre: dto.nombre.trim(),
              fecha_inicio: new Date(dto.fechaInicio),
              fecha_fin: new Date(dto.fechaFin),
              estado: dto.estado ?? 'PLANIFICADO',
            },
          });
          return { id: row.id_periodo.toString() };
        } catch (error) {
          if (attempt === 2) throw error;
        }
      }
    } catch {
      throw new ConflictException('Ya existe un período con ese código.');
    }
  }
  async updatePeriod(id: string, dto: UpdatePeriodDto) {
    if (dto.fechaInicio && dto.fechaFin)
      validateDates(dto.fechaInicio, dto.fechaFin);
    try {
      const row = await this.prisma.periodos_academicos.update({
        where: { id_periodo: parseId(id) },
        data: {
          ...(dto.nombre && { nombre: dto.nombre.trim() }),
          ...(dto.fechaInicio && { fecha_inicio: new Date(dto.fechaInicio) }),
          ...(dto.fechaFin && { fecha_fin: new Date(dto.fechaFin) }),
          ...(dto.estado && { estado: dto.estado }),
        },
      });
      return { id: row.id_periodo.toString() };
    } catch {
      throw new ConflictException('No fue posible actualizar el período.');
    }
  }
  async removePeriod(id: string) {
    try {
      await this.prisma.periodos_academicos.delete({
        where: { id_periodo: parseId(id) },
      });
      return { deleted: true };
    } catch {
      throw new ConflictException(
        'El período tiene ofertas asociadas; ciérralo en lugar de eliminarlo.',
      );
    }
  }

  async offers() {
    const rows = await this.prisma.ofertas.findMany({
      include: {
        modalidades: true,
        periodos_academicos: true,
        recinto_carreras: { include: { recintos: true, carreras: true } },
        oferta_areas: { include: { areas_investigacion: true } },
        oferta_requisitos: { include: { requisitos: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return { nextCode: await this.nextOfferCode(), items: rows.map(mapOffer) };
  }
  async createOffer(userId: string, dto: CreateOfferDto) {
    validateOffer(dto);
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const row = await this.prisma.ofertas.create({
            data: {
              codigo: await this.nextOfferCode(),
              id_recinto_carrera: parseId(dto.recintoCarreraId),
              id_modalidad: parseId(dto.modalidadId),
              id_periodo: parseId(dto.periodoId),
              titulo: dto.titulo.trim(),
              descripcion: clean(dto.descripcion),
              fecha_inicio_inscripcion: new Date(dto.fechaInicioInscripcion),
              fecha_fin_inscripcion: new Date(dto.fechaFinInscripcion),
              cupo_total: dto.cupoTotal,
              monto: dto.monto,
              moneda: dto.moneda ?? 'DOP',
              estado: dto.estado ?? 'BORRADOR',
              created_by: parseId(userId),
              oferta_areas: {
                create: (dto.areaIds ?? []).map((value) => ({
                  id_area: parseId(value),
                })),
              },
              oferta_requisitos: {
                create: (dto.requisitoIds ?? []).map((value) => ({
                  id_requisito: parseId(value),
                  obligatorio: true,
                })),
              },
            },
            include: offerInclude,
          });
          return mapOffer(row);
        } catch (error) {
          if (attempt === 2) throw error;
        }
      }
    } catch {
      throw new ConflictException(
        'No fue posible crear la oferta. Verifica el código y los catálogos seleccionados.',
      );
    }
  }
  async updateOffer(id: string, dto: UpdateOfferDto) {
    if (dto.fechaInicioInscripcion && dto.fechaFinInscripcion)
      validateDates(dto.fechaInicioInscripcion, dto.fechaFinInscripcion);
    const offerId = parseId(id);
    try {
      const row = await this.prisma.$transaction(async (db) => {
        if (dto.areaIds) {
          await db.oferta_areas.deleteMany({ where: { id_oferta: offerId } });
          await db.oferta_areas.createMany({
            data: dto.areaIds.map((value) => ({
              id_oferta: offerId,
              id_area: parseId(value),
            })),
          });
        }
        if (dto.requisitoIds) {
          await db.oferta_requisitos.deleteMany({
            where: { id_oferta: offerId },
          });
          await db.oferta_requisitos.createMany({
            data: dto.requisitoIds.map((value) => ({
              id_oferta: offerId,
              id_requisito: parseId(value),
              obligatorio: true,
            })),
          });
        }
        return db.ofertas.update({
          where: { id_oferta: offerId },
          data: {
            ...(dto.recintoCarreraId && {
              id_recinto_carrera: parseId(dto.recintoCarreraId),
            }),
            ...(dto.modalidadId && { id_modalidad: parseId(dto.modalidadId) }),
            ...(dto.periodoId && { id_periodo: parseId(dto.periodoId) }),
            ...(dto.titulo && { titulo: dto.titulo.trim() }),
            ...(dto.descripcion !== undefined && {
              descripcion: clean(dto.descripcion),
            }),
            ...(dto.fechaInicioInscripcion && {
              fecha_inicio_inscripcion: new Date(dto.fechaInicioInscripcion),
            }),
            ...(dto.fechaFinInscripcion && {
              fecha_fin_inscripcion: new Date(dto.fechaFinInscripcion),
            }),
            ...(dto.cupoTotal !== undefined && { cupo_total: dto.cupoTotal }),
            ...(dto.monto !== undefined && { monto: dto.monto }),
            ...(dto.moneda && { moneda: dto.moneda }),
            ...(dto.estado && { estado: dto.estado }),
          },
          include: offerInclude,
        });
      });
      return mapOffer(row);
    } catch {
      throw new ConflictException('No fue posible actualizar la oferta.');
    }
  }
  async removeOffer(id: string) {
    const offerId = parseId(id);
    const linked = await this.prisma.inscripciones.count({
      where: { id_oferta: offerId },
    });
    if (linked)
      throw new ConflictException(
        'La oferta tiene inscripciones; cancélala en lugar de eliminarla.',
      );
    await this.prisma.ofertas
      .delete({ where: { id_oferta: offerId } })
      .catch(() => {
        throw new NotFoundException('Oferta no encontrada.');
      });
    return { deleted: true };
  }

  private async nextAreaCode() {
    const last = await this.prisma.areas_investigacion.findFirst({
      orderBy: { id_area: 'desc' },
      select: { codigo: true },
    });
    return nextSequentialCode(last?.codigo, 'A');
  }

  private async nextPeriodCode() {
    const last = await this.prisma.periodos_academicos.findFirst({
      orderBy: { id_periodo: 'desc' },
      select: { codigo: true },
    });
    return nextSequentialCode(last?.codigo, 'PER');
  }

  private async nextOfferCode() {
    const last = await this.prisma.ofertas.findFirst({
      orderBy: { id_oferta: 'desc' },
      select: { codigo: true },
    });
    return nextSequentialCode(last?.codigo, 'OFE');
  }
}

const offerInclude = {
  modalidades: true,
  periodos_academicos: true,
  recinto_carreras: { include: { recintos: true, carreras: true } },
  oferta_areas: { include: { areas_investigacion: true } },
  oferta_requisitos: { include: { requisitos: true } },
} as const;
type OfferRecord = Prisma.ofertasGetPayload<{ include: typeof offerInclude }>;
function mapOffer(row: OfferRecord) {
  return {
    id: row.id_oferta.toString(),
    code: row.codigo,
    title: row.titulo,
    description: row.descripcion,
    registrationStart: row.fecha_inicio_inscripcion,
    registrationEnd: row.fecha_fin_inscripcion,
    capacity: row.cupo_total,
    reserved: row.cupo_reservado,
    available: Math.max(row.cupo_total - row.cupo_reservado, 0),
    amount: Number(row.monto),
    currency: row.moneda,
    status: row.estado,
    modality: {
      id: row.modalidades.id_modalidad.toString(),
      name: row.modalidades.nombre,
    },
    period: {
      id: row.periodos_academicos.id_periodo.toString(),
      name: row.periodos_academicos.nombre,
    },
    campusCareer: {
      id: row.recinto_carreras.id_recinto_carrera.toString(),
      campus: row.recinto_carreras.recintos.nombre,
      career: row.recinto_carreras.carreras.nombre,
    },
    areas: row.oferta_areas.map((item) => ({
      id: item.id_area.toString(),
      name: item.areas_investigacion.nombre,
    })),
    requirements: row.oferta_requisitos.map((item) => ({
      id: item.id_requisito.toString(),
      name: item.requisitos.nombre,
      required: item.obligatorio,
    })),
  };
}
function mapCatalog<
  T extends {
    codigo: string;
    nombre: string;
    descripcion: string | null;
    estado: string;
  },
  K extends keyof T,
>(row: T, idKey: K) {
  return {
    id: String(row[idKey]),
    code: row.codigo,
    name: row.nombre,
    description: row.descripcion,
    status: row.estado,
  };
}
function parseId(value: string) {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador inválido.');
  }
}
function clean(value?: string) {
  return value?.trim() || null;
}
function requireManualCode(value?: string) {
  const code = value?.trim().toUpperCase();
  if (!code) throw new BadRequestException('El cÃ³digo es obligatorio.');
  return code;
}
export function nextSequentialCode(
  lastCode: string | undefined,
  fallbackPrefix: string,
) {
  const match = lastCode
    ?.trim()
    .toUpperCase()
    .match(/^(.*?)(\d+)$/);
  if (!match) return `${fallbackPrefix}0001`;
  const prefix = match[1] || fallbackPrefix;
  const suffix = match[2];
  return `${prefix}${String(Number(suffix) + 1).padStart(suffix.length, '0')}`;
}
function assertKind(kind: string): asserts kind is CatalogKind {
  if (!['modalities', 'areas', 'requirements'].includes(kind))
    throw new NotFoundException('Catálogo no encontrado.');
}
function validateDates(start: string, end: string) {
  if (new Date(end) <= new Date(start))
    throw new BadRequestException(
      'La fecha final debe ser posterior a la inicial.',
    );
}
function validateOffer(dto: CreateOfferDto) {
  validateDates(dto.fechaInicioInscripcion, dto.fechaFinInscripcion);
}
