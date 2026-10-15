# Migraciones

- `../schema.sql` es la **línea base (v1)** del esquema `dispatch`. Es idempotente: elimina y recrea el esquema.
- Los cambios posteriores sobre una base en producción se agregan aquí como archivos numerados, por ejemplo:

```
002_add_operator_qualifications.sql
003_add_task_execution_delay_reason.sql
```

Cada migración debe:

1. Empezar con `SET search_path TO dispatch, public;`
2. Ser incremental (no usar `DROP SCHEMA`).
3. Aplicarse en orden: `psql "$DATABASE_URL" -f database/migrations/002_xxx.sql`
