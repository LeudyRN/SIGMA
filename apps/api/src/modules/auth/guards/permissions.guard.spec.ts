import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrismaService } from '../../../prisma/prisma.service';
import { PermissionsGuard } from './permissions.guard';

jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

function createContext(user: {
  id: string;
  roles: string[];
  permissions: string[];
}) {
  const request = { user };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('PermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(['ACADEMICO_CATALOGOS_LEER']),
  } as unknown as Reflector;

  it('refreshes effective permissions from current database assignments', async () => {
    const prisma = {
      usuario_roles: {
        findMany: jest.fn().mockResolvedValue([
          {
            roles: {
              codigo: 'COORDINADOR',
              rol_permisos: [
                { permisos: { codigo: 'ACADEMICO_CATALOGOS_LEER' } },
              ],
            },
          },
        ]),
      },
    } as unknown as PrismaService;
    const { context, request } = createContext({
      id: '2',
      roles: ['COORDINADOR'],
      permissions: [],
    });

    await expect(
      new PermissionsGuard(reflector, prisma).canActivate(context),
    ).resolves.toBe(true);
    expect(request.user.permissions).toEqual(['ACADEMICO_CATALOGOS_LEER']);
  });

  it('rejects a permission removed from the database even if the token is stale', async () => {
    const prisma = {
      usuario_roles: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const { context } = createContext({
      id: '3',
      roles: ['COORDINADOR'],
      permissions: ['ACADEMICO_CATALOGOS_LEER'],
    });

    await expect(
      new PermissionsGuard(reflector, prisma).canActivate(context),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps administrator access without exposing it in assignable roles', async () => {
    const prisma = {
      usuario_roles: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { roles: { codigo: 'ADMIN', rol_permisos: [] } },
          ]),
      },
    } as unknown as PrismaService;
    const { context, request } = createContext({
      id: '1',
      roles: ['ADMIN'],
      permissions: [],
    });

    await expect(
      new PermissionsGuard(reflector, prisma).canActivate(context),
    ).resolves.toBe(true);
    expect(request.user.permissions).toEqual(['*']);
  });
});
