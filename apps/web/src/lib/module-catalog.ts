export type ModuleStatus = 'available' | 'foundation' | 'planned';

export interface SigmaModule {
  description: string;
  label: string;
  slug: string;
  status: ModuleStatus;
}

export interface ModuleGroup {
  description: string;
  key: string;
  label: string;
  modules: SigmaModule[];
}

export const moduleCatalog: ModuleGroup[] = [
  {
    key: 'general',
    label: 'General',
    description: 'Visión ejecutiva y seguimiento global.',
    modules: [
      {
        slug: 'resumen',
        label: 'Resumen general',
        description: 'Indicadores, actividad reciente y accesos principales.',
        status: 'available',
      },
      {
        slug: 'reportes',
        label: 'Reportes',
        description: 'Consultas e informes por recinto, carrera, modalidad y período.',
        status: 'available',
      },
    ],
  },
  {
    key: 'identidad',
    label: 'Identidad y acceso',
    description: 'Seguridad, usuarios y autorización institucional.',
    modules: [
      {
        slug: 'usuarios',
        label: 'Usuarios',
        description: 'Cuentas del personal, estados, contacto y recuperación de acceso.',
        status: 'foundation',
      },
      {
        slug: 'roles-permisos',
        label: 'Roles y permisos',
        description: 'Coordinación, tesorería, estudiante, docente y sus capacidades.',
        status: 'foundation',
      },
      {
        slug: 'sesiones',
        label: 'Actividad de acceso',
        description: 'Dispositivos, accesos y revocación de sesiones.',
        status: 'foundation',
      },
    ],
  },
  {
    key: 'estudiantes',
    label: 'Estudiantes',
    description: 'Expediente y condición académica de cada sustentante.',
    modules: [
      {
        slug: 'estudiantes',
        label: 'Perfiles estudiantiles',
        description: 'Matrícula, identidad, contacto y carreras asociadas.',
        status: 'available',
      },
      {
        slug: 'estudiante-carreras',
        label: 'Carreras del estudiante',
        description: 'Recinto, plan de estudio, ingreso, egreso y estado.',
        status: 'available',
      },
      {
        slug: 'historial-academico',
        label: 'Historial académico',
        description: 'Asignaturas cursadas, calificaciones y estado académico.',
        status: 'available',
      },
      {
        slug: 'elegibilidad',
        label: 'Elegibilidad',
        description: 'Evaluación automática del plan y materias pendientes.',
        status: 'available',
      },
    ],
  },
  {
    key: 'academico',
    label: 'Estructura académica',
    description: 'Catálogos universitarios que organizan la oferta.',
    modules: [
      {
        slug: 'recintos',
        label: 'Recintos',
        description: 'Sedes y recintos regionales habilitados.',
        status: 'available',
      },
      {
        slug: 'facultades',
        label: 'Facultades',
        description: 'Catálogo institucional de facultades.',
        status: 'available',
      },
      {
        slug: 'escuelas',
        label: 'Escuelas',
        description: 'Escuelas académicas asociadas a facultades.',
        status: 'available',
      },
      {
        slug: 'carreras',
        label: 'Carreras',
        description: 'Programas y niveles académicos disponibles.',
        status: 'available',
      },
      {
        slug: 'recinto-carreras',
        label: 'Carreras por recinto',
        description: 'Disponibilidad de carreras en cada recinto.',
        status: 'available',
      },
      {
        slug: 'planes-estudio',
        label: 'Planes de estudio',
        description: 'Versiones, vigencia y créditos de cada plan.',
        status: 'available',
      },
      {
        slug: 'asignaturas',
        label: 'Asignaturas',
        description: 'Catálogo de materias y créditos.',
        status: 'available',
      },
    ],
  },
  {
    key: 'ucotesis',
    label: 'UCOTESIS y oferta',
    description: 'Configuración del proceso de tesis y monográficos.',
    modules: [
      {
        slug: 'modalidades',
        label: 'Modalidades',
        description: 'Tesis, monográfico y futuras modalidades de grado.',
        status: 'available',
      },
      {
        slug: 'periodos',
        label: 'Períodos académicos',
        description: 'Fechas, vigencia y estado de períodos.',
        status: 'available',
      },
      {
        slug: 'areas-investigacion',
        label: 'Áreas de investigación',
        description: 'Líneas temáticas disponibles para proyectos.',
        status: 'available',
      },
      {
        slug: 'requisitos',
        label: 'Requisitos',
        description: 'Reglas automáticas, manuales y documentales.',
        status: 'available',
      },
      {
        slug: 'ofertas',
        label: 'Ofertas',
        description: 'Publicación por recinto, carrera, modalidad, cupo y monto.',
        status: 'available',
      },
    ],
  },
  {
    key: 'inscripciones',
    label: 'Inscripciones',
    description: 'Ciclo completo desde solicitud hasta confirmación.',
    modules: [
      {
        slug: 'inscripciones',
        label: 'Solicitudes de inscripción',
        description: 'Expedientes, monto aplicado, fechas y observaciones.',
        status: 'available',
      },
      {
        slug: 'sustentantes',
        label: 'Sustentantes',
        description: 'Integrantes principales y secundarios de la inscripción.',
        status: 'available',
      },
      {
        slug: 'validaciones',
        label: 'Validaciones de requisitos',
        description: 'Resultados automáticos y revisiones manuales.',
        status: 'available',
      },
      {
        slug: 'estados-inscripcion',
        label: 'Estados y seguimiento',
        description: 'Flujo, transiciones e historial de la inscripción.',
        status: 'available',
      },
      {
        slug: 'documentos',
        label: 'Documentos',
        description: 'Archivos, hashes y validación documental.',
        status: 'available',
      },
    ],
  },
  {
    key: 'finanzas',
    label: 'Pagos y facturación',
    description: 'Operaciones financieras trazables e idempotentes.',
    modules: [
      {
        slug: 'cuentas-bancarias',
        label: 'Cuentas bancarias',
        description: 'Cuentas institucionales para transferencias y datos visibles al estudiante.',
        status: 'available',
      },
      {
        slug: 'metodos-pago',
        label: 'Métodos de pago',
        description: 'Canales habilitados por UCOTESIS y Tesorería.',
        status: 'available',
      },
      {
        slug: 'pagos',
        label: 'Pagos',
        description: 'Intenciones, montos, referencias y estados.',
        status: 'available',
      },
      {
        slug: 'transacciones',
        label: 'Transacciones',
        description: 'Historial automático de cada intento de pago y su respuesta de validación.',
        status: 'available',
      },
      {
        slug: 'conciliaciones',
        label: 'Conciliaciones',
        description:
          'Comparación de pagos aprobados contra transacciones para detectar diferencias y cerrar el período.',
        status: 'available',
      },
      {
        slug: 'facturas',
        label: 'Facturas digitales',
        description: 'Recibos PDF, snapshot histórico y QR de autenticidad.',
        status: 'available',
      },
    ],
  },
  {
    key: 'proyectos',
    label: 'Proyectos de grado',
    description: 'Seguimiento académico posterior a la inscripción.',
    modules: [
      {
        slug: 'proyectos-grado',
        label: 'Proyectos',
        description: 'Título, descripción, área, estado y fechas.',
        status: 'available',
      },
      {
        slug: 'docentes',
        label: 'Docentes',
        description: 'Perfiles de asesores, coordinadores y jurados.',
        status: 'available',
      },
      {
        slug: 'asesores-jurados',
        label: 'Asesores y jurados',
        description: 'Asignación y participación docente en proyectos.',
        status: 'available',
      },
    ],
  },
  {
    key: 'gobierno',
    label: 'Gobierno del sistema',
    description: 'Configuración, control y trazabilidad.',
    modules: [
      {
        slug: 'configuraciones',
        label: 'Configuraciones',
        description: 'Parámetros públicos y privados de la plataforma.',
        status: 'available',
      },
      {
        slug: 'auditoria',
        label: 'Auditoría',
        description: 'Registro de acciones, cambios, usuario, IP y solicitud.',
        status: 'available',
      },
    ],
  },
];

