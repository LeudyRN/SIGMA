# Arquitectura de SIGMA

## Principios

- Monorepo sencillo con despliegues independientes para web y API.
- Dependencias dirigidas desde presentación hacia dominio e infraestructura.
- Validación en los límites: Zod en formularios web y DTOs con `ValidationPipe` en API.
- Módulos funcionales pequeños y cohesivos; Prisma se usa desde servicios, no desde controladores.
- Contratos HTTP documentados mediante OpenAPI.

## Frontend

`apps/web` usa App Router, componentes de servidor por defecto y componentes cliente solo donde se necesita estado o interacción. Los tokens visuales viven en `globals.css`. El patrón responsive es mobile-first y las tablas administrativas deben ofrecer una representación en tarjetas en pantallas estrechas.

## Backend

`apps/api` expone la API bajo `/api`. La configuración es global, las entradas se limpian y validan, Swagger vive en `/api/docs` y el acceso a MySQL se encapsula en `PrismaModule`.

Los módulos iniciales son:

- `auth`, `users`, `roles`: identidad y autorización.
- `students`, `academic`: estudiantes, planes e historial.
- `ucotesis`: catálogos, oferta y configuración institucional.
- `enrollments`: elegibilidad, sustentantes y estados.
- `payments`: pagos, conciliación y facturación.
- `notifications`, `audit`: comunicación y trazabilidad.

## Ambientes

- Desarrollo: servicios locales en puertos 3000, 3001 y MySQL 3306.
- QA: build de producción con credenciales y base aisladas.
- Producción: secretos administrados por la plataforma, HTTPS, migraciones mediante `prisma migrate deploy` y orígenes CORS explícitos.
