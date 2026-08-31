import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { InvoicePdfService } from './invoice-pdf.service';
import { PaymentsService, type UploadedProof } from './payments.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const PROOF: UploadedProof = {
  buffer: Buffer.from('comprobante'),
  originalname: 'comprobante.pdf',
  mimetype: 'application/pdf',
  size: 11,
};

describe('PaymentsService', () => {
  it('impide registrar dos pagos activos para una inscripción', async () => {
    const transaction = jest.fn();
    const prisma = {
      inscripciones: {
        findFirst: jest.fn().mockResolvedValue({
          id_estado: BigInt(5),
          monto_aplicado: 5000,
          moneda: 'DOP',
          pagos: [{ id_pago: BigInt(8), estado: 'PENDIENTE' }],
        }),
      },
      cuentas_bancarias: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id_cuenta_bancaria: BigInt(2) }),
      },
      metodos_pago: {
        findFirst: jest.fn().mockResolvedValue({ id_metodo_pago: BigInt(3) }),
      },
      estados_inscripcion: {
        findFirst: jest.fn().mockResolvedValue({ id_estado: BigInt(6) }),
      },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new PaymentsService(
      prisma,
      {} as NotificationsService,
      {} as InvoicePdfService,
    );

    await expect(
      service.createTransfer(
        '10',
        {
          enrollmentId: '1',
          bankAccountId: '2',
          reference: 'REF-1000',
          paidAt: new Date().toISOString(),
        },
        PROOF,
      ),
    ).rejects.toThrow('pago pendiente o aprobado');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('no rechaza un comprobante si falta el estado de retorno pendiente', async () => {
    const transaction = jest.fn();
    const prisma = {
      pagos: {
        findUnique: jest.fn().mockResolvedValue({
          id_inscripcion: BigInt(1),
          estado: 'PENDIENTE',
          comprobantes_transferencia: {},
          inscripciones: {
            id_estado: BigInt(6),
            inscripcion_estudiantes: [
              { estudiantes: { id_usuario: BigInt(10) } },
            ],
          },
        }),
      },
      estados_inscripcion: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new PaymentsService(
      prisma,
      {} as NotificationsService,
      {} as InvoicePdfService,
    );

    await expect(
      service.reviewTransfer('2', '8', { decision: 'RECHAZADO' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('aprueba el pago, confirma la inscripción y emite la factura atómicamente', async () => {
    const payment = {
      id_inscripcion: BigInt(1),
      id_estado: BigInt(6),
      estado: 'PENDIENTE',
      monto: 5000,
      moneda: 'DOP',
      metodos_pago: { nombre: 'Transferencia bancaria' },
      comprobantes_transferencia: {},
      inscripciones: {
        id_estado: BigInt(6),
        ofertas: {
          titulo: 'Monográfico 2026',
          recinto_carreras: { recintos: { nombre: 'UASD Santiago' } },
        },
        inscripcion_estudiantes: [
          {
            es_principal: true,
            estudiantes: {
              id_usuario: BigInt(10),
              matricula: '100000001',
              usuarios: { nombres: 'Ana', apellidos: 'Pérez' },
            },
          },
        ],
      },
    };
    let capturedPaymentUpdate:
      { data: { estado: string }; where: unknown } | undefined;
    let capturedEnrollmentUpdate:
      { data: { id_estado: bigint }; where: unknown } | undefined;
    const updatePayment = jest.fn(
      (args: { data: { estado: string }; where: unknown }): Promise<object> => {
        capturedPaymentUpdate = args;
        return Promise.resolve({});
      },
    );
    const updateEnrollment = jest.fn(
      (args: {
        data: { id_estado: bigint };
        where: unknown;
      }): Promise<object> => {
        capturedEnrollmentUpdate = args;
        return Promise.resolve({});
      },
    );
    const db = {
      pagos: { update: updatePayment },
      comprobantes_transferencia: { update: jest.fn().mockResolvedValue({}) },
      facturas: {
        create: jest.fn().mockResolvedValue({
          id_factura: BigInt(9),
          numero_factura: 'SIGMA-2026-00000008',
        }),
      },
      inscripciones: { update: updateEnrollment },
      historial_estados_inscripcion: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const createNotification = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      pagos: { findUnique: jest.fn().mockResolvedValue(payment) },
      estados_inscripcion: {
        findFirst: jest.fn().mockResolvedValue({ id_estado: BigInt(8) }),
      },
      $transaction: jest.fn((callback: (database: typeof db) => unknown) =>
        Promise.resolve(callback(db)),
      ),
    } as unknown as PrismaService;
    const service = new PaymentsService(
      prisma,
      { create: createNotification } as unknown as NotificationsService,
      {} as InvoicePdfService,
    );

    const result = await service.reviewTransfer('2', '8', {
      decision: 'VALIDADO',
    });

    expect(result.status).toBe('APROBADO');
    expect(capturedPaymentUpdate?.data.estado).toBe('APROBADO');
    expect(capturedEnrollmentUpdate?.data.id_estado).toBe(BigInt(8));
    expect(db.facturas.create).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledTimes(1);
  });
});
