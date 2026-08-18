import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { catchError, from, map, Observable, of, switchMap, timer } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

export interface NotificationStreamEvent {
  data: { totalCount: number; unreadCount: number; version: string };
  retry?: number;
  type: 'notifications';
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const id = parseId(userId);
    const [items, unreadCount] = await Promise.all([
      this.prisma.notificaciones.findMany({
        where: { id_usuario: id },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      this.prisma.notificaciones.count({
        where: { id_usuario: id, leida: false },
      }),
    ]);

    return {
      unreadCount,
      items: items.map((notification) => ({
        id: notification.id_notificacion.toString(),
        type: notification.tipo,
        title: notification.titulo,
        message: notification.mensaje,
        url: notification.url,
        read: notification.leida,
        readAt: notification.fecha_lectura,
        createdAt: notification.created_at,
      })),
    };
  }

  async getUnreadCount(userId: string) {
    return {
      unreadCount: await this.prisma.notificaciones.count({
        where: { id_usuario: parseId(userId), leida: false },
      }),
    };
  }

  stream(userId: string): Observable<NotificationStreamEvent> {
    return timer(0, 2_500).pipe(
      switchMap(() =>
        from(this.snapshot(userId)).pipe(
          catchError(() =>
            of({ totalCount: 0, unreadCount: 0, version: 'retry' }),
          ),
        ),
      ),
      distinctUntilChanged(
        (previous, current) =>
          previous.unreadCount === current.unreadCount &&
          previous.totalCount === current.totalCount &&
          previous.version === current.version,
      ),
      map((data) => ({ data, retry: 5_000, type: 'notifications' as const })),
    );
  }

  async create(dto: CreateNotificationDto) {
    const recipientIds = new Set(
      (dto.userIds ?? []).map((id) => parseId(id).toString()),
    );
    if (dto.roleCodes?.length) {
      const usersByRole = await this.prisma.usuario_roles.findMany({
        where: {
          roles: {
            codigo: { in: dto.roleCodes.map((code) => code.toUpperCase()) },
          },
          usuarios_usuario_roles_id_usuarioTousuarios: {
            deleted_at: null,
            estado: 'ACTIVO',
          },
        },
        select: { id_usuario: true },
      });
      usersByRole.forEach(({ id_usuario }) =>
        recipientIds.add(id_usuario.toString()),
      );
    }

    if (!recipientIds.size) {
      throw new BadRequestException(
        'Debes indicar al menos un usuario o rol destinatario.',
      );
    }

    const now = new Date();
    const result = await this.prisma.notificaciones.createMany({
      data: [...recipientIds].map((idUsuario) => ({
        canal: 'IN_APP',
        estado_envio: 'ENVIADA',
        enviada_at: now,
        id_usuario: BigInt(idUsuario),
        mensaje: dto.message.trim(),
        tipo: dto.type.trim().toUpperCase(),
        titulo: dto.title.trim(),
        url: dto.url?.trim() || null,
      })),
    });
    return { created: result.count };
  }

  async markRead(id: string, userId: string) {
    const result = await this.prisma.notificaciones.updateMany({
      where: { id_notificacion: parseId(id), id_usuario: parseId(userId) },
      data: { fecha_lectura: new Date(), leida: true },
    });
    if (!result.count)
      throw new NotFoundException('Notificación no encontrada.');
    return { updated: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notificaciones.updateMany({
      where: { id_usuario: parseId(userId), leida: false },
      data: { fecha_lectura: new Date(), leida: true },
    });
    return { updated: result.count };
  }

  async remove(id: string, userId: string) {
    const result = await this.prisma.notificaciones.deleteMany({
      where: { id_notificacion: parseId(id), id_usuario: parseId(userId) },
    });
    if (!result.count)
      throw new NotFoundException('Notificación no encontrada.');
    return { deleted: true };
  }

  async removeAll(userId: string) {
    const result = await this.prisma.notificaciones.deleteMany({
      where: { id_usuario: parseId(userId) },
    });
    return { deleted: result.count };
  }

  private async snapshot(userId: string) {
    const id = parseId(userId);
    const [totalCount, unreadCount, latest] = await Promise.all([
      this.prisma.notificaciones.count({ where: { id_usuario: id } }),
      this.prisma.notificaciones.count({
        where: { id_usuario: id, leida: false },
      }),
      this.prisma.notificaciones.findFirst({
        where: { id_usuario: id },
        orderBy: { created_at: 'desc' },
        select: { id_notificacion: true, created_at: true, leida: true },
      }),
    ]);
    return {
      totalCount,
      unreadCount,
      version: latest
        ? `${latest.id_notificacion}:${latest.created_at.toISOString()}:${latest.leida}`
        : 'empty',
    };
  }
}

function parseId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador inválido.');
  }
}
