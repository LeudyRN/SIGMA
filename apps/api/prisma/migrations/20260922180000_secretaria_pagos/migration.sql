INSERT INTO permisos (codigo, nombre, modulo, estado)
VALUES ('MONOGRAFICO_PAGOS_GESTIONAR', 'Registrar resultados de pagos simulados', 'MONOGRAFICO', 'ACTIVO')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

INSERT IGNORE INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r CROSS JOIN permisos p
WHERE r.codigo = 'SECRETARIA' AND p.codigo = 'MONOGRAFICO_PAGOS_GESTIONAR';
