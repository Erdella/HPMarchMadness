# --------------------------------------------------------------------------
# HP March Madness — server Dockerfile.
#
# Single-stage Alpine + Node 20. We deliberately keep dev deps in the final
# image because we want `drizzle-kit push` available at startup so the
# schema syncs automatically on first boot. The image lands around ~350MB —
# fine for an annual bracket pool.
# --------------------------------------------------------------------------
FROM node:20-alpine

WORKDIR /app

# Install dependencies first to get good layer caching.
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build.
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# On boot: sync the schema (idempotent, safe on a fresh DB and on subsequent
# starts where there are no schema changes), then start the server.
CMD ["sh", "-c", "npm run db:push && node dist/index.js"]
