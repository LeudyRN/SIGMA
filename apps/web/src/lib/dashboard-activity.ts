export type ActivityOutcome = 'success' | 'error' | 'unknown' | 'rejected';
export interface DashboardActivity {
  id: string;
  action: string;
  entity: string;
  actor: string;
  actorId?: string | null;
  date: string;
  outcome?: ActivityOutcome;
}
const AREAS: Record<string, string> = {
  coordination: 'Coordinación académica',
  'coordinacion-academica': 'Coordinación académica',
  payments: 'Pagos',
  'payments/reconciliations': 'Conciliaciones de pagos',
  'payments/transfers': 'Comprobantes de pago',
  'payments/bank-accounts': 'Cuentas bancarias',
  'payments/methods': 'Métodos de pago',
  'payments/invoices': 'Recibos',
  'ucotesis/offers': 'Ofertas de cursos',
  'ucotesis/periods': 'Períodos académicos',
  'ucotesis/catalogs': 'Catálogos de UCOTESIS',
  ucotesis: 'Oferta académica',
  enrollments: 'Inscripciones',
  'enrollments/document-requests': 'Solicitudes de documentos',
  'enrollments/documents': 'Documentos del expediente',
  'enrollments/received-documents': 'Recepción de documentos',
  'student-portal/documents': 'Documentos del expediente',
  'student-portal/enrollments': 'Inscripciones',
  'student-portal': 'Portal estudiantil',
  monografico: 'Gestión de monográficos',
  monograph: 'Gestión de monográficos',
  auth: 'Acceso al sistema',
  users: 'Usuarios',
  roles: 'Roles y permisos',
  sessions: 'Sesiones',
  students: 'Expedientes estudiantiles',
  academic: 'Estructura académica',
  projects: 'Proyectos de grado',
  governance: 'Administración',
  sistema: 'SIGMA',
};
export function activityArea(entity: string): string {
  const parts = entity.split('/');
  while (parts.length) {
    const name = AREAS[parts.join('/')];
    if (name) return name;
    parts.pop();
  }
  return 'SIGMA';
}
const OBJECTS: Record<string, string> = {
  'payments/reconciliations': 'una conciliación de pagos',
  'payments/methods': 'un método de pago',
  'payments/bank-accounts': 'una cuenta bancaria',
  'payments/transfers': 'un comprobante de pago',
  'ucotesis/offers': 'una oferta de curso',
  'ucotesis/periods': 'un período académico',
  'student-portal/enrollments': 'una solicitud de inscripción',
  'enrollments/document-requests': 'una solicitud de documento',
  'enrollments/received-documents': 'un documento recibido',
  'student-portal/documents': 'un documento del expediente',
  users: 'una cuenta de usuario',
  roles: 'un rol',
  students: 'un expediente estudiantil',
  projects: 'un proyecto de grado',
};
const ACTIONS: Record<string, [string, string]> = {
  REGISTRAR_DESIGNACION: [
    'registró la designación de un coordinador por la Escuela',
    'registrar la designación de un coordinador',
  ],
  ASIGNAR_PERSONAL: ['asignó personal académico a un grupo', 'asignar personal académico'],
  REMOVER_PERSONAL: ['finalizó una asignación académica', 'finalizar una asignación académica'],
  TRAMITAR_EXPEDIENTE_DOCENTE: ['actualizó un trámite docente', 'actualizar un trámite docente'],
  INICIAR_SESION: ['inició sesión', 'iniciar sesión'],
  CERRAR_SESION: ['cerró sesión', 'cerrar sesión'],
  RENOVAR_SESION: ['mantuvo su sesión activa', 'mantener su sesión activa'],
  RECIBIR_EXPEDIENTE: [
    'registró la recepción de un expediente',
    'registrar la recepción de un expediente',
  ],
  VALIDAR_EXPEDIENTE: ['validó un expediente estudiantil', 'validar un expediente estudiantil'],
  ABRIR_DEUDA: ['abrió la deuda de una inscripción', 'abrir la deuda de una inscripción'],
  CONFIRMAR_CONTACTO: ['confirmó sus datos de contacto', 'confirmar sus datos de contacto'],
  COBRAR_CAJA_SIMULADO: ['simuló un cobro en Caja', 'simular un cobro en Caja'],
  PAGAR_VIRTUAL_SIMULADO: ['simuló un pago virtual', 'simular un pago virtual'],
  CONCILIAR_VIRTUAL_SIMULADO: [
    'registró la conciliación de un pago virtual simulado',
    'registrar la conciliación de un pago virtual simulado',
  ],
  ORGANIZAR_GRUPO: [
    'actualizó la organización de un curso',
    'actualizar la organización de un curso',
  ],
  REGISTRAR_NOTA: ['registró una calificación', 'registrar una calificación'],
  REMITIR_NOTAS: [
    'registró la remisión de calificaciones a Dirección',
    'registrar la remisión de calificaciones a Dirección',
  ],
  CONFIGURAR_ELEGIBILIDAD: [
    'actualizó los requisitos académicos de un plan',
    'actualizar los requisitos académicos de un plan',
  ],
  SOLICITAR_DOCUMENTO: [
    'solicitó un documento para un expediente',
    'solicitar un documento para un expediente',
  ],
  CARGAR_DOCUMENTO: ['adjuntó un documento al expediente', 'adjuntar un documento al expediente'],
  REVISAR_DOCUMENTO: ['revisó un documento del expediente', 'revisar un documento del expediente'],
  CAMBIAR_ESTADO: [
    'actualizó el estado de una inscripción',
    'actualizar el estado de una inscripción',
  ],
  VALIDAR_REQUISITO: ['revisó un requisito de inscripción', 'revisar un requisito de inscripción'],
  ASIGNAR_DOCENTE: ['asignó un docente a un proyecto', 'asignar un docente a un proyecto'],
  RETIRAR_ASIGNACION: ['retiró una asignación docente', 'retirar una asignación docente'],
};
export function activityMessage(event: DashboardActivity): string {
  const actor = event.actor === 'Actor no registrado' ? 'Una persona sin identificar' : event.actor;
  if (!event.outcome || event.outcome === 'unknown')
    return `${actor} registró actividad en ${activityArea(event.entity)}`;
  if (event.outcome === 'rejected')
    return `${actor} simuló un pago rechazado${event.action === 'COBRAR_CAJA_SIMULADO' ? ' en Caja' : ' por el canal virtual'}`;
  let action = ACTIONS[event.action];
  if (!action) {
    const verbs: Record<string, [string, string]> = {
      CREAR: ['creó', 'crear'],
      ACTUALIZAR: ['actualizó', 'actualizar'],
      ELIMINAR: ['eliminó', 'eliminar'],
      REVISAR: ['revisó', 'revisar'],
    };
    const verb = verbs[event.action];
    const object = OBJECTS[event.entity];
    if (verb && object) action = [`${verb[0]} ${object}`, `${verb[1]} ${object}`];
  }
  if (!action)
    return event.outcome === 'error'
      ? `${actor} no pudo completar una operación en ${activityArea(event.entity)}`
      : `${actor} realizó una operación en ${activityArea(event.entity)}`;
  return `${actor} ${event.outcome === 'error' ? `no pudo ${action[1]}` : action[0]}`;
}
export function groupRecentActivity(events: DashboardActivity[]) {
  const groups: Array<DashboardActivity & { count: number; firstDate: string }> = [];
  for (const event of events) {
    const last = groups.at(-1);
    const sameActor = event.actorId
      ? event.actorId === last?.actorId
      : event.actor !== 'Actor no registrado' && event.actor === last?.actor;
    const span = last ? new Date(last.date).getTime() - new Date(event.date).getTime() : Infinity;
    if (
      last &&
      sameActor &&
      last.entity === event.entity &&
      last.action === event.action &&
      last.outcome === event.outcome &&
      span >= 0 &&
      span <= 5 * 60000
    ) {
      last.count++;
      last.firstDate = event.date;
    } else groups.push({ ...event, count: 1, firstDate: event.date });
  }
  return groups.slice(0, 8);
}
export function activityDate(value: string) {
  return new Date(value).toLocaleString('es-DO', {
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Santo_Domingo',
  });
}

export function activityModules(items: Array<{ label: string; total: number }>) {
  const totals = new Map<string, number>();
  for (const item of items) {
    const name = activityArea(item.label);
    totals.set(name, (totals.get(name) ?? 0) + item.total);
  }
  return [...totals].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
}
