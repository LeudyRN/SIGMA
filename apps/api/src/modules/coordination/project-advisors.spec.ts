jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ProjectAdvisorsService } from './project-advisors.service';
import { ProjectAdvisorDto } from './project-advisors.dto';

const actor = (...roles: string[]) =>
  ({ id: '10', roles }) as AuthenticatedUser;
const advisor = {
  name: 'Ana Pérez',
  participation: 'ASESOR',
  email: 'ana@example.com',
};
function fixture() {
  const tx = {
    asesores_proyecto: {
      create: jest.fn().mockResolvedValue({ id_asesor: 1n }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditoria: { create: jest.fn() },
  };
  const db = {
    proyectos_grado: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id_proyecto: 2n }),
    },
    $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  return {
    db,
    tx,
    service: new ProjectAdvisorsService(db as unknown as PrismaService),
  };
}
describe('Registro administrativo de asesores', () => {
  it('permite consultar a Secretaría y le niega las escrituras antes de tocar datos', async () => {
    const { service, db } = fixture();
    await expect(service.list(actor('SECRETARIA'))).resolves.toEqual({
      projects: [],
    });
    await expect(
      service.save(actor('SECRETARIA'), '2', advisor),
    ).rejects.toThrow(ForbiddenException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each(['ASESOR', 'ESTUDIANTE', 'JURADO'])(
    'niega el registro a %s incluso con URL directa',
    async (role) => {
      await expect(fixture().service.list(actor(role))).rejects.toThrow(
        ForbiddenException,
      );
    },
  );
  it('registra sin depender de docentes, usuarios o perfiles académicos', async () => {
    const { service, tx } = fixture();
    await expect(
      service.save(actor('COORDINADOR'), '2', advisor),
    ).resolves.toEqual({ id: '1', saved: true });
    expect(tx.asesores_proyecto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nombre: 'Ana Pérez',
        id_proyecto: 2n,
        registrado_por: 10n,
      }) as unknown,
    });
    expect(tx.auditoria.create).toHaveBeenCalled();
  });
  it('limita al coordinador designado a su curso aunque también sea secretaria', async () => {
    const { service, db } = fixture();
    db.proyectos_grado.findFirst.mockResolvedValue(null);
    await expect(
      service.save(
        actor('COORDINADOR_MONOGRAFICO', 'SECRETARIA'),
        '2',
        advisor,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(db.proyectos_grado.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id_proyecto: 2n,
          inscripciones: { ofertas: { coordinador_id: 10n } },
        },
      }),
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('protege contra ediciones simultáneas y referencias a otro proyecto', async () => {
    const { service, tx } = fixture();
    tx.asesores_proyecto.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.save(
        actor('COORDINADOR'),
        '2',
        { ...advisor, active: true, version: 1 },
        '3',
      ),
    ).rejects.toThrow(ConflictException);
    expect(tx.asesores_proyecto.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_asesor: 3n, id_proyecto: 2n, version: 1 },
      }),
    );
    expect(tx.auditoria.create).not.toHaveBeenCalled();
  });
  it('valida nombres en blanco, correo y teléfono; admite contactos opcionales vacíos', async () => {
    const invalid = plainToInstance(ProjectAdvisorDto, {
      name: '   ',
      participation: 'ASESOR',
      email: 'incorrecto',
      phone: '<script>',
    });
    expect((await validate(invalid)).map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'email', 'phone']),
    );
    expect(
      await validate(
        plainToInstance(ProjectAdvisorDto, {
          ...advisor,
          email: '',
          phone: '',
        }),
      ),
    ).toHaveLength(0);
  });
});
