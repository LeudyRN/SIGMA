ALTER TABLE `documentos_inscripcion`
  ADD COLUMN `contenido` LONGBLOB NULL AFTER `hash_sha256`;

-- Conserva la trazabilidad de los pagos existentes para que el módulo de
-- transacciones quede operativo inmediatamente después de la migración.
INSERT INTO `transacciones_pago` (
  `id_pago`,
  `proveedor`,
  `proveedor_transaccion_id`,
  `tipo`,
  `estado`,
  `request_reference`,
  `response_code`,
  `response_message`
)
SELECT
  p.`id_pago`,
  mp.`codigo`,
  CONCAT('SIGMA-MIG-', p.`id_pago`),
  'VENTA',
  CASE
    WHEN p.`estado` = 'APROBADO' THEN 'APROBADA'
    WHEN p.`estado` = 'RECHAZADO' THEN 'RECHAZADA'
    WHEN p.`estado` IN ('PENDIENTE', 'PROCESANDO') THEN 'PENDIENTE'
    ELSE 'ERROR'
  END,
  p.`referencia`,
  'MIGRADO',
  'Transacción reconstruida a partir del pago existente.'
FROM `pagos` p
JOIN `metodos_pago` mp ON mp.`id_metodo_pago` = p.`id_metodo_pago`
WHERE NOT EXISTS (
  SELECT 1
  FROM `transacciones_pago` tp
  WHERE tp.`id_pago` = p.`id_pago`
);

INSERT INTO `roles` (`codigo`, `nombre`, `descripcion`, `estado`)
VALUES
  ('ASESOR', 'Asesor de proyecto', 'Docente responsable del acompañamiento académico de proyectos de grado.', 'ACTIVO'),
  ('JURADO', 'Jurado evaluador', 'Docente responsable de evaluar proyectos de grado asignados.', 'ACTIVO')
ON DUPLICATE KEY UPDATE
  `nombre` = VALUES(`nombre`),
  `descripcion` = VALUES(`descripcion`),
  `estado` = 'ACTIVO';

INSERT IGNORE INTO `rol_permisos` (`id_rol`, `id_permiso`)
SELECT r.`id_rol`, p.`id_permiso`
FROM `roles` r
JOIN `permisos` p ON p.`codigo` IN (
  'GENERAL_RESUMEN_LEER',
  'UCOTESIS_OFERTAS_LEER',
  'PROYECTOS_PARTICIPAR',
  'NOTIFICACIONES_AUTOGESTIONAR'
)
WHERE r.`codigo` IN ('ASESOR', 'JURADO');

INSERT INTO `docentes` (`id_usuario`, `codigo_docente`, `estado`)
SELECT DISTINCT u.`id_usuario`, u.`codigo_empleado`, 'ACTIVO'
FROM `usuarios` u
JOIN `usuario_roles` ur ON ur.`id_usuario` = u.`id_usuario`
JOIN `roles` r ON r.`id_rol` = ur.`id_rol`
WHERE r.`codigo` IN ('ASESOR', 'JURADO')
  AND u.`codigo_empleado` IS NOT NULL
  AND u.`deleted_at` IS NULL
ON DUPLICATE KEY UPDATE
  `codigo_docente` = VALUES(`codigo_docente`),
  `estado` = 'ACTIVO';
