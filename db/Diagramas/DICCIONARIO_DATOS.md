# SIGMA · Diccionario de datos

Corte: 2026-09-14. Metadatos físicos de MySQL contrastados con Prisma. Sin filas ni datos personales.

## Convenciones

PK: clave primaria. FK Rxx: relación física. U1, U2: claves UNIQUE locales a cada tabla (compuestas si comparten la marca). Nulo: admite NULL. En dibujos, U significa UNSIGNED; ENUM se desarrolla aquí.

1: padre obligatorio; 0..1: padre opcional o hijo único; 0..N: cero o más hijos. Nunca se supone un hijo obligatorio. Línea continua: FK incluida en la PK de la hija; discontinua: relación no identificadora.

## 01 · Identidad y gobierno

### usuarios

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_usuario | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| uuid | char(36) | No | U5 | (sin valor explícito / NULL) / - |
| matricula | varchar(30) | Sí | U1 | (sin valor explícito / NULL) / - |
| codigo_empleado | varchar(30) | Sí | U3 | (sin valor explícito / NULL) / - |
| nombres | varchar(120) | No | - | (sin valor explícito / NULL) / - |
| apellidos | varchar(120) | No | - | (sin valor explícito / NULL) / - |
| cedula | varchar(20) | Sí | U2 | (sin valor explícito / NULL) / - |
| email | varchar(190) | No | U4 | (sin valor explícito / NULL) / - |
| telefono | varchar(30) | Sí | - | (sin valor explícito / NULL) / - |
| password_hash | varchar(255) | No | - | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO','BLOQUEADO','PENDIENTE') | No | - | PENDIENTE / - |
| email_verificado_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| ultimo_acceso_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| intentos_fallidos | smallint unsigned | No | - | 0 / - |
| bloqueado_hasta | datetime | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| deleted_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| whatsapp_confirmado_at | datetime | Sí | - | (sin valor explícito / NULL) / - |

PK: `id_usuario`.
- U1: `matricula`.
- U2: `cedula`.
- U3: `codigo_empleado`.
- U4: `email`.
- U5: `uuid`.

### roles

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_rol | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(50) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(100) | No | U2 | (sin valor explícito / NULL) / - |
| descripcion | varchar(255) | Sí | - | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_rol`.
- U1: `codigo`.
- U2: `nombre`.

### permisos

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_permiso | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(100) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(120) | No | - | (sin valor explícito / NULL) / - |
| descripcion | varchar(255) | Sí | - | (sin valor explícito / NULL) / - |
| modulo | varchar(80) | No | - | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_permiso`.
- U1: `codigo`.

### usuario_roles

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_usuario | bigint unsigned | No | PK / FK R84 | (sin valor explícito / NULL) / - |
| id_rol | bigint unsigned | No | PK / FK R83 | (sin valor explícito / NULL) / - |
| asignado_por | bigint unsigned | Sí | FK R82 | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_usuario, id_rol`.

### rol_permisos

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_rol | bigint unsigned | No | PK / FK R75 | (sin valor explícito / NULL) / - |
| id_permiso | bigint unsigned | No | PK / FK R74 | (sin valor explícito / NULL) / - |
| asignado_por | bigint unsigned | Sí | FK R73 | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_rol, id_permiso`.

### sesiones

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_sesion | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_usuario | bigint unsigned | No | FK R76 | (sin valor explícito / NULL) / - |
| token_hash | char(64) | No | U2 | (sin valor explícito / NULL) / - |
| refresh_token_hash | char(64) | Sí | U1 | (sin valor explícito / NULL) / - |
| ip | varchar(45) | Sí | - | (sin valor explícito / NULL) / - |
| user_agent | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| expira_at | datetime | No | - | (sin valor explícito / NULL) / - |
| revocada_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_sesion`.
- U1: `refresh_token_hash`.
- U2: `token_hash`.

### notificaciones

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_notificacion | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_usuario | bigint unsigned | No | FK R46 | (sin valor explícito / NULL) / - |
| tipo | varchar(60) | No | - | (sin valor explícito / NULL) / - |
| titulo | varchar(180) | No | - | (sin valor explícito / NULL) / - |
| mensaje | text | No | - | (sin valor explícito / NULL) / - |
| url | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| canal | enum('IN_APP','EMAIL','PUSH','SISTEMA') | No | - | IN_APP / - |
| estado_envio | enum('PENDIENTE','ENVIADA','ERROR') | No | - | PENDIENTE / - |
| leida | tinyint(1) | No | - | 0 / - |
| fecha_lectura | datetime | Sí | - | (sin valor explícito / NULL) / - |
| enviada_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_notificacion`.

### auditoria

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_auditoria | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_usuario | bigint unsigned | Sí | FK R06 | (sin valor explícito / NULL) / - |
| accion | varchar(100) | No | - | (sin valor explícito / NULL) / - |
| entidad | varchar(100) | No | - | (sin valor explícito / NULL) / - |
| entidad_id | varchar(100) | Sí | - | (sin valor explícito / NULL) / - |
| datos_anteriores | json | Sí | - | (sin valor explícito / NULL) / - |
| datos_nuevos | json | Sí | - | (sin valor explícito / NULL) / - |
| ip | varchar(45) | Sí | - | (sin valor explícito / NULL) / - |
| user_agent | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| request_id | varchar(100) | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_auditoria`.

### configuraciones

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_configuracion | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| clave | varchar(120) | No | U1 | (sin valor explícito / NULL) / - |
| valor | text | Sí | - | (sin valor explícito / NULL) / - |
| tipo | enum('STRING','INTEGER','DECIMAL','BOOLEAN','JSON','DATE','DATETIME') | No | - | STRING / - |
| descripcion | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| es_publica | tinyint(1) | No | - | 0 / - |
| updated_by | bigint unsigned | Sí | FK R13 | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_configuracion`.
- U1: `clave`.

## 02 · Estructura académica

### facultades

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_facultad | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(30) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(150) | No | U2 | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_facultad`.
- U1: `codigo`.
- U2: `nombre`.

### escuelas

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_escuela | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_facultad | bigint unsigned | No | FK R26 | (sin valor explícito / NULL) / - |
| codigo | varchar(30) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(150) | No | - | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_escuela`.
- U1: `codigo`.

### carreras

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_carrera | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_escuela | bigint unsigned | No | FK R07 | (sin valor explícito / NULL) / - |
| codigo | varchar(30) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(150) | No | - | (sin valor explícito / NULL) / - |
| nivel_academico | varchar(60) | No | - | GRADO / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_carrera`.
- U1: `codigo`.

### recintos

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_recinto | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(30) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(150) | No | U2 | (sin valor explícito / NULL) / - |
| direccion | varchar(255) | Sí | - | (sin valor explícito / NULL) / - |
| telefono | varchar(30) | Sí | - | (sin valor explícito / NULL) / - |
| email | varchar(190) | Sí | - | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_recinto`.
- U1: `codigo`.
- U2: `nombre`.

