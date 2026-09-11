import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class AcademicAlertsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(AcademicAlertsService.name);
  constructor(private readonly db: PrismaService) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, 60000);
    this.timer.unref();
    void this.tick();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async tick(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const milestones = await this.db.hitos_academicos.findMany({
        where: {
          estado: 'PROGRAMADO',
          fecha_limite: { lte: new Date(now.getTime() + 86400000) },
        },
        include: { oferta: { select: { coordinador_id: true } } },
      });
      for (const h of milestones) {
        const projects = await this.db.proyectos_grado.findMany({
          where: {
            inscripciones: { id_oferta: h.id_oferta, fecha_cancelacion: null },
            estado: { notIn: ['CANCELADO', 'FINALIZADO'] },
            ...(h.id_proyecto ? { id_proyecto: h.id_proyecto } : {}),
          },
          include: {
            inscripciones: {
              include: {
                inscripcion_estudiantes: { include: { estudiantes: true } },
              },
            },
            proyecto_docentes: {
              where: { estado: 'ACTIVO' },
              include: { docentes: true },
            },
            entregas_academicas: {
              where: { id_hito: h.id_hito },
              orderBy: { id_entrega: 'desc' },
              take: 1,
            },
          },
        });
        const recipients = new Set<string>();
        for (const p of projects) {
          if (
            ['AVANCE', 'DEFENSA'].includes(h.tipo) &&
            ['PENDIENTE', 'APROBADO'].includes(
              p.entregas_academicas[0]?.estado ?? '',
            )
          )
            continue;
          p.inscripciones.inscripcion_estudiantes.forEach((s) =>
            recipients.add(s.estudiantes.id_usuario.toString()),
          );
          p.proyecto_docentes.forEach((t) =>
            recipients.add(t.docentes.id_usuario.toString()),
          );
          if (h.oferta.coordinador_id)
            recipients.add(h.oferta.coordinador_id.toString());
        }
        if (!h.id_proyecto) {
          const enrollments = await this.db.inscripciones.findMany({
            where: {
              id_oferta: h.id_oferta,
              fecha_cancelacion: null,
              estados_inscripcion: { codigo: 'CONFIRMADA' },
              ...(['AVANCE', 'DEFENSA'].includes(h.tipo)
                ? { proyectos_grado: null }
                : {}),
            },
            select: {
              inscripcion_estudiantes: {
                select: { estudiantes: { select: { id_usuario: true } } },
              },
            },
          });
          enrollments.forEach((e) =>
            e.inscripcion_estudiantes.forEach((s) =>
              recipients.add(s.estudiantes.id_usuario.toString()),
            ),
          );
          if (enrollments.length && h.oferta.coordinador_id)
            recipients.add(h.oferta.coordinador_id.toString());
        }
        const type = h.fecha_limite <= now ? 'VENCIDO' : 'PROXIMO';
        for (const uid of recipients) {
          await this.db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id_hito FROM hitos_academicos WHERE id_hito=${h.id_hito} FOR UPDATE`;
            const current = await tx.hitos_academicos.findUnique({
              where: { id_hito: h.id_hito },
              select: { version: true, estado: true },
            });
            if (
              current?.version !== h.version ||
              current.estado !== 'PROGRAMADO'
            )
              return;
            const inserted = await tx.alertas_academicas.createMany({
              data: [
                {
                  id_hito: h.id_hito,
                  version: h.version,
                  id_usuario: BigInt(uid),
                  tipo: type,
                },
              ],
              skipDuplicates: true,
            });
            if (!inserted.count) return;
            await tx.notificaciones.create({
              data: {
                id_usuario: BigInt(uid),
                tipo: 'CRONOGRAMA',
                titulo:
                  type === 'VENCIDO'
                    ? 'Fecha del cronograma alcanzada'
                    : 'Actividad en las próximas 24 horas',
                mensaje: `${h.titulo} · ${h.fecha_limite.toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' })}. Consulta el cronograma de tu grupo.`,
                url: '/app/coordinacion-academica',
                estado_envio: 'ENVIADA',
                enviada_at: now,
              },
            });
          });
        }
      }
    } catch (error) {
      this.logger.error(
        'No fue posible generar alertas del cronograma.',
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
