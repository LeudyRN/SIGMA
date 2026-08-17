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

- Node.js 22 o superior
- pnpm 11 o superior
- MySQL 8.0 o superior

## Instalación

```bash
git clone https://github.com/LeudyRN/SIGMA.git
cd SIGMA
pnpm install
cp .env.example .env
pnpm prisma:generate
```

En PowerShell, copie el entorno con:

```powershell
Copy-Item .env.example .env
```

## Variables de entorno

| Variable                 | Propósito                                              |
| ------------------------ | ------------------------------------------------------ |
| `DATABASE_URL`           | URL MySQL usada por Prisma CLI                         |
| `DATABASE_HOST`          | Host usado por el driver del API                       |
| `DATABASE_PORT`          | Puerto MySQL, normalmente `3306`                       |
| `DATABASE_USER`          | Usuario de aplicación MySQL                            |
| `DATABASE_PASSWORD`      | Contraseña del usuario MySQL                           |
| `DATABASE_NAME`          | Base de datos, normalmente `sigma_ucotesis`            |
| `JWT_SECRET`             | Firma de tokens de acceso                              |
| `JWT_REFRESH_SECRET`     | Firma independiente de refresh tokens                  |
| `JWT_ACCESS_EXPIRES_IN`  | Vigencia del access token, por ejemplo `15m`           |
| `JWT_REFRESH_EXPIRES_IN` | Vigencia del refresh token, por ejemplo `7d`           |
| `NEXT_PUBLIC_API_URL`    | URL pública del API consumida por Next.js              |
| `NEXT_PUBLIC_SITE_URL`   | URL canónica del frontend para metadatos sociales      |
| `CORS_ORIGIN`            | Origen web exacto autorizado por NestJS                |
| `API_PORT`               | Puerto del backend; predeterminado `3001`              |
| `WEB_PORT`               | Puerto documentado del frontend; predeterminado `3000` |
| `NODE_ENV`               | `development`, `test` o `production`                   |

Nunca utilice los valores de ejemplo en producción ni versione el archivo `.env`.

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

```bash
pnpm dev
```

También puede iniciar cada aplicación por separado:

```bash
pnpm dev:web
pnpm dev:api
```

| Servicio     | URL                                |
| ------------ | ---------------------------------- |
| Frontend     | <http://localhost:3000>            |
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
pnpm dev:web
pnpm dev:api
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:studio
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Playwright puede requerir instalar el navegador la primera vez con `pnpm --filter @sigma/web exec playwright install chromium`.

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
qa    -> validación y QA

feature/*
   |
   v
  qa
   |
   v
 main
```

## Seguridad

- Los secretos nunca se versionan y deben ser diferentes por ambiente.
- Las contraseñas se almacenan con hash bcrypt, nunca en texto plano.
- Los access tokens y refresh tokens usan secretos independientes.
- Los endpoints privados deben combinar autenticación y autorización por rol.
- CORS acepta el origen configurado; no usa comodín global.
- Los pagos requieren idempotencia y los cupos deben reservarse atómicamente.

Consulte [Arquitectura](docs/architecture.md) y [Base de datos](docs/database.md) antes de ampliar módulos o modificar el esquema.