### recinto_carreras

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_recinto_carrera | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_recinto | bigint unsigned | No | FK R72 / U1 | (sin valor explícito / NULL) / - |
| id_carrera | bigint unsigned | No | FK R71 / U1 | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_recinto_carrera`.
- U1: `id_recinto, id_carrera`.

### planes_estudio

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_plan_estudio | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_carrera | bigint unsigned | No | FK R62 | (sin valor explícito / NULL) / - |
| codigo | varchar(50) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(150) | No | - | (sin valor explícito / NULL) / - |
| anio_inicio | year | No | - | (sin valor explícito / NULL) / - |
| anio_fin | year | Sí | - | (sin valor explícito / NULL) / - |
| creditos_totales | decimal(7,2) | Sí | - | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| max_asignaturas_pendientes | smallint unsigned | No | - | 0 / - |
| max_creditos_pendientes | smallint unsigned | No | - | 0 / - |
| desde_semestre | tinyint unsigned | No | - | 1 / - |

PK: `id_plan_estudio`.
- U1: `codigo`.

### recinto_carrera_planes

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_recinto_carrera | bigint unsigned | No | PK / FK R70 | (sin valor explícito / NULL) / - |
| id_plan_estudio | bigint unsigned | No | PK / FK R69 | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_recinto_carrera, id_plan_estudio`.

### asignaturas

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_asignatura | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(30) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(180) | No | - | (sin valor explícito / NULL) / - |
| horas_teoricas | smallint unsigned | No | - | 0 / - |
| horas_practicas | smallint unsigned | No | - | 0 / - |
| creditos | decimal(5,2) | No | - | 0.00 / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_asignatura`.
- U1: `codigo`.

### plan_estudio_asignaturas

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_plan_estudio | bigint unsigned | No | PK / FK R61 | (sin valor explícito / NULL) / - |
| id_asignatura | bigint unsigned | No | PK / FK R60 | (sin valor explícito / NULL) / - |
| semestre | tinyint unsigned | Sí | - | (sin valor explícito / NULL) / - |
| obligatoria | tinyint(1) | No | - | 1 / - |
| creditos_plan | decimal(5,2) | Sí | - | (sin valor explícito / NULL) / - |
| prerrequisitos_texto | varchar(1000) | Sí | - | (sin valor explícito / NULL) / - |
| equivalencias_texto | varchar(1000) | Sí | - | (sin valor explícito / NULL) / - |
| tipo | varchar(30) | No | - | REGULAR / - |
| orden | smallint unsigned | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_plan_estudio, id_asignatura`.

### asignatura_relaciones

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_relacion | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_plan_estudio | bigint unsigned | No | FK R04 / U1 | (sin valor explícito / NULL) / - |
| id_asignatura | bigint unsigned | No | FK R03 / U1 | (sin valor explícito / NULL) / - |
| id_asignatura_relacionada | bigint unsigned | No | FK R05 / U1 | (sin valor explícito / NULL) / - |
| tipo | enum('PRERREQUISITO','CORREQUISITO','EQUIVALENCIA') | No | U1 | (sin valor explícito / NULL) / - |
| operador | enum('AND','OR') | Sí | - | (sin valor explícito / NULL) / - |
| grupo | smallint unsigned | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_relacion`.
- U1: `id_plan_estudio, id_asignatura, id_asignatura_relacionada, tipo`.

## 03 · Expediente estudiantil

### estudiantes

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_estudiante | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_usuario | bigint unsigned | No | FK R30 / U2 | (sin valor explícito / NULL) / - |
| matricula | varchar(30) | No | U1 | (sin valor explícito / NULL) / - |
| fecha_nacimiento | date | Sí | - | (sin valor explícito / NULL) / - |
| whatsapp | varchar(30) | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_estudiante`.
- U1: `matricula`.
- U2: `id_usuario`.

### estudiante_carreras

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_estudiante_carrera | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_estudiante | bigint unsigned | No | FK R27 / U1 | (sin valor explícito / NULL) / - |
| id_recinto_carrera | bigint unsigned | No | FK R29 / U1 | (sin valor explícito / NULL) / - |
| id_plan_estudio | bigint unsigned | No | FK R28 / U1 | (sin valor explícito / NULL) / - |
| fecha_ingreso | date | Sí | - | (sin valor explícito / NULL) / - |
| fecha_egreso | date | Sí | - | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVA','FINALIZADA','SUSPENDIDA','RETIRADA') | No | - | ACTIVA / - |
| es_principal | tinyint(1) | No | - | 1 / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_estudiante_carrera`.
- U1: `id_estudiante, id_recinto_carrera, id_plan_estudio`.

### historial_academico

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_historial | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_estudiante_carrera | bigint unsigned | No | FK R33 / U1 | (sin valor explícito / NULL) / - |
| id_asignatura | bigint unsigned | No | FK R32 / U1 | (sin valor explícito / NULL) / - |
| periodo_codigo | varchar(30) | No | U1 | (sin valor explícito / NULL) / - |
| calificacion | decimal(5,2) | Sí | - | (sin valor explícito / NULL) / - |
| calificacion_laboratorio | decimal(4,2) | Sí | - | (sin valor explícito / NULL) / - |
| calificacion_laboratorio_literal | varchar(20) | Sí | - | (sin valor explícito / NULL) / - |
| estado_asignatura | enum('APROBADA','REPROBADA','RETIRADA','CURSANDO','PENDIENTE','CONVALIDADA') | No | - | (sin valor explícito / NULL) / - |
| fuente | varchar(100) | Sí | - | (sin valor explícito / NULL) / - |
| fecha_actualizacion | datetime | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_historial`.
- U1: `id_estudiante_carrera, id_asignatura, periodo_codigo`.

## 04 · Oferta UCOTESIS

### modalidades

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_modalidad | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(40) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(100) | No | U2 | (sin valor explícito / NULL) / - |
| descripcion | varchar(255) | Sí | - | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_modalidad`.
- U1: `codigo`.
- U2: `nombre`.

### areas_investigacion

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_area | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(40) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(150) | No | U2 | (sin valor explícito / NULL) / - |
| descripcion | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_area`.
- U1: `codigo`.
- U2: `nombre`.

