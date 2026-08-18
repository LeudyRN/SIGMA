import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePaymentIntentDto,
  RequestEnrollmentDto,
} from './dto/student-process.dto';
import { StudentsService } from './students.service';

@Injectable()
export class StudentProcessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
  ) {}

  async offers(userId: string) {
    const student = await this.studentByUser(userId);
    const campusCareerIds = student.estudiante_carreras.map(
      (item) => item.id_recinto_carrera,
    );
    const now = new Date();
    const offers = await this.prisma.ofertas.findMany({
      where: {
        id_recinto_carrera: { in: campusCareerIds },
        estado: 'PUBLICADA',
        fecha_inicio_inscripcion: { lte: now },
        fecha_fin_inscripcion: { gte: now },
      },
      include: {
        modalidades: true,
        periodos_academicos: true,
        recinto_carreras: { include: { carreras: true, recintos: true } },
        oferta_areas: { include: { areas_investigacion: true } },
        oferta_requisitos: { include: { requisitos: true } },
      },
      orderBy: { fecha_fin_inscripcion: 'asc' },
    });
    return {
      items: offers.map((offer) => ({
        id: offer.id_oferta.toString(),
        code: offer.codigo,
        title: offer.titulo,
        description: offer.descripcion,
        modality: offer.modalidades.nombre,
        period: offer.periodos_academicos.nombre,
        campus: offer.recinto_carreras.recintos.nombre,
        career: offer.recinto_carreras.carreras.nombre,
        registrationStart: offer.fecha_inicio_inscripcion,
        registrationEnd: offer.fecha_fin_inscripcion,
        capacity: offer.cupo_total,
        reserved: offer.cupo_reservado,
        available: Math.max(offer.cupo_total - offer.cupo_reservado, 0),
        amount: offer.monto.toNumber(),
        currency: offer.moneda,
        areas: offer.oferta_areas.map(
          (item) => item.areas_investigacion.nombre,
        ),
        requirements: offer.oferta_requisitos.map((item) => ({
          name: item.requisitos.nombre,
          required: item.obligatorio,
        })),
      })),
    };
  }

  async enrollments(userId: string) {
    const student = await this.studentByUser(userId);
    const rows = await this.prisma.inscripcion_estudiantes.findMany({
      where: { id_estudiante: student.id_estudiante },
      include: {
        inscripciones: {
          include: {
            estados_inscripcion: true,
            ofertas: {
              include: {
                modalidades: true,
                recinto_carreras: {
                  include: { carreras: true, recintos: true },
                },
              },
            },
            pagos: {
              include: { metodos_pago: true, facturas: true },
              orderBy: { created_at: 'desc' },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    return {
      items: rows.map(({ inscripciones: enrollment }) => ({
        id: enrollment.id_inscripcion.toString(),
        code: enrollment.codigo,
        status: enrollment.estados_inscripcion.codigo,
        statusName: enrollment.estados_inscripcion.nombre,
        requestedAt: enrollment.fecha_solicitud,
        amount: enrollment.monto_aplicado.toNumber(),
        currency: enrollment.moneda,
        offer: {
          id: enrollment.id_oferta.toString(),
          title: enrollment.ofertas.titulo,
          modality: enrollment.ofertas.modalidades.nombre,
          campus: enrollment.ofertas.recinto_carreras.recintos.nombre,
          career: enrollment.ofertas.recinto_carreras.carreras.nombre,
        },
        payments: enrollment.pagos.map((payment) => ({
          id: payment.id_pago.toString(),
          reference: payment.referencia,
          status: payment.estado,
          method: payment.metodos_pago.nombre,
          amount: payment.monto.toNumber(),
          createdAt: payment.created_at,
          invoice: payment.facturas
            ? {
                number: payment.facturas.numero_factura,
                receipt: payment.facturas.numero_recibo,
                pdfUrl: payment.facturas.pdf_url,
              }
            : null,
        })),
      })),
    };
  }

  async paymentMethods() {
    const methods = await this.prisma.metodos_pago.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { nombre: 'asc' },
    });
    return {
      items: methods.map((item) => ({
        id: item.id_metodo_pago.toString(),
        code: item.codigo,
        name: item.nombre,
      })),
    };
  }

  async requestEnrollment(userId: string, dto: RequestEnrollmentDto) {
    const student = await this.studentByUser(userId);
    const offerId = parseId(dto.offerId);
    const offer = await this.prisma.ofertas.findFirst({
      where: {
        id_oferta: offerId,
        estado: 'PUBLICADA',
        fecha_inicio_inscripcion: { lte: new Date() },
        fecha_fin_inscripcion: { gte: new Date() },
        recinto_carreras: {
          estudiante_carreras: {
            some: { id_estudiante: student.id_estudiante },
          },
        },
      },
    });
    if (!offer)
      throw new NotFoundException(
        'La oferta no está disponible para tu carrera.',
      );
    const career = student.estudiante_carreras.find(
      (item) => item.id_recinto_carrera === offer.id_recinto_carrera,
    );
    if (!career)
      throw new BadRequestException(
        'La oferta no corresponde a tu expediente.',
      );
    const eligibility = await this.students.eligibility(
      student.id_estudiante.toString(),
      career.id_estudiante_carrera.toString(),
    );
    if (!eligibility.eligible) {
      throw new BadRequestException(
        'No puedes solicitar la inscripción mientras existan asignaturas pendientes.',
      );
    }
    const state = await this.prisma.estados_inscripcion.findFirst({
      where: { codigo: 'PENDIENTE_PAGO', estado: 'ACTIVO' },
    });
    if (!state)
      throw new ConflictException(
        'El estado PENDIENTE_PAGO no está configurado.',
      );

    try {
      return await this.prisma.$transaction(async (database) => {
        const capacity = await database.ofertas.updateMany({
          where: {
            id_oferta: offerId,
            cupo_reservado: { lt: offer.cupo_total },
          },
          data: { cupo_reservado: { increment: 1 } },
        });
        if (capacity.count !== 1)
          throw new ConflictException(
            'La oferta ya no tiene cupos disponibles.',
          );
        const enrollment = await database.inscripciones.create({
          data: {
            codigo: `INS-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
            id_oferta: offerId,
            id_estado: state.id_estado,
            monto_aplicado: offer.monto,
            moneda: offer.moneda,
            observaciones: dto.observations?.trim() || null,
          },
        });
        await database.inscripcion_estudiantes.create({
          data: {
            id_inscripcion: enrollment.id_inscripcion,
            id_oferta: offerId,
            id_estudiante: student.id_estudiante,
            es_principal: true,
          },
        });
        return {
          id: enrollment.id_inscripcion.toString(),
          code: enrollment.codigo,
          status: 'PENDIENTE_PAGO',
        };
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ConflictException(
        'Ya existe una inscripción del estudiante para esta oferta.',
      );
    }
  }

  async createPaymentIntent(userId: string, dto: CreatePaymentIntentDto) {
    const student = await this.studentByUser(userId);
    const enrollmentId = parseId(dto.enrollmentId);
    const existing = await this.prisma.pagos.findUnique({
      where: { idempotency_key: dto.idempotencyKey },
      include: {
        inscripciones: {
          select: {
            inscripcion_estudiantes: {
              select: { id_estudiante: true },
            },
          },
        },
      },
    });
    if (existing) {
      const belongsToStudent =
        existing.id_inscripcion === enrollmentId &&
        existing.inscripciones.inscripcion_estudiantes.some(
          (item) => item.id_estudiante === student.id_estudiante,
        );
      if (!belongsToStudent) {
        throw new ConflictException(
          'La clave de idempotencia ya fue utilizada en otra operación.',
        );
      }
      return {
        id: existing.id_pago.toString(),
        reference: existing.referencia,
        status: existing.estado,
      };
    }
    const enrollment = await this.prisma.inscripciones.findFirst({
      where: {
        id_inscripcion: enrollmentId,
        inscripcion_estudiantes: {
          some: { id_estudiante: student.id_estudiante },
        },
        estados_inscripcion: { codigo: { in: ['ELEGIBLE', 'PENDIENTE_PAGO'] } },
      },
    });
    if (!enrollment)
      throw new NotFoundException(
        'Inscripción pendiente de pago no encontrada.',
      );
    const method = await this.prisma.metodos_pago.findFirst({
      where: { id_metodo_pago: parseId(dto.paymentMethodId), estado: 'ACTIVO' },
    });
    if (!method) throw new BadRequestException('Método de pago no disponible.');
    const payment = await this.prisma.pagos.create({
      data: {
        id_inscripcion: enrollmentId,
        id_metodo_pago: method.id_metodo_pago,
        referencia: `PAY-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        idempotency_key: dto.idempotencyKey,
        monto: enrollment.monto_aplicado,
        moneda: enrollment.moneda,
        estado: 'PENDIENTE',
      },
    });
    return {
      id: payment.id_pago.toString(),
      reference: payment.referencia,
      status: payment.estado,
      message:
        'Intención registrada. La confirmación depende del proveedor de pago seleccionado.',
    };
  }

  private async studentByUser(userId: string) {
    const student = await this.prisma.estudiantes.findFirst({
      where: {
        id_usuario: parseId(userId),
        usuarios: { deleted_at: null, estado: 'ACTIVO' },
      },
      include: { estudiante_carreras: true },
    });
    if (!student)
      throw new NotFoundException('Perfil estudiantil no encontrado.');
    return student;
  }
}

function parseId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador inválido.');
  }
}
