-- Ejecutar una sola vez en la base local de SIGMA.
ALTER TABLE usuarios
    ADD COLUMN codigo_empleado VARCHAR(30) NULL AFTER matricula,
    ADD CONSTRAINT uq_usuarios_codigo_empleado UNIQUE (codigo_empleado);
