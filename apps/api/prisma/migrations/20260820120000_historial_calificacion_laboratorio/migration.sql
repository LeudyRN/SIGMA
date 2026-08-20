ALTER TABLE historial_academico
    ADD COLUMN calificacion_laboratorio DECIMAL(4, 2) NULL AFTER calificacion,
    ADD COLUMN calificacion_laboratorio_literal VARCHAR(20) NULL AFTER calificacion_laboratorio,
    ADD CONSTRAINT chk_historial_calificacion_laboratorio CHECK (
        calificacion_laboratorio IS NULL
        OR calificacion_laboratorio BETWEEN 0 AND 30
    );
