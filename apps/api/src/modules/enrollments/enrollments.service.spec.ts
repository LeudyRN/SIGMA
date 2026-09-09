import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import {
  EnrollmentsService,
  type UploadedEnrollmentDocument,
} from './enrollments.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const FILE: UploadedEnrollmentDocument = {
  buffer: Buffer.from('documento'),
  originalname: 'propuesta.pdf',
  mimetype: 'application/pdf',
  size: 9,
};

describe('EnrollmentsService documents', () => {
  it('persists a student document in the database with its integrity hash', async () => {
    let createData: Record<string, unknown> | undefined;
    const prisma = {
      estudiantes: {
        findFirst: jest.fn().mockResolvedValue({ id_estudiante: BigInt(3) }),
      },
      inscripciones: {
        findFirst: jest.fn().mockResolvedValue({ codigo: 'INS-10' }),
      },
      documentos_inscripcion: {
        create: jest.fn((query: { data: Record<string, unknown> }) => {
          createData = query.data;
          return Promise.resolve({
            id_documento: BigInt(5),
            nombre_archivo: 'propuesta.pdf',
            estado_validacion: 'PENDIENTE',
          });
        }),
      },
    } as unknown as PrismaService;
    const notifications = {
      create: jest.fn().mockResolvedValue({ created: 1 }),
    } as unknown as NotificationsService;

    const result = await new EnrollmentsService(
      transactional(prisma),
      notifications,
    ).uploadStudentDocument(
      '10',
      { enrollmentId: '7', type: 'Propuesta de proyecto' },
      FILE,
    );

    expect(result.status).toBe('PENDIENTE');
    expect(createData).toMatchObject({
      id_inscripcion: BigInt(7),
      id_estudiante: BigInt(3),
      tipo_documento: 'Propuesta de proyecto',
      mime_type: 'application/pdf',
      tamano_bytes: BigInt(9),
    });
    expect(createData?.hash_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(createData?.contenido).toBeInstanceOf(Uint8Array);
  });

  it('rejects unsupported document formats before querying the database', async () => {
    const service = new EnrollmentsService(
      {} as PrismaService,
      {} as NotificationsService,
    );

    await expect(
      service.uploadStudentDocument(
        '10',
        { enrollmentId: '7', type: 'Archivo' },
        { ...FILE, mimetype: 'application/zip' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('notifies the student when a document is validated', async () => {
    const prisma = {
      documentos_inscripcion: {
        findUnique: jest.fn().mockResolvedValue({ id_inscripcion: 7n }),
        update: jest.fn().mockResolvedValue({
          id_documento: BigInt(5),
          nombre_archivo: 'propuesta.pdf',
          estado_validacion: 'VALIDO',
          inscripciones: {
            codigo: 'INS-10',
            inscripcion_estudiantes: [
              { estudiantes: { id_usuario: BigInt(10) } },
            ],
          },
        }),
      },
    } as unknown as PrismaService;
    const createNotification = jest.fn().mockResolvedValue({ created: 1 });
    const service = new EnrollmentsService(transactional(prisma), {
      create: createNotification,
    } as unknown as NotificationsService);

    const result = await service.validateDocument('1', '5', {
      status: 'VALIDO',
    });

    expect(result.status).toBe('VALIDO');
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['10'],
        title: 'Documento validado',
      }),
    );
  });
});

it('requires actionable feedback when rejecting documents', async () => {
  const service = new EnrollmentsService(
    {} as PrismaService,
    {} as NotificationsService,
  );
  await expect(
    service.validateDocument('1', '2', {
      status: 'RECHAZADO',
      observation: '  ',
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
});

it('does not attach a file to a request from another enrollment', async () => {
  const create = jest.fn();
  const findRequest = jest.fn().mockResolvedValue(null);
  const service = new EnrollmentsService(
    transactional({
      estudiantes: {
        findFirst: jest.fn().mockResolvedValue({ id_estudiante: 3n }),
      },
      inscripciones: {
        findFirst: jest.fn().mockResolvedValue({ codigo: 'INS-7' }),
      },
      solicitudes_documentos: { findFirst: findRequest },
      documentos_inscripcion: { create },
    } as unknown as PrismaService),
    {} as NotificationsService,
  );
  await expect(
    service.uploadStudentDocument(
      '10',
      { enrollmentId: '7', type: 'Identidad', requestId: '9' },
      FILE,
    ),
  ).rejects.toThrow('Solicitud documental no disponible');
  expect(findRequest).toHaveBeenCalledWith({
    where: { id_solicitud: 9n, id_inscripcion: 7n },
  });
  expect(create).not.toHaveBeenCalled();
});

it('notifies enrollment participants when coordination requests a document', async () => {
  const createNotification = jest.fn().mockResolvedValue({});
  const service = new EnrollmentsService(
    transactional({
      inscripciones: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id_inscripcion: 7n,
            codigo: 'INS-7',
            inscripcion_estudiantes: [{ estudiantes: { id_usuario: 10n } }],
          }),
        ),
      },
      solicitudes_documentos: {
        create: jest.fn().mockResolvedValue({ id_solicitud: 9n }),
      },
    } as unknown as PrismaService),
    { create: createNotification } as unknown as NotificationsService,
  );
  await expect(
    service.requestDocument('1', {
      enrollmentId: '7',
      type: 'Identidad',
      instructions: 'Ambos lados legibles',
    }),
  ).resolves.toEqual({ id: '9' });
  expect(createNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      userIds: ['10'],
      url: '/app/documentos',
      title: 'Documento solicitado',
    }),
  );
});

function transactional(prisma: PrismaService): PrismaService {
  const db = {
    ...prisma,
    inscripciones: {
      ...prisma.inscripciones,
      findUnique: jest.fn(() =>
        Promise.resolve({
          id_inscripcion: 7n,
          version_lock: 0,
          deuda_abierta_at: null,
          fecha_cancelacion: null,
          pagos: [],
        }),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return {
    ...prisma,
    $transaction: (operation: (client: typeof db) => unknown) =>
      Promise.resolve(operation(db)),
  } as unknown as PrismaService;
}
