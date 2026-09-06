const LABELS: Record<string, string> = {
  PRESENCIAL: 'Presencial',
  VIRTUAL: 'Virtual',
  SEMIPRESENCIAL: 'Semipresencial',
  ACTIVO: 'Activo',
  ACTIVA: 'Activa',
  INACTIVO: 'Inactivo',
  INACTIVA: 'Inactiva',
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  APROBADA: 'Aprobada',
  RECHAZADO: 'Rechazado',
  RECHAZADA: 'Rechazada',
  VALIDADO: 'Validado',
  VALIDO: 'Válido',
  REVOCADA: 'Revocada',
  EXPIRADA: 'Expirada',
  CERRADA: 'Cerrada',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
  CANCELADA: 'Cancelada',
  EN_REVISION: 'En revisión',
  EN_DESARROLLO: 'En desarrollo',
  PENDIENTE_PAGO: 'Pendiente de pago',
  PAGO_PROCESANDO: 'Pago en revisión',
  NO_ELEGIBLE: 'No elegible',
  CON_DIFERENCIAS: 'Con diferencias',
};

export function humanizeSystemValue(value: string) {
  const normalized = value.trim();
  if (!normalized) return normalized;
  if (LABELS[normalized]) return LABELS[normalized];
  if (!/^[A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(normalized)) return normalized;
  const text = normalized.replaceAll('_', ' ').toLocaleLowerCase('es');
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1);
}
