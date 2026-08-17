# Base de datos

El SQL de `db/DB/SIGMA_Base_Datos_MySQL.sql` es la fuente funcional original. Define 41 tablas, cuatro vistas, datos de catálogo y procedimientos para reservar o liberar cupos con bloqueo transaccional.

El `schema.prisma` fue generado por introspección sobre una instancia MySQL 8 aislada creada desde ese SQL. Esto conserva las relaciones y tipos existentes.

## Objetos que requieren SQL manual

Prisma Client no representa completamente:

- restricciones `CHECK`;
- vistas de apoyo;
- procedimientos almacenados;
- comportamiento `ON UPDATE CURRENT_TIMESTAMP` en todos los casos.

Cuando se genere una migración, revise el SQL y agregue de forma explícita esos objetos si el cambio los afecta. Nunca edite una migración que ya fue aplicada.

## Reglas de integridad

- No borrar físicamente pagos, facturas, inscripciones confirmadas ni auditoría.
- Reservar cupos dentro de la misma transacción lógica que inicia la inscripción.
- Mantener `idempotency_key` única para cada intención de pago.
- Conservar la factura como snapshot histórico y sus identificadores/QR únicos.
- Registrar cambios sensibles mediante el módulo de auditoría.
