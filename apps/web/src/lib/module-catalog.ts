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
        status: 'planned',
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
        description: 'Cuentas, estados, contacto y recuperación de acceso.',
        status: 'foundation',
      },
      {
        slug: 'roles-permisos',
        label: 'Roles y permisos',
        description: 'Administrador, coordinación, tesorería, estudiante y docente.',
        status: 'foundation',
      },
      {
        slug: 'sesiones',
        label: 'Sesiones',
        description: 'Tokens activos, renovación y revocación de sesiones.',
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
        status: 'planned',
      },
      {
        slug: 'estudiante-carreras',
        label: 'Carreras del estudiante',
        description: 'Recinto, plan de estudio, ingreso, egreso y estado.',
        status: 'planned',
      },
      {
        slug: 'historial-academico',
        label: 'Historial académico',
        description: 'Asignaturas cursadas, calificaciones y estado académico.',
        status: 'planned',
      },
      {
        slug: 'elegibilidad',
        label: 'Elegibilidad',
        description: 'Evaluación automática del plan y materias pendientes.',
        status: 'planned',
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
        status: 'planned',
      },
      {
        slug: 'facultades',
        label: 'Facultades',
        description: 'Catálogo institucional de facultades.',
        status: 'planned',
      },
      {
        slug: 'escuelas',
        label: 'Escuelas',
        description: 'Escuelas académicas asociadas a facultades.',
        status: 'planned',
      },
      {
        slug: 'carreras',
        label: 'Carreras',
        description: 'Programas y niveles académicos disponibles.',
        status: 'planned',
      },
      {
        slug: 'recinto-carreras',
        label: 'Carreras por recinto',
        description: 'Disponibilidad de carreras en cada recinto.',
        status: 'planned',
      },
      {
        slug: 'planes-estudio',
        label: 'Planes de estudio',
        description: 'Versiones, vigencia y créditos de cada plan.',
        status: 'planned',
      },
      {
        slug: 'asignaturas',
        label: 'Asignaturas',
        description: 'Catálogo de materias y créditos.',
        status: 'planned',
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
        status: 'planned',
      },
      {
        slug: 'periodos',
        label: 'Períodos académicos',
        description: 'Fechas, vigencia y estado de períodos.',
        status: 'planned',
      },
      {
        slug: 'areas-investigacion',
        label: 'Áreas de investigación',
        description: 'Líneas temáticas disponibles para proyectos.',
        status: 'planned',
      },
      {
        slug: 'requisitos',
        label: 'Requisitos',
        description: 'Reglas automáticas, manuales y documentales.',
        status: 'planned',
      },
      {
        slug: 'ofertas',
        label: 'Ofertas',
        description: 'Publicación por recinto, carrera, modalidad, cupo y monto.',
        status: 'planned',
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
        status: 'planned',
      },
      {
        slug: 'sustentantes',
        label: 'Sustentantes',
        description: 'Integrantes principales y secundarios de la inscripción.',
        status: 'planned',
      },
      {
        slug: 'validaciones',
        label: 'Validaciones de requisitos',
        description: 'Resultados automáticos y revisiones manuales.',
        status: 'planned',
      },
      {
        slug: 'estados-inscripcion',
        label: 'Estados y seguimiento',
        description: 'Flujo, transiciones e historial de la inscripción.',
        status: 'planned',
      },
      {
        slug: 'documentos',
        label: 'Documentos',
        description: 'Archivos, hashes y validación documental.',
        status: 'planned',
      },
    ],
  },
  {
    key: 'finanzas',
    label: 'Pagos y facturación',
    description: 'Operaciones financieras trazables e idempotentes.',
    modules: [
      {
        slug: 'metodos-pago',
        label: 'Métodos de pago',
        description: 'Canales habilitados por UCOTESIS y Tesorería.',
        status: 'planned',
      },
      {
        slug: 'pagos',
        label: 'Pagos',
        description: 'Intenciones, montos, referencias y estados.',
        status: 'planned',
      },
      {
        slug: 'transacciones',
        label: 'Transacciones',
        description: 'Respuestas de proveedores, autorizaciones y reembolsos.',
        status: 'planned',
      },
      {
        slug: 'conciliaciones',
        label: 'Conciliaciones',
        description: 'Comparación bancaria, diferencias y cierre.',
        status: 'planned',
      },
      {
        slug: 'facturas',
        label: 'Facturas digitales',
        description: 'Recibos PDF, snapshot histórico y QR de autenticidad.',
        status: 'planned',
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
        status: 'planned',
      },
      {
        slug: 'docentes',
        label: 'Docentes',
        description: 'Perfiles de asesores, coordinadores y jurados.',
        status: 'planned',
      },
      {
        slug: 'asesores-jurados',
        label: 'Asesores y jurados',
        description: 'Asignación y participación docente en proyectos.',
        status: 'planned',
      },
    ],
  },
  {
    key: 'comunicacion',
    label: 'Comunicación',
    description: 'Mensajes y avisos durante el proceso.',
    modules: [
      {
        slug: 'notificaciones',
        label: 'Notificaciones',
        description: 'Avisos en plataforma, correo, push y sistema.',
        status: 'planned',
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
        status: 'planned',
      },
      {
        slug: 'auditoria',
        label: 'Auditoría',
        description: 'Registro de acciones, cambios, usuario, IP y solicitud.',
        status: 'planned',
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