### periodos_academicos

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_periodo | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(30) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(100) | No | - | (sin valor explícito / NULL) / - |
| fecha_inicio | date | No | - | (sin valor explícito / NULL) / - |
| fecha_fin | date | No | - | (sin valor explícito / NULL) / - |
| estado | enum('PLANIFICADO','ACTIVO','CERRADO','CANCELADO') | No | - | PLANIFICADO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_periodo`.
- U1: `codigo`.

### ofertas

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_oferta | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(50) | No | U1 / U2 | (sin valor explícito / NULL) / - |
| id_recinto_carrera | bigint unsigned | No | FK R54 / U1 | (sin valor explícito / NULL) / - |
| id_modalidad | bigint unsigned | No | FK R52 / U1 | (sin valor explícito / NULL) / - |
| id_periodo | bigint unsigned | No | FK R53 / U1 | (sin valor explícito / NULL) / - |
| titulo | varchar(200) | No | - | (sin valor explícito / NULL) / - |
| descripcion | text | Sí | - | (sin valor explícito / NULL) / - |
| fecha_inicio_inscripcion | datetime | No | - | (sin valor explícito / NULL) / - |
| fecha_fin_inscripcion | datetime | No | - | (sin valor explícito / NULL) / - |
| cupo_total | int unsigned | No | - | (sin valor explícito / NULL) / - |
| cupo_reservado | int unsigned | No | - | 0 / - |
| monto | decimal(12,2) | No | - | (sin valor explícito / NULL) / - |
| moneda | char(3) | No | - | DOP / - |
| estado | enum('BORRADOR','PUBLICADA','CERRADA','CANCELADA') | No | - | BORRADOR / - |
| created_by | bigint unsigned | No | FK R51 | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| modalidad_ensenanza | enum('PRESENCIAL','VIRTUAL','SEMIPRESENCIAL') | Sí | - | (sin valor explícito / NULL) / - |
| coordinador_id | bigint unsigned | Sí | FK R55 | (sin valor explícito / NULL) / - |
| grupo_whatsapp | varchar(300) | Sí | - | (sin valor explícito / NULL) / - |
| presupuesto_docencia | decimal(12,2) | No | - | 0.00 / - |
| presupuesto_materiales | decimal(12,2) | No | - | 0.00 / - |
| notas_remitidas_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| notas_remitidas_por | bigint unsigned | Sí | - | (sin valor explícito / NULL) / - |

PK: `id_oferta`.
- U1: `id_recinto_carrera, id_modalidad, id_periodo, codigo`.
- U2: `codigo`.

### oferta_areas

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_oferta | bigint unsigned | No | PK / FK R48 | (sin valor explícito / NULL) / - |
| id_area | bigint unsigned | No | PK / FK R47 | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_oferta, id_area`.

### requisitos

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_requisito | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(60) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(150) | No | - | (sin valor explícito / NULL) / - |
| descripcion | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| tipo_validacion | enum('AUTOMATICA','MANUAL','DOCUMENTAL') | No | - | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_requisito`.
- U1: `codigo`.

### oferta_requisitos

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_oferta | bigint unsigned | No | PK / FK R49 | (sin valor explícito / NULL) / - |
| id_requisito | bigint unsigned | No | PK / FK R50 | (sin valor explícito / NULL) / - |
| obligatorio | tinyint(1) | No | - | 1 / - |
| valor_requerido | varchar(255) | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_oferta, id_requisito`.

## 05 · Inscripción y documentos

### inscripciones

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_inscripcion | bigint unsigned | No | PK / U2 | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(60) | No | U1 | (sin valor explícito / NULL) / - |
| id_oferta | bigint unsigned | No | FK R43 / U2 | (sin valor explícito / NULL) / - |
| id_estado | bigint unsigned | No | FK R42 | (sin valor explícito / NULL) / - |
| monto_aplicado | decimal(12,2) | No | - | (sin valor explícito / NULL) / - |
| moneda | char(3) | No | - | DOP / - |
| fecha_solicitud | datetime | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| fecha_confirmacion | datetime | Sí | - | (sin valor explícito / NULL) / - |
| fecha_cancelacion | datetime | Sí | - | (sin valor explícito / NULL) / - |
| motivo_cancelacion | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| observaciones | text | Sí | - | (sin valor explícito / NULL) / - |
| version_lock | int unsigned | No | - | 0 / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| recibido_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| recibido_por | bigint unsigned | Sí | - | (sin valor explícito / NULL) / - |
| validado_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| validado_por | bigint unsigned | Sí | - | (sin valor explícito / NULL) / - |
| deuda_abierta_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| deuda_abierta_por | bigint unsigned | Sí | - | (sin valor explícito / NULL) / - |
| canal_pago | varchar(20) | Sí | - | (sin valor explícito / NULL) / - |

PK: `id_inscripcion`.
- U1: `codigo`.
- U2: `id_inscripcion, id_oferta`.

### inscripcion_estudiantes

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_inscripcion | bigint unsigned | No | PK / FK R41 | (sin valor explícito / NULL) / - |
| id_oferta | bigint unsigned | No | FK R41 / U1 | (sin valor explícito / NULL) / - |
| id_estudiante | bigint unsigned | No | PK / FK R40 / U1 | (sin valor explícito / NULL) / - |
| es_principal | tinyint(1) | No | - | 0 / - |
| orden_sustentante | smallint unsigned | No | - | 1 / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_inscripcion, id_estudiante`.
- U1: `id_oferta, id_estudiante`.

### estados_inscripcion

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_estado | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(50) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(100) | No | - | (sin valor explícito / NULL) / - |
| orden | smallint unsigned | No | U2 | (sin valor explícito / NULL) / - |
| es_final | tinyint(1) | No | - | 0 / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |

PK: `id_estado`.
- U1: `codigo`.
- U2: `orden`.

### historial_estados_inscripcion

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_historial_estado | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_inscripcion | bigint unsigned | No | FK R36 | (sin valor explícito / NULL) / - |
| id_estado_anterior | bigint unsigned | Sí | FK R34 | (sin valor explícito / NULL) / - |
| id_estado_nuevo | bigint unsigned | No | FK R35 | (sin valor explícito / NULL) / - |
| cambiado_por | bigint unsigned | Sí | FK R37 | (sin valor explícito / NULL) / - |
| motivo | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_historial_estado`.

### validaciones_requisitos

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_validacion | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_inscripcion | bigint unsigned | No | FK R85 / U1 | (sin valor explícito / NULL) / - |
| id_requisito | bigint unsigned | No | FK R86 / U1 | (sin valor explícito / NULL) / - |
| cumple | tinyint(1) | No | - | (sin valor explícito / NULL) / - |
| valor_obtenido | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| observacion | varchar(1000) | Sí | - | (sin valor explícito / NULL) / - |
| validado_automaticamente | tinyint(1) | No | - | 0 / - |
| validado_por | bigint unsigned | Sí | FK R87 | (sin valor explícito / NULL) / - |
| fecha_validacion | datetime | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_validacion`.
- U1: `id_inscripcion, id_requisito`.

### solicitudes_documentos

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_solicitud | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_inscripcion | bigint unsigned | No | FK R79 / U1 | (sin valor explícito / NULL) / - |
| tipo_documento | varchar(80) | No | U1 | (sin valor explícito / NULL) / - |
| instrucciones | varchar(500) | No | - | (sin valor explícito / NULL) / - |
| solicitado_por | bigint unsigned | No | FK R80 | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_solicitud`.
- U1: `id_inscripcion, tipo_documento`.

