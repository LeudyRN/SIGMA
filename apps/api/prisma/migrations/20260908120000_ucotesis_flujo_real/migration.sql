-- Reestructuración UCOTESIS: aditiva; conserva expedientes, pagos y auditoría históricos.
ALTER TABLE inscripciones
 ADD recibido_at DATETIME NULL, ADD recibido_por BIGINT UNSIGNED NULL,
 ADD validado_at DATETIME NULL, ADD validado_por BIGINT UNSIGNED NULL,
 ADD deuda_abierta_at DATETIME NULL, ADD deuda_abierta_por BIGINT UNSIGNED NULL,
 ADD canal_pago VARCHAR(20) NULL;
ALTER TABLE usuarios ADD whatsapp_confirmado_at DATETIME NULL;
ALTER TABLE ofertas
 ADD coordinador_id BIGINT UNSIGNED NULL,
 ADD grupo_whatsapp VARCHAR(300) NULL,
 ADD presupuesto_docencia DECIMAL(12,2) NOT NULL DEFAULT 0,
 ADD presupuesto_materiales DECIMAL(12,2) NOT NULL DEFAULT 0,
 ADD notas_remitidas_at DATETIME NULL, ADD notas_remitidas_por BIGINT UNSIGNED NULL,
 ADD CONSTRAINT ofertas_coordinador_id_fkey FOREIGN KEY (coordinador_id) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE;
ALTER TABLE pagos ADD es_simulado BOOLEAN NOT NULL DEFAULT FALSE, ADD canal VARCHAR(20) NULL;
ALTER TABLE planes_estudio
 ADD max_asignaturas_pendientes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 ADD max_creditos_pendientes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 ADD desde_semestre TINYINT UNSIGNED NOT NULL DEFAULT 1;
