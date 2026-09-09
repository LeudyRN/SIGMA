import type { Prisma } from '../../generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

export interface DashboardSummary {
  audience: string;
  generatedAt: string;
  metrics: Array<{ label: string; value: number; detail: string }>;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(user: AuthenticatedUser): Promise<DashboardSummary> {
    const now = new Date();
    if (
      user.roles.some((role) =>
        [
          'ENCARGADO',
          'SECRETARIA',
          'OFICINISTA',
          'CAJA',
          'COORDINADOR_MONOGRAFICO',
        ].includes(role),
      )
    )
      return this.monographSummary(user, now);
    if (user.roles.includes('ESTUDIANTE'))
      return this.studentSummary(user, now);
    if (user.roles.includes('TESORERIA')) return this.treasurySummary(now);
    if (
      user.roles.some((role) => ['DOCENTE', 'ASESOR', 'JURADO'].includes(role))
    )
      return this.teacherSummary(user, now);

    const [
      totalUsers,
      activeUsers,
      roles,
      students,
      publishedOffers,
      enrollments,
      approvedPayments,
      activeSessions,
    ] = await Promise.all([
      this.prisma.usuarios.count({ where: { deleted_at: null } }),
      this.prisma.usuarios.count({
        where: { deleted_at: null, estado: 'ACTIVO' },
      }),
      this.prisma.roles.count({ where: { estado: 'ACTIVO' } }),
      this.prisma.estudiantes.count(),
      this.prisma.ofertas.count({ where: { estado: 'PUBLICADA' } }),
      this.prisma.inscripciones.count(),
      this.prisma.pagos.count({ where: { estado: 'APROBADO' } }),
      this.prisma.sesiones.count({
        where: { expira_at: { gt: now }, revocada_at: null },
      }),
    ]);

    return {
      audience: user.roles.includes('ADMIN') ? 'ADMIN' : 'COORDINADOR',
      generatedAt: now.toISOString(),
      metrics: [
        {
          label: 'Usuarios registrados',
          value: totalUsers,
          detail: `${activeUsers} cuentas activas`,
        },
        {
          label: 'Perfiles estudiantiles',
          value: students,
          detail: `${roles} roles activos`,
        },
        {
          label: 'Inscripciones',
          value: enrollments,
          detail: `${publishedOffers} ofertas publicadas`,
        },
        {
          label: 'Pagos aprobados',
          value: approvedPayments,
          detail: `${activeSessions} sesiones activas`,
        },
      ],
    };
  }

  private async monographSummary(
    user: AuthenticatedUser,
    now: Date,
  ): Promise<DashboardSummary> {
    const teacher =
      user.roles.includes('COORDINADOR_MONOGRAFICO') &&
      !user.roles.some((r) =>
        ['ENCARGADO', 'SECRETARIA', 'OFICINISTA', 'CAJA', 'ADMIN'].includes(r),
      );
    const where: Prisma.inscripcionesWhereInput = teacher
      ? { ofertas: { coordinador_id: BigInt(user.id) } }
      : {};
    const [enrollments, waiting, debt, paid] = await Promise.all([
      this.prisma.inscripciones.count({ where }),
      this.prisma.inscripciones.count({
        where: {
          ...where,
          validado_at: null,
          fecha_cancelacion: null,
          pagos: { none: { estado: 'APROBADO' } },
        },
      }),
      this.prisma.inscripciones.count({
        where: {
          ...where,
          deuda_abierta_at: { not: null },
          fecha_cancelacion: null,
          pagos: { none: { estado: 'APROBADO' } },
        },
      }),
      this.prisma.inscripciones.count({
        where: { ...where, pagos: { some: { estado: 'APROBADO' } } },
      }),
    ]);
    return {
      audience: user.roles[0] ?? 'UCOTESIS',
      generatedAt: now.toISOString(),
      metrics: [
        {
          label: teacher ? 'Inscripciones de mis cursos' : 'Expedientes',
          value: enrollments,
          detail: 'Seguimiento de monográficos',
        },
        {
          label: 'Por revisar',
          value: waiting,
          detail: 'Recepción y validación de Secretaría',
        },
        {
          label: 'Deudas activas',
          value: debt,
          detail: 'Pendientes del canal elegido',
        },
        {
          label: 'Inscripciones saldadas',
          value: paid,
          detail: 'Incluye pagos simulados identificados en el informe',
        },
      ],
    };
  }

