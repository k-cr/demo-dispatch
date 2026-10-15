# -----------------------------------------------------------------------------
# DISPATCH FRONTEND · Dockerfile para producción y Coolify
# -----------------------------------------------------------------------------

# Etapa 1: Build de Vite + React
FROM node:20-alpine AS builder

WORKDIR /app

# Copia archivos de dependencias
COPY package*.json ./
RUN npm ci

# Parámetro opcional para inyectar una URL absoluta de API en tiempo de compilación.
# Si se deja vacío (predeterminado), las llamadas van a /api y Nginx las reenvía internamente al backend.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Copia código fuente y archivos de configuración
COPY . .

# Compila el bundle de producción
RUN npm run build

# Etapa 2: Servidor web de producción Nginx
FROM nginx:alpine AS runner

# Configura variables de entorno para la plantilla Nginx
ENV PORT=80
ENV BACKEND_URL=http://backend:4000
ENV NGINX_ENVSUBST_FILTER="PORT BACKEND_URL"

# Copia la plantilla para soporte de envsubst dinámico
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Y la configuración fija como respaldo
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia los archivos estáticos generados por Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Expone el puerto configurado (80 por defecto)
EXPOSE 80

# Healthcheck interno del contenedor
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
