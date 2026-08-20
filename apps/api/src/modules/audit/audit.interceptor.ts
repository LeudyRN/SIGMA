import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<
        Request & { user?: AuthenticatedUser; route?: { path?: string } }
      >();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method))
      return next.handle();
    return next.handle().pipe(
      tap((result: unknown) => {
        const payload = sanitize(request.body);
        const entity =
          request.baseUrl.replace(/^\/api\//, '').split('/')[0] || 'sistema';
        const resultId =
          result && typeof result === 'object' && 'id' in result
            ? String(result.id)
            : undefined;
        void this.audit.record({
          userId: request.user?.id,
          action: actionName(request.method),
          entity,
          entityId: resultId,
          data: payload,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          requestId: String(request.headers['x-request-id'] ?? ''),
        });
      }),
    );
  }
}
function actionName(method: string) {
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
function sanitize(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitize);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/password|token|secret|contenido/i.test(key))
      .map(([key, item]) => [key, sanitize(item)]),
  );
}
