import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrismaService } from '../../../prisma/prisma.service';
import { RoleCode } from '../roles';
import { RolesGuard } from './roles.guard';

jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('RolesGuard', () => {
  it('uses current database assignments instead of stale token roles', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([RoleCode.Admin]),
    } as unknown as Reflector;
    const prisma = {
      usuario_roles: {
        findMany: jest.fn().mockResolvedValue([{ roles: { codigo: 'ADMIN' } }]),
      },
    } as unknown as PrismaService;
    const request = { user: { id: '1', roles: [] } };
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(
      new RolesGuard(reflector, prisma).canActivate(context),
    ).resolves.toBe(true);
    expect(request.user.roles).toEqual(['ADMIN']);
  });
});
