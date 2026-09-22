import { humanizeSystemValue } from './humanize-system-value';

interface EnrollmentProgressInput {
  status: string;
  receivedAt: string | null;
  validatedAt: string | null;
  debtOpenedAt: string | null;
  paid: boolean;
  payments: { status: string }[];
}

export function enrollmentProgress(row: EnrollmentProgressInput) {
  const closed = ['CANCELADA', 'RECHAZADA', 'NO_ELEGIBLE'].includes(row.status);
  const paid = row.paid || row.payments.some((payment) => payment.status === 'APROBADO');
  const latestPayment = row.payments[0]?.status;
  const paymentLabel = paid
    ? 'Pago aprobado'
    : latestPayment === 'RECHAZADO'
      ? 'Pago rechazado'
      : ['PENDIENTE', 'PROCESANDO'].includes(latestPayment ?? '')
        ? 'Pago en procesamiento'
        : row.debtOpenedAt
          ? 'Pago pendiente'
          : 'Sin deuda abierta';
  const enrollmentLabel = closed
    ? humanizeSystemValue(row.status)
    : paid
      ? 'Inscripción confirmada'
      : row.debtOpenedAt
        ? 'Pendiente de pago'
        : row.validatedAt
          ? 'Expediente validado'
          : row.receivedAt
            ? 'Expediente en revisión'
            : 'Pendiente de recepción';
  return { closed, paid, paymentLabel, enrollmentLabel };
}
