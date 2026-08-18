-- Permisos funcionales y matriz inicial por rol.
INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
('GENERAL_RESUMEN_LEER', 'Consultar resumen general', 'Acceso al resumen operativo correspondiente al rol.', 'GENERAL'),
('GENERAL_REPORTES_LEER', 'Consultar reportes', 'Acceso a reportes de uso y operación.', 'GENERAL'),
('ESTUDIANTES_EXPEDIENTE_GESTIONAR', 'Gestionar expedientes estudiantiles', 'Crear y mantener perfiles, carreras e historial académico.', 'ESTUDIANTES'),
('ESTUDIANTES_ELEGIBILIDAD_PROPIA', 'Consultar elegibilidad propia', 'Permite al estudiante evaluar su propio expediente.', 'ESTUDIANTES'),
('ACADEMICO_CATALOGOS_LEER', 'Consultar estructura académica', 'Consultar recintos, facultades, escuelas, carreras, planes y asignaturas.', 'ACADEMICO'),
('ACADEMICO_CATALOGOS_GESTIONAR', 'Gestionar estructura académica', 'Crear, actualizar y retirar catálogos académicos.', 'ACADEMICO'),
('UCOTESIS_OFERTAS_LEER', 'Consultar oferta UCOTESIS', 'Consultar tesis y monográficos disponibles.', 'UCOTESIS'),
('UCOTESIS_OFERTAS_GESTIONAR', 'Gestionar oferta UCOTESIS', 'Publicar y mantener ofertas, requisitos y áreas.', 'UCOTESIS'),
('INSCRIPCIONES_PROPIAS_GESTIONAR', 'Gestionar inscripción propia', 'Solicitar y consultar la inscripción del estudiante.', 'INSCRIPCIONES'),
('INSCRIPCIONES_GESTIONAR', 'Gestionar inscripciones', 'Supervisar solicitudes e inscritos.', 'INSCRIPCIONES'),
('PAGOS_PROPIOS_GESTIONAR', 'Gestionar pagos propios', 'Iniciar pagos y descargar comprobantes propios.', 'PAGOS'),
('PAGOS_GESTIONAR', 'Gestionar pagos y conciliación', 'Supervisar transacciones, facturas y conciliaciones.', 'PAGOS'),
('PROYECTOS_PARTICIPAR', 'Participar en proyectos', 'Consultar y atender asignaciones docentes.', 'PROYECTOS'),
('PROYECTOS_GESTIONAR', 'Gestionar proyectos', 'Asignar asesores, jurados y seguimiento académico.', 'PROYECTOS'),
('GOBIERNO_GESTIONAR', 'Gestionar gobierno del sistema', 'Configuraciones y auditoría global.', 'GOBIERNO'),
('NOTIFICACIONES_ENVIAR', 'Enviar notificaciones', 'Enviar notificaciones institucionales por usuario o rol.', 'NOTIFICACIONES')
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion),
  modulo = VALUES(modulo),
  estado = 'ACTIVO';

-- El administrador conserva acceso total sin exponer su rol en los catálogos.
INSERT IGNORE INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
CROSS JOIN permisos p
WHERE r.codigo = 'ADMIN';

INSERT IGNORE INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.codigo IN (
  'GENERAL_RESUMEN_LEER',
  'GENERAL_REPORTES_LEER',
  'ESTUDIANTES_EXPEDIENTE_GESTIONAR',
  'ACADEMICO_CATALOGOS_LEER',
  'UCOTESIS_OFERTAS_LEER',
  'UCOTESIS_OFERTAS_GESTIONAR',
  'INSCRIPCIONES_GESTIONAR',
  'PROYECTOS_GESTIONAR',
  'NOTIFICACIONES_AUTOGESTIONAR',
  'NOTIFICACIONES_ENVIAR'
)
WHERE r.codigo = 'COORDINADOR';

INSERT IGNORE INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.codigo IN (
  'GENERAL_RESUMEN_LEER',
  'GENERAL_REPORTES_LEER',
  'PAGOS_GESTIONAR',
  'NOTIFICACIONES_AUTOGESTIONAR'
)
WHERE r.codigo = 'TESORERIA';

INSERT IGNORE INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.codigo IN (
  'GENERAL_RESUMEN_LEER',
  'UCOTESIS_OFERTAS_LEER',
  'PROYECTOS_PARTICIPAR',
  'NOTIFICACIONES_AUTOGESTIONAR'
)
WHERE r.codigo = 'DOCENTE';

INSERT IGNORE INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.codigo IN (
  'GENERAL_RESUMEN_LEER',
  'ESTUDIANTES_ELEGIBILIDAD_PROPIA',
  'UCOTESIS_OFERTAS_LEER',
  'INSCRIPCIONES_PROPIAS_GESTIONAR',
  'PAGOS_PROPIOS_GESTIONAR',
  'NOTIFICACIONES_AUTOGESTIONAR'
)
WHERE r.codigo = 'ESTUDIANTE';

