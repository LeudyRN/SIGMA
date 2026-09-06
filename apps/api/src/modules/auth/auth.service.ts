import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

interface AuthContext {
  ip?: string;
  userAgent?: string;
}

interface UserWithRoles {
  apellidos: string;
  email: string;
  estado: string;
  id_usuario: bigint;
  matricula: string | null;
  codigo_empleado: string | null;

  intentos_fallidos: number;
  bloqueado_hasta: Date | null;

  nombres: string;
  password_hash: string;

  usuario_roles_usuario_roles_id_usuarioTousuarios: Array<{
    roles: {
      codigo: string;
      nombre: string;
      rol_permisos: Array<{
        permisos: { codigo: string; estado: string };
      }>;
    };
  }>;

  uuid: string;
}

export interface PublicUser {
  email: string;
  id: string;
  matricula: string;
  employeeCode: string;
  name: string;
  roles: Array<{
    code: string;
    name: string;
  }>;
  permissions: string[];
  uuid: string;
}

export interface AuthTokens {
  accessExpiresIn: number;
  accessToken: string;
  refreshExpiresIn: number;
  refreshToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  private readonly saltRounds = 12;

  private readonly accessExpiresIn: number;
  private readonly refreshExpiresIn: number;
  private readonly refreshSecret: string;

  private readonly maxFailedAttempts = 5;
  private readonly lockMinutes = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessExpiresIn = parseDurationToSeconds(
      config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      15 * 60,
    );

    this.refreshExpiresIn = parseDurationToSeconds(
      config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      7 * 24 * 60 * 60,
    );

    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  async login(dto: LoginDto, context: AuthContext): Promise<AuthTokens> {
    const identifier = normalizeIdentifier(dto.identificador);

    const user = await this.findUserByIdentifier(identifier);

    /*
     * No revelamos cuál identificador existe.
     */
    if (!user) {
      throw new UnauthorizedException(
        'Matrícula/código de empleado o contraseña incorrectos.',
      );
    }

    /*
     * Bloqueo temporal.
     */
    if (user.bloqueado_hasta && user.bloqueado_hasta.getTime() > Date.now()) {
      throw new ForbiddenException(
        'La cuenta se encuentra temporalmente bloqueada. Intenta nuevamente más tarde.',
      );
    }

    /*
     * Si el bloqueo temporal ya venció,
     * limpiamos los intentos.
     */
    if (user.bloqueado_hasta && user.bloqueado_hasta.getTime() <= Date.now()) {
      await this.prisma.usuarios.update({
        where: {
          id_usuario: user.id_usuario,
        },
        data: {
          intentos_fallidos: 0,
          bloqueado_hasta: null,
        },
      });

      user.intentos_fallidos = 0;
      user.bloqueado_hasta = null;
    }

    /*
     * Validar estado administrativo.
     */
    if (user.estado !== 'ACTIVO') {
      switch (user.estado) {
        case 'BLOQUEADO':
          throw new ForbiddenException('La cuenta se encuentra bloqueada.');

        case 'INACTIVO':
          throw new ForbiddenException('La cuenta se encuentra inactiva.');

        case 'PENDIENTE':
          throw new ForbiddenException(
            'La cuenta está pendiente de activación.',
          );

        default:
          throw new ForbiddenException('La cuenta no se encuentra disponible.');
      }
    }

    /*
     * Validar contraseña.
     */
    const validPassword = await this.verifyPassword(
      dto.password,
      user.password_hash,
    );

    if (!validPassword) {
      const failedAttempts = user.intentos_fallidos + 1;

      const mustLock = failedAttempts >= this.maxFailedAttempts;

      await this.prisma.usuarios.update({
        where: {
          id_usuario: user.id_usuario,
        },
        data: {
          intentos_fallidos: failedAttempts,

          bloqueado_hasta: mustLock
            ? new Date(Date.now() + this.lockMinutes * 60 * 1000)
            : null,
        },
      });

      if (mustLock) {
        throw new ForbiddenException(
          `La cuenta fue bloqueada temporalmente por ${this.lockMinutes} minutos debido a múltiples intentos fallidos.`,
        );
      }

      throw new UnauthorizedException(
        'Matrícula/código de empleado o contraseña incorrectos.',
      );
    }

    /*
     * Login correcto.
     */
    await this.prisma.usuarios.update({
      where: {
        id_usuario: user.id_usuario,
      },
      data: {
        intentos_fallidos: 0,
        bloqueado_hasta: null,
        ultimo_acceso_at: new Date(),
      },
    });

    return this.createSession(user, context);
  }

  async refresh(
    refreshToken: string,
    context: AuthContext,
  ): Promise<AuthTokens> {
    let payload: JwtPayload;

    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('La sesión ya no es válida.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token de renovación inválido.');
    }

