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
      prisma,
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
    const service = new EnrollmentsService(prisma, {
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
