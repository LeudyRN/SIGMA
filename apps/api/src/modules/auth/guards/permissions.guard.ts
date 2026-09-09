import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { RoleCode } from '../roles';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (!request.user?.id) return false;

    let userId: bigint;
    try {
      userId = BigInt(request.user.id);
    } catch {
      return false;
    }

    const assignments = await this.prisma.usuario_roles.findMany({
      where: {
        id_usuario: userId,
        roles: { estado: 'ACTIVO' },
        usuarios_usuario_roles_id_usuarioTousuarios: {
          deleted_at: null,
          estado: 'ACTIVO',
        },
      },
      select: {
        roles: {
          select: {
            codigo: true,
            rol_permisos: {
              where: { permisos: { estado: 'ACTIVO' } },
              select: { permisos: { select: { codigo: true } } },
            },
          },
        },
      },
    });
    const roleCodes = assignments.map(({ roles }) => roles.codigo);
    request.user.roles = roleCodes;
    if (roleCodes.includes(RoleCode.Admin)) {
      request.user.permissions = ['*'];
      return true;
    }

    const granted = new Set(
      assignments.flatMap(({ roles }) =>
        roles.rol_permisos.map(({ permisos }) => permisos.codigo),
      ),
    );
    request.user.permissions = [...granted];
    if (required.every((permission) => granted.has(permission))) return true;

    throw new ForbiddenException(
      'Tu rol no tiene permisos para realizar esta operación.',
    );
  }
}
