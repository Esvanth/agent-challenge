# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

# Native module deps: better-sqlite3 (python/make/g++) + sharp (libvips)
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/
COPY characters/ ./characters/

RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only what's needed to run
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/       ./dist/
COPY --from=builder /app/public/     ./public/
COPY --from=builder /app/characters/ ./characters/

RUN mkdir -p data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
