import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { RolesService } from './roles.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('RolesService', () => {
  it('excludes ADMIN from the roles catalog', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { roles: { findMany } } as unknown as PrismaService;

    await new RolesService(prisma).list();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { codigo: { not: 'ADMIN' } },
      }),
    );
  });

  it('rejects creating another manageable ADMIN role', async () => {
    const prisma = { roles: { create: jest.fn() } } as unknown as PrismaService;

    await expect(
      new RolesService(prisma).create({
        code: 'ADMIN',
        name: 'Administrador',
        description: 'Rol interno',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not allow managing ADMIN through its direct id', async () => {
    const transaction = jest.fn();
    const prisma = {
      roles: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: transaction,
    } as unknown as PrismaService;

    await expect(
      new RolesService(prisma).assignPermissions('1', [], '1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
