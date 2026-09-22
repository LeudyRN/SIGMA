import { describe, expect, it } from 'vitest';
import { enrollmentProgress } from './enrollment-progress';

const row = {
  status: 'PAGO_PROCESANDO',
  receivedAt: null,
  validatedAt: null,
  debtOpenedAt: null,
  paid: false,
  payments: [],
};

describe('Seguimiento del expediente y del pago', () => {
  it('no anuncia un pago en procesamiento si solo se modificó la inscripción', () => {
    expect(enrollmentProgress(row)).toMatchObject({
      enrollmentLabel: 'Pendiente de recepción',
      paymentLabel: 'Sin deuda abierta',
    });
  });
  it('distingue la revisión completada de la deuda pendiente', () => {
    expect(enrollmentProgress({ ...row, validatedAt: '2026-09-22' }).enrollmentLabel).toBe(
      'Expediente validado',
    );
    expect(enrollmentProgress({ ...row, debtOpenedAt: '2026-09-22' }).paymentLabel).toBe(
      'Pago pendiente',
    );
  });
  it('muestra el último intento rechazado y la deuda pendiente', () => {
    expect(
      enrollmentProgress({
        ...row,
        debtOpenedAt: '2026-09-22',
        payments: [{ status: 'RECHAZADO' }],
      }),
    ).toMatchObject({
      enrollmentLabel: 'Pendiente de pago',
      paymentLabel: 'Pago rechazado',
      paid: false,
    });
  });
  it('conserva la aprobación aunque haya intentos rechazados anteriores', () => {
    expect(
      enrollmentProgress({
        ...row,
        paid: true,
        payments: [{ status: 'APROBADO' }, { status: 'RECHAZADO' }],
      }),
    ).toMatchObject({
      enrollmentLabel: 'Inscripción confirmada',
      paymentLabel: 'Pago aprobado',
    });
  });
  it('mantiene visibles el cierre de la inscripción y los pagos históricos', () => {
    expect(enrollmentProgress({ ...row, status: 'CANCELADA', paid: true })).toMatchObject({
      closed: true,
      enrollmentLabel: 'Cancelada',
      paymentLabel: 'Pago aprobado',
    });
  });
});
