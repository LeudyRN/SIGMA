import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrismaService } from '../../prisma/prisma.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { StudentsController } from './students.controller';
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('./students.service', () => ({ StudentsService: class {} }));
jest.mock('./academic-history-transfer.service', () => ({
  AcademicHistoryTransferService: class {},
}));
jest.mock('./academic-history-pdf.service', () => ({
  AcademicHistoryPdfService: class {},
}));
function authorization(
  handler: 'list' | 'catalogs',
  role: string,
  permissions: string[],
) {
  const prisma = {
    usuario_roles: {
      findMany: jest.fn().mockResolvedValue([
        {
          roles: {
            codigo: role,
            rol_permisos: permissions.map((codigo) => ({
              permisos: { codigo },
            })),
          },
        },
      ]),
    },
  } as unknown as PrismaService;
  const request = { user: { id: '1', roles: [], permissions: [] } };
  const context = {
    getClass: () => StudentsController,
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Se consulta metadata del método, no se ejecuta.
    getHandler: () => StudentsController.prototype[handler],
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const reflector = new Reflector();
  return {
    context,
    roles: new RolesGuard(reflector, prisma),
    permissions: new PermissionsGuard(reflector, prisma),
  };
}
describe('Acceso de Secretaría a Estudiantes', () => {
  it.each(['list', 'catalogs'] as const)(
    'permite %s con el rol y permiso asignados',
    async (handler) => {
      const access = authorization(handler, 'SECRETARIA', [
        'ESTUDIANTES_EXPEDIENTE_GESTIONAR',
      ]);
      await expect(access.roles.canActivate(access.context)).resolves.toBe(
        true,
      );
      await expect(
        access.permissions.canActivate(access.context),
      ).resolves.toBe(true);
    },
  );
  it('mantiene el rechazo si se retira el permiso', async () => {
    const access = authorization('list', 'SECRETARIA', []);
    await expect(
      access.permissions.canActivate(access.context),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('no concede la gestión de expedientes al rol estudiante', async () => {
    const access = authorization('list', 'ESTUDIANTE', []);
    await expect(access.roles.canActivate(access.context)).resolves.toBe(false);
  });
});
