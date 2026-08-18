import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { SessionsService } from './sessions.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const USER: AuthenticatedUser = {
  id: '22',
  email: 'persona@uasd.edu.do',
  matricula: '',
  codigoEmpleado: 'EMP-22',
  roles: ['DOCENTE'],
  permissions: ['GENERAL_RESUMEN_LEER'],
  sessionId: '7',
};

describe('SessionsService', () => {
  it('limits employees and students to their own database sessions', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      usuario_roles: { count: jest.fn().mockResolvedValue(0) },
      sesiones: { findMany },
    } as unknown as PrismaService;

    await new SessionsService(prisma).list(USER);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id_usuario: BigInt(USER.id) } }),
    );
  });

  it('allows a current administrator to inspect every persisted session', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      usuario_roles: { count: jest.fn().mockResolvedValue(1) },
      sesiones: { findMany },
    } as unknown as PrismaService;

    await new SessionsService(prisma).list({ ...USER, roles: ['ADMIN'] });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});
