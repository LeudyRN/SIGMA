import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import { ACCESS_COOKIE, getCookie } from '../utils/cookies';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      passReqToCallback: true,
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => getCookie(request, ACCESS_COOKIE) ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(request: Request, payload: JwtPayload) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token de acceso inválido.');
    }

    const accessToken =
      getCookie(request, ACCESS_COOKIE) ??
      ExtractJwt.fromAuthHeaderAsBearerToken()(request);
    const sessionId = parseId(payload.sessionId);
    const session = sessionId
      ? await this.prisma.sesiones.findUnique({
          where: { id_sesion: sessionId },
        })
      : null;

    if (
      !accessToken ||
      !session ||
      session.revocada_at ||
      session.expira_at <= new Date() ||
      session.id_usuario.toString() !== payload.sub ||
      session.token_hash !== hashToken(accessToken)
    ) {
      throw new UnauthorizedException('La sesión expiró o fue revocada.');
    }

    return {
      id: payload.sub,
      email: payload.email,
      matricula: payload.matricula,
      codigoEmpleado: payload.codigoEmpleado,
      roles: payload.roles,
      permissions: payload.permissions ?? [],
      sessionId: payload.sessionId,
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseId(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}