  private async studentSummary(
    user: AuthenticatedUser,
    now: Date,
  ): Promise<DashboardSummary> {
    const student = await this.prisma.estudiantes.findUnique({
      where: { id_usuario: BigInt(user.id) },
      select: {
        id_estudiante: true,
        estudiante_carreras: { select: { id_recinto_carrera: true } },
      },
    });
    if (!student)
      return {
        audience: 'ESTUDIANTE',
        generatedAt: now.toISOString(),
        metrics: [],
      };
    const campusCareerIds = student.estudiante_carreras.map(
      (item) => item.id_recinto_carrera,
    );
    const [careers, offers, enrollments, invoices] = await Promise.all([
      this.prisma.estudiante_carreras.count({
        where: { id_estudiante: student.id_estudiante },
      }),
      this.prisma.ofertas.count({
        where: {
          id_recinto_carrera: { in: campusCareerIds },
          estado: 'PUBLICADA',
          fecha_inicio_inscripcion: { lte: now },
          fecha_fin_inscripcion: { gte: now },
        },
      }),
      this.prisma.inscripcion_estudiantes.count({
        where: { id_estudiante: student.id_estudiante },
      }),
      this.prisma.facturas.count({
        where: {
          pagos: {
            inscripciones: {
              inscripcion_estudiantes: {
                some: { id_estudiante: student.id_estudiante },
              },
            },
          },
        },
      }),
    ]);
    return {
      audience: 'ESTUDIANTE',
      generatedAt: now.toISOString(),
      metrics: [
        {
          label: 'Carreras asociadas',
          value: careers,
          detail: 'Expediente institucional',
        },
        {
          label: 'Ofertas disponibles',
          value: offers,
          detail: 'Según recinto y carrera',
        },
        {
          label: 'Mis inscripciones',
          value: enrollments,
          detail: 'Solicitudes del proceso de grado',
        },
        {
          label: 'Facturas digitales',
          value: invoices,
          detail: 'Comprobantes disponibles',
        },
      ],
    };
  }

  private async treasurySummary(now: Date): Promise<DashboardSummary> {
    const [pending, approved, transactions, reconciliations] =
      await Promise.all([
        this.prisma.pagos.count({
          where: { estado: { in: ['CREADO', 'PENDIENTE', 'PROCESANDO'] } },
        }),
        this.prisma.pagos.count({ where: { estado: 'APROBADO' } }),
        this.prisma.transacciones_pago.count(),
        this.prisma.conciliaciones_pago.count({
          where: { estado: { not: 'CERRADA' } },
        }),
      ]);
    return {
      audience: 'TESORERIA',
      generatedAt: now.toISOString(),
      metrics: [
        {
          label: 'Pagos pendientes',
          value: pending,
          detail: 'Requieren seguimiento',
        },
        {
          label: 'Pagos aprobados',
          value: approved,
          detail: 'Confirmados en la plataforma',
        },
        {
          label: 'Transacciones',
          value: transactions,
          detail: 'Operaciones del proveedor',
        },
        {
          label: 'Conciliaciones abiertas',
          value: reconciliations,
          detail: 'Pendientes de cierre',
        },
      ],
    };
  }

  private async teacherSummary(
    user: AuthenticatedUser,
    now: Date,
  ): Promise<DashboardSummary> {
    const teacher = await this.prisma.docentes.findUnique({
      where: { id_usuario: BigInt(user.id) },
    });
    const [
      activeAssignments,
      assignedProjects,
      pendingReviews,
      removedAssignments,
    ] = teacher
      ? await Promise.all([
          this.prisma.proyecto_docentes.count({
            where: { id_docente: teacher.id_docente, estado: 'ACTIVO' },
          }),
          this.prisma.proyectos_grado.count({
            where: {
              proyecto_docentes: {
                some: { id_docente: teacher.id_docente, estado: 'ACTIVO' },
              },
            },
          }),
          this.prisma.proyectos_grado.count({
            where: {
              estado: 'EN_REVISION',
              proyecto_docentes: {
                some: { id_docente: teacher.id_docente, estado: 'ACTIVO' },
              },
            },
          }),
          this.prisma.proyecto_docentes.count({
            where: { id_docente: teacher.id_docente, estado: 'REMOVIDO' },
          }),
        ])
      : [0, 0, 0, 0];
    return {
      audience: 'DOCENTE',
      generatedAt: now.toISOString(),
      metrics: [
        {
          label: 'Asignaciones activas',
          value: activeAssignments,
          detail: 'Asesorías y jurados vigentes',
        },
        {
          label: 'Proyectos asignados',
          value: assignedProjects,
          detail: 'Seguimiento académico',
        },
        {
          label: 'Revisiones pendientes',
          value: pendingReviews,
          detail: 'Proyectos actualmente en revisión',
        },
        {
          label: 'Participaciones cerradas',
          value: removedAssignments,
          detail: 'Histórico docente',
        },
      ],
    };
  }

