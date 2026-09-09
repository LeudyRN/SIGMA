# SIGMA

**Sistema de Gestión e Inscripción Virtual de Tesis / Monográficos**<br>
**UCOTESIS - UASD Recinto Santiago**

SIGMA centraliza y digitaliza la consulta de oferta académica, la validación de requisitos, la inscripción de sustentantes, los pagos, la facturación y el seguimiento administrativo de los procesos de grado de UCOTESIS.

Esta primera versión establece una base modular, tipada, responsive y verificable para desarrollar progresivamente las funciones del sistema.

## Stack tecnológico

| Área          | Tecnologías                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend      | Next.js 16, React 19, TypeScript, App Router, Tailwind CSS, shadcn/ui, Lucide, React Hook Form, Zod, TanStack Query/Table, Zustand y Recharts |
| Backend       | NestJS 11, TypeScript, JWT, Passport, Swagger/OpenAPI, class-validator y bcrypt                                                               |
| Base de datos | MySQL 8, Prisma ORM 7 y driver MariaDB/MySQL                                                                                                  |
| Tooling       | pnpm workspaces, ESLint, Prettier y TypeScript estricto                                                                                       |
| Testing       | Vitest, React Testing Library, Playwright y Jest                                                                                              |

## Arquitectura

```text
Cliente
   |
   v
Next.js / React (apps/web)
   |
   | REST API
   v
NestJS (apps/api)
   |
   v
Prisma
   |
   v
MySQL 8
```

El backend se divide por dominios (`auth`, `users`, `roles`, `students`, `academic`, `ucotesis`, `enrollments`, `payments`, `notifications` y `audit`). Prisma se mantiene como infraestructura compartida, sin acoplar los contratos HTTP al esquema de persistencia.

## Requisitos

- Git
- Node.js 22 o superior
- pnpm 11 o superior
- MySQL 8.0 o superior

Compruebe las versiones antes de continuar:

```bash
git --version
node --version
pnpm --version
mysql --version
```

Si Node está instalado pero `pnpm` no está disponible, puede habilitarlo con Corepack:

```bash
corepack enable
corepack prepare pnpm@11.22.0 --activate
```

## Clonación e instalación desde cero

La rama de integración y trabajo del proyecto es **`qa`**. Clone el repositorio dejando esa rama activa:

```bash
git clone --branch qa https://github.com/LeudyRN/SIGMA.git SIGMA-MONOGRAFICO
cd SIGMA-MONOGRAFICO
git branch --show-current
```

El último comando debe mostrar `qa`. Todos los comandos `pnpm` documentados a continuación deben ejecutarse desde la raíz `SIGMA-MONOGRAFICO`, donde se encuentran `package.json` y `pnpm-workspace.yaml`.

Antes de instalar, cree el entorno local del API. En PowerShell:

```powershell
Copy-Item .env.example apps/api/.env
```

En Bash, Git Bash, macOS o Linux:

```bash
cp .env.example apps/api/.env
```

Abra `apps/api/.env` y complete, como mínimo, `DATABASE_URL`, `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`. Ejemplo sin credenciales reales:

```dotenv
DATABASE_URL="COMPLETE_AQUI_LA_URL_MYSQL_LOCAL"
JWT_ACCESS_SECRET="SECRETO_ALEATORIO_LARGO_Y_UNICO"
JWT_REFRESH_SECRET="OTRO_SECRETO_ALEATORIO_LARGO_Y_DIFERENTE"
```

No suba `apps/api/.env` ni `apps/web/.env.local` a Git. Si la contraseña MySQL contiene caracteres especiales, deben codificarse para URL dentro de `DATABASE_URL`.

Con el entorno ya configurado, instale todas las dependencias del monorepo:

```bash
pnpm install
```

La instalación ejecuta `pnpm prisma:generate` automáticamente. Después, aplique las migraciones pendientes sobre una base local ya inicializada:

```bash
pnpm prisma:deploy
```

Resumen del lugar desde donde se ejecuta cada acción:

| Acción                                        | Directorio               |
| --------------------------------------------- | ------------------------ |
| `git pull`, `git push` y cambio de rama       | Raíz `SIGMA-MONOGRAFICO` |
| `pnpm install`                                | Raíz `SIGMA-MONOGRAFICO` |
| Comandos `pnpm dev:*`, pruebas y build        | Raíz `SIGMA-MONOGRAFICO` |
| Archivo privado del backend                   | `apps/api/.env`          |
| Archivo web opcional para URLs personalizadas | `apps/web/.env.local`    |

## Variables de entorno

| Variable                 | Propósito                                              |
| ------------------------ | ------------------------------------------------------ |
| `DATABASE_URL`           | URL MySQL usada por Prisma CLI                         |
| `JWT_ACCESS_SECRET`      | Firma de tokens de acceso                              |
| `JWT_REFRESH_SECRET`     | Firma independiente de refresh tokens                  |
| `JWT_ACCESS_EXPIRES_IN`  | Vigencia del access token, por ejemplo `15m`           |
| `JWT_REFRESH_EXPIRES_IN` | Vigencia del refresh token, por ejemplo `7d`           |
| `NEXT_PUBLIC_API_URL`    | URL del API; compatibilidad de configuración           |
| `API_INTERNAL_URL`       | URL interna usada por el proxy seguro de Next.js       |
| `NEXT_PUBLIC_SITE_URL`   | URL canónica del frontend para metadatos sociales      |
| `CORS_ORIGIN`            | Origen web exacto autorizado por NestJS                |
| `API_PORT`               | Puerto del backend; predeterminado `3001`              |
| `WEB_PORT`               | Puerto documentado del frontend; predeterminado `3000` |
| `NODE_ENV`               | `development`, `test` o `production`                   |

Las variables `DATABASE_URL`, `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` se dejan vacías
intencionalmente en `.env.example`: el API y Prisma
rechazan el arranque si no se configuran en el `.env` local. Nunca versione ese archivo ni
reutilice secretos entre ambientes. Puede generar cada secreto JWT con
`openssl rand -base64 48` o con el gestor de secretos de su plataforma.

## Base de datos

El modelo SQL original se conserva en `db/DB/SIGMA_Base_Datos_MySQL.sql`. El archivo contiene `DROP DATABASE`, por lo que **solo debe ejecutarse para inicializar una instancia nueva y vacía**. No se debe ejecutar sobre una base con información existente.

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:deploy
pnpm prisma:studio
```

- `prisma:migrate` crea una migración nueva durante desarrollo.
- `prisma:deploy` aplica migraciones ya revisadas en QA o producción.
- No edite migraciones aplicadas ni elimine registros financieros o de auditoría.
- Los `CHECK`, vistas y procedimientos almacenados del SQL se deben preservar mediante SQL de migración, porque Prisma no representa todos esos objetos de forma nativa.

## Desarrollo local

### Ejecutar API y web juntos

Desde la raíz del repositorio:

```bash
pnpm dev
```

El modo de desarrollo compila el API en `apps/api/.nest-dev`, separado de `dist`, y el
frontend espera a que `GET /api/health` responda antes de iniciar. De esta forma un
`pnpm build` no elimina los archivos que está usando el watcher ni genera errores de proxy
durante el arranque.

### Ejecutar API y web por separado

Abra dos terminales en la raíz `SIGMA-MONOGRAFICO`. Inicie primero el backend.

Terminal 1:

```bash
pnpm dev:api
```

Terminal 2:

```bash
pnpm dev:web
```

`dev:web` espera hasta 90 segundos a que el health check del API responda. Si aparece `ECONNREFUSED 127.0.0.1:3001`, compruebe que la primera terminal siga ejecutando el API, que MySQL esté iniciado y que `apps/api/.env` sea válido.

Para detener los procesos use `Ctrl+C` en cada terminal. No es necesario ejecutar los comandos dentro de `apps/web` o `apps/api`; los scripts raíz seleccionan automáticamente la aplicación correspondiente.

| Servicio     | URL                                |
| ------------ | ---------------------------------- |
| Frontend     | <http://localhost:3000>            |
| Login        | <http://localhost:3000/login>      |
| Mapa modular | <http://localhost:3000/app>        |
| API          | <http://localhost:3001/api>        |
| Health check | <http://localhost:3001/api/health> |
| Swagger      | <http://localhost:3001/api/docs>   |

## Calidad, pruebas y build

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm format:check
```

