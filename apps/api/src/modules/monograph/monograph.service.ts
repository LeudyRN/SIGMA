import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { StudentsService } from '../students/students.service';
import {
  AcademicPolicyDto,
  ContactDto,
  CourseGroupDto,
  GradeDto,
  ReviewFileDto,
  SimulatePaymentDto,
} from './monograph.dto';

export function granted(user: AuthenticatedUser, permission: string) {
  return (
    user.permissions.includes('*') || user.permissions.includes(permission)
  );
}
function id(value: string) {
  if (!/^[1-9]\d*$/.test(value))
    throw new BadRequestException('Identificador inválido.');
  return BigInt(value);
}
const staffPermissions = [
  'MONOGRAFICO_RECIBIR',
  'MONOGRAFICO_VALIDAR',
  'MONOGRAFICO_GRUPOS',
  'MONOGRAFICO_REPORTES',
  'MONOGRAFICO_CAJA',
  'MONOGRAFICO_REGLAS',
];
const enrollmentInclude = {
  estados_inscripcion: true,
  ofertas: {
    include: {
      recinto_carreras: { include: { carreras: true, recintos: true } },
      coordinador: {
        select: { id_usuario: true, nombres: true, apellidos: true },
      },
      modalidades: true,
    },
  },
  inscripcion_estudiantes: {
    include: {
      estudiantes: {
        include: {
          usuarios: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
              telefono: true,
              whatsapp_confirmado_at: true,
            },
          },
          estudiante_carreras: true,
        },
      },
    },
  },
  solicitudes_documentos: {
    include: {
      documentos_inscripcion: {
        orderBy: { id_documento: 'desc' as const },
        take: 1,
      },
    },
  },
  notas_monografico: true,
  pagos: {
    include: { facturas: true },
    orderBy: { created_at: 'desc' as const },
  },
} satisfies Prisma.inscripcionesInclude;