  async getReports() {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [
      loginsLast30Days,
      activeSessions,
      students,
      enrollments,
      approvedPayments,
      publishedOffers,
      enrollmentRows,
      apiActivity,
    ] = await Promise.all([
      this.prisma.sesiones.count({ where: { created_at: { gte: since } } }),
      this.prisma.sesiones.count({
        where: { expira_at: { gt: now }, revocada_at: null },
      }),
      this.prisma.estudiantes.count({
        where: { usuarios: { deleted_at: null } },
      }),
      this.prisma.inscripciones.count(),
      this.prisma.pagos.count({ where: { estado: 'APROBADO' } }),
      this.prisma.ofertas.count({ where: { estado: 'PUBLICADA' } }),
      this.prisma.inscripciones.findMany({
        select: {
          ofertas: {
            select: {
              modalidades: { select: { nombre: true } },
              modalidad_ensenanza: true,
              recinto_carreras: {
                select: {
                  carreras: { select: { nombre: true } },
                  recintos: { select: { nombre: true } },
                },
              },
              oferta_areas: {
                select: { areas_investigacion: { select: { nombre: true } } },
              },
            },
          },
        },
      }),
      this.prisma.auditoria.groupBy({
        by: ['entidad', 'accion'],
        where: { created_at: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { accion: 'desc' } },
        take: 50,
      }),
    ]);

    const byCampus = new Map<string, number>();
    const byCareer = new Map<string, number>();
    const byModality = new Map<string, number>();
    const byTeachingMode = new Map<string, number>();
    const byArea = new Map<string, number>();
    for (const row of enrollmentRows) {
      increment(byCampus, row.ofertas.recinto_carreras.recintos.nombre);
      increment(byCareer, row.ofertas.recinto_carreras.carreras.nombre);
      increment(byModality, row.ofertas.modalidades.nombre);
      const labels = {
        PRESENCIAL: 'Presencial',
        VIRTUAL: 'Virtual',
        SEMIPRESENCIAL: 'Semipresencial',
      };
      increment(
        byTeachingMode,
        row.ofertas.modalidad_ensenanza
          ? labels[row.ofertas.modalidad_ensenanza]
          : 'Modalidad por definir',
      );
      for (const area of row.ofertas.oferta_areas) {
        increment(byArea, area.areas_investigacion.nombre);
      }
    }

    return {
      generatedAt: now.toISOString(),
      period: { from: since.toISOString(), to: now.toISOString(), days: 30 },
      actualUsage: {
        logins: loginsLast30Days,
        activeSessions,
        students,
        enrollments,
        approvedPayments,
        publishedOffers,
      },
      enrollments: {
        byCampus: mapBreakdown(byCampus),
        byCareer: mapBreakdown(byCareer),
        byModality: mapBreakdown(byModality),
        byTeachingMode: mapBreakdown(byTeachingMode),
        byArea: mapBreakdown(byArea),
      },
      apiDbConsumption: {
        totalOperations: apiActivity.reduce(
          (total, item) => total + item._count._all,
          0,
        ),
        items: apiActivity.map((item) => ({
          entity: item.entidad,
          action: item.accion,
          operations: item._count._all,
        })),
        source: 'auditoria',
      },
    };
  }
}

function increment(target: Map<string, number>, key: string) {
  target.set(key, (target.get(key) ?? 0) + 1);
}

function mapBreakdown(source: Map<string, number>) {
  return [...source.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort(
      (left, right) =>
        right.total - left.total || left.label.localeCompare(right.label),
    );
}