    const session = await this.prisma.sesiones.findUnique({
      where: {
        refresh_token_hash: hashToken(refreshToken),
      },
      include: {
        usuarios: {
          include: {
            usuario_roles_usuario_roles_id_usuarioTousuarios: {
              include: {
                roles: {
                  include: {
                    rol_permisos: { include: { permisos: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (
      !session ||
      session.revocada_at ||
      session.expira_at <= new Date() ||
      session.id_usuario.toString() !== payload.sub ||
      session.usuarios.estado !== 'ACTIVO'
    ) {
      throw new UnauthorizedException('La sesión expiró o fue revocada.');
    }

    const tokens = await this.issueTokens(
      session.usuarios,
      session.id_sesion.toString(),
    );

    await this.prisma.sesiones.update({
      where: {
        id_sesion: session.id_sesion,
      },
      data: {
        token_hash: hashToken(tokens.accessToken),

        refresh_token_hash: hashToken(tokens.refreshToken),

        expira_at: new Date(Date.now() + this.refreshExpiresIn * 1000),

        ip: context.ip,
        user_agent: context.userAgent,
      },
    });

    return tokens;
  }

  async logout(refreshToken?: string): Promise<string | undefined> {
    if (!refreshToken) return;
    const tokenHash = hashToken(refreshToken);
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.sesiones.findFirst({
        where: { refresh_token_hash: tokenHash, revocada_at: null },
        select: { id_sesion: true, id_usuario: true },
      });
      if (!session) return;
      const result = await tx.sesiones.updateMany({
        where: {
          id_sesion: session.id_sesion,
          refresh_token_hash: tokenHash,
          revocada_at: null,
        },
        data: { revocada_at: new Date() },
      });
      return result.count ? session.id_usuario.toString() : undefined;
    });
  }

  async getProfile(userId: string): Promise<PublicUser> {
    let idUsuario: bigint;

    try {
      idUsuario = BigInt(userId);
    } catch {
      throw new UnauthorizedException('Usuario inválido.');
    }

    const user = await this.prisma.usuarios.findUnique({
      where: {
        id_usuario: idUsuario,
      },
      include: {
        usuario_roles_usuario_roles_id_usuarioTousuarios: {
          include: {
            roles: {
              include: { rol_permisos: { include: { permisos: true } } },
            },
          },
        },
      },
    });

    if (!user || user.estado !== 'ACTIVO' || user.deleted_at) {
      throw new UnauthorizedException('Usuario no disponible.');
    }

    return this.toPublicUser(user);
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  private async findUserByIdentifier(
    identifier: string,
  ): Promise<UserWithRoles | null> {
    const user = await this.prisma.usuarios.findFirst({
      where: {
        OR: [{ matricula: identifier }, { codigo_empleado: identifier }],
      },
      include: {
        usuario_roles_usuario_roles_id_usuarioTousuarios: {
          include: {
            roles: {
              include: { rol_permisos: { include: { permisos: true } } },
            },
          },
        },
      },
    });

    if (!user || user.deleted_at) {
      return null;
    }

    return user;
  }

  private async createSession(
    user: UserWithRoles,
    context: AuthContext,
  ): Promise<AuthTokens> {
    const placeholder = hashToken(randomUUID());
    const session = await this.prisma.sesiones.create({
      data: {
        id_usuario: user.id_usuario,
        token_hash: placeholder,
        refresh_token_hash: hashToken(randomUUID()),
        expira_at: new Date(Date.now() + this.refreshExpiresIn * 1000),
        ip: context.ip,
        user_agent: context.userAgent,
      },
    });

    const tokens = await this.issueTokens(user, session.id_sesion.toString());

    await this.prisma.sesiones.update({
      where: { id_sesion: session.id_sesion },
      data: {
        token_hash: hashToken(tokens.accessToken),
        refresh_token_hash: hashToken(tokens.refreshToken),
      },
    });

    return tokens;
  }

  private async issueTokens(
    user: UserWithRoles,
    sessionId: string,
  ): Promise<AuthTokens> {
    const publicUser = this.toPublicUser(user);

    const basePayload = {
      sub: publicUser.id,
      email: publicUser.email,
      matricula: publicUser.matricula,
      codigoEmpleado: publicUser.employeeCode,
      sessionId,

      roles: publicUser.roles.map((role) => role.code),
      permissions: publicUser.permissions,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        {
          ...basePayload,
          jti: randomUUID(),
          type: 'access',
        },
        {
          expiresIn: this.accessExpiresIn,
        },
      ),

      this.jwt.signAsync(
        {
          ...basePayload,
          jti: randomUUID(),
          type: 'refresh',
        },
        {
          expiresIn: this.refreshExpiresIn,
          secret: this.refreshSecret,
        },
      ),
    ]);

    return {
      accessExpiresIn: this.accessExpiresIn,

      accessToken,

      refreshExpiresIn: this.refreshExpiresIn,

      refreshToken,

      user: publicUser,
    };
  }

  private toPublicUser(user: UserWithRoles): PublicUser {
    return {
      id: user.id_usuario.toString(),
      uuid: user.uuid,
      email: user.email,

      matricula: user.matricula ?? '',
      employeeCode: user.codigo_empleado ?? '',

      name: `${user.nombres} ${user.apellidos}`.trim(),

      roles: user.usuario_roles_usuario_roles_id_usuarioTousuarios.map(
        ({ roles }) => ({
          code: roles.codigo,
          name: roles.nombre,
        }),
      ),
      permissions: [
        ...new Set(
          user.usuario_roles_usuario_roles_id_usuarioTousuarios.flatMap(
            ({ roles }) =>
              roles.rol_permisos
                .filter(({ permisos }) => permisos.estado === 'ACTIVO')
                .map(({ permisos }) => permisos.codigo),
          ),
        ),
      ],
    };
  }
}

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toUpperCase();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseDurationToSeconds(value: string, fallback: number): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());

  if (!match) {
    return fallback;
  }

  const amount = Number(match[1]);

  const multipliers = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86_400,
  } as const;

  return amount * multipliers[match[2] as keyof typeof multipliers];
}
