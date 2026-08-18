import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthService } from '../auth/auth.service';
import { UsersService } from './users.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('UsersService', () => {
  it('excludes administrator and student accounts from internal users', async () => {
    type ListArguments = {
      where: {
        usuario_roles_usuario_roles_id_usuarioTousuarios: {
          none: { roles: { codigo: { in: string[] } } };
        };
      };
    };
    const findMany = jest
      .fn<Promise<never[]>, [ListArguments]>()
      .mockResolvedValue([]);
    const prisma = { usuarios: { findMany } } as unknown as PrismaService;
    const auth = {} as AuthService;

    await new UsersService(prisma, auth).list();

    const [arguments_] = findMany.mock.calls[0];
    expect(
      arguments_.where.usuario_roles_usuario_roles_id_usuarioTousuarios,
    ).toEqual({
      none: { roles: { codigo: { in: ['ADMIN', 'ESTUDIANTE'] } } },
    });
  });
});
