import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser) {
    const administrator = await this.isAdministrator(user.id);
    const sessions = await this.prisma.sesiones.findMany({
      where: administrator ? {} : { id_usuario: BigInt(user.id) },
      include: {
        usuarios: {
          select: {
            id_usuario: true,
            matricula: true,
            codigo_empleado: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return {
      items: sessions.map((session) => ({
        id: session.id_sesion.toString(),
        isCurrent: session.id_sesion.toString() === user.sessionId,
        status: session.revocada_at
          ? 'REVOCADA'
          : session.expira_at <= new Date()
            ? 'EXPIRADA'
            : 'ACTIVA',
        ip: session.ip,
        userAgent: session.user_agent,
        expiresAt: session.expira_at,
        revokedAt: session.revocada_at,
        createdAt: session.created_at,
        user: {
          id: session.usuarios.id_usuario.toString(),
          name: `${session.usuarios.nombres} ${session.usuarios.apellidos}`.trim(),
          matricula: session.usuarios.matricula,
          employeeCode: session.usuarios.codigo_empleado,
        },
      })),
      total: sessions.length,
    };
  }

  async revoke(id: string, user: AuthenticatedUser) {
    const sessionId = parseId(id);
    const session = await this.prisma.sesiones.findUnique({
      where: { id_sesion: sessionId },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada.');

    if (
      session.id_usuario.toString() !== user.id &&
      !(await this.isAdministrator(user.id))
    ) {
      throw new ForbiddenException('No puedes revocar esta sesión.');
    }

    await this.prisma.sesiones.update({
      where: { id_sesion: sessionId },
      data: { revocada_at: session.revocada_at ?? new Date() },
    });
    return { revoked: true, id };
  }

  async revokeOthers(user: AuthenticatedUser) {
    const result = await this.prisma.sesiones.updateMany({
      where: {
        id_usuario: BigInt(user.id),
        id_sesion: { not: BigInt(user.sessionId) },
        revocada_at: null,
      },
      data: { revocada_at: new Date() },
    });
    return { revoked: result.count };
  }

  private async isAdministrator(userId: string): Promise<boolean> {
    return (
      (await this.prisma.usuario_roles.count({
        where: {
          id_usuario: BigInt(userId),
          roles: { codigo: 'ADMIN', estado: 'ACTIVO' },
        },
      })) > 0
    );
  }
}

function parseId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador inválido.');
  }
}
