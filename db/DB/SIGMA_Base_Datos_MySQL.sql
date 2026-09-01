-- ============================================================
-- SIGMA - Sistema de Gestión e Inscripción Virtual de Tesis /
-- Monográficos - UCOTESIS UASD
-- Motor: MySQL 8.0+
-- Codificación: utf8mb4
-- ============================================================

DROP DATABASE IF EXISTS sigma_ucotesis;

CREATE DATABASE sigma_ucotesis
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE sigma_ucotesis;

SET NAMES utf8mb4;
SET time_zone = '-04:00';

-- ============================================================
-- 1. SEGURIDAD Y USUARIOS
-- ============================================================

CREATE TABLE roles (
    id_rol BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_roles_codigo UNIQUE (codigo),
    CONSTRAINT uq_roles_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE permisos (
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

CREATE TABLE usuarios (
    id_usuario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL,
    matricula VARCHAR(30) NULL,
    codigo_empleado VARCHAR(30) NULL,
    nombres VARCHAR(120) NOT NULL,
    apellidos VARCHAR(120) NOT NULL,
    cedula VARCHAR(20) NULL,
    email VARCHAR(190) NOT NULL,
    telefono VARCHAR(30) NULL,
    password_hash VARCHAR(255) NOT NULL,
    estado ENUM('ACTIVO','INACTIVO','BLOQUEADO','PENDIENTE') NOT NULL DEFAULT 'PENDIENTE',
    email_verificado_at DATETIME NULL,
    ultimo_acceso_at DATETIME NULL,
    intentos_fallidos SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    bloqueado_hasta DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    CONSTRAINT uq_usuarios_uuid UNIQUE (uuid),
    CONSTRAINT uq_usuarios_matricula UNIQUE (matricula),
    CONSTRAINT uq_usuarios_codigo_empleado UNIQUE (codigo_empleado),
    CONSTRAINT uq_usuarios_cedula UNIQUE (cedula),
    CONSTRAINT uq_usuarios_email UNIQUE (email),

    INDEX idx_usuarios_nombre (apellidos, nombres),
    INDEX idx_usuarios_estado (estado)
) ENGINE=InnoDB;

CREATE TABLE usuario_roles (
    id_usuario BIGINT UNSIGNED NOT NULL,
    id_rol BIGINT UNSIGNED NOT NULL,
    asignado_por BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_usuario, id_rol),
    CONSTRAINT fk_usuario_roles_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_usuario_roles_rol
        FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_usuario_roles_asignado_por
        FOREIGN KEY (asignado_por) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE rol_permisos (
    id_rol BIGINT UNSIGNED NOT NULL,
    id_permiso BIGINT UNSIGNED NOT NULL,
    asignado_por BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_rol, id_permiso),
    INDEX idx_rol_permisos_permiso (id_permiso),
    INDEX idx_rol_permisos_asignado_por (asignado_por),
    CONSTRAINT fk_rol_permisos_rol
        FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_rol_permisos_permiso
        FOREIGN KEY (id_permiso) REFERENCES permisos(id_permiso)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_rol_permisos_asignado_por
        FOREIGN KEY (asignado_por) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE sesiones (
    id_sesion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_usuario BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    refresh_token_hash CHAR(64) NULL,
    ip VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    expira_at DATETIME NOT NULL,
    revocada_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sesiones_token UNIQUE (token_hash),
    CONSTRAINT uq_sesiones_refresh UNIQUE (refresh_token_hash),
    INDEX idx_sesiones_usuario (id_usuario),
    INDEX idx_sesiones_expira (expira_at),
    CONSTRAINT fk_sesiones_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 2. ESTRUCTURA UNIVERSITARIA
-- ============================================================

CREATE TABLE recintos (
    id_recinto BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    direccion VARCHAR(255) NULL,
    telefono VARCHAR(30) NULL,
    email VARCHAR(190) NULL,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_recintos_codigo UNIQUE (codigo),
    CONSTRAINT uq_recintos_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE facultades (
    id_facultad BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_facultades_codigo UNIQUE (codigo),
    CONSTRAINT uq_facultades_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE escuelas (
    id_escuela BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_facultad BIGINT UNSIGNED NOT NULL,
    codigo VARCHAR(30) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_escuelas_codigo UNIQUE (codigo),
    INDEX idx_escuelas_facultad (id_facultad),
    CONSTRAINT fk_escuelas_facultad
        FOREIGN KEY (id_facultad) REFERENCES facultades(id_facultad)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE carreras (
    id_carrera BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_escuela BIGINT UNSIGNED NOT NULL,
    codigo VARCHAR(30) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    nivel_academico VARCHAR(60) NOT NULL DEFAULT 'GRADO',
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_carreras_codigo UNIQUE (codigo),
    INDEX idx_carreras_escuela (id_escuela),
    CONSTRAINT fk_carreras_escuela
        FOREIGN KEY (id_escuela) REFERENCES escuelas(id_escuela)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE recinto_carreras (
    id_recinto_carrera BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_recinto BIGINT UNSIGNED NOT NULL,
    id_carrera BIGINT UNSIGNED NOT NULL,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_recinto_carrera UNIQUE (id_recinto, id_carrera),
    INDEX idx_rc_carrera (id_carrera),
    CONSTRAINT fk_rc_recinto
        FOREIGN KEY (id_recinto) REFERENCES recintos(id_recinto)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_rc_carrera
        FOREIGN KEY (id_carrera) REFERENCES carreras(id_carrera)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE planes_estudio (
    id_plan_estudio BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_carrera BIGINT UNSIGNED NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    anio_inicio YEAR NOT NULL,
    anio_fin YEAR NULL,
    creditos_totales DECIMAL(7,2) NULL,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_planes_codigo UNIQUE (codigo),
    INDEX idx_planes_carrera (id_carrera),
    CONSTRAINT fk_planes_carrera
        FOREIGN KEY (id_carrera) REFERENCES carreras(id_carrera)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE asignaturas (
    id_asignatura BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL,
    nombre VARCHAR(180) NOT NULL,
    creditos DECIMAL(5,2) NOT NULL DEFAULT 0,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_asignaturas_codigo UNIQUE (codigo),
    INDEX idx_asignaturas_nombre (nombre),
    CONSTRAINT chk_asignaturas_creditos CHECK (creditos >= 0)
) ENGINE=InnoDB;

CREATE TABLE plan_estudio_asignaturas (
    id_plan_estudio BIGINT UNSIGNED NOT NULL,
    id_asignatura BIGINT UNSIGNED NOT NULL,
    semestre TINYINT UNSIGNED NULL,
    obligatoria BOOLEAN NOT NULL DEFAULT TRUE,
    creditos_plan DECIMAL(5,2) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_plan_estudio, id_asignatura),
    INDEX idx_pea_asignatura (id_asignatura),
    CONSTRAINT fk_pea_plan
        FOREIGN KEY (id_plan_estudio) REFERENCES planes_estudio(id_plan_estudio)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pea_asignatura
        FOREIGN KEY (id_asignatura) REFERENCES asignaturas(id_asignatura)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_pea_semestre CHECK (semestre IS NULL OR semestre BETWEEN 1 AND 20)
) ENGINE=InnoDB;

-- ============================================================
-- 3. ESTUDIANTES E HISTORIAL ACADÉMICO
-- ============================================================

CREATE TABLE estudiantes (
    id_estudiante BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_usuario BIGINT UNSIGNED NOT NULL,
    matricula VARCHAR(30) NOT NULL,
    fecha_nacimiento DATE NULL,
    whatsapp VARCHAR(30) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_estudiantes_usuario UNIQUE (id_usuario),
    CONSTRAINT uq_estudiantes_matricula UNIQUE (matricula),
    CONSTRAINT fk_estudiantes_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE estudiante_carreras (
    id_estudiante_carrera BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_estudiante BIGINT UNSIGNED NOT NULL,
    id_recinto_carrera BIGINT UNSIGNED NOT NULL,
    id_plan_estudio BIGINT UNSIGNED NOT NULL,
    fecha_ingreso DATE NULL,
    fecha_egreso DATE NULL,
    estado ENUM('ACTIVA','FINALIZADA','SUSPENDIDA','RETIRADA') NOT NULL DEFAULT 'ACTIVA',
    es_principal BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_estudiante_carrera_plan UNIQUE (
        id_estudiante, id_recinto_carrera, id_plan_estudio
    ),
    INDEX idx_ec_recinto_carrera (id_recinto_carrera),
    INDEX idx_ec_plan (id_plan_estudio),
    CONSTRAINT fk_ec_estudiante
        FOREIGN KEY (id_estudiante) REFERENCES estudiantes(id_estudiante)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ec_recinto_carrera
        FOREIGN KEY (id_recinto_carrera) REFERENCES recinto_carreras(id_recinto_carrera)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ec_plan
        FOREIGN KEY (id_plan_estudio) REFERENCES planes_estudio(id_plan_estudio)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE historial_academico (
    id_historial BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_estudiante_carrera BIGINT UNSIGNED NOT NULL,
    id_asignatura BIGINT UNSIGNED NOT NULL,
    periodo_codigo VARCHAR(30) NOT NULL,
    calificacion DECIMAL(5,2) NULL,
    calificacion_laboratorio DECIMAL(4,2) NULL,
    calificacion_laboratorio_literal VARCHAR(20) NULL,
    estado_asignatura ENUM(
        'APROBADA','REPROBADA','RETIRADA','CURSANDO','PENDIENTE','CONVALIDADA'
    ) NOT NULL,
    fuente VARCHAR(100) NULL,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_historial_registro UNIQUE (
        id_estudiante_carrera, id_asignatura, periodo_codigo
    ),
    INDEX idx_historial_asignatura (id_asignatura),
    INDEX idx_historial_estado (estado_asignatura),
    CONSTRAINT fk_historial_ec
        FOREIGN KEY (id_estudiante_carrera) REFERENCES estudiante_carreras(id_estudiante_carrera)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_historial_asignatura
        FOREIGN KEY (id_asignatura) REFERENCES asignaturas(id_asignatura)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_historial_calificacion CHECK (
        calificacion IS NULL OR calificacion BETWEEN 0 AND 100
    ),
    CONSTRAINT chk_historial_calificacion_laboratorio CHECK (
        calificacion_laboratorio IS NULL OR calificacion_laboratorio BETWEEN 0 AND 30
    )
) ENGINE=InnoDB;

-- ============================================================
-- 4. CATÁLOGOS UCOTESIS
-- ============================================================

CREATE TABLE modalidades (
    id_modalidad BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_modalidades_codigo UNIQUE (codigo),
    CONSTRAINT uq_modalidades_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE periodos_academicos (
    id_periodo BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado ENUM('PLANIFICADO','ACTIVO','CERRADO','CANCELADO') NOT NULL DEFAULT 'PLANIFICADO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_periodos_codigo UNIQUE (codigo),
    CONSTRAINT chk_periodos_fechas CHECK (fecha_fin >= fecha_inicio),
    INDEX idx_periodos_estado_fechas (estado, fecha_inicio, fecha_fin)
) ENGINE=InnoDB;

CREATE TABLE areas_investigacion (
    id_area BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion VARCHAR(500) NULL,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_areas_codigo UNIQUE (codigo),
    CONSTRAINT uq_areas_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE requisitos (
    id_requisito BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(60) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion VARCHAR(500) NULL,
    tipo_validacion ENUM('AUTOMATICA','MANUAL','DOCUMENTAL') NOT NULL,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_requisitos_codigo UNIQUE (codigo)
) ENGINE=InnoDB;

-- ============================================================
-- 5. OFERTAS DE TESIS / MONOGRÁFICO
-- ============================================================

CREATE TABLE ofertas (
    id_oferta BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL,
    id_recinto_carrera BIGINT UNSIGNED NOT NULL,
    id_modalidad BIGINT UNSIGNED NOT NULL,
    id_periodo BIGINT UNSIGNED NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NULL,
    fecha_inicio_inscripcion DATETIME NOT NULL,
    fecha_fin_inscripcion DATETIME NOT NULL,
    cupo_total INT UNSIGNED NOT NULL,
    cupo_reservado INT UNSIGNED NOT NULL DEFAULT 0,
    monto DECIMAL(12,2) NOT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'DOP',
    estado ENUM('BORRADOR','PUBLICADA','CERRADA','CANCELADA') NOT NULL DEFAULT 'BORRADOR',
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_ofertas_codigo UNIQUE (codigo),
    CONSTRAINT uq_oferta_contexto UNIQUE (
        id_recinto_carrera, id_modalidad, id_periodo, codigo
    ),
    INDEX idx_ofertas_busqueda (
        id_recinto_carrera, id_modalidad, id_periodo, estado
    ),
    INDEX idx_ofertas_fechas (
        fecha_inicio_inscripcion, fecha_fin_inscripcion
    ),
    CONSTRAINT fk_ofertas_rc
        FOREIGN KEY (id_recinto_carrera) REFERENCES recinto_carreras(id_recinto_carrera)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ofertas_modalidad
        FOREIGN KEY (id_modalidad) REFERENCES modalidades(id_modalidad)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ofertas_periodo
        FOREIGN KEY (id_periodo) REFERENCES periodos_academicos(id_periodo)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ofertas_created_by
        FOREIGN KEY (created_by) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_ofertas_fechas CHECK (
        fecha_fin_inscripcion >= fecha_inicio_inscripcion
    ),
    CONSTRAINT chk_ofertas_cupo CHECK (
        cupo_reservado <= cupo_total
    ),
    CONSTRAINT chk_ofertas_monto CHECK (monto >= 0)
) ENGINE=InnoDB;

CREATE TABLE oferta_areas (
    id_oferta BIGINT UNSIGNED NOT NULL,
    id_area BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_oferta, id_area),
    INDEX idx_oferta_areas_area (id_area),
    CONSTRAINT fk_oferta_areas_oferta
        FOREIGN KEY (id_oferta) REFERENCES ofertas(id_oferta)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_oferta_areas_area
        FOREIGN KEY (id_area) REFERENCES areas_investigacion(id_area)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE oferta_requisitos (
    id_oferta BIGINT UNSIGNED NOT NULL,
    id_requisito BIGINT UNSIGNED NOT NULL,
    obligatorio BOOLEAN NOT NULL DEFAULT TRUE,
    valor_requerido VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_oferta, id_requisito),
    INDEX idx_or_requisito (id_requisito),
    CONSTRAINT fk_or_oferta
        FOREIGN KEY (id_oferta) REFERENCES ofertas(id_oferta)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_or_requisito
        FOREIGN KEY (id_requisito) REFERENCES requisitos(id_requisito)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- 6. ESTADOS E INSCRIPCIONES
-- ============================================================

CREATE TABLE estados_inscripcion (
    id_estado BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    orden SMALLINT UNSIGNED NOT NULL,
    es_final BOOLEAN NOT NULL DEFAULT FALSE,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT uq_estados_inscripcion_codigo UNIQUE (codigo),
    CONSTRAINT uq_estados_inscripcion_orden UNIQUE (orden)
) ENGINE=InnoDB;

CREATE TABLE inscripciones (
    id_inscripcion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(60) NOT NULL,
    id_oferta BIGINT UNSIGNED NOT NULL,
    id_estado BIGINT UNSIGNED NOT NULL,
    monto_aplicado DECIMAL(12,2) NOT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'DOP',
    fecha_solicitud DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_confirmacion DATETIME NULL,
    fecha_cancelacion DATETIME NULL,
    motivo_cancelacion VARCHAR(500) NULL,
    observaciones TEXT NULL,
    version_lock INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_inscripciones_codigo UNIQUE (codigo),
    CONSTRAINT uq_inscripciones_id_oferta UNIQUE (id_inscripcion, id_oferta),
    INDEX idx_inscripciones_oferta_estado (id_oferta, id_estado),
    INDEX idx_inscripciones_fecha (fecha_solicitud),
    CONSTRAINT fk_inscripciones_oferta
        FOREIGN KEY (id_oferta) REFERENCES ofertas(id_oferta)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_inscripciones_estado
        FOREIGN KEY (id_estado) REFERENCES estados_inscripcion(id_estado)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_inscripciones_monto CHECK (monto_aplicado >= 0)
) ENGINE=InnoDB;

CREATE TABLE inscripcion_estudiantes (
    id_inscripcion BIGINT UNSIGNED NOT NULL,
    id_oferta BIGINT UNSIGNED NOT NULL,
    id_estudiante BIGINT UNSIGNED NOT NULL,
    es_principal BOOLEAN NOT NULL DEFAULT FALSE,
    orden_sustentante SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_inscripcion, id_estudiante),
    CONSTRAINT uq_inscripcion_estudiante_oferta UNIQUE (id_oferta, id_estudiante),
    INDEX idx_ie_estudiante (id_estudiante),
    CONSTRAINT fk_ie_inscripcion_oferta
        FOREIGN KEY (id_inscripcion, id_oferta)
        REFERENCES inscripciones(id_inscripcion, id_oferta)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_ie_estudiante
        FOREIGN KEY (id_estudiante) REFERENCES estudiantes(id_estudiante)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE validaciones_requisitos (
    id_validacion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_inscripcion BIGINT UNSIGNED NOT NULL,
    id_requisito BIGINT UNSIGNED NOT NULL,
    cumple BOOLEAN NOT NULL,
    valor_obtenido VARCHAR(500) NULL,
    observacion VARCHAR(1000) NULL,
    validado_automaticamente BOOLEAN NOT NULL DEFAULT FALSE,
    validado_por BIGINT UNSIGNED NULL,
    fecha_validacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_validacion_inscripcion_requisito UNIQUE (
        id_inscripcion, id_requisito
    ),
    INDEX idx_validaciones_requisito (id_requisito),
    INDEX idx_validaciones_resultado (cumple),
    CONSTRAINT fk_validaciones_inscripcion
        FOREIGN KEY (id_inscripcion) REFERENCES inscripciones(id_inscripcion)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_validaciones_requisito
        FOREIGN KEY (id_requisito) REFERENCES requisitos(id_requisito)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_validaciones_usuario
        FOREIGN KEY (validado_por) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE historial_estados_inscripcion (
    id_historial_estado BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_inscripcion BIGINT UNSIGNED NOT NULL,
    id_estado_anterior BIGINT UNSIGNED NULL,
    id_estado_nuevo BIGINT UNSIGNED NOT NULL,
    cambiado_por BIGINT UNSIGNED NULL,
    motivo VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hei_inscripcion_fecha (id_inscripcion, created_at),
    CONSTRAINT fk_hei_inscripcion
        FOREIGN KEY (id_inscripcion) REFERENCES inscripciones(id_inscripcion)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_hei_estado_anterior
        FOREIGN KEY (id_estado_anterior) REFERENCES estados_inscripcion(id_estado)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_hei_estado_nuevo
        FOREIGN KEY (id_estado_nuevo) REFERENCES estados_inscripcion(id_estado)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_hei_usuario
        FOREIGN KEY (cambiado_por) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE documentos_inscripcion (
    id_documento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_inscripcion BIGINT UNSIGNED NOT NULL,
    id_estudiante BIGINT UNSIGNED NULL,
    tipo_documento VARCHAR(80) NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    mime_type VARCHAR(120) NULL,
    tamano_bytes BIGINT UNSIGNED NULL,
    hash_sha256 CHAR(64) NULL,
    contenido LONGBLOB NULL,
    estado_validacion ENUM('PENDIENTE','VALIDO','RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
    validado_por BIGINT UNSIGNED NULL,
    validado_at DATETIME NULL,
    observacion VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_documentos_inscripcion (id_inscripcion),
    INDEX idx_documentos_estudiante (id_estudiante),
    CONSTRAINT fk_documentos_inscripcion
        FOREIGN KEY (id_inscripcion) REFERENCES inscripciones(id_inscripcion)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_documentos_estudiante
        FOREIGN KEY (id_estudiante) REFERENCES estudiantes(id_estudiante)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_documentos_validado_por
        FOREIGN KEY (validado_por) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 7. PAGOS, TRANSACCIONES, CONCILIACIÓN Y FACTURACIÓN
-- ============================================================

CREATE TABLE metodos_pago (
    id_metodo_pago BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT uq_metodos_pago_codigo UNIQUE (codigo),
    CONSTRAINT uq_metodos_pago_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE cuentas_bancarias (
    id_cuenta_bancaria BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    banco VARCHAR(120) NOT NULL,
    numero_cuenta VARCHAR(80) NOT NULL,
    tipo_cuenta ENUM('AHORRO','CORRIENTE') NOT NULL,
    tipo_documento VARCHAR(30) NOT NULL,
    documento_titular VARCHAR(30) NOT NULL,
    nombre_titular VARCHAR(200) NOT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'DOP',
    instrucciones VARCHAR(1000) NULL,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_cuentas_bancarias_numero UNIQUE (numero_cuenta),
    INDEX idx_cuentas_bancarias_estado (estado, banco),
    CONSTRAINT fk_cuentas_bancarias_usuario
        FOREIGN KEY (created_by) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE pagos (
    id_pago BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_inscripcion BIGINT UNSIGNED NOT NULL,
    id_metodo_pago BIGINT UNSIGNED NOT NULL,
    id_cuenta_bancaria BIGINT UNSIGNED NULL,
    referencia VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'DOP',
    estado ENUM(
        'CREADO','PENDIENTE','PROCESANDO','APROBADO','RECHAZADO',
        'REVERSADO','REEMBOLSADO','CANCELADO'
    ) NOT NULL DEFAULT 'CREADO',
    fecha_pago DATETIME NULL,
    aprobado_at DATETIME NULL,
    rechazado_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_pagos_referencia UNIQUE (referencia),
    CONSTRAINT uq_pagos_idempotency UNIQUE (idempotency_key),
    INDEX idx_pagos_inscripcion_estado (id_inscripcion, estado),
    INDEX idx_pagos_fecha (fecha_pago),
    INDEX idx_pagos_cuenta_bancaria (id_cuenta_bancaria),
    CONSTRAINT fk_pagos_inscripcion
        FOREIGN KEY (id_inscripcion) REFERENCES inscripciones(id_inscripcion)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pagos_metodo
        FOREIGN KEY (id_metodo_pago) REFERENCES metodos_pago(id_metodo_pago)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pagos_cuenta_bancaria
        FOREIGN KEY (id_cuenta_bancaria) REFERENCES cuentas_bancarias(id_cuenta_bancaria)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_pagos_monto CHECK (monto >= 0)
) ENGINE=InnoDB;

CREATE TABLE comprobantes_transferencia (
    id_comprobante BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_pago BIGINT UNSIGNED NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    tamano_bytes INT UNSIGNED NOT NULL,
    hash_sha256 CHAR(64) NOT NULL,
    contenido LONGBLOB NOT NULL,
    estado ENUM('PENDIENTE','VALIDADO','RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
    observacion VARCHAR(500) NULL,
    revisado_por BIGINT UNSIGNED NULL,
    revisado_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_comprobantes_transferencia_pago UNIQUE (id_pago),
    INDEX idx_comprobantes_transferencia_estado (estado, created_at),
    CONSTRAINT fk_comprobantes_transferencia_pago
        FOREIGN KEY (id_pago) REFERENCES pagos(id_pago)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_comprobantes_transferencia_revisor
        FOREIGN KEY (revisado_por) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE transacciones_pago (
    id_transaccion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_pago BIGINT UNSIGNED NOT NULL,
    proveedor VARCHAR(80) NOT NULL,
    proveedor_transaccion_id VARCHAR(150) NULL,
    tipo ENUM(
        'AUTORIZACION','CAPTURA','VENTA','REVERSO','REEMBOLSO','CONSULTA'
    ) NOT NULL DEFAULT 'VENTA',
    estado ENUM('PENDIENTE','APROBADA','RECHAZADA','ERROR') NOT NULL,
    authorization_code VARCHAR(100) NULL,
    response_code VARCHAR(50) NULL,
    response_message VARCHAR(500) NULL,
    request_reference VARCHAR(150) NULL,
    request_payload JSON NULL,
    response_payload JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tx_proveedor_id UNIQUE (proveedor, proveedor_transaccion_id),
    INDEX idx_tx_pago_fecha (id_pago, created_at),
    CONSTRAINT fk_tx_pago
        FOREIGN KEY (id_pago) REFERENCES pagos(id_pago)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE conciliaciones_pago (
    id_conciliacion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(60) NOT NULL,
    proveedor VARCHAR(80) NOT NULL,
    fecha_desde DATETIME NOT NULL,
    fecha_hasta DATETIME NOT NULL,
    total_registros INT UNSIGNED NOT NULL DEFAULT 0,
    total_monto DECIMAL(14,2) NOT NULL DEFAULT 0,
    estado ENUM('ABIERTA','PROCESADA','CON_DIFERENCIAS','CERRADA') NOT NULL DEFAULT 'ABIERTA',
    procesada_por BIGINT UNSIGNED NULL,
    procesada_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_conciliaciones_codigo UNIQUE (codigo),
    CONSTRAINT chk_conciliaciones_fechas CHECK (fecha_hasta >= fecha_desde),
    CONSTRAINT fk_conciliaciones_usuario
        FOREIGN KEY (procesada_por) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE conciliacion_detalles (
    id_conciliacion BIGINT UNSIGNED NOT NULL,
    id_pago BIGINT UNSIGNED NOT NULL,
    monto_reportado DECIMAL(12,2) NULL,
    coincide BOOLEAN NOT NULL DEFAULT FALSE,
    observacion VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_conciliacion, id_pago),
    INDEX idx_cd_pago (id_pago),
    CONSTRAINT fk_cd_conciliacion
        FOREIGN KEY (id_conciliacion) REFERENCES conciliaciones_pago(id_conciliacion)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_cd_pago
        FOREIGN KEY (id_pago) REFERENCES pagos(id_pago)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE facturas (
    id_factura BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_pago BIGINT UNSIGNED NOT NULL,
    numero_factura VARCHAR(80) NOT NULL,
    numero_recibo VARCHAR(80) NOT NULL,

    -- Snapshot histórico de la factura
    recinto_nombre VARCHAR(150) NOT NULL,
    matricula VARCHAR(30) NOT NULL,
    estudiante_nombre VARCHAR(250) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'DOP',
    metodo_pago_nombre VARCHAR(100) NOT NULL,

    qr_token VARCHAR(255) NOT NULL,
    qr_hash CHAR(64) NOT NULL,
    pdf_url VARCHAR(500) NULL,
    fecha_emision DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    anulada_at DATETIME NULL,
    motivo_anulacion VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_facturas_pago UNIQUE (id_pago),
    CONSTRAINT uq_facturas_numero UNIQUE (numero_factura),
    CONSTRAINT uq_facturas_recibo UNIQUE (numero_recibo),
    CONSTRAINT uq_facturas_qr_token UNIQUE (qr_token),
    CONSTRAINT uq_facturas_qr_hash UNIQUE (qr_hash),
    INDEX idx_facturas_fecha (fecha_emision),
    INDEX idx_facturas_matricula (matricula),
    CONSTRAINT fk_facturas_pago
        FOREIGN KEY (id_pago) REFERENCES pagos(id_pago)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_facturas_monto CHECK (monto >= 0)
) ENGINE=InnoDB;

-- ============================================================
-- 8. DOCENTES, PROYECTOS, ASESORES Y JURADOS
-- ============================================================

CREATE TABLE docentes (
    id_docente BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_usuario BIGINT UNSIGNED NOT NULL,
    codigo_docente VARCHAR(50) NOT NULL,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_docentes_usuario UNIQUE (id_usuario),
    CONSTRAINT uq_docentes_codigo UNIQUE (codigo_docente),
    CONSTRAINT fk_docentes_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE proyectos_grado (
    id_proyecto BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_inscripcion BIGINT UNSIGNED NOT NULL,
    id_area BIGINT UNSIGNED NULL,
    area_personalizada VARCHAR(150) NULL,
    observacion_revision VARCHAR(1000) NULL,
    titulo VARCHAR(300) NULL,
    descripcion TEXT NULL,
    estado ENUM(
        'PENDIENTE','EN_DESARROLLO','EN_REVISION','APROBADO',
        'RECHAZADO','FINALIZADO','CANCELADO'
    ) NOT NULL DEFAULT 'PENDIENTE',
    fecha_inicio DATE NULL,
    fecha_finalizacion DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_proyectos_inscripcion UNIQUE (id_inscripcion),
    INDEX idx_proyectos_area (id_area),
    INDEX idx_proyectos_estado (estado),
    CONSTRAINT fk_proyectos_inscripcion
        FOREIGN KEY (id_inscripcion) REFERENCES inscripciones(id_inscripcion)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_proyectos_area
        FOREIGN KEY (id_area) REFERENCES areas_investigacion(id_area)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE tipos_participacion (
    id_tipo_participacion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT uq_tipos_participacion_codigo UNIQUE (codigo)
) ENGINE=InnoDB;

CREATE TABLE proyecto_docentes (
    id_proyecto BIGINT UNSIGNED NOT NULL,
    id_docente BIGINT UNSIGNED NOT NULL,
    id_tipo_participacion BIGINT UNSIGNED NOT NULL,
    fecha_asignacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    asignado_por BIGINT UNSIGNED NULL,
    estado ENUM('ACTIVO','REMOVIDO') NOT NULL DEFAULT 'ACTIVO',
    removed_at DATETIME NULL,
    PRIMARY KEY (id_proyecto, id_docente, id_tipo_participacion),
    INDEX idx_pd_docente (id_docente),
    INDEX idx_pd_tipo (id_tipo_participacion),
    CONSTRAINT fk_pd_proyecto
        FOREIGN KEY (id_proyecto) REFERENCES proyectos_grado(id_proyecto)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pd_docente
        FOREIGN KEY (id_docente) REFERENCES docentes(id_docente)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pd_tipo
        FOREIGN KEY (id_tipo_participacion)
        REFERENCES tipos_participacion(id_tipo_participacion)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pd_asignado_por
        FOREIGN KEY (asignado_por) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 9. NOTIFICACIONES, CONFIGURACIÓN Y AUDITORÍA
-- ============================================================

CREATE TABLE notificaciones (
    id_notificacion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_usuario BIGINT UNSIGNED NOT NULL,
    tipo VARCHAR(60) NOT NULL,
    titulo VARCHAR(180) NOT NULL,
    mensaje TEXT NOT NULL,
    url VARCHAR(500) NULL,
    canal ENUM('IN_APP','EMAIL','PUSH','SISTEMA') NOT NULL DEFAULT 'IN_APP',
    estado_envio ENUM('PENDIENTE','ENVIADA','ERROR') NOT NULL DEFAULT 'PENDIENTE',
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_lectura DATETIME NULL,
    enviada_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notificaciones_usuario_leida (
        id_usuario, leida, created_at
    ),
    CONSTRAINT fk_notificaciones_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE configuraciones (
    id_configuracion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(120) NOT NULL,
    valor TEXT NULL,
    tipo ENUM('STRING','INTEGER','DECIMAL','BOOLEAN','JSON','DATE','DATETIME') NOT NULL DEFAULT 'STRING',
    descripcion VARCHAR(500) NULL,
    es_publica BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_configuraciones_clave UNIQUE (clave),
    CONSTRAINT fk_configuraciones_usuario
        FOREIGN KEY (updated_by) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE auditoria (
    id_auditoria BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_usuario BIGINT UNSIGNED NULL,
    accion VARCHAR(100) NOT NULL,
    entidad VARCHAR(100) NOT NULL,
    entidad_id VARCHAR(100) NULL,
    datos_anteriores JSON NULL,
    datos_nuevos JSON NULL,
    ip VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    request_id VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_auditoria_usuario_fecha (id_usuario, created_at),
    INDEX idx_auditoria_entidad (entidad, entidad_id),
    INDEX idx_auditoria_accion_fecha (accion, created_at),
    CONSTRAINT fk_auditoria_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 10. DATOS INICIALES
-- ============================================================

INSERT INTO roles (codigo, nombre, descripcion) VALUES
('ADMIN', 'Administrador', 'Administración global de SIGMA'),
('COORDINADOR', 'Coordinador UCOTESIS', 'Gestión académica y de ofertas de UCOTESIS'),
('TESORERIA', 'Tesorería / Cajero Virtual', 'Supervisión de pagos y conciliaciones'),
('ESTUDIANTE', 'Estudiante', 'Consulta, elegibilidad, inscripción y pagos'),
('DOCENTE', 'Docente', 'Docencia y participación académica'),
('ASESOR', 'Asesor de proyecto', 'Acompañamiento académico de proyectos de grado'),
('JURADO', 'Jurado evaluador', 'Evaluación de proyectos de grado');

INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
('IDENTIDAD_USUARIOS_LEER', 'Consultar usuarios', 'Permite consultar usuarios y sus roles.', 'IDENTIDAD'),
('IDENTIDAD_USUARIOS_GESTIONAR', 'Gestionar usuarios', 'Permite crear y actualizar usuarios.', 'IDENTIDAD'),
('IDENTIDAD_ROLES_LEER', 'Consultar roles y permisos', 'Permite consultar roles y permisos.', 'IDENTIDAD'),
('IDENTIDAD_ROLES_GESTIONAR', 'Gestionar roles y permisos', 'Permite crear roles y asignar permisos.', 'IDENTIDAD'),
('IDENTIDAD_SESIONES_LEER', 'Consultar sesiones', 'Permite consultar sesiones activas e históricas.', 'IDENTIDAD'),
('IDENTIDAD_SESIONES_REVOCAR', 'Revocar sesiones', 'Permite revocar sesiones de acceso.', 'IDENTIDAD'),
('NOTIFICACIONES_AUTOGESTIONAR', 'Gestionar notificaciones propias', 'Permite leer y eliminar notificaciones propias.', 'NOTIFICACIONES'),
('GENERAL_RESUMEN_LEER', 'Consultar resumen general', 'Acceso al resumen operativo correspondiente al rol.', 'GENERAL'),
('GENERAL_REPORTES_LEER', 'Consultar reportes', 'Acceso a reportes de uso y operación.', 'GENERAL'),
('ESTUDIANTES_EXPEDIENTE_GESTIONAR', 'Gestionar expedientes estudiantiles', 'Crear y mantener perfiles, carreras e historial académico.', 'ESTUDIANTES'),
('ESTUDIANTES_ELEGIBILIDAD_PROPIA', 'Consultar elegibilidad propia', 'Permite al estudiante evaluar su propio expediente.', 'ESTUDIANTES'),
('ACADEMICO_CATALOGOS_LEER', 'Consultar estructura académica', 'Consultar recintos, facultades, escuelas, carreras, planes y asignaturas.', 'ACADEMICO'),
('ACADEMICO_CATALOGOS_GESTIONAR', 'Gestionar estructura académica', 'Crear, actualizar y retirar catálogos académicos.', 'ACADEMICO'),
('UCOTESIS_OFERTAS_LEER', 'Consultar oferta UCOTESIS', 'Consultar tesis y monográficos disponibles.', 'UCOTESIS'),
('UCOTESIS_OFERTAS_GESTIONAR', 'Gestionar oferta UCOTESIS', 'Publicar y mantener ofertas, requisitos y áreas.', 'UCOTESIS'),
('INSCRIPCIONES_PROPIAS_GESTIONAR', 'Gestionar inscripción propia', 'Solicitar y consultar la inscripción del estudiante.', 'INSCRIPCIONES'),
('INSCRIPCIONES_GESTIONAR', 'Gestionar inscripciones', 'Supervisar solicitudes e inscritos.', 'INSCRIPCIONES'),
('PAGOS_PROPIOS_GESTIONAR', 'Gestionar pagos propios', 'Iniciar pagos y descargar comprobantes propios.', 'PAGOS'),
('PAGOS_GESTIONAR', 'Gestionar pagos y conciliación', 'Supervisar transacciones, facturas y conciliaciones.', 'PAGOS'),
('PROYECTOS_PARTICIPAR', 'Participar en proyectos', 'Consultar y atender asignaciones docentes.', 'PROYECTOS'),
('PROYECTOS_GESTIONAR', 'Gestionar proyectos', 'Asignar asesores, jurados y seguimiento académico.', 'PROYECTOS'),
('GOBIERNO_GESTIONAR', 'Gestionar gobierno del sistema', 'Configuraciones y auditoría global.', 'GOBIERNO'),
('NOTIFICACIONES_ENVIAR', 'Enviar notificaciones', 'Enviar notificaciones institucionales por usuario o rol.', 'NOTIFICACIONES');

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
CROSS JOIN permisos p
WHERE r.codigo = 'ADMIN';

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.codigo IN (
    'GENERAL_RESUMEN_LEER', 'GENERAL_REPORTES_LEER',
    'ESTUDIANTES_EXPEDIENTE_GESTIONAR', 'ACADEMICO_CATALOGOS_LEER',
    'UCOTESIS_OFERTAS_LEER', 'UCOTESIS_OFERTAS_GESTIONAR',
    'INSCRIPCIONES_GESTIONAR', 'PROYECTOS_GESTIONAR',
    'NOTIFICACIONES_AUTOGESTIONAR', 'NOTIFICACIONES_ENVIAR'
)
WHERE r.codigo = 'COORDINADOR';

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.codigo IN (
    'GENERAL_RESUMEN_LEER', 'GENERAL_REPORTES_LEER',
    'PAGOS_GESTIONAR', 'NOTIFICACIONES_AUTOGESTIONAR'
)
WHERE r.codigo = 'TESORERIA';

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.codigo IN (
    'GENERAL_RESUMEN_LEER', 'UCOTESIS_OFERTAS_LEER',
    'PROYECTOS_PARTICIPAR', 'NOTIFICACIONES_AUTOGESTIONAR'
)
WHERE r.codigo = 'DOCENTE';

INSERT IGNORE INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.codigo IN (
    'GENERAL_RESUMEN_LEER', 'UCOTESIS_OFERTAS_LEER',
    'PROYECTOS_PARTICIPAR', 'NOTIFICACIONES_AUTOGESTIONAR'
)
WHERE r.codigo IN ('ASESOR', 'JURADO');

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.codigo IN (
    'GENERAL_RESUMEN_LEER', 'ESTUDIANTES_ELEGIBILIDAD_PROPIA',
    'UCOTESIS_OFERTAS_LEER', 'INSCRIPCIONES_PROPIAS_GESTIONAR',
    'PAGOS_PROPIOS_GESTIONAR', 'PROYECTOS_PARTICIPAR',
    'NOTIFICACIONES_AUTOGESTIONAR'
)
WHERE r.codigo = 'ESTUDIANTE';

INSERT INTO modalidades (codigo, nombre, descripcion) VALUES
('TESIS', 'Tesis', 'Modalidad de trabajo de grado tipo tesis'),
('MONOGRAFICO', 'Monográfico', 'Modalidad de trabajo de grado tipo monográfico');

INSERT INTO estados_inscripcion (codigo, nombre, orden, es_final) VALUES
('BORRADOR', 'Borrador', 10, FALSE),
('VALIDANDO', 'Validando requisitos', 20, FALSE),
('NO_ELEGIBLE', 'No elegible', 30, TRUE),
('ELEGIBLE', 'Elegible', 40, FALSE),
('PENDIENTE_PAGO', 'Pendiente de pago', 50, FALSE),
('PAGO_PROCESANDO', 'Pago en procesamiento', 60, FALSE),
('PAGADA', 'Pagada', 70, FALSE),
('CONFIRMADA', 'Confirmada', 80, TRUE),
('RECHAZADA', 'Rechazada', 90, TRUE),
('CANCELADA', 'Cancelada', 100, TRUE);

INSERT INTO requisitos (codigo, nombre, descripcion, tipo_validacion) VALUES
(
    'PLAN_COMPLETADO',
    'Plan de estudios completado',
    'El estudiante debe haber completado el 100% del plan de estudios aplicable.',
    'AUTOMATICA'
),
(
    'SIN_ASIGNATURAS_PENDIENTES',
    'Sin asignaturas pendientes',
    'El estudiante no debe poseer asignaturas pendientes o reprobadas que impidan iniciar el proceso.',
    'AUTOMATICA'
),
(
    'IDENTIDAD_VALIDADA',
    'Identidad validada',
    'Validación de los datos de identidad del estudiante.',
    'MANUAL'
);

INSERT INTO metodos_pago (codigo, nombre) VALUES
('TARJETA', 'Tarjeta'),
('TRANSFERENCIA', 'Transferencia bancaria'),
('CAJA', 'Caja');

INSERT INTO tipos_participacion (codigo, nombre, descripcion) VALUES
('ASESOR', 'Asesor', 'Docente asesor principal'),
('COASESOR', 'Coasesor', 'Docente asesor adicional'),
('JURADO', 'Jurado', 'Miembro del jurado evaluador'),
('COORDINADOR', 'Coordinador', 'Coordinación académica del proyecto');

INSERT INTO recintos (codigo, nombre) VALUES
('STGO', 'UASD Recinto Santiago');

INSERT INTO facultades (codigo, nombre) VALUES
('FC', 'Facultad de Ciencias');

INSERT INTO escuelas (id_facultad, codigo, nombre)
SELECT id_facultad, 'INF', 'Escuela de Informática'
FROM facultades
WHERE codigo = 'FC';

INSERT INTO carreras (id_escuela, codigo, nombre, nivel_academico)
SELECT id_escuela, 'LIC-INF', 'Licenciatura en Informática', 'GRADO'
FROM escuelas
WHERE codigo = 'INF';

INSERT INTO recinto_carreras (id_recinto, id_carrera)
SELECT r.id_recinto, c.id_carrera
FROM recintos r
JOIN carreras c ON c.codigo = 'LIC-INF'
WHERE r.codigo = 'STGO';

-- ============================================================
-- 11. VISTAS DE APOYO
-- ============================================================

CREATE OR REPLACE VIEW vw_estudiantes_detalle AS
SELECT
    e.id_estudiante,
    e.matricula,
    u.id_usuario,
    u.uuid,
    u.nombres,
    u.apellidos,
    u.cedula,
    u.email,
    u.telefono,
    e.whatsapp,
    u.estado AS estado_usuario
FROM estudiantes e
INNER JOIN usuarios u
    ON u.id_usuario = e.id_usuario;

CREATE OR REPLACE VIEW vw_ofertas_disponibles AS
SELECT
    o.id_oferta,
    o.codigo,
    o.titulo,
    r.nombre AS recinto,
    c.nombre AS carrera,
    m.nombre AS modalidad,
    p.nombre AS periodo,
    o.fecha_inicio_inscripcion,
    o.fecha_fin_inscripcion,
    o.cupo_total,
    o.cupo_reservado,
    (o.cupo_total - o.cupo_reservado) AS cupos_disponibles,
    o.monto,
    o.moneda,
    o.estado
FROM ofertas o
INNER JOIN recinto_carreras rc
    ON rc.id_recinto_carrera = o.id_recinto_carrera
INNER JOIN recintos r
    ON r.id_recinto = rc.id_recinto
INNER JOIN carreras c
    ON c.id_carrera = rc.id_carrera
INNER JOIN modalidades m
    ON m.id_modalidad = o.id_modalidad
INNER JOIN periodos_academicos p
    ON p.id_periodo = o.id_periodo;

CREATE OR REPLACE VIEW vw_inscripciones_resumen AS
SELECT
    i.id_inscripcion,
    i.codigo AS codigo_inscripcion,
    o.codigo AS codigo_oferta,
    o.titulo AS oferta,
    m.nombre AS modalidad,
    ei.codigo AS estado_inscripcion,
    i.monto_aplicado,
    i.moneda,
    i.fecha_solicitud,
    i.fecha_confirmacion,
    COUNT(ie.id_estudiante) AS total_sustentantes
FROM inscripciones i
INNER JOIN ofertas o
    ON o.id_oferta = i.id_oferta
INNER JOIN modalidades m
    ON m.id_modalidad = o.id_modalidad
INNER JOIN estados_inscripcion ei
    ON ei.id_estado = i.id_estado
LEFT JOIN inscripcion_estudiantes ie
    ON ie.id_inscripcion = i.id_inscripcion
GROUP BY
    i.id_inscripcion,
    i.codigo,
    o.codigo,
    o.titulo,
    m.nombre,
    ei.codigo,
    i.monto_aplicado,
    i.moneda,
    i.fecha_solicitud,
    i.fecha_confirmacion;

CREATE OR REPLACE VIEW vw_pagos_aprobados AS
SELECT
    p.id_pago,
    p.referencia,
    p.id_inscripcion,
    i.codigo AS codigo_inscripcion,
    p.monto,
    p.moneda,
    mp.nombre AS metodo_pago,
    p.fecha_pago,
    p.aprobado_at,
    f.numero_factura,
    f.numero_recibo
FROM pagos p
INNER JOIN inscripciones i
    ON i.id_inscripcion = p.id_inscripcion
INNER JOIN metodos_pago mp
    ON mp.id_metodo_pago = p.id_metodo_pago
LEFT JOIN facturas f
    ON f.id_pago = p.id_pago
WHERE p.estado = 'APROBADO';

-- ============================================================
-- 12. PROCEDIMIENTOS DE CONCURRENCIA PARA CUPOS
-- ============================================================

DELIMITER $$

CREATE PROCEDURE sp_reservar_cupo (
    IN p_id_oferta BIGINT UNSIGNED
)
BEGIN
    DECLARE v_cupo_total INT UNSIGNED;
    DECLARE v_cupo_reservado INT UNSIGNED;
    DECLARE v_estado VARCHAR(20);
    DECLARE v_inicio DATETIME;
    DECLARE v_fin DATETIME;

    START TRANSACTION;

    SELECT
        cupo_total,
        cupo_reservado,
        estado,
        fecha_inicio_inscripcion,
        fecha_fin_inscripcion
    INTO
        v_cupo_total,
        v_cupo_reservado,
        v_estado,
        v_inicio,
        v_fin
    FROM ofertas
    WHERE id_oferta = p_id_oferta
    FOR UPDATE;

    IF v_estado <> 'PUBLICADA' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La oferta no se encuentra publicada.';
    END IF;

    IF NOW() < v_inicio OR NOW() > v_fin THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La oferta está fuera del período de inscripción.';
    END IF;

    IF v_cupo_reservado >= v_cupo_total THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No quedan cupos disponibles.';
    END IF;

    UPDATE ofertas
    SET cupo_reservado = cupo_reservado + 1
    WHERE id_oferta = p_id_oferta;

    COMMIT;
END$$

CREATE PROCEDURE sp_liberar_cupo (
    IN p_id_oferta BIGINT UNSIGNED
)
BEGIN
    START TRANSACTION;

    SELECT id_oferta
    FROM ofertas
    WHERE id_oferta = p_id_oferta
    FOR UPDATE;

    UPDATE ofertas
    SET cupo_reservado =
        CASE
            WHEN cupo_reservado > 0 THEN cupo_reservado - 1
            ELSE 0
        END
    WHERE id_oferta = p_id_oferta;

    COMMIT;
END$$

DELIMITER ;

-- ============================================================
-- 13. NOTAS DE IMPLEMENTACIÓN
-- ============================================================
-- 1) No hacer DELETE físico de pagos, facturas, inscripciones confirmadas
--    ni auditoría desde la aplicación.
-- 2) La reserva de cupos debe ejecutarse dentro de la misma transacción
--    lógica que inicia la inscripción.
-- 3) idempotency_key evita procesar dos veces la misma intención de pago.
-- 4) numero_factura, numero_recibo, qr_token y qr_hash son únicos.
-- 5) UNIQUE(id_oferta, id_estudiante) evita que un estudiante se inscriba
--    dos veces en la misma oferta, incluso si intenta formar grupos distintos.
-- 6) La factura conserva un snapshot histórico de los datos emitidos.
-- 7) auditoria debe poblarse desde la capa de aplicación o mediante una
--    estrategia de auditoría centralizada del backend.
-- ============================================================

SELECT 'Base de datos sigma_ucotesis creada correctamente.' AS resultado;
