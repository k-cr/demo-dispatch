# -----------------------------------------------------------------------------
# DISPATCH BACKEND · Dockerfile para producción y Coolify
# -----------------------------------------------------------------------------

# Etapa 1: Build de TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Forzar NODE_ENV=development durante la compilación para asegurar que se instale TypeScript (tsc)
ARG NODE_ENV=development
ENV NODE_ENV=development

# Copia dependencias
COPY package*.json ./
RUN npm ci --include=dev

# Copia configuración y código fuente para compilar
COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Etapa 2: Imagen de ejecución (ligera y segura)
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Instala sólo las dependencias de producción (omite dependencias de desarrollo)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia archivos compilados
COPY --from=builder /app/dist ./dist

# Copia directorio database para que dispatch.config.json, schema.sql y seed.sql estén disponibles
COPY database ./database

# Copia el script de arranque para soporte de auto-migración opcional
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Puerto expuesto por defecto
EXPOSE 4000

# Healthcheck interno del contenedor
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
