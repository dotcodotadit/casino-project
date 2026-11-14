# Single-container deployment for platforms that provide one Docker service
# plus external PostgreSQL and Redis add-ons.
FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx supervisor openssl ca-certificates netcat-openbsd \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json ./
COPY game-engine/package.json game-engine/
COPY auth-service/package.json auth-service/
COPY wallet-service/package.json wallet-service/
COPY backend/package.json backend/
COPY api-gateway/package.json api-gateway/
COPY frontend/package.json frontend/
COPY admin-panel/package.json admin-panel/
RUN npm ci

COPY . .
RUN npx prisma generate --schema backend/prisma/schema.prisma \
  && npm run build -w game-engine -w auth-service -w wallet-service -w backend -w api-gateway \
  && npm run build -w frontend -w admin-panel

COPY deployment/ethio/nginx.conf /etc/nginx/conf.d/default.conf
COPY deployment/ethio/supervisord.conf /etc/supervisor/conf.d/casino.conf
COPY deployment/ethio/start.sh /app/deployment/ethio/start.sh
RUN chmod +x /app/deployment/ethio/start.sh \
  && rm -f /etc/nginx/sites-enabled/default

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["/app/deployment/ethio/start.sh"]
