# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# npm ci loest den postinstall-Hook aus, der die OCR-Sprachdaten
# (@tesseract.js-data/deu, /eng) nach data/tessdata kopiert.
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
