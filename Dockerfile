# ── Build stage — cache bust 2026-04-05b ─────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Copy workspace manifests — shared package.json needed for workspace resolution
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend/package*.json ./packages/backend/
COPY packages/frontend/package*.json ./packages/frontend/

RUN npm ci --ignore-scripts

# Copy shared source (needed for import type resolution) and backend source, then compile
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

RUN npm run build -w packages/backend

# SQL migrations are not compiled by tsc — copy them manually to dist
RUN cp -r packages/backend/src/db/migrations packages/backend/dist/db/

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

# Run migrations then start the server
CMD ["sh", "-c", "echo 'Starting migration...' && node dist/db/migrate.js && echo 'Migration done. Starting server...' && node dist/index.js"]
