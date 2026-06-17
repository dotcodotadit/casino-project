# Deployment & Production Setup

Educational casino-clone platform. **No real money / payments.**

## Architecture (runtime)

```
                         ┌──────────────────────────────┐
   Browser ── HTTPS ───► │  nginx (edge, :80/:443, TLS)  │
                         └───┬───────────┬───────────┬──┘
            / (SPA)         │   /api/*   │ /socket.io│  admin.<domain>
        ┌───────────┐  ┌────▼──────┐  ┌──▼───────┐  ┌─▼───────────┐
        │ frontend  │  │api-gateway│  │ backend  │  │ admin-panel │
        │ (nginx)   │  │  :8080    │  │  :4000   │  │  (nginx)    │
        └───────────┘  └──┬─────┬──┘  │ socket.io│  └─────────────┘
                          │     │     └────┬─────┘
                   ┌──────▼─┐ ┌─▼──────┐   │
                   │  auth  │ │ wallet │   │ (game logic uses @casino/game-engine)
                   │ :4001  │ │ :4002  │   │
                   └───┬────┘ └───┬────┘   │
                       └────┬─────┴────────┘
                     ┌──────▼─────┐   ┌─────────┐
                     │ PostgreSQL │   │  Redis  │
                     └────────────┘   └─────────┘
```

- The **gateway** is the only HTTP entrypoint to the services; it validates JWTs,
  rate-limits, and fans out to auth/wallet/backend (service discovery).
- **Redis** backs rate limiting + the wallet→backend balance pub/sub.
- **Health checks**: every Node service exposes `GET /health`; nginx exposes `/healthz`.

---

## 1. Local development (no Docker)

```bash
# from repo root
npm ci
npm run prisma:generate
npm run engine:build                 # build the game-engine lib first
# start Postgres + Redis however you like (or: docker compose up -d postgres redis)
cp .env.example .env                 # fill DATABASE_URL / REDIS_URL / JWT secrets
npm run prisma:migrate               # or: npx prisma db push --schema backend/prisma/schema.prisma
npm run dev                          # gateway + auth + wallet + backend + frontend (Vite)
```

Player app: http://localhost:5173 · Admin: `npm run dev -w admin-panel` → http://localhost:5174

---

## 2. Production (Docker Compose)

```bash
# from repo root
cp deployment/.env.example deployment/.env       # set DOMAIN, strong secrets
bash deployment/scripts/gen-ssl.sh casino.localhost   # self-signed certs (or use certbot)

docker compose -f deployment/docker/docker-compose.yml --env-file deployment/.env up -d --build
```

Boot order is enforced via health checks: `postgres`+`redis` → `migrate` (one-shot
`prisma db push` + seed) → services → gateway → nginx.

- Player app:  `https://<DOMAIN>/`
- Admin panel: `https://admin.<DOMAIN>/`
- Gateway health: `https://<DOMAIN>/api` (404 envelope = reachable); `…/healthz` = edge.

Useful:
```bash
docker compose -f deployment/docker/docker-compose.yml ps
docker compose -f deployment/docker/docker-compose.yml logs -f api-gateway
docker compose -f deployment/docker/docker-compose.yml down            # keep volumes
docker compose -f deployment/docker/docker-compose.yml down -v         # wipe data
```

---

## 3. SSL / TLS

- **Local prod test**: `deployment/scripts/gen-ssl.sh <domain>` writes
  `deployment/certs/{fullchain,privkey}.pem` (mounted read-only into nginx).
- **Real certificates (Let's Encrypt)**: point DNS at the host, then use certbot
  with the webroot mounted at `/var/www/certbot` (volume `certbot-webroot`), e.g.
  `certbot certonly --webroot -w /var/www/certbot -d <domain> -d admin.<domain>`,
  and mount the issued certs as `fullchain.pem` / `privkey.pem`. Auto-renew via a
  cron/systemd timer that runs `certbot renew && docker compose exec nginx nginx -s reload`.
- nginx forces HTTPS (HTTP→301), enables HSTS, TLS 1.2/1.3 only.

## 4. Logging strategy

- **App**: pino structured JSON to stdout (`LOG_LEVEL` env), tokens/cookies redacted.
- **Containers**: Docker `json-file` driver with rotation (`max-size 10m`, `max-file 5`).
- **nginx**: JSON access logs (`log_format json`) for easy shipping to Loki/ELK.
- Correlate requests via the gateway-issued `x-request-id` (propagated to services).

## 5. Volumes (data management)

| Volume            | Purpose                          |
|-------------------|----------------------------------|
| `pgdata`          | PostgreSQL data (persistent)     |
| `redisdata`       | Redis AOF persistence            |
| `certbot-webroot` | ACME HTTP-01 challenge files     |

Back up Postgres: `docker compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql`.

## 6. VM / bare-metal (PM2 alternative)

See `deployment/pm2/ecosystem.config.cjs`. After building the repo and running
`prisma db push`, start the four Node services with
`pm2 start deployment/pm2/ecosystem.config.cjs` and serve the built SPA(s) with nginx.

## 7. CI/CD

`deployment/ci-cd/github-actions.yml` → copy to `.github/workflows/ci.yml`. It runs
lint/typecheck/build/test against ephemeral Postgres+Redis, then builds & pushes the
container images to GHCR on `main`, with a deploy placeholder to wire to your host.

## Notes / production hardening TODO
- Commit real Prisma **migrations** and switch the `migrate` step to `prisma migrate deploy`
  (the demo uses `db push`).
- Set a Redis password and a strong `GATEWAY_SECRET` (enables the "only-via-gateway" guard).
- The admin panel auth is currently a demo login + fixture data — wire it to real
  `/api/admin/*` endpoints with `ADMIN` role gating before exposing publicly.