@Injectable()
export class MonographService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
  ) {}
  private scope(user: AuthenticatedUser): Prisma.inscripcionesWhereInput {
    if (staffPermissions.some((p) => granted(user, p))) return {};
    if (granted(user, 'MONOGRAFICO_NOTAS'))
      return { ofertas: { coordinador_id: id(user.id) } };
    return {
      inscripcion_estudiantes: {
        some: { estudiantes: { id_usuario: id(user.id) } },
      },
    };
  }
  async workspace(user: AuthenticatedUser) {
    const rows = await this.prisma.inscripciones.findMany({
      where: this.scope(user),
      include: enrollmentInclude,
      orderBy: { fecha_solicitud: 'desc' },
    });
    const staff = staffPermissions.some((p) => granted(user, p));
    const items = rows.map((row) => {
      const paid = row.pagos.some((p) => p.estado === 'APROBADO');
      return {
        id: row.id_inscripcion.toString(),
        code: row.codigo,
        offerId: row.id_oferta.toString(),
        offer: row.ofertas.titulo,
        teachingMode: row.ofertas.modalidad_ensenanza,
        degreeType: row.ofertas.modalidades.nombre,
        career: row.ofertas.recinto_carreras.carreras.nombre,
        campus: row.ofertas.recinto_carreras.recintos.nombre,
        status: row.estados_inscripcion.codigo,
        receivedAt: row.recibido_at,
        validatedAt: row.validado_at,
        debtOpenedAt: row.deuda_abierta_at,
        channel: row.canal_pago,
        amount: Number(row.monto_aplicado),
        currency: row.moneda,
        paid,
        whatsappUrl:
          paid || granted(user, 'MONOGRAFICO_GRUPOS')
            ? row.ofertas.grupo_whatsapp
            : null,
        remittedAt: row.ofertas.notas_remitidas_at,
        observation: row.observaciones,
        participants: row.inscripcion_estudiantes.map((p) => ({
          id: p.id_estudiante.toString(),
          registration: p.estudiantes.matricula,
          name: `${p.estudiantes.usuarios.nombres} ${p.estudiantes.usuarios.apellidos}`,
          phone:
            staff || p.estudiantes.id_usuario === id(user.id)
              ? p.estudiantes.usuarios.telefono
              : null,
          contactConfirmed: !!p.estudiantes.usuarios.whatsapp_confirmado_at,
          grade:
            row.notas_monografico
              .find((n) => n.id_estudiante === p.id_estudiante)
              ?.nota.toNumber() ?? null,
        })),
        documents: row.solicitudes_documentos.map((d) => ({
          id: d.id_solicitud.toString(),
          type: d.tipo_documento,
          status:
            d.documentos_inscripcion[0]?.estado_validacion ?? 'SIN_ENTREGAR',
        })),
        payments: row.pagos.map((p) => ({
          id: p.id_pago.toString(),
          reference: p.referencia,
          simulated: p.es_simulado,
          channel: p.canal,
          status: p.estado,
          amount: Number(p.monto),
          invoice: p.facturas?.numero_recibo ?? null,
          createdAt: p.created_at,
        })),
      };
    });
    const groups =
      staff || granted(user, 'MONOGRAFICO_NOTAS')
        ? await this.prisma.ofertas.findMany({
            where: staff ? {} : { coordinador_id: id(user.id) },
            include: {
              coordinador: {
                select: { id_usuario: true, nombres: true, apellidos: true },
              },
            },
            orderBy: { created_at: 'desc' },
          })
        : [];
    const coordinators = granted(user, 'MONOGRAFICO_GRUPOS')
      ? await this.prisma.usuarios.findMany({
          where: {
            estado: 'ACTIVO',
            deleted_at: null,
            usuario_roles_usuario_roles_id_usuarioTousuarios: {
              some: {
                roles: {
                  codigo: { in: ['DOCENTE', 'COORDINADOR_MONOGRAFICO'] },
                },
              },
            },
          },
          select: { id_usuario: true, nombres: true, apellidos: true },
        })
      : [];
    const plans = granted(user, 'MONOGRAFICO_REGLAS')
      ? await this.prisma.planes_estudio.findMany({
          include: { carreras: true },
          orderBy: { nombre: 'asc' },
        })
      : [];
    const contact = await this.prisma.usuarios.findUnique({
      where: { id_usuario: id(user.id) },
      select: { telefono: true, whatsapp_confirmado_at: true },
    });
    return {
      items,
      contact: {
        phone: contact?.telefono ?? '',
        confirmed: !!contact?.whatsapp_confirmado_at,
      },
      groups: groups.map((g) => ({
        id: g.id_oferta.toString(),
        title: g.titulo,
        coordinatorId: g.coordinador_id?.toString() ?? '',
        coordinator: g.coordinador
          ? `${g.coordinador.nombres} ${g.coordinador.apellidos}`
          : 'Sin asignar',
        whatsappUrl: g.grupo_whatsapp ?? '',
        teachingBudget: Number(g.presupuesto_docencia),
        materialsBudget: Number(g.presupuesto_materiales),
        capacity: g.cupo_total,
        price: Number(g.monto),
        remittedAt: g.notas_remitidas_at,
      })),
      coordinators: coordinators.map((c) => ({
        id: c.id_usuario.toString(),
        name: `${c.nombres} ${c.apellidos}`,
      })),
      plans: plans.map((p) => ({
        id: p.id_plan_estudio.toString(),
        name: `${p.carreras.nombre} · ${p.nombre}`,
        maxSubjects: p.max_asignaturas_pendientes,
        maxCredits: p.max_creditos_pendientes,
        fromSemester: p.desde_semestre,
      })),
    };
  }
  async confirmContact(user: AuthenticatedUser, dto: ContactDto) {
    await this.prisma.$transaction(async (db) => {
      await db.usuarios.update({
        where: { id_usuario: id(user.id) },
        data: { telefono: dto.phone, whatsapp_confirmado_at: new Date() },
      });
      await db.estudiantes.updateMany({
        where: { id_usuario: id(user.id) },
        data: { whatsapp: dto.phone },
      });
      await this.audit(db, user, 'CONFIRMAR_CONTACTO', user.id, {
        confirmed: true,
      });
    });
    return { id: user.id, confirmed: true };
  }
  async receive(user: AuthenticatedUser, enrollmentId: string) {
    return this.prisma.$transaction(async (db) => {
      const row = await db.inscripciones.findUnique({
        where: { id_inscripcion: id(enrollmentId) },
        include: { estados_inscripcion: true },
      });
      if (!row) throw new NotFoundException('Inscripción no encontrada.');
      if (row.recibido_at) return { id: enrollmentId, received: true };
      this.assertActive(row.estados_inscripcion.codigo);
      await db.inscripciones.update({
        where: { id_inscripcion: row.id_inscripcion },
        data: { recibido_at: new Date(), recibido_por: id(user.id) },
      });
      await this.audit(db, user, 'RECIBIR_EXPEDIENTE', enrollmentId, {});
      return { id: enrollmentId, received: true };
    });
  }
  async validate(
    user: AuthenticatedUser,
    enrollmentId: string,
    dto: ReviewFileDto,
  ) {
    if (!dto.documentsComplete)
      throw new BadRequestException('Confirma la revisión documental.');
    const row = await this.prisma.inscripciones.findUnique({
      where: { id_inscripcion: id(enrollmentId) },
      include: enrollmentInclude,
    });
    if (!row) throw new NotFoundException('Inscripción no encontrada.');
    this.assertActive(row.estados_inscripcion.codigo);
    if (!row.recibido_at)
      throw new ConflictException(
        'Oficinistas debe registrar la recepción del expediente.',
      );
    if (row.deuda_abierta_at)
      throw new ConflictException('La deuda ya está abierta.');
    if (!row.inscripcion_estudiantes.length)
      throw new ConflictException('Faltan los participantes.');
    if (
      row.solicitudes_documentos.some(
        (d) => d.documentos_inscripcion[0]?.estado_validacion !== 'VALIDO',
      )
    )
      throw new ConflictException(
        'Revisa y valida todos los documentos solicitados antes de continuar.',
      );
    for (const p of row.inscripcion_estudiantes) {
      if (!p.estudiantes.usuarios.whatsapp_confirmado_at)
        throw new ConflictException(
          `Falta confirmar el contacto de ${p.estudiantes.matricula}.`,
        );
      const career = p.estudiantes.estudiante_carreras.find(
        (c) =>
          c.id_recinto_carrera === row.ofertas.id_recinto_carrera &&
          c.estado === 'ACTIVA',
      );
      if (!career)
        throw new ConflictException(
          'El participante no tiene una carrera compatible activa.',
        );
      const result = await this.students.eligibility(
        p.id_estudiante.toString(),
        career.id_estudiante_carrera.toString(),
      );
      if (!result.eligible)
        throw new ConflictException(
          `${p.estudiantes.matricula}: ${result.reason}`,
        );
    }
    return this.prisma.$transaction(async (db) => {
      const updated = await db.inscripciones.updateMany({
        where: {
          id_inscripcion: row.id_inscripcion,
          version_lock: row.version_lock,
          deuda_abierta_at: null,
        },
        data: {
          validado_at: new Date(),
          validado_por: id(user.id),
          observaciones: dto.observation.trim() || null,
          version_lock: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          'El expediente cambió. Actualiza y revisa de nuevo.',
        );
      await this.audit(db, user, 'VALIDAR_EXPEDIENTE', enrollmentId, {
        documentsComplete: true,
        observation: dto.observation,
      });
      return { id: enrollmentId, validated: true };
    });
  }
  async openDebt(user: AuthenticatedUser, enrollmentId: string) {
    const row = await this.prisma.inscripciones.findUnique({
      where: { id_inscripcion: id(enrollmentId) },
      include: enrollmentInclude,
    });
    if (!row) throw new NotFoundException('Inscripción no encontrada.');
    this.assertActive(row.estados_inscripcion.codigo);
    if (row.deuda_abierta_at) return { id: enrollmentId, debtOpened: true };
    if (!row.validado_at)
      throw new ConflictException(
        'Secretaría debe validar el expediente primero.',
      );
    // Reevaluate immediately before opening a debt, including documents changed since validation.
    await this.validate(user, enrollmentId, {
      documentsComplete: true,
      observation: row.observaciones ?? '',
    });
    return this.prisma.$transaction(async (db) => {
      const state = await db.estados_inscripcion.findUnique({
        where: { codigo: 'PENDIENTE_PAGO' },
      });
      if (!state)
        throw new ConflictException('Estado pendiente de pago no configurado.');
      const changed = await db.inscripciones.updateMany({
        where: {
          id_inscripcion: row.id_inscripcion,
          deuda_abierta_at: null,
          version_lock: row.version_lock + 1,
          fecha_cancelacion: null,
        },
        data: {
          deuda_abierta_at: new Date(),
          deuda_abierta_por: id(user.id),
          id_estado: state.id_estado,
          version_lock: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'La deuda ya cambió. Actualiza la pantalla.',
        );
      await db.historial_estados_inscripcion.create({
        data: {
          id_inscripcion: row.id_inscripcion,
          id_estado_anterior: row.id_estado,
          id_estado_nuevo: state.id_estado,
          cambiado_por: id(user.id),
          motivo: 'Secretaría abrió la deuda del curso.',
        },
      });
      await this.audit(db, user, 'ABRIR_DEUDA', enrollmentId, {
        amount: Number(row.monto_aplicado),
        currency: row.moneda,
      });
      return { id: enrollmentId, debtOpened: true };
    });
  }
  async chooseChannel(
    user: AuthenticatedUser,
    enrollmentId: string,
    channel: 'CAJA' | 'VIRTUAL',
  ) {
    const row = await this.ownedEnrollment(user, enrollmentId);
    if (!row.deuda_abierta_at || row.pagos.some((p) => p.estado === 'APROBADO'))
      throw new ConflictException('No hay una deuda activa por pagar.');
    this.assertActive(row.estados_inscripcion.codigo);
    const result = await this.prisma.inscripciones.updateMany({
      where: {
        id_inscripcion: row.id_inscripcion,
        version_lock: row.version_lock,
      },
      data: { canal_pago: channel, version_lock: { increment: 1 } },
    });
    if (result.count !== 1)
      throw new ConflictException('La deuda cambió. Actualiza.');
    return { id: enrollmentId, channel };
  }
  async simulate(
    user: AuthenticatedUser,
    enrollmentId: string,
    dto: SimulatePaymentDto,
  ) {
    if (dto.simulationAcknowledged !== true)
      throw new BadRequestException('Confirma el uso del simulador.');
    if (dto.channel === 'CAJA' && !granted(user, 'MONOGRAFICO_CAJA'))
      throw new ForbiddenException('El cobro presencial corresponde a Caja.');
    if (dto.channel === 'VIRTUAL')
      await this.ownedEnrollment(user, enrollmentId);
    return this.prisma.$transaction(async (db) => {
      const row = await db.inscripciones.findUnique({
        where: { id_inscripcion: id(enrollmentId) },
        include: enrollmentInclude,
      });
      if (!row) throw new NotFoundException('Inscripción no encontrada.');
      const existing = await db.pagos.findUnique({
        where: { idempotency_key: dto.idempotencyKey },
      });
      if (existing) {
        if (
          existing.id_inscripcion !== row.id_inscripcion ||
          existing.canal !== dto.channel ||
          existing.estado !== dto.outcome ||
          !existing.es_simulado
        )
          throw new ConflictException('Clave utilizada en otra operación.');
        return {
          id: existing.id_pago.toString(),
          status: existing.estado,
          simulated: true,
        };
      }
      this.assertActive(row.estados_inscripcion.codigo);
      if (
        !row.deuda_abierta_at ||
        !row.validado_at ||
        row.canal_pago !== dto.channel
      )
        throw new ConflictException(
          'Secretaría debe abrir la deuda y el estudiante debe elegir este canal.',
        );
      if (
        row.solicitudes_documentos.some(
          (d) => d.documentos_inscripcion[0]?.estado_validacion !== 'VALIDO',
        )
      )
        throw new ConflictException(
          'Existen documentos pendientes de revisión.',
        );
      if (row.ofertas.notas_remitidas_at)
        throw new ConflictException('Este curso ya cerró sus calificaciones.');
      if (row.pagos.some((p) => p.estado === 'APROBADO'))
        throw new ConflictException('La deuda ya está saldada.');
      const lock = await db.inscripciones.updateMany({
        where: {
          id_inscripcion: row.id_inscripcion,
          version_lock: row.version_lock,
        },
        data: { version_lock: { increment: 1 } },
      });
      if (lock.count !== 1)
        throw new ConflictException(
          'Otro cobro está procesando esta deuda. Actualiza antes de reintentar.',
        );
      const method = await db.metodos_pago.findUnique({
        where: { codigo: 'SIMULACION' },
      });
      if (!method)
        throw new ConflictException('Ejecuta la migración del simulador.');
      const suffix = randomUUID();
      const now = new Date();
      const payment = await db.pagos.create({
        data: {
          id_inscripcion: row.id_inscripcion,
          id_metodo_pago: method.id_metodo_pago,
          referencia: `SIM-${suffix}`,
          idempotency_key: dto.idempotencyKey,
          monto: row.monto_aplicado,
          moneda: row.moneda,
          es_simulado: true,
          canal: dto.channel,
          estado: dto.outcome,
          fecha_pago: now,
          aprobado_at: dto.outcome === 'APROBADO' ? now : null,
          rechazado_at: dto.outcome === 'RECHAZADO' ? now : null,
          transacciones_pago: {
            create: {
              proveedor: `SIMULADOR_${dto.channel}`,
              tipo: 'VENTA',
              estado: dto.outcome === 'APROBADO' ? 'APROBADA' : 'RECHAZADA',
              request_reference: suffix,
              response_code: 'SIMULADO',
              response_message: 'Demostración sin movimiento de dinero.',
              response_payload: {
                simulated: true,
                channel: dto.channel,
                reconciled:
                  dto.channel === 'VIRTUAL' && dto.outcome === 'APROBADO',
              },
            },
          },
        },
      });
      if (dto.outcome === 'APROBADO') {
        const principal =
          row.inscripcion_estudiantes.find((p) => p.es_principal) ??
          row.inscripcion_estudiantes[0];
        if (!principal)
          throw new ConflictException('Falta el estudiante de la inscripción.');
        const token = randomUUID();
        await db.facturas.create({
          data: {
            id_pago: payment.id_pago,
            numero_factura: `SIM-${suffix}`,
            numero_recibo: `SIM-REC-${suffix}`,
            recinto_nombre: row.ofertas.recinto_carreras.recintos.nombre,
            matricula: principal.estudiantes.matricula,
            estudiante_nombre: `${principal.estudiantes.usuarios.nombres} ${principal.estudiantes.usuarios.apellidos}`,
            descripcion: `SIMULACIÓN SIN VALIDEZ FISCAL · ${row.ofertas.titulo}`,
            monto: row.monto_aplicado,
            moneda: row.moneda,
            metodo_pago_nombre: `Simulación ${dto.channel === 'CAJA' ? 'Caja local' : 'virtual — Tesorería central'}`,
            qr_token: token,
            qr_hash: createHash('sha256').update(token).digest('hex'),
            pdf_url: `/api/payments/invoices/${payment.id_pago}/pdf`,
            fecha_emision: now,
          },
        });
        const confirmed = await db.estados_inscripcion.findUnique({
          where: { codigo: 'CONFIRMADA' },
        });
        if (!confirmed)
          throw new ConflictException('Estado confirmado no configurado.');
        await db.inscripciones.update({
          where: { id_inscripcion: row.id_inscripcion },
          data: { id_estado: confirmed.id_estado, fecha_confirmacion: now },
        });
        await db.historial_estados_inscripcion.create({
          data: {
            id_inscripcion: row.id_inscripcion,
            id_estado_anterior: row.id_estado,
            id_estado_nuevo: confirmed.id_estado,
            cambiado_por: id(user.id),
            motivo: `Pago simulado ${dto.channel}; sin movimiento de dinero.`,
          },
        });
        if (dto.channel === 'VIRTUAL')
          await this.audit(
            db,
            user,
            'CONCILIAR_VIRTUAL_SIMULADO',
            enrollmentId,
            {
              paymentId: payment.id_pago.toString(),
              amount: Number(payment.monto),
            },
          );
      }
      await this.audit(
        db,
        user,
        dto.channel === 'CAJA'
          ? 'COBRAR_CAJA_SIMULADO'
          : 'PAGAR_VIRTUAL_SIMULADO',
        enrollmentId,
        {
          paymentId: payment.id_pago.toString(),
          outcome: dto.outcome,
          amount: Number(payment.monto),
        },
      );
      return {
        id: payment.id_pago.toString(),
        status: payment.estado,
        simulated: true,
      };
    });
  }
  async policy(
    user: AuthenticatedUser,
    planId: string,
    dto: AcademicPolicyDto,
  ) {
    return this.prisma.$transaction(async (db) => {
      await db.planes_estudio.update({
        where: { id_plan_estudio: id(planId) },
        data: {
          max_asignaturas_pendientes: dto.maxSubjects,
          max_creditos_pendientes: dto.maxCredits,
          desde_semestre: dto.fromSemester,
        },
      });
      await this.audit(db, user, 'CONFIGURAR_ELEGIBILIDAD', planId, { ...dto });
      return { id: planId };
    });
  }
  async group(user: AuthenticatedUser, offerId: string, dto: CourseGroupDto) {
    if (dto.coordinatorId) {
      const current = await this.prisma.ofertas.findUnique({
        where: { id_oferta: id(offerId) },
        select: { coordinador_id: true },
      });
      if (current?.coordinador_id !== id(dto.coordinatorId))
        throw new BadRequestException(
          'Registra la designación recibida de la Escuela en Coordinación académica.',
        );
    }
    return this.prisma.$transaction(async (db) => {
      await db.ofertas.update({
        where: { id_oferta: id(offerId) },
        data: {
          grupo_whatsapp: dto.whatsappUrl || null,
          presupuesto_docencia: dto.teachingBudget,
          presupuesto_materiales: dto.materialsBudget,
        },
      });
      await this.audit(db, user, 'ORGANIZAR_GRUPO', offerId, { ...dto });
      return { id: offerId };
    });
  }
  async grade(user: AuthenticatedUser, enrollmentId: string, dto: GradeDto) {
    return this.prisma.$transaction(async (db) => {
      const row = await db.inscripciones.findUnique({
        where: { id_inscripcion: id(enrollmentId) },
        include: enrollmentInclude,
      });
      if (!row || row.ofertas.coordinador_id !== id(user.id))
        throw new ForbiddenException(
          'Solo el coordinador asignado a este curso puede registrar notas.',
        );
      if (
        !row.pagos.some((p) => p.estado === 'APROBADO') ||
        !row.inscripcion_estudiantes.some(
          (p) => p.id_estudiante === id(dto.studentId),
        )
      )
        throw new ConflictException(
          'El estudiante debe estar inscrito y tener el pago aprobado.',
        );
      const locked = await db.ofertas.updateMany({
        where: {
          id_oferta: row.id_oferta,
          notas_remitidas_at: null,
          coordinador_id: id(user.id),
        },
        data: { updated_at: new Date() },
      });
      if (locked.count !== 1)
        throw new ConflictException(
          'Las notas ya fueron remitidas o cambió la asignación.',
        );
      await db.notas_monografico.upsert({
        where: {
          id_inscripcion_id_estudiante: {
            id_inscripcion: row.id_inscripcion,
            id_estudiante: id(dto.studentId),
          },
        },
        create: {
          id_inscripcion: row.id_inscripcion,
          id_estudiante: id(dto.studentId),
          nota: dto.grade,
          observacion: dto.observation,
          registrado_por: id(user.id),
        },
        update: {
          nota: dto.grade,
          observacion: dto.observation,
          registrado_por: id(user.id),
          updated_at: new Date(),
        },
      });
      await this.audit(db, user, 'REGISTRAR_NOTA', enrollmentId, { ...dto });
      return { id: enrollmentId };
    });
  }
  async remit(user: AuthenticatedUser, offerId: string) {
    return this.prisma.$transaction(async (db) => {
      const locked = await db.ofertas.updateMany({
        where: { id_oferta: id(offerId), notas_remitidas_at: null },
        data: {
          notas_remitidas_at: new Date(),
          notas_remitidas_por: id(user.id),
        },
      });
      if (locked.count !== 1)
        throw new ConflictException('La plantilla ya fue remitida.');
      const rows = await db.inscripciones.findMany({
        where: {
          id_oferta: id(offerId),
          pagos: { some: { estado: 'APROBADO' } },
          fecha_cancelacion: null,
        },
        include: { inscripcion_estudiantes: true, notas_monografico: true },
      });
      if (
        !rows.length ||
        rows.some((r) =>
          r.inscripcion_estudiantes.some(
            (p) =>
              !r.notas_monografico.some(
                (n) => n.id_estudiante === p.id_estudiante,
              ),
          ),
        )
      )
        throw new ConflictException(
          'Completa las notas de todos los estudiantes pagados antes de remitir.',
        );
      await this.audit(db, user, 'REMITIR_NOTAS', offerId, {
        enrollments: rows.length,
        destination: 'Dirección del Recinto',
      });
      return { id: offerId, remitted: true };
    });
  }
  private async ownedEnrollment(user: AuthenticatedUser, enrollmentId: string) {
    const row = await this.prisma.inscripciones.findFirst({
      where: {
        id_inscripcion: id(enrollmentId),
        inscripcion_estudiantes: {
          some: { estudiantes: { id_usuario: id(user.id) } },
        },
      },
      include: enrollmentInclude,
    });
    if (!row) throw new NotFoundException('Inscripción propia no encontrada.');
    return row;
  }
  private assertActive(status: string) {
    if (
      [
        'CANCELADA',
        'RECHAZADA',
        'NO_ELEGIBLE',
        'CONFIRMADA',
        'PAGADA',
      ].includes(status)
    )
      throw new ConflictException('La inscripción no admite esta operación.');
  }
  private audit(
    db: Prisma.TransactionClient,
    user: AuthenticatedUser,
    action: string,
    recordId: string,
    data: Prisma.InputJsonObject,
  ) {
    return db.auditoria.create({
      data: {
        id_usuario: id(user.id),
        accion: action,
        entidad: 'monografico',
        entidad_id: recordId,
        datos_nuevos: data,
      },
    });
  }
}
