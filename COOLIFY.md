# Despliegue de Dispatch en Coolify

Esta guía detalla los pasos para desplegar el módulo **Dispatch (DEMO)** en **Coolify** de forma robusta, segura y lista para producción.

---

## 1. Arquitectura de Despliegue

El proyecto se compone de 3 servicios orquestados:

```
[ Navegador del Usuario ]
           │
           │ (HTTPS / Dominio asignado en Coolify)
           ▼
┌────────────────────────────────────────────────────────┐
│  dispatch-frontend (Nginx Alpine :80)                  │
│  - Sirve el bundle SPA React 19 + Vite                 │
│  - Cacheo inmutable de assets estáticos y Gzip         │
│  - Reverse Proxy interno: /api/* → backend:4000/api/*   │
└──────────────────────────┬─────────────────────────────┘
                           │ (Red interna Docker: dispatch-network)
                           ▼
┌────────────────────────────────────────────────────────┐
│  dispatch-backend (Node.js 20 Alpine :4000)            │
│  - API REST Express en TypeScript                      │
│  - Healthcheck en /api/health                          │
│  - Auto-migración opcional y LISTEN/NOTIFY Postgres    │
└──────────────────────────┬─────────────────────────────┘
                           │ (Red interna Docker: dispatch-network)
                           ▼
┌────────────────────────────────────────────────────────┐
│  dispatch-db (PostgreSQL 16 Alpine :5432)              │
│  - Volumen persistente: dispatch-data                  │
│  - Auto-inicialización con schema.sql y seed.sql       │
└────────────────────────────────────────────────────────┘
```

> **Ventaja de esta arquitectura:**
> Como Nginx actúa de proxy inverso reenviando `/api/` al backend en la red interna de Docker, **solo necesita asignar dominio público y certificado SSL al frontend**. No es necesario exponer el puerto 4000 a internet ni lidiar con problemas de CORS o certificados adicionales para la API (aunque también puede asignarle dominio al backend si desea consumirlo externamente).

---

## 2. Método Recomendado: Despliegue con Docker Compose (Todo en 1)

Este es el método más rápido y recomendado en Coolify.

### Paso 1: Crear el recurso en Coolify
1. En su panel de Coolify, ingrese al **Proyecto** y **Entorno** donde alojará la demo.
2. Haga clic en **+ New Resource** (Nuevo Recurso).
3. Seleccione **Docker Compose**.
4. Elija su fuente:
   - **Git Repository**: Conecte el repositorio Git donde subió este proyecto (rama `main` o la que prefiera).
   - O bien pegue directamente el contenido de `docker-compose.yml`.

### Paso 2: Configurar Variables de Entorno
En la pestaña **Environment Variables** del recurso en Coolify, configure los valores clave (puede basarse en `.env.coolify.example`):

| Variable | Valor sugerido | Descripción |
|---|---|---|
| `POSTGRES_USER` | `dispatch` | Usuario de PostgreSQL |
| `POSTGRES_PASSWORD` | *(contraseña segura)* | Contraseña del usuario de la BD |
| `POSTGRES_DB` | `dispatch` | Nombre de la base de datos |
| `OPERATION_TIMEZONE` | `America/Argentina/San_Juan` | Zona horaria de turnos mineros |
| `CORS_ORIGIN` | `*` | Orígenes permitidos (o su dominio) |
| `BACKEND_URL` | `http://backend:4000` | URL interna hacia el backend |

*(Nota: En Docker Compose, `DATABASE_URL` se arma automáticamente a partir de las variables de Postgres apuntando al host `db`).*

### Paso 3: Asignar Dominio
1. En la lista de servicios del Docker Compose en Coolify, seleccione **frontend**.
2. En el campo **Domains**, ingrese su dominio o subdominio con HTTPS:
   ```
   https://dispatch.su-empresa.com
   ```