### documentos_inscripcion

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_documento | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_inscripcion | bigint unsigned | No | FK R22 | (sin valor explícito / NULL) / - |
| id_estudiante | bigint unsigned | Sí | FK R21 | (sin valor explícito / NULL) / - |
| tipo_documento | varchar(80) | No | - | (sin valor explícito / NULL) / - |
| nombre_archivo | varchar(255) | No | - | (sin valor explícito / NULL) / - |
| ruta_archivo | varchar(500) | No | - | (sin valor explícito / NULL) / - |
| mime_type | varchar(120) | Sí | - | (sin valor explícito / NULL) / - |
| tamano_bytes | bigint unsigned | Sí | - | (sin valor explícito / NULL) / - |
| hash_sha256 | char(64) | Sí | - | (sin valor explícito / NULL) / - |
| contenido | longblob | Sí | - | (sin valor explícito / NULL) / - |
| estado_validacion | enum('PENDIENTE','VALIDO','RECHAZADO') | No | - | PENDIENTE / - |
| validado_por | bigint unsigned | Sí | FK R23 | (sin valor explícito / NULL) / - |
| validado_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| observacion | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| id_solicitud | bigint unsigned | Sí | FK R20 | (sin valor explícito / NULL) / - |

PK: `id_documento`.

## 06 · Pagos y conciliación

### metodos_pago

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_metodo_pago | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(50) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(100) | No | U2 | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |

PK: `id_metodo_pago`.
- U1: `codigo`.
- U2: `nombre`.

### cuentas_bancarias

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_cuenta_bancaria | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| banco | varchar(120) | No | - | (sin valor explícito / NULL) / - |
| numero_cuenta | varchar(80) | No | U1 | (sin valor explícito / NULL) / - |
| tipo_cuenta | enum('AHORRO','CORRIENTE') | No | - | (sin valor explícito / NULL) / - |
| tipo_documento | varchar(30) | No | - | (sin valor explícito / NULL) / - |
| documento_titular | varchar(30) | No | - | (sin valor explícito / NULL) / - |
| nombre_titular | varchar(200) | No | - | (sin valor explícito / NULL) / - |
| moneda | char(3) | No | - | DOP / - |
| instrucciones | varchar(1000) | Sí | - | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_by | bigint unsigned | Sí | FK R14 | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_cuenta_bancaria`.
- U1: `numero_cuenta`.

### pagos

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_pago | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_inscripcion | bigint unsigned | No | FK R57 | (sin valor explícito / NULL) / - |
| id_metodo_pago | bigint unsigned | No | FK R58 | (sin valor explícito / NULL) / - |
| id_cuenta_bancaria | bigint unsigned | Sí | FK R56 | (sin valor explícito / NULL) / - |
| referencia | varchar(100) | No | U2 | (sin valor explícito / NULL) / - |
| idempotency_key | varchar(120) | No | U1 | (sin valor explícito / NULL) / - |
| monto | decimal(12,2) | No | - | (sin valor explícito / NULL) / - |
| moneda | char(3) | No | - | DOP / - |
| estado | enum('CREADO','PENDIENTE','PROCESANDO','APROBADO','RECHAZADO','REVERSADO','REEMBOLSADO','CANCELADO') | No | - | CREADO / - |
| fecha_pago | datetime | Sí | - | (sin valor explícito / NULL) / - |
| aprobado_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| rechazado_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| es_simulado | tinyint(1) | No | - | 0 / - |
| canal | varchar(20) | Sí | - | (sin valor explícito / NULL) / - |

PK: `id_pago`.
- U1: `idempotency_key`.
- U2: `referencia`.

### transacciones_pago

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_transaccion | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_pago | bigint unsigned | No | FK R81 | (sin valor explícito / NULL) / - |
| proveedor | varchar(80) | No | U1 | (sin valor explícito / NULL) / - |
| proveedor_transaccion_id | varchar(150) | Sí | U1 | (sin valor explícito / NULL) / - |
| tipo | enum('AUTORIZACION','CAPTURA','VENTA','REVERSO','REEMBOLSO','CONSULTA') | No | - | VENTA / - |
| estado | enum('PENDIENTE','APROBADA','RECHAZADA','ERROR') | No | - | (sin valor explícito / NULL) / - |
| authorization_code | varchar(100) | Sí | - | (sin valor explícito / NULL) / - |
| response_code | varchar(50) | Sí | - | (sin valor explícito / NULL) / - |
| response_message | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| request_reference | varchar(150) | Sí | - | (sin valor explícito / NULL) / - |
| request_payload | json | Sí | - | (sin valor explícito / NULL) / - |
| response_payload | json | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_transaccion`.
- U1: `proveedor, proveedor_transaccion_id`.

### facturas

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_factura | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_pago | bigint unsigned | No | FK R31 / U2 | (sin valor explícito / NULL) / - |
| numero_factura | varchar(80) | No | U1 | (sin valor explícito / NULL) / - |
| numero_recibo | varchar(80) | No | U5 | (sin valor explícito / NULL) / - |
| recinto_nombre | varchar(150) | No | - | (sin valor explícito / NULL) / - |
| matricula | varchar(30) | No | - | (sin valor explícito / NULL) / - |
| estudiante_nombre | varchar(250) | No | - | (sin valor explícito / NULL) / - |
| descripcion | varchar(255) | No | - | (sin valor explícito / NULL) / - |
| monto | decimal(12,2) | No | - | (sin valor explícito / NULL) / - |
| moneda | char(3) | No | - | DOP / - |
| metodo_pago_nombre | varchar(100) | No | - | (sin valor explícito / NULL) / - |
| qr_token | varchar(255) | No | U4 | (sin valor explícito / NULL) / - |
| qr_hash | char(64) | No | U3 | (sin valor explícito / NULL) / - |
| pdf_url | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| fecha_emision | datetime | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| anulada_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| motivo_anulacion | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_factura`.
- U1: `numero_factura`.
- U2: `id_pago`.
- U3: `qr_hash`.
- U4: `qr_token`.
- U5: `numero_recibo`.

### conciliaciones_pago

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_conciliacion | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(60) | No | U1 | (sin valor explícito / NULL) / - |
| proveedor | varchar(80) | No | - | (sin valor explícito / NULL) / - |
| fecha_desde | datetime | No | - | (sin valor explícito / NULL) / - |
| fecha_hasta | datetime | No | - | (sin valor explícito / NULL) / - |
| total_registros | int unsigned | No | - | 0 / - |
| total_monto | decimal(14,2) | No | - | 0.00 / - |
| estado | enum('ABIERTA','PROCESADA','CON_DIFERENCIAS','CERRADA') | No | - | ABIERTA / - |
| procesada_por | bigint unsigned | Sí | FK R12 | (sin valor explícito / NULL) / - |
| procesada_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_conciliacion`.
- U1: `codigo`.

