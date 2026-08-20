import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AddParticipantDto,
  ChangeEnrollmentStatusDto,
  UpsertEnrollmentStateDto,
  ValidateDocumentDto,
  ValidateRequirementDto,
} from './dto/enrollments.dto';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(filters: { search?: string; status?: string; offerId?: string }) {
    const search = filters.search?.trim();
    const rows = await this.prisma.inscripciones.findMany({
      where: {
        ...(filters.status && {
          estados_inscripcion: { codigo: filters.status.toUpperCase() },
        }),
        ...(filters.offerId && { id_oferta: parseId(filters.offerId) }),
        ...(search && {
          OR: [
            { codigo: { contains: search } },
            {
              inscripcion_estudiantes: {
                some: {
                  estudiantes: {
                    OR: [
                      { matricula: { contains: search } },
                      {
                        usuarios: {
                          OR: [
                            { nombres: { contains: search } },
                            { apellidos: { contains: search } },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        }),
      },
      include: enrollmentDetailInclude,
      orderBy: { fecha_solicitud: 'desc' },
    });
    return { items: rows.map((row) => mapEnrollment(row)) };
  }
  async detail(id: string) {
    const row = await this.prisma.inscripciones.findUnique({
      where: { id_inscripcion: parseId(id) },
      include: enrollmentDetailInclude,
    });
    if (!row) throw new NotFoundException('Inscripción no encontrada.');
    return mapEnrollment(row);
  }
  async catalogs() {
    const [states, offers, students] = await Promise.all([
      this.prisma.estados_inscripcion.findMany({ orderBy: { orden: 'asc' } }),
      this.prisma.ofertas.findMany({
        orderBy: { created_at: 'desc' },
        select: { id_oferta: true, codigo: true, titulo: true },
      }),
      this.prisma.estudiantes.findMany({
        include: { usuarios: true },
        orderBy: { matricula: 'asc' },
      }),
    ]);
    return {
      states: states.map((x) => ({
        id: x.id_estado.toString(),
        code: x.codigo,
        name: x.nombre,
        order: x.orden,
        final: x.es_final,
        status: x.estado,
      })),
      offers: offers.map((x) => ({
        id: x.id_oferta.toString(),
        code: x.codigo,
        name: x.titulo,
      })),
      students: students.map((x) => ({
        id: x.id_estudiante.toString(),
        registration: x.matricula,
        name: `${x.usuarios.nombres} ${x.usuarios.apellidos}`,
      })),
    };
  }
  async changeStatus(
    userId: string,
    id: string,
    dto: ChangeEnrollmentStatusDto,
  ) {
    const enrollmentId = parseId(id);
    const next = await this.prisma.estados_inscripcion.findFirst({
      where: { codigo: dto.statusCode.toUpperCase(), estado: 'ACTIVO' },
    });
    if (!next)
      throw new BadRequestException('Estado de inscripción no disponible.');
    const previous = await this.prisma.inscripciones.findUnique({
      where: { id_inscripcion: enrollmentId },
      include: {
        estados_inscripcion: true,
        inscripcion_estudiantes: { include: { estudiantes: true } },
      },
    });
    if (!previous) throw new NotFoundException('Inscripción no encontrada.');
    if (previous.estados_inscripcion.es_final)
      throw new ConflictException(
        'Una inscripción finalizada no puede cambiar de estado.',
      );
    const cancel = ['CANCELADA', 'RECHAZADA'].includes(next.codigo);
    const updated = await this.prisma.$transaction(async (db) => {
      const row = await db.inscripciones.update({
        where: { id_inscripcion: enrollmentId },
        data: {
          id_estado: next.id_estado,
          version_lock: { increment: 1 },
          ...(next.codigo === 'CONFIRMADA' && {
            fecha_confirmacion: new Date(),
          }),
          ...(cancel && {
            fecha_cancelacion: new Date(),
            motivo_cancelacion: dto.reason?.trim() || null,
          }),
        },
      });
      await db.historial_estados_inscripcion.create({
        data: {
          id_inscripcion: enrollmentId,
          id_estado_anterior: previous.id_estado,
          id_estado_nuevo: next.id_estado,
          cambiado_por: parseId(userId),
          motivo: dto.reason?.trim() || null,
        },
      });
      if (cancel)
        await db.ofertas.updateMany({
          where: { id_oferta: previous.id_oferta, cupo_reservado: { gt: 0 } },
          data: { cupo_reservado: { decrement: 1 } },
        });
      return row;
    });
    await this.notifications.create({
      userIds: previous.inscripcion_estudiantes.map((x) =>
        x.estudiantes.id_usuario.toString(),
      ),
      type: 'INSCRIPCION',
      title: 'Estado de inscripción actualizado',
      message: `${previous.codigo}: ${next.nombre}`,
      url: '/app/inscripciones',
    });
    return { id: updated.id_inscripcion.toString(), status: next.codigo };
  }
  async addParticipant(id: string, dto: AddParticipantDto) {
    const enrollment = await this.prisma.inscripciones.findUnique({
      where: { id_inscripcion: parseId(id) },
    });
    if (!enrollment) throw new NotFoundException('Inscripción no encontrada.');
    const count = await this.prisma.inscripcion_estudiantes.count({
      where: { id_inscripcion: enrollment.id_inscripcion },
    });
    try {
      await this.prisma.inscripcion_estudiantes.create({
        data: {
          id_inscripcion: enrollment.id_inscripcion,
          id_oferta: enrollment.id_oferta,
          id_estudiante: parseId(dto.studentId),
          es_principal: dto.principal ?? false,
          orden_sustentante: count + 1,
        },
      });
      return { created: true };
    } catch {
      throw new ConflictException(
        'El estudiante ya participa en esta oferta o no existe.',
      );
    }
  }
  async removeParticipant(id: string, studentId: string) {
    const result = await this.prisma.inscripcion_estudiantes.deleteMany({
      where: {
        id_inscripcion: parseId(id),
        id_estudiante: parseId(studentId),
        es_principal: false,
      },
    });
    if (!result.count)
      throw new ConflictException(
        'No se puede remover al sustentante principal o no existe.',
      );
    return { deleted: true };
  }
  async validateRequirement(
    userId: string,
    id: string,
    dto: ValidateRequirementDto,
  ) {
    const row = await this.prisma.validaciones_requisitos.upsert({
      where: {
        id_inscripcion_id_requisito: {
          id_inscripcion: parseId(id),
          id_requisito: parseId(dto.requirementId),
        },
      },
      create: {
        id_inscripcion: parseId(id),
        id_requisito: parseId(dto.requirementId),
        cumple: dto.meets,
        valor_obtenido: dto.value?.trim() || null,
        observacion: dto.observation?.trim() || null,
        validado_por: parseId(userId),
      },
      update: {
        cumple: dto.meets,
        valor_obtenido: dto.value?.trim() || null,
        observacion: dto.observation?.trim() || null,
        validado_por: parseId(userId),
        fecha_validacion: new Date(),
      },
    });
    return { id: row.id_validacion.toString() };
  }
  async validateDocument(
    userId: string,
    documentId: string,
    dto: ValidateDocumentDto,
  ) {
    try {
      const row = await this.prisma.documentos_inscripcion.update({
        where: { id_documento: parseId(documentId) },
        data: {
          estado_validacion: dto.status,
          observacion: dto.observation?.trim() || null,
          validado_por: parseId(userId),
          validado_at: new Date(),
        },
      });
      return { id: row.id_documento.toString(), status: row.estado_validacion };
    } catch {
      throw new NotFoundException('Documento no encontrado.');
    }
  }
  async createState(dto: UpsertEnrollmentStateDto) {
    try {
      const row = await this.prisma.estados_inscripcion.create({
        data: {
          codigo: dto.code.trim().toUpperCase(),
          nombre: dto.name.trim(),
          orden: Number(dto.order),
          es_final: dto.final ?? false,
          estado: dto.status ?? 'ACTIVO',
        },
      });
      return { id: row.id_estado.toString() };
    } catch {
      throw new ConflictException('El código u orden del estado ya existe.');
    }
  }
  async updateState(id: string, dto: UpsertEnrollmentStateDto) {
    try {
      const row = await this.prisma.estados_inscripcion.update({
        where: { id_estado: parseId(id) },
        data: {
          codigo: dto.code.trim().toUpperCase(),
          nombre: dto.name.trim(),
          orden: Number(dto.order),
          es_final: dto.final ?? false,
          estado: dto.status ?? 'ACTIVO',
        },
      });
      return { id: row.id_estado.toString() };
    } catch {
      throw new ConflictException('No fue posible actualizar el estado.');
    }
  }
}

const enrollmentInclude = {
  estados_inscripcion: true,
  ofertas: {
    include: {
      modalidades: true,
      periodos_academicos: true,
      recinto_carreras: { include: { recintos: true, carreras: true } },
    },
  },
  inscripcion_estudiantes: {
    include: { estudiantes: { include: { usuarios: true } } },
  },
  pagos: {
    include: {
      metodos_pago: true,
      facturas: true,
      comprobantes_transferencia: {
        select: { estado: true, nombre_archivo: true },
      },
    },
    orderBy: { created_at: 'desc' as const },
  },
  _count: {
    select: { documentos_inscripcion: true, validaciones_requisitos: true },
  },
};
const enrollmentDetailInclude = {
  ...enrollmentInclude,
  documentos_inscripcion: true,
  validaciones_requisitos: { include: { requisitos: true, usuarios: true } },
  historial_estados_inscripcion: {
    include: {
      estados_inscripcion_historial_estados_inscripcion_id_estado_nuevoToestados_inscripcion: true,
    },
    orderBy: { created_at: 'desc' as const },
  },
  proyectos_grado: true,
};
type EnrollmentRecord = Prisma.inscripcionesGetPayload<{
  include: typeof enrollmentDetailInclude;
}>;
function mapEnrollment(row: EnrollmentRecord) {
  return {
    id: row.id_inscripcion.toString(),
    code: row.codigo,
    status: row.estados_inscripcion.codigo,
    statusName: row.estados_inscripcion.nombre,
    requestedAt: row.fecha_solicitud,
    confirmedAt: row.fecha_confirmacion,
    amount: Number(row.monto_aplicado),
    currency: row.moneda,
    observations: row.observaciones,
    offer: {
      id: row.id_oferta.toString(),
      code: row.ofertas.codigo,
      title: row.ofertas.titulo,
      modality: row.ofertas.modalidades.nombre,
      period: row.ofertas.periodos_academicos.nombre,
      campus: row.ofertas.recinto_carreras.recintos.nombre,
      career: row.ofertas.recinto_carreras.carreras.nombre,
    },
    participants: row.inscripcion_estudiantes.map((x) => ({
      id: x.estudiantes.id_estudiante.toString(),
      registration: x.estudiantes.matricula,
      name: `${x.estudiantes.usuarios.nombres} ${x.estudiantes.usuarios.apellidos}`,
      principal: x.es_principal,
    })),
    payments: row.pagos.map((x) => ({
      id: x.id_pago.toString(),
      reference: x.referencia,
      status: x.estado,
      method: x.metodos_pago.nombre,
      amount: Number(x.monto),
      proofStatus: x.comprobantes_transferencia?.estado ?? null,
      invoice: x.facturas ? x.facturas.numero_factura : null,
    })),
    counts: {
      documents: row._count.documentos_inscripcion,
      validations: row._count.validaciones_requisitos,
    },
    documents: row.documentos_inscripcion.map((x) => ({
      id: x.id_documento.toString(),
      type: x.tipo_documento,
      name: x.nombre_archivo,
      status: x.estado_validacion,
      observation: x.observacion,
    })),
    validations: row.validaciones_requisitos.map((x) => ({
      id: x.id_validacion.toString(),
      requirementId: x.id_requisito.toString(),
      requirement: x.requisitos.nombre,
      meets: x.cumple,
      value: x.valor_obtenido,
      observation: x.observacion,
      validatedAt: x.fecha_validacion,
    })),
    history: row.historial_estados_inscripcion.map((x) => ({
      id: x.id_historial_estado.toString(),
      status:
        x
          .estados_inscripcion_historial_estados_inscripcion_id_estado_nuevoToestados_inscripcion
          .nombre,
      reason: x.motivo,
      createdAt: x.created_at,
    })),
  };
}
function parseId(value: string) {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador inválido.');
  }
}
