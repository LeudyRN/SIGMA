ALTER TABLE ofertas ADD COLUMN modalidad_ensenanza ENUM('PRESENCIAL','VIRTUAL','SEMIPRESENCIAL') NULL;
CREATE TABLE solicitudes_documentos (
 id_solicitud BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 id_inscripcion BIGINT UNSIGNED NOT NULL,
 tipo_documento VARCHAR(80) NOT NULL,
 instrucciones VARCHAR(500) NOT NULL,
 solicitado_por BIGINT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id_solicitud),
 UNIQUE KEY uq_sd_tipo (id_inscripcion, tipo_documento),
 KEY fk_sd_usuario (solicitado_por),
 CONSTRAINT fk_sd_inscripcion FOREIGN KEY (id_inscripcion) REFERENCES inscripciones(id_inscripcion),
 CONSTRAINT fk_sd_usuario FOREIGN KEY (solicitado_por) REFERENCES usuarios(id_usuario)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE documentos_inscripcion ADD COLUMN id_solicitud BIGINT UNSIGNED NULL,
 ADD KEY fk_di_solicitud (id_solicitud),
 ADD CONSTRAINT fk_di_solicitud FOREIGN KEY (id_solicitud) REFERENCES solicitudes_documentos(id_solicitud);
