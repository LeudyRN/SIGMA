import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { AuditService } from './audit.service';
import { sanitizeAuditData } from './audit-data';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: AuthenticatedUser }>();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method))
      return next.handle();
    const path = (request.originalUrl || request.url || request.path).split(
      '?',
    )[0];
    const segments = path
      .replace(/^\/api(?:\/|$)/, '')
      .split('/')
      .filter(Boolean);
    const route = request.route as { path?: string } | undefined;
    const routeSegments = String(route?.path ?? '')
      .split('/')
      .filter(Boolean);
    const entity =
      segments[0] === 'ucotesis' && segments[1] === 'catalogs'
        ? segments.slice(0, 3).join('/')
        : [
            segments[0],
            segments[1] && !/^\d+$/.test(segments[1]) ? segments[1] : null,
          ]
            .filter(Boolean)
            .join('/') || 'sistema';
    const requestId =
      typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : randomUUID();
    const record = (result: unknown, error?: unknown) => {
      const response = asRecord(result);
      const httpResponse = http.getResponse<{
        statusCode: number;
        locals?: { auditUserId?: string };
      }>();
      const logoutId =
        segments[0] === 'auth' && segments[1] === 'logout' && !error
          ? httpResponse.locals?.auditUserId
          : undefined;
      // Only authentication responses can supply an actor when no guard populated request.user.
      const authenticatedId =
        segments[0] === 'auth' &&
        ['login', 'refresh'].includes(segments[1]) &&
        !error
          ? stringId(asRecord(response?.user)?.id)
          : undefined;
      const parameterId =
        request.params.id ||
        Object.entries(request.params).find(([key]) => /Id$/.test(key))?.[1];
      const resourceId =
        stringId(parameterId) ??
        stringId(response?.id) ??
        authenticatedId ??
        logoutId;
      void this.audit.record({
        userId: request.user?.id ?? authenticatedId ?? logoutId,
        action: auditAction(request.method, segments),
        entity,
        entityId: resourceId,
        data: {
          method: request.method,
          path: routeSegments.length ? String(route?.path) : path,
          outcome: error ? 'ERROR' : 'EXITO',
          statusCode:
            error instanceof HttpException
              ? error.getStatus()
              : error
                ? 500
                : httpResponse.statusCode,
          changes:
            segments[0] === 'auth'
              ? undefined
              : sanitizeAuditData(request.body),
        },
        ip: request.ip?.replace(/^::ffff:/, ''),
        userAgent: request.headers['user-agent'],
        requestId,
      });
    };
    const stream = next.handle();
    return stream.pipe(
      tap({
        next: (result: unknown) => record(result),
        error: (error: unknown) => record(undefined, error),
      }),
    );
  }
}
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}
function stringId(value: unknown): string | undefined {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
    ? String(value)
    : undefined;
}
function auditAction(method: string, segments: string[]): string {
  const last = segments.at(-1);
  const auth: Record<string, string> = {
    login: 'INICIAR_SESION',
    refresh: 'RENOVAR_SESION',
    logout: 'CERRAR_SESION',
  };
  if (segments[0] === 'auth' && last && auth[last]) return auth[last];
  if (last === 'review') return 'REVISAR';
  if (last === 'status') return 'CAMBIAR_ESTADO';
  if (last === 'validations') return 'VALIDAR_REQUISITO';
  if (last === 'document-requests') return 'SOLICITAR_DOCUMENTO';
  if (last === 'documents' && method === 'POST') return 'CARGAR_DOCUMENTO';
  if (segments.includes('documents') && method === 'PATCH')
    return 'REVISAR_DOCUMENTO';
  if (last === 'teachers' && method === 'POST') return 'ASIGNAR_DOCENTE';
  if (segments.includes('teachers') && method === 'DELETE')
    return 'RETIRAR_ASIGNACION';
  return (
    (
      {
        POST: 'CREAR',
        PUT: 'ACTUALIZAR',
        PATCH: 'ACTUALIZAR',
        DELETE: 'ELIMINAR',
      } as Record<string, string>
    )[method] ?? method
  );
}
