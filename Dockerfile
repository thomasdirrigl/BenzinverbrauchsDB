# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NODE_ENV=production
# Build-Tools fuer den Fallback-Kompilierlauf von better-sqlite3, falls kein
# vorkompiliertes Binary fuer die Zielplattform geladen werden kann. Bleiben
# nur im Build-Stage, landen nicht im finalen Image.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY scripts ./scripts
# npm ci loest den postinstall-Hook aus, der scripts/prepare-tessdata.js
# ausfuehrt und die OCR-Sprachdaten (@tesseract.js-data/deu, /eng) nach
# data/tessdata kopiert - scripts/ muss deshalb vor npm ci vorhanden sein.
RUN npm ci --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DB_DIR=/app/storage

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/data ./data
COPY package.json ./
COPY src ./src
COPY public ./public

RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
