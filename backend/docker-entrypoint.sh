#!/bin/sh
set -e

# Si AUTO_MIGRATE o INIT_DB está activado, ejecuta el esquema SQL
if [ "$AUTO_MIGRATE" = "true" ] || [ "$INIT_DB" = "true" ]; then
  echo "[dispatch-entrypoint] Inicializando esquema de base de datos..."
  node dist/database/runSql.js schema || echo "[dispatch-entrypoint] Advertencia: fallo al ejecutar schema.sql"
fi

# Si AUTO_SEED está activado, carga los datos de prueba
if [ "$AUTO_SEED" = "true" ]; then
  echo "[dispatch-entrypoint] Cargando datos iniciales (seed)..."
  node dist/database/runSql.js seed || echo "[dispatch-entrypoint] Advertencia: fallo al ejecutar seed.sql"
fi

exec "$@"
