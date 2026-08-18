-- Ejecutar una sola vez en la base local que ya contiene codigo_empleado.
-- No modifica ni elimina usuarios, roles o sesiones existentes.

CREATE TABLE IF NOT EXISTS permisos (
    id_permiso BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(100) NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    descripcion VARCHAR(255) NULL,
    modulo VARCHAR(80) NOT NULL,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_permisos_codigo UNIQUE (codigo),
    INDEX idx_permisos_modulo_estado (modulo, estado)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rol_permisos (
    id_rol BIGINT UNSIGNED NOT NULL,
    id_permiso BIGINT UNSIGNED NOT NULL,
    asignado_por BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_rol, id_permiso),
    INDEX idx_rol_permisos_permiso (id_permiso),
    INDEX idx_rol_permisos_asignado_por (asignado_por),
    CONSTRAINT fk_rol_permisos_rol FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_rol_permisos_permiso FOREIGN KEY (id_permiso) REFERENCES permisos(id_permiso)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_rol_permisos_asignado_por FOREIGN KEY (asignado_por) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
('IDENTIDAD_USUARIOS_LEER', 'Consultar usuarios', 'Permite consultar usuarios y sus roles.', 'IDENTIDAD'),
('IDENTIDAD_USUARIOS_GESTIONAR', 'Gestionar usuarios', 'Permite crear y actualizar usuarios.', 'IDENTIDAD'),
('IDENTIDAD_ROLES_LEER', 'Consultar roles y permisos', 'Permite consultar roles y permisos.', 'IDENTIDAD'),
('IDENTIDAD_ROLES_GESTIONAR', 'Gestionar roles y permisos', 'Permite crear roles y asignar permisos.', 'IDENTIDAD'),
('IDENTIDAD_SESIONES_LEER', 'Consultar actividad de acceso', 'Permite consultar sesiones activas e historicas.', 'IDENTIDAD'),
('IDENTIDAD_SESIONES_REVOCAR', 'Revocar sesiones', 'Permite revocar sesiones de acceso.', 'IDENTIDAD'),
('NOTIFICACIONES_AUTOGESTIONAR', 'Gestionar notificaciones propias', 'Permite leer y eliminar notificaciones propias.', 'NOTIFICACIONES')
ON DUPLICATE KEY UPDATE
    nombre = VALUES(nombre),
    descripcion = VALUES(descripcion),
    modulo = VALUES(modulo),
    estado = 'ACTIVO';

INSERT IGNORE INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
CROSS JOIN permisos p
WHERE r.codigo = 'ADMIN';
