import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { StudentsService } from '../students/students.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { MonographService } from './monograph.service';
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../students/students.service', () => ({
  StudentsService: class {},
}));
const actor = {
  id: '1',
  roles: ['SECRETARIA'],
  permissions: ['MONOGRAFICO_VALIDAR'],
} as AuthenticatedUser;
const contact = { phone: '+18095551234', confirmed: true };
function fixture() {
  const db = {
    inscripcion_estudiantes: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ estudiantes: { id_usuario: 9n } }),
    },
    usuarios: { update: jest.fn() },
    estudiantes: { updateMany: jest.fn() },
    auditoria: { create: jest.fn() },
  };
  const prisma = {
    ...db,
    $transaction: (fn: (value: typeof db) => unknown) =>
      Promise.resolve(fn(db)),
  };
  return {
    db,
    service: new MonographService(
      prisma as unknown as PrismaService,
      {} as StudentsService,
    ),
  };
}
describe('Confirmación de contacto por Secretaría', () => {
  it('actualiza al participante y registra quién confirmó el contacto', async () => {
    const { service, db } = fixture();
    await expect(
      service.confirmParticipantContact(actor, '12', '7', contact),
    ).resolves.toEqual({ id: '12', studentId: '7', confirmed: true });
    expect(db.inscripcion_estudiantes.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_inscripcion: 12n, id_estudiante: 7n },
      }),
    );
    expect(db.usuarios.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id_usuario: 9n } }),
    );
    expect(db.estudiantes.updateMany).toHaveBeenCalledWith({
      where: { id_usuario: 9n },
      data: { whatsapp: contact.phone },
    });
    expect(db.auditoria.create).toHaveBeenCalledWith({
      data: {
        id_usuario: 1n,
        accion: 'CONFIRMAR_CONTACTO_SECRETARIA',
        entidad: 'monografico',
        entidad_id: '12',
        datos_nuevos: { studentId: '7', userId: '9', confirmed: true },
      },
    });
  });
  it('rechaza participantes de otra inscripción', async () => {
    const { service, db } = fixture();
    db.inscripcion_estudiantes.findFirst.mockResolvedValue(null);
    await expect(
      service.confirmParticipantContact(actor, '12', '7', contact),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.usuarios.update).not.toHaveBeenCalled();
  });
  it('requiere el permiso de validación para actuar por otro estudiante', async () => {
    const { service, db } = fixture();
    await expect(
      service.confirmParticipantContact(
        { ...actor, permissions: [] },
        '12',
        '7',
        contact,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.usuarios.update).not.toHaveBeenCalled();
  });
  it('requiere la confirmación explícita de Secretaría', async () => {
    const { service, db } = fixture();
    await expect(
      service.confirmParticipantContact(actor, '12', '7', {
        ...contact,
        confirmed: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.usuarios.update).not.toHaveBeenCalled();
  });
});
