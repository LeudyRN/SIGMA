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

  it('creates the academic profile automatically for an advisor role', async () => {
    const teacherCreate = jest.fn().mockResolvedValue({});
    const createdUser = {
      id_usuario: BigInt(12),
      uuid: 'uuid-12',
      matricula: null,
      codigo_empleado: 'EMP-12',
      nombres: 'Ana',
      apellidos: 'Asesora',
      email: 'ana@uasd.edu.do',
      telefono: null,
      estado: 'ACTIVO',
      ultimo_acceso_at: null,
      created_at: new Date(),
      usuario_roles_usuario_roles_id_usuarioTousuarios: [
        { roles: { id_rol: BigInt(8), codigo: 'ASESOR', nombre: 'Asesor' } },
      ],
    };
    const database = {
      usuarios: {
        create: jest.fn().mockResolvedValue({ id_usuario: BigInt(12) }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(createdUser),
      },
      roles: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id_rol: BigInt(8), codigo: 'ASESOR' }]),
      },
      usuario_roles: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      docentes: { create: teacherCreate },
    };
    const prisma = {
      $transaction: jest.fn((callback: (db: typeof database) => unknown) =>
        callback(database),
      ),
    } as unknown as PrismaService;
    const auth = {
      hashPassword: jest.fn().mockResolvedValue('hash'),
    } as unknown as AuthService;

    await new UsersService(prisma, auth).create(
      {
        employeeCode: 'EMP-12',
        firstName: 'Ana',
        lastName: 'Asesora',
        email: 'ana@uasd.edu.do',
        password: 'Password-123',
        roleIds: ['8'],
      },
      '1',
    );

    expect(teacherCreate).toHaveBeenCalledWith({
      data: {
        codigo_docente: 'EMP-12',
        estado: 'ACTIVO',
        id_usuario: BigInt(12),
      },
    });
  });
});