3. Coolify generará automáticamente el certificado SSL (Let's Encrypt) y enrutará el tráfico al puerto `80` del contenedor `frontend`.

*(Opcional: Si desea exponer la API directamente para integraciones externas, puede asignar otro dominio al servicio **backend**, por ejemplo `https://api-dispatch.su-empresa.com`).*

### Paso 4: Desplegar
1. Haga clic en el botón **Deploy**.
2. Coolify clonará el repositorio, compilará los contenedores de backend y frontend con sus Dockerfiles optimizados en multi-etapa y levantará la base de datos PostgreSQL.
3. El primer inicio creará automáticamente el esquema con `schema.sql` y sembrará los datos de prueba con `seed.sql`.

---

## 3. Método Alternativo: Despliegue como Aplicaciones Separadas

Si prefiere gestionar la base de datos, backend y frontend como recursos individuales en Coolify:

### 1. Base de datos PostgreSQL
1. En Coolify: **+ New Resource** → **Database** → **PostgreSQL**.
2. Versión: `16`.
3. Anote la cadena de conexión interna generada por Coolify (ej. `postgres://dispatch:secret@postgres:5432/dispatch`).

### 2. Backend
1. En Coolify: **+ New Resource** → **Application** → Seleccione su repositorio Git.
2. Configuración de Build:
   - **Build Pack**: `Dockerfile`
   - **Base Directory**: `/backend`
   - **Dockerfile Path**: `/backend/Dockerfile`
   - **Exposed Port**: `4000`
3. Variables de Entorno en Coolify:
   - `DATABASE_URL`: La cadena de conexión de su base de datos.
   - `NODE_ENV`: `production`
   - `PORT`: `4000`
   - `CORS_ORIGIN`: `*` (o la URL de su frontend)
   - `OPERATION_TIMEZONE`: `America/Argentina/San_Juan`
   - `REALTIME_PG_LISTEN`: `true`
   - `AUTO_MIGRATE`: `true` *(creará las tablas en el primer inicio)*
   - `AUTO_SEED`: `true` *(cargará los datos de prueba en el primer inicio)*
4. Dominio asignado: `https://api-dispatch.su-empresa.com`.
5. Desplegar.

### 3. Frontend
1. En Coolify: **+ New Resource** → **Application** → Mismo repositorio Git.
2. Configuración de Build:
   - **Build Pack**: `Dockerfile`
   - **Base Directory**: `/frontend`
   - **Dockerfile Path**: `/frontend/Dockerfile`
   - **Exposed Port**: `80`
3. Build Arguments / Variables de Entorno:
   - `BACKEND_URL`: URL interna o externa del backend.
   - Si usa dominios separados: `VITE_API_URL=https://api-dispatch.su-empresa.com`.
4. Dominio asignado: `https://dispatch.su-empresa.com`.
5. Desplegar.

---

## 4. Healthchecks y Monitoreo

Ambos servicios incluyen comprobaciones automáticas de salud:

- **Backend**:
  - Endpoint: `GET /api/health`
  - Respuesta: `{"status": "ok", "db": "up", "time": "2026-..."}`
  - Coolify marcará el contenedor como saludable cuando la API responda y la conexión a Postgres esté activa.
- **Frontend**:
  - Endpoint: `GET /`
  - Responde con el HTML principal y código 200.

---

## 5. Mantenimiento y Reinicio de Datos (Demo)

### Rejuvenecer los datos de prueba
Las tareas de prueba en `seed.sql` están calculadas dinámicamente en torno al momento actual (ayer, hoy y mañana, turnos día y noche). Para refrescar las fechas y volver a sembrar los datos:

**Opción A (Desde la terminal del contenedor backend en Coolify):**
1. En Coolify, abra la pestaña **Terminal** del servicio `backend`.
2. Ejecute:
   ```bash
   npm run db:reset:prod
   ```

**Opción B (Recreando el volumen de base de datos):**
Si está en Docker Compose, borrar el volumen de datos forzará a Postgres a volver a ejecutar `01-schema.sql` y `02-seed.sql` en el próximo arranque.

---

## 6. Archivos creados para Coolify

- `docker-compose.yml`: Orquestación completa lista para Coolify.
- `backend/Dockerfile`: Build multi-etapa ligero (Node 20 Alpine) con soporte de auto-migración.
- `backend/docker-entrypoint.sh`: Entrypoint para inicialización opcional de esquema y semillas.
- `backend/.dockerignore`: Exclusión de node_modules y archivos innecesarios.
- `frontend/Dockerfile`: Build multi-etapa con Vite y Nginx Alpine.
- `frontend/nginx.conf.template`: Plantilla Nginx con soporte de sustitución de variables de entorno (`BACKEND_URL`, `PORT`) y proxy inverso para `/api/`.
- `frontend/nginx.conf`: Configuración estática de respaldo.
- `frontend/.dockerignore`: Exclusión de node_modules y archivos de desarrollo.
- `.dockerignore`: Exclusiones para el root de la solución.
- `.env.coolify.example`: Plantilla de variables de entorno comentada para Coolify.