Playwright puede requerir instalar el navegador la primera vez con `pnpm --filter @sigma/web exec playwright install chromium`.

## Autenticación y mapa funcional

El API implementa inicio de sesión por matrícula o código de empleado mediante los endpoints `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout` y `GET /api/auth/me`. Los tokens de acceso y renovación se guardan en cookies `httpOnly`, se firman con secretos independientes y quedan vinculados a sesiones persistidas y revocables en la base de datos. Al cambiar de cuenta, el frontend cancela las consultas activas y vacía por completo su caché para no reutilizar información del usuario anterior.

El historial académico permite previsualizar y confirmar importaciones PDF por carrera
estudiantil, además de exportar el expediente con la plantilla institucional. La importación
valida matrícula, carrera, códigos, equivalencias, períodos, créditos y calificaciones; es
idempotente por asignatura y período. Los literales `AUS` se registran como retirados sin
nota y no impiden almacenar una calificación válida de la misma materia en un período
posterior.

La navegación y las rutas REST usan la misma matriz funcional de permisos. La interfaz muestra solo los módulos autorizados para administrador, coordinación, tesorería, docente o estudiante; el API vuelve a consultar en MySQL los roles y permisos efectivos antes de cada operación protegida. Por tanto, retirar una asignación entra en vigor sin depender de datos antiguos del token.

Las cuentas de empleados se administran desde `/app/usuarios` y los roles y permisos desde `/app/roles-permisos`. El alta, consulta, actualización y eliminación se realizan mediante la API; no se crean usuarios mediante variables de entorno.

El catálogo de usuarios internos excluye las cuentas con roles `ADMIN` y `ESTUDIANTE`. Los estudiantes se administran exclusivamente desde `/app/estudiantes`, donde el backend crea de forma transaccional la cuenta, el perfil y la asignación única del rol `ESTUDIANTE`. Las rutas `/app/estudiante-carreras`, `/app/historial-academico` y `/app/elegibilidad` trabajan con los catálogos y expedientes persistidos en MySQL.

La actualización de identidad y acceso del 17 de agosto de 2026 está en `apps/api/prisma/migrations/20260817170000_identidad_acceso_codigo_empleado/migration.sql`. El `ALTER TABLE` aislado solicitado para agregar únicamente el código de empleado está en `db/DB/ALTER_Usuarios_Codigo_Empleado.sql`. La migración completa también crea el catálogo persistente de permisos y su relación con roles.

Si la base local ya tiene `codigo_empleado` pero todavía no tiene el catálogo de permisos, ejecute únicamente `db/DB/ACTUALIZAR_Roles_Permisos.sql`. La matriz funcional ampliada se encuentra en la migración `20260817213000_rbac_funcional` y, para una base local existente, en `db/DB/ACTUALIZAR_Permisos_RBAC.sql`; ambos scripts son idempotentes respecto a sus asignaciones.

Los módulos privados `/app/usuarios`, `/app/roles-permisos`, `/app/sesiones`, `/app/reportes` y el bloque de estudiantes consumen la API real. El centro de notificaciones vive en el encabezado, recibe cambios mediante Server-Sent Events y ejecuta lectura y eliminación directamente en MySQL; no utiliza `localStorage` ni `sessionStorage` como fuente de datos.

`GET /api/dashboard/reports` calcula uso real, distribución de inscripciones por recinto, carrera, modalidad y área, además del consumo API/DB disponible en auditoría. El resumen también se calcula según la audiencia autenticada. Si todavía no existen registros, la respuesta devuelve colecciones vacías en lugar de datos simulados.