CREATE TABLE notas_monografico (
 id_nota BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_inscripcion BIGINT UNSIGNED NOT NULL, id_estudiante BIGINT UNSIGNED NOT NULL,
 nota DECIMAL(5,2) NOT NULL, observacion VARCHAR(1000) NULL,
 registrado_por BIGINT UNSIGNED NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY notas_monografico_id_inscripcion_id_estudiante_key(id_inscripcion,id_estudiante),
 CONSTRAINT notas_monografico_id_inscripcion_fkey FOREIGN KEY(id_inscripcion) REFERENCES inscripciones(id_inscripcion) ON UPDATE CASCADE,
 CONSTRAINT notas_monografico_id_estudiante_fkey FOREIGN KEY(id_estudiante) REFERENCES estudiantes(id_estudiante) ON UPDATE CASCADE,
 CONSTRAINT chk_nota_monografico CHECK(nota BETWEEN 0 AND 100)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO metodos_pago(codigo,nombre,estado) VALUES ('SIMULACION','Pago de demostración','ACTIVO') ON DUPLICATE KEY UPDATE codigo=VALUES(codigo);
INSERT INTO roles(codigo,nombre,estado) VALUES ('ENCARGADO','Encargado/a UCOTESIS','ACTIVO') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
INSERT INTO roles(codigo,nombre,estado) VALUES ('SECRETARIA','Secretaría UCOTESIS','ACTIVO') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
INSERT INTO roles(codigo,nombre,estado) VALUES ('OFICINISTA','Oficinista UCOTESIS','ACTIVO') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
INSERT INTO roles(codigo,nombre,estado) VALUES ('CAJA','Caja local','ACTIVO') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
INSERT INTO roles(codigo,nombre,estado) VALUES ('COORDINADOR_MONOGRAFICO','Coordinador/a de monográfico','ACTIVO') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
INSERT INTO permisos(codigo,nombre,modulo,estado) VALUES ('MONOGRAFICO_LEER','Consultar seguimiento de monográficos','MONOGRAFICO','ACTIVO') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
INSERT INTO permisos(codigo,nombre,modulo,estado) VALUES ('MONOGRAFICO_RECIBIR','Recibir expedientes','MONOGRAFICO','ACTIVO') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
INSERT INTO permisos(codigo,nombre,modulo,estado) VALUES ('MONOGRAFICO_VALIDAR','Validar expediente y abrir deuda','MONOGRAFICO','ACTIVO') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
INSERT INTO permisos(codigo,nombre,modulo,estado) VALUES ('MONOGRAFICO_GRUPOS','Gestionar grupos y remitir notas','MONOGRAFICO','ACTIVO') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
INSERT INTO permisos(codigo,nombre,modulo,estado) VALUES ('MONOGRAFICO_NOTAS','Registrar notas de cursos asignados','MONOGRAFICO','ACTIVO') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
INSERT INTO permisos(codigo,nombre,modulo,estado) VALUES ('MONOGRAFICO_CAJA','Simular cobro presencial','MONOGRAFICO','ACTIVO') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
INSERT INTO permisos(codigo,nombre,modulo,estado) VALUES ('MONOGRAFICO_REPORTES','Consultar informes institucionales','MONOGRAFICO','ACTIVO') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
INSERT INTO permisos(codigo,nombre,modulo,estado) VALUES ('MONOGRAFICO_REGLAS','Configurar tolerancia académica por plan','MONOGRAFICO','ACTIVO') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
INSERT IGNORE INTO rol_permisos(id_rol,id_permiso) SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p WHERE r.codigo='ENCARGADO' AND p.codigo IN ('MONOGRAFICO_LEER','MONOGRAFICO_REPORTES','MONOGRAFICO_REGLAS','MONOGRAFICO_GRUPOS','UCOTESIS_OFERTAS_GESTIONAR','UCOTESIS_OFERTAS_LEER','GENERAL_RESUMEN_LEER','GENERAL_REPORTES_LEER');
INSERT IGNORE INTO rol_permisos(id_rol,id_permiso) SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p WHERE r.codigo='SECRETARIA' AND p.codigo IN ('MONOGRAFICO_LEER','MONOGRAFICO_RECIBIR','MONOGRAFICO_VALIDAR','MONOGRAFICO_GRUPOS','MONOGRAFICO_REPORTES','UCOTESIS_OFERTAS_GESTIONAR','UCOTESIS_OFERTAS_LEER','INSCRIPCIONES_GESTIONAR','ESTUDIANTES_EXPEDIENTE_GESTIONAR','GENERAL_RESUMEN_LEER');
INSERT IGNORE INTO rol_permisos(id_rol,id_permiso) SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p WHERE r.codigo='OFICINISTA' AND p.codigo IN ('MONOGRAFICO_LEER','MONOGRAFICO_RECIBIR','ESTUDIANTES_EXPEDIENTE_GESTIONAR','GENERAL_RESUMEN_LEER');
INSERT IGNORE INTO rol_permisos(id_rol,id_permiso) SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p WHERE r.codigo='CAJA' AND p.codigo IN ('MONOGRAFICO_LEER','MONOGRAFICO_CAJA','GENERAL_RESUMEN_LEER');
INSERT IGNORE INTO rol_permisos(id_rol,id_permiso) SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p WHERE r.codigo='COORDINADOR_MONOGRAFICO' AND p.codigo IN ('MONOGRAFICO_LEER','MONOGRAFICO_NOTAS','GENERAL_RESUMEN_LEER','UCOTESIS_OFERTAS_LEER');
INSERT IGNORE INTO rol_permisos(id_rol,id_permiso) SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p WHERE r.codigo='DOCENTE' AND p.codigo IN ('MONOGRAFICO_LEER','MONOGRAFICO_NOTAS');
INSERT IGNORE INTO rol_permisos(id_rol,id_permiso) SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p WHERE r.codigo='TESORERIA' AND p.codigo IN ('MONOGRAFICO_LEER','MONOGRAFICO_REPORTES');
INSERT IGNORE INTO rol_permisos(id_rol,id_permiso) SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p WHERE r.codigo='ESTUDIANTE' AND p.codigo IN ('MONOGRAFICO_LEER');
INSERT IGNORE INTO rol_permisos(id_rol,id_permiso) SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p WHERE r.codigo='COORDINADOR' AND p.codigo IN ('MONOGRAFICO_LEER','MONOGRAFICO_RECIBIR','MONOGRAFICO_VALIDAR','MONOGRAFICO_GRUPOS','MONOGRAFICO_REPORTES','MONOGRAFICO_REGLAS');
