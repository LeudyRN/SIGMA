# SIGMA - Guía para agentes

SIGMA digitaliza la consulta de oferta, validación académica, inscripción, pagos y seguimiento de tesis y monográficos de UCOTESIS en la UASD Recinto Santiago.

## Arquitectura

- Monorepo pnpm: `apps/web` (Next.js, React, TypeScript, App Router, Tailwind) y `apps/api` (NestJS, Prisma, MySQL).
- La UI consume la API REST. El backend separa módulos de dominio y acceso a datos.
- `db/DB/SIGMA_Base_Datos_MySQL.sql` es el modelo SQL de referencia; `apps/api/prisma/schema.prisma` debe mantenerse alineado.

## Convenciones

- TypeScript estricto. Componentes/clases en `PascalCase`, funciones/variables en `camelCase`, constantes en `UPPER_SNAKE_CASE` y archivos en `kebab-case` salvo convenciones del framework.
- Reutilizar componentes y evitar duplicación. Separar UI, dominio e infraestructura.
- Mantener diseño mobile-first, accesibilidad, HTML semántico y foco visible.
- Validar entradas en los límites con DTOs/Zod. No exponer modelos de persistencia como contratos públicos.

## Comandos

- Desarrollo: `pnpm dev`, `pnpm dev:web`, `pnpm dev:api`
- Calidad: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`
- Pruebas: `pnpm test`, `pnpm test:e2e`
- Build: `pnpm build`
- Prisma: `pnpm prisma:generate`, `pnpm prisma:migrate`, `pnpm prisma:studio`, `pnpm create:user`

## Base de datos y seguridad

- Nunca guardar secretos, tokens, credenciales ni archivos `.env` reales.
- No modificar migraciones antiguas ya aplicadas; crear una nueva migración.
- No ejecutar cambios destructivos en la BD sin autorización explícita.
- No eliminar físicamente pagos, facturas, inscripciones confirmadas ni auditoría.
- Los cambios de cupos deben ser atómicos y preservar idempotencia.
- Actualizar README cuando cambien comandos, variables o arquitectura relevantes.
