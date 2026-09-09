jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../students/students.service', () => ({
  StudentsService: class StudentsService {},
}));
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { MonographService } from './monograph.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { StudentsService } from '../students/students.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
const user = {
  id: '1',
  roles: ['CAJA'],
  permissions: ['MONOGRAFICO_CAJA'],
} as AuthenticatedUser;
const input = {
  channel: 'CAJA' as const,
  outcome: 'APROBADO' as const,
  idempotencyKey: 'key',
  simulationAcknowledged: true,
};
function fixture(overrides: Record<string, unknown> = {}) {
  const row = {
    id_inscripcion: 1n,
    id_estado: 1n,
    id_oferta: 1n,
    version_lock: 0,
    deuda_abierta_at: new Date(),
    validado_at: new Date(),
    canal_pago: 'CAJA',
    estados_inscripcion: { codigo: 'PENDIENTE_PAGO' },
    pagos: [],
    solicitudes_documentos: [],
    ofertas: { notas_remitidas_at: null },
    ...overrides,
  };
  const db = {
    inscripciones: {
      findUnique: jest.fn(() => Promise.resolve(row)),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    pagos: {
      findUnique: jest.fn((): Promise<unknown> => Promise.resolve(null)),
      create: jest.fn(),
    },
    auditoria: { create: jest.fn() },
    ofertas: { updateMany: jest.fn(() => Promise.resolve({ count: 1 })) },
  };
  const prisma = {
    ...db,
    $transaction: jest.fn((fn: (value: typeof db) => unknown) =>
      Promise.resolve(fn(db)),
    ),
  };
  const service = new MonographService(
    prisma as unknown as PrismaService,
    {} as StudentsService,
  );
  return { service, db, row };
}
describe('Flujo de monográficos', () => {
  it('reserva el cobro presencial a Caja', async () => {
    const { service } = fixture();
    await expect(
      service.simulate({ ...user, permissions: [] }, '1', input),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rechaza cobros antes de que Secretaría abra la deuda', async () => {
    const { service, db } = fixture({ deuda_abierta_at: null });
    await expect(service.simulate(user, '1', input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(db.pagos.create).not.toHaveBeenCalled();
  });
  it('impide un segundo pago de la misma deuda', async () => {
    const { service, db } = fixture({ pagos: [{ estado: 'APROBADO' }] });
    await expect(service.simulate(user, '1', input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(db.pagos.create).not.toHaveBeenCalled();
  });
  it('devuelve el mismo pago al repetir la misma operación', async () => {
    const { service, db } = fixture({
      estados_inscripcion: { codigo: 'CONFIRMADA' },
    });
    db.pagos.findUnique.mockResolvedValue({
      id_pago: 9n,
      id_inscripcion: 1n,
      canal: 'CAJA',
      estado: 'APROBADO',
      es_simulado: true,
    });
    await expect(service.simulate(user, '1', input)).resolves.toEqual({
      id: '9',
      status: 'APROBADO',
      simulated: true,
    });
    expect(db.pagos.create).not.toHaveBeenCalled();
  });
  it('rechaza reutilizar una clave para otro expediente', async () => {
    const { service, db } = fixture();
    db.pagos.findUnique.mockResolvedValue({
      id_pago: 9n,
      id_inscripcion: 2n,
      canal: 'CAJA',
      estado: 'APROBADO',
      es_simulado: true,
    });
    await expect(service.simulate(user, '1', input)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('detecta cobros concurrentes antes de crear pagos', async () => {
    const { service, db } = fixture();
    db.inscripciones.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.simulate(user, '1', input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(db.pagos.create).not.toHaveBeenCalled();
  });
  it('limita las notas al docente asignado', async () => {
    const { service } = fixture({ ofertas: { coordinador_id: 2n } });
    await expect(
      service.grade(user, '1', { studentId: '1', grade: 90 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