### conciliacion_detalles

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_conciliacion | bigint unsigned | No | PK / FK R10 | (sin valor explícito / NULL) / - |
| id_pago | bigint unsigned | No | PK / FK R11 | (sin valor explícito / NULL) / - |
| monto_reportado | decimal(12,2) | Sí | - | (sin valor explícito / NULL) / - |
| coincide | tinyint(1) | No | - | 0 / - |
| observacion | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_conciliacion, id_pago`.

### comprobantes_transferencia

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_comprobante | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_pago | bigint unsigned | No | FK R08 / U1 | (sin valor explícito / NULL) / - |
| nombre_archivo | varchar(255) | No | - | (sin valor explícito / NULL) / - |
| mime_type | varchar(120) | No | - | (sin valor explícito / NULL) / - |
| tamano_bytes | int unsigned | No | - | (sin valor explícito / NULL) / - |
| hash_sha256 | char(64) | No | - | (sin valor explícito / NULL) / - |
| contenido | longblob | No | - | (sin valor explícito / NULL) / - |
| estado | enum('PENDIENTE','VALIDADO','RECHAZADO') | No | - | PENDIENTE / - |
| observacion | varchar(500) | Sí | - | (sin valor explícito / NULL) / - |
| revisado_por | bigint unsigned | Sí | FK R09 | (sin valor explícito / NULL) / - |
| revisado_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_comprobante`.
- U1: `id_pago`.

## 07 · Proyectos y evaluación

### docentes

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_docente | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_usuario | bigint unsigned | No | FK R18 / U2 | (sin valor explícito / NULL) / - |
| codigo_docente | varchar(50) | No | U1 | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_docente`.
- U1: `codigo_docente`.
- U2: `id_usuario`.

### tipos_participacion

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_tipo_participacion | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| codigo | varchar(50) | No | U1 | (sin valor explícito / NULL) / - |
| nombre | varchar(100) | No | - | (sin valor explícito / NULL) / - |
| descripcion | varchar(255) | Sí | - | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','INACTIVO') | No | - | ACTIVO / - |

PK: `id_tipo_participacion`.
- U1: `codigo`.

### proyectos_grado

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_proyecto | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_inscripcion | bigint unsigned | No | FK R68 / U1 | (sin valor explícito / NULL) / - |
| id_area | bigint unsigned | Sí | FK R67 | (sin valor explícito / NULL) / - |
| area_personalizada | varchar(150) | Sí | - | (sin valor explícito / NULL) / - |
| observacion_revision | varchar(1000) | Sí | - | (sin valor explícito / NULL) / - |
| titulo | varchar(300) | Sí | - | (sin valor explícito / NULL) / - |
| descripcion | text | Sí | - | (sin valor explícito / NULL) / - |
| estado | enum('PENDIENTE','EN_DESARROLLO','EN_REVISION','APROBADO','RECHAZADO','FINALIZADO','CANCELADO') | No | - | PENDIENTE / - |
| fecha_inicio | date | Sí | - | (sin valor explícito / NULL) / - |
| fecha_finalizacion | date | Sí | - | (sin valor explícito / NULL) / - |
| created_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| updated_at | timestamp | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

PK: `id_proyecto`.
- U1: `id_inscripcion`.

### proyecto_docentes

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_proyecto | bigint unsigned | No | PK / FK R65 | (sin valor explícito / NULL) / - |
| id_docente | bigint unsigned | No | PK / FK R64 | (sin valor explícito / NULL) / - |
| id_tipo_participacion | bigint unsigned | No | PK / FK R66 | (sin valor explícito / NULL) / - |
| fecha_asignacion | datetime | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| asignado_por | bigint unsigned | Sí | FK R63 | (sin valor explícito / NULL) / - |
| estado | enum('ACTIVO','REMOVIDO') | No | - | ACTIVO / - |
| removed_at | datetime | Sí | - | (sin valor explícito / NULL) / - |
| complejidad | varchar(30) | Sí | - | (sin valor explícito / NULL) / - |
| criterio_asignacion | varchar(1500) | Sí | - | (sin valor explícito / NULL) / - |
| disponibilidad_confirmada | tinyint(1) | No | - | 0 / - |

PK: `id_proyecto, id_docente, id_tipo_participacion`.

### notas_monografico

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_nota | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_inscripcion | bigint unsigned | No | FK R45 / U1 | (sin valor explícito / NULL) / - |
| id_estudiante | bigint unsigned | No | FK R44 / U1 | (sin valor explícito / NULL) / - |
| nota | decimal(5,2) | No | - | (sin valor explícito / NULL) / - |
| observacion | varchar(1000) | Sí | - | (sin valor explícito / NULL) / - |
| registrado_por | bigint unsigned | No | - | (sin valor explícito / NULL) / - |
| updated_at | datetime | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_nota`.
- U1: `id_inscripcion, id_estudiante`.

## 08 · Coordinación académica

### perfiles_academicos

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_docente | bigint unsigned | No | PK / FK R59 | (sin valor explícito / NULL) / - |
| especialidades | varchar(1000) | No | - | (sin valor explícito / NULL) / - |
| disponibilidad | varchar(1000) | No | - | (sin valor explícito / NULL) / - |
| max_grupos | smallint unsigned | No | - | 5 / - |
| max_estudiantes | smallint unsigned | No | - | 25 / - |
| disponible | tinyint(1) | No | - | 1 / - |
| updated_at | datetime | No | - | (sin valor explícito / NULL) / - |

PK: `id_docente`.

### designaciones_academicas

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_oferta | bigint unsigned | No | PK / FK R17 | (sin valor explícito / NULL) / - |
| id_escuela | bigint unsigned | No | FK R16 | (sin valor explícito / NULL) / - |
| id_docente | bigint unsigned | No | FK R15 | (sin valor explícito / NULL) / - |
| fecha | date | No | - | (sin valor explícito / NULL) / - |
| referencia | varchar(200) | No | - | (sin valor explícito / NULL) / - |
| observacion | varchar(1000) | Sí | - | (sin valor explícito / NULL) / - |
| registrado_por | bigint unsigned | No | - | (sin valor explícito / NULL) / - |
| updated_at | datetime | No | - | (sin valor explícito / NULL) / - |

