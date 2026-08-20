CREATE TABLE `cuentas_bancarias` (
  `id_cuenta_bancaria` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `banco` VARCHAR(120) NOT NULL,
  `numero_cuenta` VARCHAR(80) NOT NULL,
  `tipo_cuenta` ENUM('AHORRO', 'CORRIENTE') NOT NULL,
  `tipo_documento` VARCHAR(30) NOT NULL,
  `documento_titular` VARCHAR(30) NOT NULL,
  `nombre_titular` VARCHAR(200) NOT NULL,
  `moneda` CHAR(3) NOT NULL DEFAULT 'DOP',
  `instrucciones` VARCHAR(1000) NULL,
  `estado` ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_cuenta_bancaria`),
  UNIQUE KEY `uq_cuentas_bancarias_numero` (`numero_cuenta`),
  KEY `idx_cuentas_bancarias_estado` (`estado`, `banco`),
  KEY `idx_cuentas_bancarias_usuario` (`created_by`),
  CONSTRAINT `fk_cuentas_bancarias_usuario` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE `pagos`
  ADD COLUMN `id_cuenta_bancaria` BIGINT UNSIGNED NULL AFTER `id_metodo_pago`,
  ADD KEY `idx_pagos_cuenta_bancaria` (`id_cuenta_bancaria`),
  ADD CONSTRAINT `fk_pagos_cuenta_bancaria` FOREIGN KEY (`id_cuenta_bancaria`) REFERENCES `cuentas_bancarias` (`id_cuenta_bancaria`) ON DELETE RESTRICT;

CREATE TABLE `comprobantes_transferencia` (
  `id_comprobante` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_pago` BIGINT UNSIGNED NOT NULL,
  `nombre_archivo` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(120) NOT NULL,
  `tamano_bytes` INT UNSIGNED NOT NULL,
  `hash_sha256` CHAR(64) NOT NULL,
  `contenido` LONGBLOB NOT NULL,
  `estado` ENUM('PENDIENTE', 'VALIDADO', 'RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
  `observacion` VARCHAR(500) NULL,
  `revisado_por` BIGINT UNSIGNED NULL,
  `revisado_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_comprobante`),
  UNIQUE KEY `uq_comprobantes_transferencia_pago` (`id_pago`),
  KEY `idx_comprobantes_transferencia_estado` (`estado`, `created_at`),
  KEY `idx_comprobantes_transferencia_revisor` (`revisado_por`),
  CONSTRAINT `fk_comprobantes_transferencia_pago` FOREIGN KEY (`id_pago`) REFERENCES `pagos` (`id_pago`) ON DELETE CASCADE,
  CONSTRAINT `fk_comprobantes_transferencia_revisor` FOREIGN KEY (`revisado_por`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `metodos_pago` (`codigo`, `nombre`, `estado`)
VALUES ('TRANSFERENCIA', 'Transferencia bancaria', 'ACTIVO')
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `estado` = 'ACTIVO';

INSERT INTO `tipos_participacion` (`codigo`, `nombre`, `descripcion`, `estado`)
VALUES
  ('ASESOR', 'Asesor', 'Docente responsable de la asesoría académica.', 'ACTIVO'),
  ('JURADO', 'Jurado', 'Docente integrante del jurado evaluador.', 'ACTIVO'),
  ('COORDINADOR', 'Coordinador', 'Docente coordinador del proyecto.', 'ACTIVO')
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `descripcion` = VALUES(`descripcion`), `estado` = 'ACTIVO';

INSERT INTO `configuraciones` (`clave`, `valor`, `tipo`, `descripcion`, `es_publica`)
VALUES
  ('FACTURA_PREFIJO', 'SIGMA', 'STRING', 'Prefijo institucional para facturas emitidas.', 0),
  ('PAGO_TRANSFERENCIA_MAX_MB', '8', 'INTEGER', 'Tamaño máximo del comprobante de transferencia.', 1),
  ('INSCRIPCION_REQUIERE_PAGO', 'true', 'BOOLEAN', 'Exige pago validado para confirmar una inscripción.', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`);

INSERT IGNORE INTO `rol_permisos` (`id_rol`, `id_permiso`)
SELECT r.`id_rol`, p.`id_permiso`
FROM `roles` r
JOIN `permisos` p ON p.`codigo` = 'PROYECTOS_PARTICIPAR'
WHERE r.`codigo` = 'ESTUDIANTE';
