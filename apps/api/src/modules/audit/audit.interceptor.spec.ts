import { BadRequestException, type ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import { sanitizeAuditData } from './audit-data';
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

function setup(path: string, method = 'POST', extra: object = {}) {
  const record = jest.fn().mockResolvedValue(undefined);
  const request = {
    originalUrl: path,
    method,
    baseUrl: '',
    route: { path },
    params: {},
    headers: {},
    body: {},
    ip: '::ffff:127.0.0.1',
    ...extra,
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext;
  const interceptor = new AuditInterceptor({
    record,
  } as unknown as AuditService);
  return { record, context, interceptor };
}
it('records successful login with the authenticated response actor and excludes credentials', async () => {
  const { record, context, interceptor } = setup('/api/auth/login', 'POST', {
    body: { userId: '999', password: 'never-log' },
  });
  await lastValueFrom(
    interceptor.intercept(context, { handle: () => of({ user: { id: '7' } }) }),
  );
  expect(record).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: '7',
      action: 'INICIAR_SESION',
      entity: 'auth/login',
      ip: '127.0.0.1',
    }),
  );
  expect(JSON.stringify(record.mock.calls)).not.toContain('never-log');
  expect(JSON.stringify(record.mock.calls)).not.toContain('999');
});
it('uses the actual route and affected record for updates without an id in the response', async () => {
  const { record, context, interceptor } = setup(
    '/api/projects/8/teachers/3/1',
    'DELETE',
    { params: { id: '8', teacherId: '3', typeId: '1' }, user: { id: '7' } },
  );
  await lastValueFrom(
    interceptor.intercept(context, { handle: () => of({ removed: true }) }),
  );
  expect(record).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: '7',
      entity: 'projects',
      entityId: '8',
      action: 'RETIRAR_ASIGNACION',
    }),
  );
});
it('distinguishes failed operations and preserves the original error', async () => {
  const { record, context, interceptor } = setup(
    '/api/enrollments/document-requests',
  );
  const error = new BadRequestException('Invalid input');
  await expect(
    lastValueFrom(
      interceptor.intercept(context, { handle: () => throwError(() => error) }),
    ),
  ).rejects.toBe(error);
  expect(record).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        outcome: 'ERROR',
        statusCode: 400,
      }) as unknown,
    }),
  );
});
it('does not audit read-only queries', async () => {
  const { record, context, interceptor } = setup(
    '/api/governance/audit',
    'GET',
  );
  await lastValueFrom(
    interceptor.intercept(context, { handle: () => of({ items: [] }) }),
  );
  expect(record).not.toHaveBeenCalled();
});
it('removes nested credentials, sensitive configuration values and binary contents', () => {
  const clean = sanitizeAuditData({
    name: 'Keep',
    nested: {
      refreshToken: 'secret',
      password_hash: 'secret',
      authorization: 'secret',
      safe: true,
    },
    config: { key: 'JWT_ACCESS_SECRET', value: 'secret' },
    file: Buffer.from('secret'),
  });
  expect(JSON.stringify(clean)).not.toContain('secret');
  expect(clean).toMatchObject({ name: 'Keep', nested: { safe: true } });
});