export const allModules = moduleCatalog.flatMap((group) =>
  group.modules.map((module) => ({ ...module, groupKey: group.key, groupLabel: group.label })),
);

export function findModuleBySlug(slug: string) {
  return allModules.find((module) => module.slug === slug);
}

const MODULE_PERMISSIONS: Record<string, string[]> = {
  resumen: ['GENERAL_RESUMEN_LEER'],
  reportes: ['GENERAL_REPORTES_LEER'],
  usuarios: ['IDENTIDAD_USUARIOS_GESTIONAR'],
  'roles-permisos': ['IDENTIDAD_ROLES_GESTIONAR'],
  sesiones: ['GENERAL_RESUMEN_LEER'],
  estudiantes: ['ESTUDIANTES_EXPEDIENTE_GESTIONAR', 'ESTUDIANTES_ELEGIBILIDAD_PROPIA'],
  'estudiante-carreras': ['ESTUDIANTES_EXPEDIENTE_GESTIONAR', 'ESTUDIANTES_ELEGIBILIDAD_PROPIA'],
  'historial-academico': ['ESTUDIANTES_EXPEDIENTE_GESTIONAR', 'ESTUDIANTES_ELEGIBILIDAD_PROPIA'],
  elegibilidad: ['ESTUDIANTES_EXPEDIENTE_GESTIONAR', 'ESTUDIANTES_ELEGIBILIDAD_PROPIA'],
  recintos: ['ACADEMICO_CATALOGOS_GESTIONAR'],
  facultades: ['ACADEMICO_CATALOGOS_GESTIONAR'],
  escuelas: ['ACADEMICO_CATALOGOS_GESTIONAR'],
  carreras: ['ACADEMICO_CATALOGOS_GESTIONAR'],
  'recinto-carreras': ['ACADEMICO_CATALOGOS_GESTIONAR'],
  'planes-estudio': ['ACADEMICO_CATALOGOS_GESTIONAR'],
  asignaturas: ['ACADEMICO_CATALOGOS_GESTIONAR'],
  modalidades: ['UCOTESIS_OFERTAS_GESTIONAR'],
  periodos: ['UCOTESIS_OFERTAS_GESTIONAR'],
  'areas-investigacion': ['UCOTESIS_OFERTAS_GESTIONAR'],
  requisitos: ['UCOTESIS_OFERTAS_GESTIONAR'],
  ofertas: ['UCOTESIS_OFERTAS_LEER', 'UCOTESIS_OFERTAS_GESTIONAR'],
  inscripciones: ['INSCRIPCIONES_PROPIAS_GESTIONAR', 'INSCRIPCIONES_GESTIONAR'],
  sustentantes: ['INSCRIPCIONES_GESTIONAR'],
  validaciones: ['INSCRIPCIONES_GESTIONAR'],
  'estados-inscripcion': ['INSCRIPCIONES_GESTIONAR'],
  documentos: ['INSCRIPCIONES_PROPIAS_GESTIONAR', 'INSCRIPCIONES_GESTIONAR'],
  'metodos-pago': ['PAGOS_GESTIONAR'],
  'cuentas-bancarias': ['PAGOS_GESTIONAR'],
  pagos: ['PAGOS_PROPIOS_GESTIONAR', 'PAGOS_GESTIONAR'],
  transacciones: ['PAGOS_GESTIONAR'],
  conciliaciones: ['PAGOS_GESTIONAR'],
  facturas: ['PAGOS_PROPIOS_GESTIONAR', 'PAGOS_GESTIONAR'],
  'proyectos-grado': ['PROYECTOS_PARTICIPAR', 'PROYECTOS_GESTIONAR'],
  docentes: ['PROYECTOS_GESTIONAR'],
  'asesores-jurados': ['PROYECTOS_PARTICIPAR', 'PROYECTOS_GESTIONAR'],
  configuraciones: ['GOBIERNO_GESTIONAR'],
  auditoria: ['GOBIERNO_GESTIONAR'],
};

export interface ModuleAccessUser {
  permissions: string[];
  roles: Array<{ code: string }>;
}

export function canAccessModule(slug: string, user: ModuleAccessUser): boolean {
  if (user.roles.some((role) => role.code === 'ADMIN')) return true;
  const required = MODULE_PERMISSIONS[slug] ?? [];
  return required.some((permission) => user.permissions.includes(permission));
}
