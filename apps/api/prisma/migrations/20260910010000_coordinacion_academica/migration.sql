-- AlterTable
ALTER TABLE `proyecto_docentes` ADD COLUMN `complejidad` VARCHAR(30) NULL,
    ADD COLUMN `criterio_asignacion` VARCHAR(1500) NULL,
    ADD COLUMN `disponibilidad_confirmada` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `perfiles_academicos` (
    `id_docente` BIGINT UNSIGNED NOT NULL,
    `especialidades` VARCHAR(1000) NOT NULL,
    `disponibilidad` VARCHAR(1000) NOT NULL,
    `max_grupos` SMALLINT UNSIGNED NOT NULL DEFAULT 5,
    `max_estudiantes` SMALLINT UNSIGNED NOT NULL DEFAULT 25,
    `disponible` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id_docente`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `designaciones_academicas` (
    `id_oferta` BIGINT UNSIGNED NOT NULL,
    `id_escuela` BIGINT UNSIGNED NOT NULL,
    `id_docente` BIGINT UNSIGNED NOT NULL,
    `fecha` DATE NOT NULL,
    `referencia` VARCHAR(200) NOT NULL,
    `observacion` VARCHAR(1000) NULL,
    `registrado_por` BIGINT UNSIGNED NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id_oferta`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hitos_academicos` (
    `id_hito` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_oferta` BIGINT UNSIGNED NOT NULL,
    `id_proyecto` BIGINT UNSIGNED NULL,
    `titulo` VARCHAR(200) NOT NULL,
    `tipo` VARCHAR(30) NOT NULL,
    `fecha_limite` DATETIME(0) NOT NULL,
    `instrucciones` TEXT NOT NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADO',
    `version` INTEGER NOT NULL DEFAULT 1,
    `creado_por` BIGINT UNSIGNED NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `hitos_academicos_estado_fecha_limite_idx`(`estado`, `fecha_limite`),
    PRIMARY KEY (`id_hito`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entregas_academicas` (
    `id_entrega` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_hito` BIGINT UNSIGNED NOT NULL,
    `id_proyecto` BIGINT UNSIGNED NOT NULL,
    `nombre_archivo` VARCHAR(200) NOT NULL,
    `contenido` LONGBLOB NOT NULL,
    `hash_sha256` CHAR(64) NOT NULL,
    `entregado_por` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `estado` VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    `retroalimentacion` TEXT NULL,
    `revisado_por` BIGINT UNSIGNED NULL,
    `revisado_at` DATETIME(0) NULL,

    INDEX `entregas_academicas_id_proyecto_id_hito_created_at_idx`(`id_proyecto`, `id_hito`, `created_at`),
    PRIMARY KEY (`id_entrega`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solicitudes_docentes` (
    `id_solicitud` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_oferta` BIGINT UNSIGNED NOT NULL,
    `id_docente` BIGINT UNSIGNED NOT NULL,
    `titulo` VARCHAR(200) NOT NULL,
    `finalidad` VARCHAR(30) NOT NULL,
    `instrucciones` TEXT NOT NULL,
    `estado_tramite` VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    `referencia_tramite` VARCHAR(200) NULL,
    `solicitado_por` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id_solicitud`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentos_docentes` (
    `id_documento` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_solicitud` BIGINT UNSIGNED NOT NULL,
    `nombre_archivo` VARCHAR(200) NOT NULL,
    `contenido` LONGBLOB NOT NULL,
    `hash_sha256` CHAR(64) NOT NULL,
    `cargado_por` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `estado` VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    `observacion` TEXT NULL,
    `revisado_por` BIGINT UNSIGNED NULL,
    `revisado_at` DATETIME(0) NULL,

    INDEX `documentos_docentes_id_solicitud_created_at_idx`(`id_solicitud`, `created_at`),
    PRIMARY KEY (`id_documento`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alertas_academicas` (
    `id_alerta` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_hito` BIGINT UNSIGNED NOT NULL,
    `version` INTEGER NOT NULL,
    `id_usuario` BIGINT UNSIGNED NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `alertas_academicas_id_hito_version_id_usuario_tipo_key`(`id_hito`, `version`, `id_usuario`, `tipo`),
    PRIMARY KEY (`id_alerta`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `perfiles_academicos` ADD CONSTRAINT `perfiles_academicos_id_docente_fkey` FOREIGN KEY (`id_docente`) REFERENCES `docentes`(`id_docente`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designaciones_academicas` ADD CONSTRAINT `designaciones_academicas_id_oferta_fkey` FOREIGN KEY (`id_oferta`) REFERENCES `ofertas`(`id_oferta`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designaciones_academicas` ADD CONSTRAINT `designaciones_academicas_id_escuela_fkey` FOREIGN KEY (`id_escuela`) REFERENCES `escuelas`(`id_escuela`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designaciones_academicas` ADD CONSTRAINT `designaciones_academicas_id_docente_fkey` FOREIGN KEY (`id_docente`) REFERENCES `docentes`(`id_docente`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hitos_academicos` ADD CONSTRAINT `hitos_academicos_id_oferta_fkey` FOREIGN KEY (`id_oferta`) REFERENCES `ofertas`(`id_oferta`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hitos_academicos` ADD CONSTRAINT `hitos_academicos_id_proyecto_fkey` FOREIGN KEY (`id_proyecto`) REFERENCES `proyectos_grado`(`id_proyecto`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entregas_academicas` ADD CONSTRAINT `entregas_academicas_id_hito_fkey` FOREIGN KEY (`id_hito`) REFERENCES `hitos_academicos`(`id_hito`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entregas_academicas` ADD CONSTRAINT `entregas_academicas_id_proyecto_fkey` FOREIGN KEY (`id_proyecto`) REFERENCES `proyectos_grado`(`id_proyecto`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitudes_docentes` ADD CONSTRAINT `solicitudes_docentes_id_oferta_fkey` FOREIGN KEY (`id_oferta`) REFERENCES `ofertas`(`id_oferta`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitudes_docentes` ADD CONSTRAINT `solicitudes_docentes_id_docente_fkey` FOREIGN KEY (`id_docente`) REFERENCES `docentes`(`id_docente`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_docentes` ADD CONSTRAINT `documentos_docentes_id_solicitud_fkey` FOREIGN KEY (`id_solicitud`) REFERENCES `solicitudes_docentes`(`id_solicitud`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alertas_academicas` ADD CONSTRAINT `alertas_academicas_id_hito_fkey` FOREIGN KEY (`id_hito`) REFERENCES `hitos_academicos`(`id_hito`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alertas_academicas` ADD CONSTRAINT `alertas_academicas_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO permisos(codigo,nombre,modulo,estado) VALUES ('COORDINACION_ACADEMICA_LEER','Consultar coordinación académica','COORDINACION','ACTIVO') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
INSERT IGNORE INTO rol_permisos(id_rol,id_permiso) SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p WHERE p.codigo='COORDINACION_ACADEMICA_LEER' AND r.codigo IN ('ADMIN','COORDINADOR','ENCARGADO','SECRETARIA','OFICINISTA','COORDINADOR_MONOGRAFICO','DOCENTE','ASESOR','JURADO','ESTUDIANTE');
