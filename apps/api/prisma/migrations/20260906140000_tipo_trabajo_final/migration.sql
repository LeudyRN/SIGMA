-- Nuevo tipo de trabajo de grado; conserva los tipos y las ofertas existentes.
INSERT INTO modalidades (codigo, nombre, descripcion, estado)
VALUES ('TRABAJO_FINAL', 'Trabajo final', 'Trabajo de grado tipo trabajo final', 'ACTIVO')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), descripcion = VALUES(descripcion), estado = 'ACTIVO';
