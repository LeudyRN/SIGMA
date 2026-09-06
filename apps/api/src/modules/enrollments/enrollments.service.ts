import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AddParticipantDto,
  RequestDocumentDto,
  ChangeEnrollmentStatusDto,
  UpsertEnrollmentStateDto,
  UploadEnrollmentDocumentDto,
  ValidateDocumentDto,
  ValidateRequirementDto,
} from './dto/enrollments.dto';

export interface UploadedEnrollmentDocument {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

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
  async requestDocument(userId: string, dto: RequestDocumentDto) {
    if (!dto.type.trim() || !dto.instructions.trim())
      throw new BadRequestException(
        'Indica el documento y las instrucciones para el estudiante.',
      );
    const enrollment = await this.prisma.inscripciones.findFirst({
      where: {
        id_inscripcion: parseId(dto.enrollmentId),
        estados_inscripcion: { codigo: { notIn: ['CANCELADA', 'RECHAZADA'] } },
      },
      include: { inscripcion_estudiantes: { include: { estudiantes: true } } },
    });
    if (!enrollment)
      throw new NotFoundException('Inscripción disponible no encontrada.');
    const request = await this.prisma.solicitudes_documentos
      .create({
        data: {
          id_inscripcion: enrollment.id_inscripcion,
          tipo_documento: dto.type.trim(),
          instrucciones: dto.instructions.trim(),
          solicitado_por: parseId(userId),
        },
      })
      .catch((error: unknown) => {
        if ((error as { code?: string }).code === 'P2002')
          throw new ConflictException(
            'Ese documento ya fue solicitado. Revisa su estado antes de solicitarlo nuevamente.',
          );
        throw error;
      });
    await this.notifications
      .create({
        userIds: enrollment.inscripcion_estudiantes.map((p) =>
          p.estudiantes.id_usuario.toString(),
        ),
        type: 'INSCRIPCION',
        title: 'Documento solicitado',
        message: `${enrollment.codigo}: ${dto.type.trim()}. ${dto.instructions.trim()}`,
        url: '/app/documentos',
      })
      .catch(() => undefined);
    return { id: request.id_solicitud.toString() };
  }

