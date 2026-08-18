import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RoleCode } from '../roles';

interface AuthenticatedRequest extends Request {
  user?: { id?: string; roles?: RoleCode[] };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<RoleCode[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
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
      select: { roles: { select: { codigo: true } } },
    });
    const currentRoles = assignments.map(
      ({ roles }) => roles.codigo as RoleCode,
    );
    request.user.roles = currentRoles;
    return requiredRoles.some((role) => currentRoles.includes(role));
  }
}