PK: `id_oferta`.

### hitos_academicos

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_hito | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_oferta | bigint unsigned | No | FK R38 | (sin valor explícito / NULL) / - |
| id_proyecto | bigint unsigned | Sí | FK R39 | (sin valor explícito / NULL) / - |
| titulo | varchar(200) | No | - | (sin valor explícito / NULL) / - |
| tipo | varchar(30) | No | - | (sin valor explícito / NULL) / - |
| fecha_limite | datetime | No | - | (sin valor explícito / NULL) / - |
| instrucciones | text | No | - | (sin valor explícito / NULL) / - |
| estado | varchar(20) | No | - | PROGRAMADO / - |
| version | int | No | - | 1 / - |
| creado_por | bigint unsigned | No | - | (sin valor explícito / NULL) / - |
| updated_at | datetime | No | - | (sin valor explícito / NULL) / - |

PK: `id_hito`.

### entregas_academicas

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_entrega | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_hito | bigint unsigned | No | FK R24 | (sin valor explícito / NULL) / - |
| id_proyecto | bigint unsigned | No | FK R25 | (sin valor explícito / NULL) / - |
| nombre_archivo | varchar(200) | No | - | (sin valor explícito / NULL) / - |
| contenido | longblob | No | - | (sin valor explícito / NULL) / - |
| hash_sha256 | char(64) | No | - | (sin valor explícito / NULL) / - |
| entregado_por | bigint unsigned | No | - | (sin valor explícito / NULL) / - |
| created_at | datetime | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| estado | varchar(30) | No | - | PENDIENTE / - |
| retroalimentacion | text | Sí | - | (sin valor explícito / NULL) / - |
| revisado_por | bigint unsigned | Sí | - | (sin valor explícito / NULL) / - |
| revisado_at | datetime | Sí | - | (sin valor explícito / NULL) / - |

PK: `id_entrega`.