La estructura académica dispone de CRUD conectado a MySQL para recintos, facultades, escuelas, carreras, carreras por recinto, planes de estudio y asignaturas. Los planes permiten asignar materias obligatorias, semestre y créditos aplicables; estas relaciones alimentan el historial y el cálculo de elegibilidad al 100 %.

El portal estudiantil consulta exclusivamente el expediente del usuario autenticado. Permite revisar carreras, historial, elegibilidad y ofertas compatibles; solicitar una inscripción con reserva atómica de cupo; consultar su estado; y registrar una intención de pago idempotente. La aprobación del pago y la factura solo se presentan cuando existen datos reales del proveedor y un comprobante persistido; SIGMA no simula aprobaciones financieras.

La ruta privada `/app` presenta, después del inicio de sesión, solo las áreas y módulos permitidos para la cuenta actual. Las fichas marcadas como «planificado» o «base lista» delimitan el trabajo pendiente, aunque todavía no tengan operaciones de negocio conectadas.

## Estructura del proyecto

```text
SIGMA-MONOGRAFICO/
|-- apps/
|   |-- web/                 # Next.js y componentes UI
|   `-- api/                 # NestJS, módulos y Prisma
|-- db/
|   |-- DB/                  # SQL MySQL original
|   |-- Diagramas/           # Diagramas UML
|   `-- Estructura/          # Modelo visual de datos
|-- docs/                    # Decisiones y guías técnicas
|-- .env.example
|-- AGENTS.md
|-- package.json
|-- pnpm-workspace.yaml
`-- README.md
```

## Ramas y flujo sugerido

```text
main  -> rama estable / producción
qa    -> rama habitual de desarrollo, integración y QA