  async validateDocument(
    userId: string,
    documentId: string,
    dto: ValidateDocumentDto,
  ) {
    if (dto.status === 'RECHAZADO' && !dto.observation?.trim())
      throw new BadRequestException(
        'Indica el motivo del rechazo para que el estudiante pueda corregirlo.',
      );
    const row = await this.prisma.documentos_inscripcion
      .update({
        where: { id_documento: parseId(documentId) },
        data: {
          estado_validacion: dto.status,
          observacion: dto.observation?.trim() || null,
          validado_por: parseId(userId),
          validado_at: new Date(),
        },
        include: {
          inscripciones: {
            select: {
              codigo: true,
              inscripcion_estudiantes: {
                select: { estudiantes: { select: { id_usuario: true } } },
              },
            },
          },
        },
      })
      .catch(() => {
        throw new NotFoundException('Documento no encontrado.');
      });
    await this.notifications
      .create({
        userIds: row.inscripciones.inscripcion_estudiantes.map((participant) =>
          participant.estudiantes.id_usuario.toString(),
        ),
        type: 'INSCRIPCION',
        title:
          dto.status === 'VALIDO'
            ? 'Documento validado'
            : 'Documento requiere corrección',
        message: `${row.inscripciones.codigo}: ${row.nombre_archivo}${
          dto.observation?.trim() ? ` · ${dto.observation.trim()}` : ''
        }`,
        url: '/app/documentos',
      })
      .catch(() => undefined);
    return { id: row.id_documento.toString(), status: row.estado_validacion };
  }
  async uploadStudentDocument(
    userId: string,
    dto: UploadEnrollmentDocumentDto,
    file?: UploadedEnrollmentDocument,
  ) {
    validateEnrollmentDocument(file);
    const user = parseId(userId);
    const enrollmentId = parseId(dto.enrollmentId);
    const student = await this.prisma.estudiantes.findFirst({
      where: {
        id_usuario: user,
        usuarios: { estado: 'ACTIVO', deleted_at: null },
      },
      select: { id_estudiante: true },
    });
    if (!student)
      throw new NotFoundException('Perfil estudiantil no encontrado.');
    const enrollment = await this.prisma.inscripciones.findFirst({
      where: {
        id_inscripcion: enrollmentId,
        inscripcion_estudiantes: {
          some: { id_estudiante: student.id_estudiante },
        },
        estados_inscripcion: { codigo: { notIn: ['CANCELADA', 'RECHAZADA'] } },
      },
      select: { codigo: true },
    });
    if (!enrollment)
      throw new NotFoundException('Inscripción disponible no encontrada.');
    if (!dto.type.trim())
      throw new BadRequestException('Indica el tipo de documento.');
    const request = dto.requestId
      ? await this.prisma.solicitudes_documentos.findFirst({
          where: {
            id_solicitud: parseId(dto.requestId),
            id_inscripcion: enrollmentId,
          },
        })
      : null;
    if (dto.requestId && !request)
      throw new NotFoundException(
        'Solicitud documental no disponible para esta inscripción.',
      );
    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const row = await this.prisma.documentos_inscripcion.create({
      data: {
        id_inscripcion: enrollmentId,
        id_estudiante: student.id_estudiante,
        tipo_documento: request?.tipo_documento ?? dto.type.trim(),
        id_solicitud: request?.id_solicitud,
        nombre_archivo: file.originalname.slice(0, 255),
        ruta_archivo: `db://enrollment-document/${randomUUID()}`,
        mime_type: file.mimetype,
        tamano_bytes: BigInt(file.size),
        hash_sha256: hash,
        contenido: Uint8Array.from(file.buffer),
      },
    });
    await this.notifications
      .create({
        roleCodes: ['ADMIN', 'COORDINADOR'],
        type: 'INSCRIPCION',
        title: 'Nuevo documento de inscripción',
        message: `${enrollment.codigo}: ${dto.type.trim()}`,
        url: '/app/documentos',
      })
      .catch(() => undefined);
    return {
      id: row.id_documento.toString(),
      name: row.nombre_archivo,
      status: row.estado_validacion,
    };
  }
  async downloadDocument(
    user: AuthenticatedUser,
    documentId: string,
    response: Response,
  ) {
    const row = await this.prisma.documentos_inscripcion.findUnique({
      where: { id_documento: parseId(documentId) },
      include: {
        inscripciones: {
          select: {
            inscripcion_estudiantes: {
              select: { estudiantes: { select: { id_usuario: true } } },
            },
          },
        },
      },
    });
    if (!row?.contenido)
      throw new NotFoundException(
        'El archivo del documento no está disponible.',
      );
    const canManage =
      user.roles.some((role) => ['ADMIN', 'COORDINADOR'].includes(role)) ||
      user.permissions.includes('INSCRIPCIONES_GESTIONAR');
    const ownsDocument = row.inscripciones.inscripcion_estudiantes.some(
      (participant) => participant.estudiantes.id_usuario === parseId(user.id),
    );
    if (!canManage && !ownsDocument)
      throw new ForbiddenException('No puedes consultar este documento.');
    response.setHeader(
      'Content-Type',
      row.mime_type ?? 'application/octet-stream',
    );
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${safeFileName(row.nombre_archivo)}"`,
    );
    response.send(Buffer.from(row.contenido));
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
  solicitudes_documentos: true,
  documentos_inscripcion: {
    select: {
      id_documento: true,
      id_solicitud: true,
      tipo_documento: true,
      nombre_archivo: true,
      ruta_archivo: true,
      mime_type: true,
      tamano_bytes: true,
      estado_validacion: true,
      observacion: true,
      created_at: true,
    },
  },
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
      teachingMode: row.ofertas.modalidad_ensenanza,
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
    documentRequests: row.solicitudes_documentos.map((r) => ({
      id: r.id_solicitud.toString(),
      type: r.tipo_documento,
      instructions: r.instrucciones,
    })),
    documents: row.documentos_inscripcion.map((x) => ({
      id: x.id_documento.toString(),
      requestId: x.id_solicitud?.toString() ?? null,
      type: x.tipo_documento,
      name: x.nombre_archivo,
      status: x.estado_validacion,
      observation: x.observacion,
      mimeType: x.mime_type,
      size: x.tamano_bytes ? Number(x.tamano_bytes) : null,
      uploadedAt: x.created_at,
      downloadAvailable: x.ruta_archivo.startsWith('db://'),
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

function validateEnrollmentDocument(
  file?: UploadedEnrollmentDocument,
): asserts file is UploadedEnrollmentDocument {
  if (!file) throw new BadRequestException('Debes seleccionar un archivo.');
  if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimetype))
    throw new BadRequestException('El documento debe ser PDF, PNG o JPG.');
  if (file.size > 8 * 1024 * 1024)
    throw new BadRequestException('El documento no puede superar 8 MB.');
}

function safeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180);
}
