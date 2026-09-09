import { BadRequestException, Injectable } from '@nestjs/common';
import { IsOptional, Matches } from 'class-validator';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
export class InsightsQuery {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
}
export function insightPeriod(query: InsightsQuery, now = new Date()) {
  const today = day(now);
  const from = query.from ?? day(new Date(now.getTime() - 29 * 86400000));
  const to = query.to ?? today;
  const start = new Date(`${from}T00:00:00-04:00`);
  const end = new Date(`${to}T23:59:59.999-04:00`);
  const days = Math.round((end.getTime() + 1 - start.getTime()) / 86400000);
  if (
    !Number.isFinite(days) ||
    days < 1 ||
    days > 366 ||
    day(start) !== from ||
    day(end) !== to
  )
    throw new BadRequestException(
      'Selecciona un rango válido de hasta 366 días.',
    );
  return {
    from,
    to,
    start,
    end,
    days,
    previous: new Date(start.getTime() - days * 86400000),
  };
}
function day(date: Date) {
  return new Date(date.getTime() - 4 * 3600000).toISOString().slice(0, 10);
}
@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}
  async load(user: AuthenticatedUser, query: InsightsQuery) {
    const period = insightPeriod(query);
    const userId = BigInt(user.id);
    const staff =
      user.roles.some((r) =>
        [
          'ADMIN',
          'COORDINADOR',
          'ENCARGADO',
          'SECRETARIA',
          'OFICINISTA',
          'CAJA',
          'TESORERIA',
        ].includes(r),
      ) || user.permissions.includes('GENERAL_REPORTES_LEER');
    const teacher =
      !staff &&
      user.roles.some((r) =>
        ['DOCENTE', 'COORDINADOR_MONOGRAFICO', 'ASESOR', 'JURADO'].includes(r),
      );
    const scope: Prisma.inscripcionesWhereInput = staff
      ? {}
      : teacher
        ? { ofertas: { coordinador_id: userId } }
        : {
            inscripcion_estudiantes: {
              some: { estudiantes: { id_usuario: userId } },
            },
          };
    const dates = { gte: period.start, lte: period.end };
    const [rows, previous, sessions, events, payments, queue] =
      await Promise.all([
        this.prisma.inscripciones.findMany({
          where: { ...scope, fecha_solicitud: dates },
          select: {
            id_inscripcion: true,
            fecha_solicitud: true,
            estados_inscripcion: { select: { nombre: true, codigo: true } },
            ofertas: {
              select: {
                titulo: true,
                modalidad_ensenanza: true,
                recinto_carreras: {
                  select: {
                    carreras: { select: { nombre: true } },
                    recintos: { select: { nombre: true } },
                  },
                },
              },
            },
          },
        }),
        this.prisma.inscripciones.count({
          where: {
            ...scope,
            fecha_solicitud: { gte: period.previous, lt: period.start },
          },
        }),
        this.prisma.sesiones.findMany({
          where: {
            created_at: dates,
            ...(!staff ? { id_usuario: userId } : {}),
          },
          select: { created_at: true, id_usuario: true },
        }),
        this.prisma.auditoria.findMany({
          where: {
            created_at: dates,
            ...(!staff ? { id_usuario: userId } : {}),
          },
          select: {
            id_auditoria: true,
            accion: true,
            entidad: true,
            entidad_id: true,
            id_usuario: true,
            created_at: true,
            datos_nuevos: true,
            usuarios: { select: { nombres: true, apellidos: true } },
          },
          orderBy: { created_at: 'desc' },
        }),
        this.prisma.pagos.findMany({
          where: {
            estado: 'APROBADO',
            fecha_pago: dates,
            inscripciones: scope,
          },
          select: { monto: true, moneda: true, es_simulado: true, canal: true },
        }),
        this.prisma.inscripciones.findMany({
          where: {
            ...scope,
            fecha_cancelacion: null,
            estados_inscripcion: {
              codigo: {
                notIn: [
                  'CONFIRMADA',
                  'PAGADA',
                  'RECHAZADA',
                  'CANCELADA',
                  'NO_ELEGIBLE',
                ],
              },
            },
          },
          select: {
            id_inscripcion: true,
            codigo: true,
            recibido_at: true,
            validado_at: true,
            deuda_abierta_at: true,
            monto_aplicado: true,
            moneda: true,
            fecha_solicitud: true,
            ofertas: { select: { titulo: true } },
          },
          orderBy: { fecha_solicitud: 'asc' },
        }),
      ]);
    const series = Array.from({ length: period.days }, (_, i) => ({
      date: day(new Date(period.start.getTime() + i * 86400000)),
      enrollments: 0,
      sessions: 0,
      events: 0,
    }));
    const seriesMap = new Map(series.map((x) => [x.date, x]));
    for (const row of rows) {
      const point = seriesMap.get(day(row.fecha_solicitud));
      if (point) point.enrollments++;
    }
    for (const session of sessions) {
      const point = seriesMap.get(day(session.created_at));
      if (point) point.sessions++;
    }
    for (const event of events) {
      const point = seriesMap.get(day(event.created_at));
      if (point) point.events++;
    }
    const breakdown = (values: string[]) => {
      const counts = new Map<string, number>();
      for (const value of values)
        counts.set(value, (counts.get(value) ?? 0) + 1);
      return [...counts]
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total);
    };
    const balances = new Map<
      string,
      {
        currency: string;
        cash: number;
        virtual: number;
        historical: number;
        pending: number;
      }
    >();
    const balance = (currency: string) => {
      if (!balances.has(currency))
        balances.set(currency, {
          currency,
          cash: 0,
          virtual: 0,
          historical: 0,
          pending: 0,
        });
      return balances.get(currency)!;
    };
    for (const payment of payments) {
      const target = balance(payment.moneda);
      if (!payment.es_simulado) target.historical += Number(payment.monto);
      else if (payment.canal === 'CAJA') target.cash += Number(payment.monto);
      else target.virtual += Number(payment.monto);
    }
    for (const row of queue)
      if (row.deuda_abierta_at)
        balance(row.moneda).pending += Number(row.monto_aplicado);
    const activeUsers = new Set(sessions.map((s) => s.id_usuario.toString()));
    for (const event of events)
      if (event.id_usuario) activeUsers.add(event.id_usuario.toString());
    const errors = events.filter(
      (e) =>
        e.datos_nuevos &&
        typeof e.datos_nuevos === 'object' &&
        !Array.isArray(e.datos_nuevos) &&
        e.datos_nuevos.outcome === 'ERROR',
    ).length;
    const priorityQueue = queue.slice(0, 6);
    const latestEvents = events.slice(0, 50);
    return {
      generatedAt: new Date().toISOString(),
      period: { from: period.from, to: period.to, days: period.days },
      scope: staff
        ? 'Institucional'
        : teacher
          ? 'Cursos asignados'
          : 'Mi actividad',
      kpis: {
        enrollments: rows.length,
        previousEnrollments: previous,
        activeUsers: activeUsers.size,
        sessions: sessions.length,
        events: events.length,
        errors,
        approvedPayments: payments.length,
      },
      series,
      states: breakdown(rows.map((r) => r.estados_inscripcion.nombre)),
      careers: breakdown(
        rows.map((r) => r.ofertas.recinto_carreras.carreras.nombre),
      ),
      campuses: breakdown(
        rows.map((r) => r.ofertas.recinto_carreras.recintos.nombre),
      ),
      teachingModes: breakdown(
        rows.map((r) => r.ofertas.modalidad_ensenanza ?? 'Sin definir'),
      ),
      finances: [...balances.values()],
      pending: {
        total: queue.length,
        intake: queue.filter((r) => !r.recibido_at).length,
        validation: queue.filter((r) => r.recibido_at && !r.validado_at).length,
        debt: queue.filter((r) => r.validado_at && !r.deuda_abierta_at).length,
        payment: queue.filter((r) => r.deuda_abierta_at).length,
        items: priorityQueue.map((r) => ({
          id: r.id_inscripcion.toString(),
          code: r.codigo,
          offer: r.ofertas.titulo,
          since: r.fecha_solicitud,
          step: !r.recibido_at
            ? 'Recepción'
            : !r.validado_at
              ? 'Validación'
              : !r.deuda_abierta_at
                ? 'Abrir deuda'
                : 'Pago',
        })),
      },
      activity: latestEvents.map((e) => ({
        id: e.id_auditoria.toString(),
        action: e.accion,
        outcome: activityOutcome(e.accion, e.datos_nuevos),
        actorId: e.id_usuario?.toString() ?? null,
        entity: e.entidad,
        actor: e.usuarios
          ? `${e.usuarios.nombres} ${e.usuarios.apellidos}`
          : 'Actor no registrado',
        date: e.created_at,
      })),
      modules: breakdown(events.map((e) => e.entidad)),
      methodology:
        'El período filtra solicitudes por fecha de solicitud, pagos por fecha de pago y actividad por fecha del evento. Los pendientes son una fotografía actual. Usuarios activos = usuarios distintos con sesión iniciada o evento auditado; no mide visitantes ni consumo de infraestructura. Los importes simulados se separan del histórico.',
    };
  }
}

export function activityOutcome(
  action: string,
  data: unknown,
): 'success' | 'error' | 'unknown' | 'rejected' {
  const details =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  if (details.outcome === 'ERROR') return 'error';
  if (
    details.outcome === 'RECHAZADO' &&
    ['COBRAR_CAJA_SIMULADO', 'PAGAR_VIRTUAL_SIMULADO'].includes(action)
  )
    return 'rejected';
  if (details.outcome === 'EXITO' || details.outcome === 'APROBADO')
    return 'success';
  // These business events are recorded only after their transaction succeeds.
  if (
    [
      'RECIBIR_EXPEDIENTE',
      'VALIDAR_EXPEDIENTE',
      'ABRIR_DEUDA',
      'CONFIRMAR_CONTACTO',
      'CONCILIAR_VIRTUAL_SIMULADO',
      'ORGANIZAR_GRUPO',
      'REGISTRAR_NOTA',
      'REMITIR_NOTAS',
      'CONFIGURAR_ELEGIBILIDAD',
    ].includes(action)
  )
    return 'success';
  return 'unknown';
}