feature/*
   |
   v
  qa
   |
   v
 main
```

### Descargar los cambios más recientes

Ejecute desde la raíz del repositorio:

```bash
git status
git fetch origin
git switch qa
git pull --rebase origin qa
```

`git status` debe revisarse antes de cambiar de rama o descargar cambios. Si tiene trabajo sin terminar, confírmelo con un commit o guárdelo temporalmente:

```bash
git stash push --include-untracked -m "trabajo local pendiente"
git pull --rebase origin qa
git stash pop
```

No use `git reset --hard` para actualizarse: puede eliminar cambios locales sin recuperación sencilla.

### Subir cambios a `qa`

Revise y valide el proyecto antes de publicar:

```bash
git switch qa
git pull --rebase origin qa
git status
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git add ruta/al/archivo-modificado otra/ruta
git status
git diff --staged
git commit -m "feat: describir el cambio realizado"
git push origin qa
```

Agregue solamente los archivos que forman parte del cambio. Revise `git status` y `git diff --staged` para confirmar que no se incluyeron `.env`, credenciales, PDFs privados, archivos temporales ni secretos. Si otra persona subió cambios mientras trabajaba, repita `git pull --rebase origin qa`, resuelva los conflictos, vuelva a validar y luego ejecute `git push origin qa`.

### Cambiar o crear ramas

Cambiar a la rama habitual de trabajo:

```bash
git fetch origin
git switch qa
git pull --rebase origin qa
```

Crear una rama de funcionalidad partiendo de `qa`, cuando el equipo decida trabajar mediante pull request:

```bash
git switch qa
git pull --rebase origin qa
git switch -c feature/nombre-corto
git push --set-upstream origin feature/nombre-corto
```

Volver posteriormente a `qa`:

```bash
git switch qa
```

`main` se reserva para la versión estable. Los cambios deben validarse primero en `qa`; no se recomienda desarrollar ni hacer `push` directo sobre `main`.

## Seguridad

- Los secretos nunca se versionan y deben ser diferentes por ambiente.
- Las contraseñas se almacenan con hash bcrypt, nunca en texto plano.
- Los access tokens y refresh tokens usan secretos independientes.
- Los endpoints privados deben combinar autenticación y autorización por rol.
- CORS acepta el origen configurado; no usa comodín global.
- Los pagos requieren idempotencia y los cupos deben reservarse atómicamente.

## Operación de UCOTESIS

La migración `20260820190000_operacion_ucotesis_completa` habilita los catálogos y ofertas, la inscripción con reserva atómica de cupos, cuentas bancarias institucionales, comprobantes de transferencia persistidos, revisión de Tesorería, factura PDF verificable, proyectos de grado y gobierno del sistema.

Después de descargar estos cambios, aplique las migraciones sin iniciar los servidores:

```bash
pnpm prisma:generate
pnpm prisma:deploy
```

En desarrollo, use `pnpm prisma:migrate` únicamente para crear una migración nueva. Las cuentas bancarias se administran desde **Pagos y facturación > Cuentas bancarias**; no se configuran en variables de entorno.

Consulte [Arquitectura](docs/architecture.md) y [Base de datos](docs/database.md) antes de ampliar módulos o modificar el esquema.

### Modalidades y documentos de inscripción

- La pantalla independiente de Modalidades está oculta; la modalidad se selecciona desde Ofertas.
- La oferta conserva su tipo de trabajo (tesis, monográfico o trabajo final) y requiere una modalidad de enseñanza: presencial, virtual o semipresencial. Las ofertas anteriores quedan por definir hasta que Coordinación las edite.
- Documentos permite a Coordinación solicitar un archivo con instrucciones. El estudiante ve la solicitud, adjunta el archivo y consulta su revisión. El rechazo requiere una observación y permite enviar otra versión; se conserva el historial.
- El docente consulta ofertas publicadas y únicamente sus proyectos asignados, con sus asesores y jurados. Las pantallas internas de requisitos, estados y configuraciones no se muestran en la navegación ni en sus rutas.
- Antes de iniciar una versión actualizada, ejecutar `pnpm prisma:deploy` y `pnpm prisma:generate`. La migración `20260905120000_modalidad_ensenanza_solicitudes_documentos` agrega la modalidad y solicitudes sin reemplazar los datos existentes.

### Consulta de auditoría

Auditoría ofrece paginación en el servidor y filtros por acción, módulo, búsqueda y rango de fechas (hora de República Dominicana). Los eventos nuevos identifican la ruta, el actor autenticado, el registro afectado y el resultado de la operación; las operaciones de autenticación no guardan credenciales ni el cuerpo de la solicitud. Los datos históricos incompletos permanecen intactos y se muestran como no registrados. La captura registra operaciones de escritura que alcanzan el interceptor; no representa un historial de lecturas ni de solicitudes rechazadas antes de ejecutar el controlador.

## Flujo UCOTESIS revisado (septiembre de 2026)

La referencia funcional es `Propuesta_SIGMA_Monografico_UCOTESIS.pdf`. La petición del proyecto prevalece sobre su propuesta de pasarela bancaria: todos los pagos nuevos son **simulaciones sin movimiento de dinero**. No se solicitan tarjetas, cuentas ni comprobantes. Se conservan los pagos y recibos históricos.

- **Oficinista:** recibe el expediente, solicita y archiva documentos recibidos.
- **Secretaría:** revisa los documentos y la elegibilidad, valida el expediente y utiliza «Crear pago · abrir deuda». Organiza grupos, presupuestos y plantillas; registra la remisión de notas a Dirección.
- **Estudiante:** confirma su contacto, consulta ofertas compatibles, solicita inscripción y sigue su expediente. Después de abrirse la deuda elige Caja presencial o pago virtual.
- **Caja local:** busca la matrícula y ejecuta el cobro presencial simulado.
- **Tesorería central:** consulta ingresos virtuales; una aprobación virtual deja conciliación simulada automática y trazabilidad transaccional.
- **Coordinador de monográfico:** docente asignado a una oferta, registra progreso y calificaciones de sus estudiantes pagados. Después de remitidas, las notas quedan cerradas.
- **Encargado/a:** organiza la oferta y consulta los informes consolidados para Subdirección Académica.

La nueva pantalla **Gestión de monográficos** contiene expedientes, grupos y plantillas, informes y política académica por plan. **Deudas y pagos** muestra el simulador y los recibos. El formulario de ofertas separa datos del curso, inscripción/costo y publicación; los requisitos particulares quedan en opciones adicionales. La modalidad de enseñanza sigue siendo presencial, virtual o semipresencial, y el tipo de trabajo conserva tesis, monográfico y trabajo final.

### Instalación y datos existentes

Ejecutar `pnpm prisma:deploy` y `pnpm prisma:generate` antes de iniciar API/web. La migración `20260908120000_ucotesis_flujo_real` es aditiva; no elimina datos ni cambia las asignaciones actuales de usuarios. Crea los roles `ENCARGADO`, `SECRETARIA`, `OFICINISTA`, `CAJA` y `COORDINADOR_MONOGRAFICO`. Asígnalos en Usuarios según la función real. El rol anterior `COORDINADOR` mantiene compatibilidad administrativa; el nuevo coordinador de curso es distinto. Las nuevas capacidades se incorporan a DOCENTE, ESTUDIANTE y TESORERIA. Actualizar la sesión para refrescar el menú.

Las solicitudes nuevas empiezan en VALIDANDO. Las solicitudes antiguas impagadas requieren recepción y revisión antes de abrir deuda. Los pagos aprobados históricos conservan su estado y recibo. Los endpoints antiguos de crear transferencias e intenciones responden 410 para evitar saltarse el flujo; las consultas históricas siguen disponibles.

### Elegibilidad, contacto y remisión

Cada plan tiene límites de materias y créditos pendientes, ambos en cero inicialmente, y un semestre mínimo para excepciones. Deben cumplirse ambos límites y todas las materias pendientes deben tener semestre conocido dentro del rango permitido. Los créditos optativos pendientes siguen bloqueando. No se inventa un umbral especial para Psicología. Las asignaturas terminales de grado mantienen el tratamiento previo del motor académico.

El contacto exige formato internacional y confirmación del propio usuario; esta confirmación no verifica titularidad mediante SMS. El enlace de WhatsApp se configura por curso y se muestra al estudiante tras el pago. SIGMA no envía mensajes externos. Las plantillas y presupuestos se exportan a CSV y la remisión se registra internamente para su entrega por el canal institucional; no se envía automáticamente a Dirección.

Las operaciones de deuda, pagos simulados, conciliación virtual, notas y remisión guardan auditoría dentro de la misma transacción. El cobro usa control de versión e idempotencia, conserva intentos rechazados y admite reintento. Un recibo con prefijo SIM es de demostración y no tiene validez fiscal. Los informes distinguen ingresos simulados por canal de pagos históricos.

### Verificación del flujo

`pnpm --filter @sigma/api exec tsx scripts/verify-monograph.ts` ejecuta la elegibilidad, recepción documental, revisión, deuda, ambos canales, rechazo/reintento, idempotencia, recibos, grupo, notas y remisión contra MySQL. Todos los datos de prueba se revierten en una única transacción; los recibos de muestra quedan en `.tmp/verification`. Requiere una base migrada con al menos un recinto/carrera y período.

Cuando cambia un documento antes de abrir la deuda, se invalida la revisión previa. Durante una deuda activa, el expediente queda congelado para el cobro; después del pago se pueden archivar documentos finales. Las actualizaciones documentales y el control de versión son transaccionales.

El resumen general y los reportes comparten `/dashboard/insights`, con alcance por usuario/rol, rangos de 7/30/90 días o personalizados (máximo 366), tendencias diarias, comparación de solicitudes con el período anterior, usuarios con actividad, cola de pendientes actuales y exportación CSV. Los eventos auditados no se presentan como consumo total de API/DB. Las fechas se agrupan con el huso horario de Santo Domingo. La conciliación acepta código de método y, por compatibilidad, ID; el formulario envía el código y ofrece únicamente métodos activos.