### solicitudes_docentes

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_solicitud | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_oferta | bigint unsigned | No | FK R78 | (sin valor explícito / NULL) / - |
| id_docente | bigint unsigned | No | FK R77 | (sin valor explícito / NULL) / - |
| titulo | varchar(200) | No | - | (sin valor explícito / NULL) / - |
| finalidad | varchar(30) | No | - | (sin valor explícito / NULL) / - |
| instrucciones | text | No | - | (sin valor explícito / NULL) / - |
| estado_tramite | varchar(30) | No | - | PENDIENTE / - |
| referencia_tramite | varchar(200) | Sí | - | (sin valor explícito / NULL) / - |
| solicitado_por | bigint unsigned | No | - | (sin valor explícito / NULL) / - |
| created_at | datetime | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_solicitud`.

### documentos_docentes

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_documento | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_solicitud | bigint unsigned | No | FK R19 | (sin valor explícito / NULL) / - |
| nombre_archivo | varchar(200) | No | - | (sin valor explícito / NULL) / - |
| contenido | longblob | No | - | (sin valor explícito / NULL) / - |
| hash_sha256 | char(64) | No | - | (sin valor explícito / NULL) / - |
| cargado_por | bigint unsigned | No | - | (sin valor explícito / NULL) / - |
| created_at | datetime | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |
| estado | varchar(30) | No | - | PENDIENTE / - |
| observacion | text | Sí | - | (sin valor explícito / NULL) / - |
| revisado_por | bigint unsigned | Sí | - | (sin valor explícito / NULL) / - |
| revisado_at | datetime | Sí | - | (sin valor explícito / NULL) / - |

PK: `id_documento`.

### alertas_academicas

| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |
|---|---|---|---|---|
| id_alerta | bigint unsigned | No | PK | (sin valor explícito / NULL) / auto_increment |
| id_hito | bigint unsigned | No | FK R01 / U1 | (sin valor explícito / NULL) / - |
| version | int | No | U1 | (sin valor explícito / NULL) / - |
| id_usuario | bigint unsigned | No | FK R02 / U1 | (sin valor explícito / NULL) / - |
| tipo | varchar(20) | No | U1 | (sin valor explícito / NULL) / - |
| created_at | datetime | No | - | CURRENT_TIMESTAMP / DEFAULT_GENERATED |

PK: `id_alerta`.
- U1: `id_hito, version, id_usuario, tipo`.

## Relaciones físicas

| ID | Tabla hija / columnas FK | Tabla padre / columnas clave | Padre por hijo | Hijos por padre | DELETE | UPDATE |
|---|---|---|---|---|---|---|
| R01 | alertas_academicas (id_hito) | hitos_academicos (id_hito) | 1 | 0..N | RESTRICT | CASCADE |
| R02 | alertas_academicas (id_usuario) | usuarios (id_usuario) | 1 | 0..N | RESTRICT | CASCADE |
| R03 | asignatura_relaciones (id_asignatura) | asignaturas (id_asignatura) | 1 | 0..N | CASCADE | NO ACTION |
| R04 | asignatura_relaciones (id_plan_estudio) | planes_estudio (id_plan_estudio) | 1 | 0..N | CASCADE | NO ACTION |
| R05 | asignatura_relaciones (id_asignatura_relacionada) | asignaturas (id_asignatura) | 1 | 0..N | CASCADE | NO ACTION |
| R06 | auditoria (id_usuario) | usuarios (id_usuario) | 0..1 | 0..N | SET NULL | CASCADE |
| R07 | carreras (id_escuela) | escuelas (id_escuela) | 1 | 0..N | RESTRICT | CASCADE |
| R08 | comprobantes_transferencia (id_pago) | pagos (id_pago) | 1 | 0..1 | CASCADE | NO ACTION |
| R09 | comprobantes_transferencia (revisado_por) | usuarios (id_usuario) | 0..1 | 0..N | SET NULL | NO ACTION |
| R10 | conciliacion_detalles (id_conciliacion) | conciliaciones_pago (id_conciliacion) | 1 | 0..N | CASCADE | CASCADE |
| R11 | conciliacion_detalles (id_pago) | pagos (id_pago) | 1 | 0..N | RESTRICT | CASCADE |
| R12 | conciliaciones_pago (procesada_por) | usuarios (id_usuario) | 0..1 | 0..N | SET NULL | CASCADE |
| R13 | configuraciones (updated_by) | usuarios (id_usuario) | 0..1 | 0..N | SET NULL | CASCADE |
| R14 | cuentas_bancarias (created_by) | usuarios (id_usuario) | 0..1 | 0..N | SET NULL | NO ACTION |
| R15 | designaciones_academicas (id_docente) | docentes (id_docente) | 1 | 0..N | RESTRICT | CASCADE |
| R16 | designaciones_academicas (id_escuela) | escuelas (id_escuela) | 1 | 0..N | RESTRICT | CASCADE |
| R17 | designaciones_academicas (id_oferta) | ofertas (id_oferta) | 1 | 0..1 | RESTRICT | CASCADE |
| R18 | docentes (id_usuario) | usuarios (id_usuario) | 1 | 0..1 | RESTRICT | CASCADE |
| R19 | documentos_docentes (id_solicitud) | solicitudes_docentes (id_solicitud) | 1 | 0..N | RESTRICT | CASCADE |
| R20 | documentos_inscripcion (id_solicitud) | solicitudes_documentos (id_solicitud) | 0..1 | 0..N | NO ACTION | NO ACTION |
| R21 | documentos_inscripcion (id_estudiante) | estudiantes (id_estudiante) | 0..1 | 0..N | RESTRICT | CASCADE |
| R22 | documentos_inscripcion (id_inscripcion) | inscripciones (id_inscripcion) | 1 | 0..N | CASCADE | CASCADE |
| R23 | documentos_inscripcion (validado_por) | usuarios (id_usuario) | 0..1 | 0..N | SET NULL | CASCADE |
| R24 | entregas_academicas (id_hito) | hitos_academicos (id_hito) | 1 | 0..N | RESTRICT | CASCADE |
| R25 | entregas_academicas (id_proyecto) | proyectos_grado (id_proyecto) | 1 | 0..N | RESTRICT | CASCADE |
| R26 | escuelas (id_facultad) | facultades (id_facultad) | 1 | 0..N | RESTRICT | CASCADE |
| R27 | estudiante_carreras (id_estudiante) | estudiantes (id_estudiante) | 1 | 0..N | RESTRICT | CASCADE |
| R28 | estudiante_carreras (id_plan_estudio) | planes_estudio (id_plan_estudio) | 1 | 0..N | RESTRICT | CASCADE |
| R29 | estudiante_carreras (id_recinto_carrera) | recinto_carreras (id_recinto_carrera) | 1 | 0..N | RESTRICT | CASCADE |
| R30 | estudiantes (id_usuario) | usuarios (id_usuario) | 1 | 0..1 | RESTRICT | CASCADE |
| R31 | facturas (id_pago) | pagos (id_pago) | 1 | 0..1 | RESTRICT | CASCADE |
| R32 | historial_academico (id_asignatura) | asignaturas (id_asignatura) | 1 | 0..N | RESTRICT | CASCADE |
| R33 | historial_academico (id_estudiante_carrera) | estudiante_carreras (id_estudiante_carrera) | 1 | 0..N | RESTRICT | CASCADE |
| R34 | historial_estados_inscripcion (id_estado_anterior) | estados_inscripcion (id_estado) | 0..1 | 0..N | RESTRICT | CASCADE |
| R35 | historial_estados_inscripcion (id_estado_nuevo) | estados_inscripcion (id_estado) | 1 | 0..N | RESTRICT | CASCADE |
| R36 | historial_estados_inscripcion (id_inscripcion) | inscripciones (id_inscripcion) | 1 | 0..N | CASCADE | CASCADE |
| R37 | historial_estados_inscripcion (cambiado_por) | usuarios (id_usuario) | 0..1 | 0..N | SET NULL | CASCADE |
| R38 | hitos_academicos (id_oferta) | ofertas (id_oferta) | 1 | 0..N | RESTRICT | CASCADE |
| R39 | hitos_academicos (id_proyecto) | proyectos_grado (id_proyecto) | 0..1 | 0..N | SET NULL | CASCADE |
| R40 | inscripcion_estudiantes (id_estudiante) | estudiantes (id_estudiante) | 1 | 0..N | RESTRICT | CASCADE |
| R41 | inscripcion_estudiantes (id_inscripcion, id_oferta) | inscripciones (id_inscripcion, id_oferta) | 1 | 0..N | CASCADE | CASCADE |
| R42 | inscripciones (id_estado) | estados_inscripcion (id_estado) | 1 | 0..N | RESTRICT | CASCADE |
| R43 | inscripciones (id_oferta) | ofertas (id_oferta) | 1 | 0..N | RESTRICT | CASCADE |
| R44 | notas_monografico (id_estudiante) | estudiantes (id_estudiante) | 1 | 0..N | NO ACTION | CASCADE |
| R45 | notas_monografico (id_inscripcion) | inscripciones (id_inscripcion) | 1 | 0..N | NO ACTION | CASCADE |
| R46 | notificaciones (id_usuario) | usuarios (id_usuario) | 1 | 0..N | CASCADE | CASCADE |
| R47 | oferta_areas (id_area) | areas_investigacion (id_area) | 1 | 0..N | RESTRICT | CASCADE |
| R48 | oferta_areas (id_oferta) | ofertas (id_oferta) | 1 | 0..N | CASCADE | CASCADE |
| R49 | oferta_requisitos (id_oferta) | ofertas (id_oferta) | 1 | 0..N | CASCADE | CASCADE |
| R50 | oferta_requisitos (id_requisito) | requisitos (id_requisito) | 1 | 0..N | RESTRICT | CASCADE |
| R51 | ofertas (created_by) | usuarios (id_usuario) | 1 | 0..N | RESTRICT | CASCADE |
| R52 | ofertas (id_modalidad) | modalidades (id_modalidad) | 1 | 0..N | RESTRICT | CASCADE |
| R53 | ofertas (id_periodo) | periodos_academicos (id_periodo) | 1 | 0..N | RESTRICT | CASCADE |
| R54 | ofertas (id_recinto_carrera) | recinto_carreras (id_recinto_carrera) | 1 | 0..N | RESTRICT | CASCADE |
| R55 | ofertas (coordinador_id) | usuarios (id_usuario) | 0..1 | 0..N | NO ACTION | CASCADE |
| R56 | pagos (id_cuenta_bancaria) | cuentas_bancarias (id_cuenta_bancaria) | 0..1 | 0..N | RESTRICT | NO ACTION |
| R57 | pagos (id_inscripcion) | inscripciones (id_inscripcion) | 1 | 0..N | RESTRICT | CASCADE |
| R58 | pagos (id_metodo_pago) | metodos_pago (id_metodo_pago) | 1 | 0..N | RESTRICT | CASCADE |
| R59 | perfiles_academicos (id_docente) | docentes (id_docente) | 1 | 0..1 | RESTRICT | CASCADE |
| R60 | plan_estudio_asignaturas (id_asignatura) | asignaturas (id_asignatura) | 1 | 0..N | RESTRICT | CASCADE |
| R61 | plan_estudio_asignaturas (id_plan_estudio) | planes_estudio (id_plan_estudio) | 1 | 0..N | CASCADE | CASCADE |
| R62 | planes_estudio (id_carrera) | carreras (id_carrera) | 1 | 0..N | RESTRICT | CASCADE |
| R63 | proyecto_docentes (asignado_por) | usuarios (id_usuario) | 0..1 | 0..N | SET NULL | CASCADE |
| R64 | proyecto_docentes (id_docente) | docentes (id_docente) | 1 | 0..N | RESTRICT | CASCADE |
| R65 | proyecto_docentes (id_proyecto) | proyectos_grado (id_proyecto) | 1 | 0..N | RESTRICT | CASCADE |
| R66 | proyecto_docentes (id_tipo_participacion) | tipos_participacion (id_tipo_participacion) | 1 | 0..N | RESTRICT | CASCADE |
| R67 | proyectos_grado (id_area) | areas_investigacion (id_area) | 0..1 | 0..N | SET NULL | CASCADE |
| R68 | proyectos_grado (id_inscripcion) | inscripciones (id_inscripcion) | 1 | 0..1 | RESTRICT | CASCADE |
| R69 | recinto_carrera_planes (id_plan_estudio) | planes_estudio (id_plan_estudio) | 1 | 0..N | CASCADE | NO ACTION |
| R70 | recinto_carrera_planes (id_recinto_carrera) | recinto_carreras (id_recinto_carrera) | 1 | 0..N | CASCADE | NO ACTION |
| R71 | recinto_carreras (id_carrera) | carreras (id_carrera) | 1 | 0..N | RESTRICT | CASCADE |
| R72 | recinto_carreras (id_recinto) | recintos (id_recinto) | 1 | 0..N | RESTRICT | CASCADE |
| R73 | rol_permisos (asignado_por) | usuarios (id_usuario) | 0..1 | 0..N | SET NULL | CASCADE |
| R74 | rol_permisos (id_permiso) | permisos (id_permiso) | 1 | 0..N | CASCADE | CASCADE |
| R75 | rol_permisos (id_rol) | roles (id_rol) | 1 | 0..N | CASCADE | CASCADE |
| R76 | sesiones (id_usuario) | usuarios (id_usuario) | 1 | 0..N | CASCADE | CASCADE |
| R77 | solicitudes_docentes (id_docente) | docentes (id_docente) | 1 | 0..N | RESTRICT | CASCADE |
| R78 | solicitudes_docentes (id_oferta) | ofertas (id_oferta) | 1 | 0..N | RESTRICT | CASCADE |
| R79 | solicitudes_documentos (id_inscripcion) | inscripciones (id_inscripcion) | 1 | 0..N | NO ACTION | NO ACTION |
| R80 | solicitudes_documentos (solicitado_por) | usuarios (id_usuario) | 1 | 0..N | NO ACTION | NO ACTION |
| R81 | transacciones_pago (id_pago) | pagos (id_pago) | 1 | 0..N | RESTRICT | CASCADE |
| R82 | usuario_roles (asignado_por) | usuarios (id_usuario) | 0..1 | 0..N | SET NULL | CASCADE |
| R83 | usuario_roles (id_rol) | roles (id_rol) | 1 | 0..N | RESTRICT | CASCADE |
| R84 | usuario_roles (id_usuario) | usuarios (id_usuario) | 1 | 0..N | CASCADE | CASCADE |
| R85 | validaciones_requisitos (id_inscripcion) | inscripciones (id_inscripcion) | 1 | 0..N | CASCADE | CASCADE |
| R86 | validaciones_requisitos (id_requisito) | requisitos (id_requisito) | 1 | 0..N | RESTRICT | CASCADE |
| R87 | validaciones_requisitos (validado_por) | usuarios (id_usuario) | 0..1 | 0..N | SET NULL | CASCADE |

## Trazabilidad sin FK declarada

Se conservan como atributos. No se dibuja una relación que MySQL no garantiza.

- `designaciones_academicas`: `registrado_por`.
- `documentos_docentes`: `cargado_por`, `revisado_por`.
- `entregas_academicas`: `entregado_por`, `revisado_por`.
- `hitos_academicos`: `creado_por`.
- `inscripciones`: `recibido_por`, `validado_por`, `deuda_abierta_por`.
- `notas_monografico`: `registrado_por`.
- `ofertas`: `notas_remitidas_por`.
- `solicitudes_docentes`: `solicitado_por`.

## Vistas de consulta

No son tablas persistentes ni tienen claves foráneas propias. Se excluyen del ER físico.

### vw_estudiantes_detalle

| Columna | Tipo MySQL |
|---|---|
| id_estudiante | bigint unsigned |
| matricula | varchar(30) |
| id_usuario | bigint unsigned |
| uuid | char(36) |
| nombres | varchar(120) |
| apellidos | varchar(120) |
| cedula | varchar(20) |
| email | varchar(190) |
| telefono | varchar(30) |
| whatsapp | varchar(30) |
| estado_usuario | enum('ACTIVO','INACTIVO','BLOQUEADO','PENDIENTE') |

### vw_inscripciones_resumen

| Columna | Tipo MySQL |
|---|---|
| id_inscripcion | bigint unsigned |
| codigo_inscripcion | varchar(60) |
| codigo_oferta | varchar(50) |
| oferta | varchar(200) |
| modalidad | varchar(100) |
| estado_inscripcion | varchar(50) |
| monto_aplicado | decimal(12,2) |
| moneda | char(3) |
| fecha_solicitud | datetime |
| fecha_confirmacion | datetime |
| total_sustentantes | bigint |

### vw_ofertas_disponibles

| Columna | Tipo MySQL |
|---|---|
| id_oferta | bigint unsigned |
| codigo | varchar(50) |
| titulo | varchar(200) |
| recinto | varchar(150) |
| carrera | varchar(150) |
| modalidad | varchar(100) |
| periodo | varchar(100) |
| fecha_inicio_inscripcion | datetime |
| fecha_fin_inscripcion | datetime |
| cupo_total | int unsigned |
| cupo_reservado | int unsigned |
| cupos_disponibles | bigint unsigned |
| monto | decimal(12,2) |
| moneda | char(3) |
| estado | enum('BORRADOR','PUBLICADA','CERRADA','CANCELADA') |

### vw_pagos_aprobados

| Columna | Tipo MySQL |
|---|---|
| id_pago | bigint unsigned |
| referencia | varchar(100) |
| id_inscripcion | bigint unsigned |
| codigo_inscripcion | varchar(60) |
| monto | decimal(12,2) |
| moneda | char(3) |
| metodo_pago | varchar(100) |
| fecha_pago | datetime |
| aprobado_at | datetime |
| numero_factura | varchar(80) |
| numero_recibo | varchar(80) |

