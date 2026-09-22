jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../students/students.service', () => ({
  StudentsService: class StudentsService {},
}));
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
    monto_aplicado: 2000,
    moneda: 'DOP',
    inscripcion_estudiantes: [
      {
        es_principal: true,
        estudiantes: {
          matricula: '1001',
          usuarios: { nombres: 'Alumno', apellidos: 'Prueba' },
        },
      },
    ],
    pagos: [],
    solicitudes_documentos: [],
    ofertas: {
      notas_remitidas_at: null,
      titulo: 'Curso',
      recinto_carreras: { recintos: { nombre: 'Santiago' } },
    },
    ...overrides,
  };
  const db = {
    inscripciones: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      findUnique: jest.fn(() => Promise.resolve(row)),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      update: jest.fn(),
    },
    pagos: {
      findUnique: jest.fn((): Promise<unknown> => Promise.resolve(null)),
      create: jest.fn(({ data }: { data: { estado: string } }) =>
        Promise.resolve({ id_pago: 9n, estado: data.estado, monto: 2000 }),
      ),
    },
    metodos_pago: {
      findUnique: jest.fn(() => Promise.resolve({ id_metodo_pago: 1n })),
    },
    estados_inscripcion: {
      findUnique: jest.fn(() => Promise.resolve({ id_estado: 2n })),
    },
    facturas: { create: jest.fn() },
    historial_estados_inscripcion: { create: jest.fn() },
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
  const secretary = {
    ...user,
    roles: ['SECRETARIA'],
    permissions: ['MONOGRAFICO_PAGOS_GESTIONAR'],
  };

  it.each(['CAJA', 'VIRTUAL'] as const)(
    'permite a Secretaría elegir el canal %s de una deuda ajena',
    async (channel) => {
      const { service, db } = fixture();
      await expect(
        service.chooseChannel(secretary, '1', channel),
      ).resolves.toEqual({ id: '1', channel });
      expect(db.inscripciones.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { canal_pago: channel, version_lock: { increment: 1 } },
        }),
      );
    },
  );

  it.each(['CAJA', 'VIRTUAL'] as const)(
    'Secretaría rechaza y aprueba por %s con recibo solo al aprobar',
    async (channel) => {
      const { service, db } = fixture({ canal_pago: channel });
      await expect(
        service.simulate(secretary, '1', {
          ...input,
          channel,
          outcome: 'RECHAZADO',
        }),
      ).resolves.toMatchObject({ status: 'RECHAZADO' });
      expect(db.facturas.create).not.toHaveBeenCalled();
      expect(db.inscripciones.update).not.toHaveBeenCalled();
      await expect(
        service.simulate(secretary, '1', {
          ...input,
          channel,
          idempotencyKey: 'retry',
        }),
      ).resolves.toMatchObject({ status: 'APROBADO' });
      expect(db.facturas.create).toHaveBeenCalledTimes(1);
      expect(db.inscripciones.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { id_estado: 2n, fecha_confirmacion: expect.any(Date) as Date },
        }),
      );
    },
  );

  it('mantiene el control de propiedad virtual para usuarios sin el permiso financiero', async () => {
    const { service, db } = fixture();
    await expect(
      service.simulate({ ...user, permissions: ['MONOGRAFICO_VALIDAR'] }, '1', {
        ...input,
        channel: 'VIRTUAL',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.inscripciones.findFirst).toHaveBeenCalled();
    expect(db.pagos.create).not.toHaveBeenCalled();
  });
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
