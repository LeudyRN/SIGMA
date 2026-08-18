ALTER TABLE asignaturas
    ADD COLUMN horas_teoricas SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER nombre,
    ADD COLUMN horas_practicas SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER horas_teoricas;

ALTER TABLE plan_estudio_asignaturas
    ADD COLUMN prerrequisitos_texto VARCHAR(1000) NULL AFTER creditos_plan,
    ADD COLUMN equivalencias_texto VARCHAR(1000) NULL AFTER prerrequisitos_texto,
    ADD COLUMN tipo VARCHAR(30) NOT NULL DEFAULT 'REGULAR' AFTER equivalencias_texto,
    ADD COLUMN orden SMALLINT UNSIGNED NULL AFTER tipo;

CREATE TABLE asignatura_relaciones (
    id_relacion BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_plan_estudio BIGINT UNSIGNED NOT NULL,
    id_asignatura BIGINT UNSIGNED NOT NULL,
    id_asignatura_relacionada BIGINT UNSIGNED NOT NULL,
    tipo ENUM(
        'PRERREQUISITO',
        'CORREQUISITO',
        'EQUIVALENCIA'
    ) NOT NULL,
    operador ENUM('AND', 'OR') NULL,
    grupo SMALLINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id_relacion),

    UNIQUE KEY uq_asignatura_relacion (
        id_plan_estudio,
        id_asignatura,
        id_asignatura_relacionada,
        tipo
    ),

    KEY idx_ar_plan (id_plan_estudio),
    KEY idx_ar_asignatura (id_asignatura),
    KEY idx_ar_relacionada (id_asignatura_relacionada),

    CONSTRAINT fk_ar_plan
        FOREIGN KEY (id_plan_estudio)
        REFERENCES planes_estudio(id_plan_estudio)
        ON DELETE CASCADE,

    CONSTRAINT fk_ar_asignatura
        FOREIGN KEY (id_asignatura)
        REFERENCES asignaturas(id_asignatura)
        ON DELETE CASCADE,

    CONSTRAINT fk_ar_relacionada
        FOREIGN KEY (id_asignatura_relacionada)
        REFERENCES asignaturas(id_asignatura)
        ON DELETE CASCADE
);

CREATE TABLE recinto_carrera_planes (
    id_recinto_carrera BIGINT UNSIGNED NOT NULL,
    id_plan_estudio BIGINT UNSIGNED NOT NULL,
    estado ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id_recinto_carrera, id_plan_estudio),

    KEY idx_rcp_plan (id_plan_estudio),

    CONSTRAINT fk_rcp_recinto_carrera
        FOREIGN KEY (id_recinto_carrera)
        REFERENCES recinto_carreras(id_recinto_carrera)
        ON DELETE CASCADE,

    CONSTRAINT fk_rcp_plan
        FOREIGN KEY (id_plan_estudio)
        REFERENCES planes_estudio(id_plan_estudio)
        ON DELETE CASCADE
);