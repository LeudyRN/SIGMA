import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { StudentsService } from './students.service';
import { StudentProcessService } from './student-process.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const STUDENT = {
  id_estudiante: BigInt(4),
  estudiante_carreras: [
    {
      id_estudiante_carrera: BigInt(9),
      id_recinto_carrera: BigInt(2),
      estado: 'ACTIVA',
    },
  ],
};

function offer(overrides: Record<string, unknown> = {}) {
  return {
    id_oferta: BigInt(1),
    codigo: 'OFE-1',
    titulo: 'Monográfico 2026',
    descripcion: null,
    fecha_inicio_inscripcion: new Date('2026-08-31T16:00:00.000Z'),
    fecha_fin_inscripcion: new Date('2026-09-02T20:00:00.000Z'),
    cupo_total: 30,
    cupo_reservado: 0,
    monto: { toNumber: () => 5000 },
    moneda: 'DOP',
    modalidades: { nombre: 'Monográfico' },
    periodos_academicos: { nombre: '2026-20' },
    recinto_carreras: {
      recintos: { nombre: 'UASD Santiago' },
      carreras: { nombre: 'Licenciatura en Informática' },
    },
    oferta_areas: [],
    oferta_requisitos: [],
    inscripciones: [],
    ...overrides,
  };
}

describe('StudentProcessService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-31T14:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('muestra ofertas publicadas próximas y calcula cada disponibilidad', async () => {
    type OfferQuery = {
      where: {
        estado: string;
        fecha_fin_inscripcion: { gte: Date };
        fecha_inicio_inscripcion?: unknown;
      };
    };
    let capturedQuery: OfferQuery | undefined;
    const findMany = jest.fn((query: OfferQuery): Promise<unknown[]> => {
      capturedQuery = query;
      return Promise.resolve([
        offer(),
        offer({
          id_oferta: BigInt(2),
          fecha_inicio_inscripcion: new Date('2026-08-31T12:00:00.000Z'),
        }),
        offer({
          id_oferta: BigInt(3),
          fecha_inicio_inscripcion: new Date('2026-08-31T12:00:00.000Z'),
          cupo_reservado: 30,
        }),
        offer({
          id_oferta: BigInt(4),
          fecha_inicio_inscripcion: new Date('2026-08-31T12:00:00.000Z'),
          inscripciones: [
            {
              id_inscripcion: BigInt(20),
              estados_inscripcion: {
                codigo: 'PENDIENTE_PAGO',
                nombre: 'Pendiente de pago',
              },
            },
          ],
        }),
      ]);
    });
    const prisma = {
      estudiantes: { findFirst: jest.fn().mockResolvedValue(STUDENT) },
      ofertas: { findMany },
    } as unknown as PrismaService;

    const result = await new StudentProcessService(
      prisma,
      {} as StudentsService,
    ).offers('10');

    expect(capturedQuery?.where.estado).toBe('PUBLICADA');
    expect(capturedQuery?.where.fecha_fin_inscripcion.gte).toEqual(
      new Date('2026-08-31T14:00:00.000Z'),
    );
    expect(capturedQuery?.where.fecha_inicio_inscripcion).toBeUndefined();
    expect(
      result.items.map(({ availability, canEnroll }) => ({
        availability,
        canEnroll,
      })),
    ).toEqual([
      { availability: 'PROXIMAMENTE', canEnroll: false },
      { availability: 'ABIERTA', canEnroll: true },
      { availability: 'AGOTADA', canEnroll: false },
      { availability: 'SOLICITADA', canEnroll: false },
    ]);
  });

  it('rechaza una segunda solicitud para la misma oferta', async () => {
    const eligibility = jest.fn();
    const prisma = {
      estudiantes: { findFirst: jest.fn().mockResolvedValue(STUDENT) },
      ofertas: {
        findFirst: jest.fn().mockResolvedValue({
          id_oferta: BigInt(1),
          id_recinto_carrera: BigInt(2),
        }),
      },
      inscripcion_estudiantes: {
        findFirst: jest.fn().mockResolvedValue({ id_inscripcion: BigInt(30) }),
      },
    } as unknown as PrismaService;

    await expect(
      new StudentProcessService(prisma, {
        eligibility,
      } as unknown as StudentsService).requestEnrollment('10', {
        offerId: '1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(eligibility).not.toHaveBeenCalled();
  });
});
