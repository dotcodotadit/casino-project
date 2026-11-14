# One-container demo deployment

This Dockerfile packages the player SPA, admin SPA, API gateway, auth service,
wallet service, game backend, and Nginx into one web container. PostgreSQL and
Redis must be provided as managed add-ons by the hosting platform.

## Docker configuration

- Dockerfile path: `deployment/ethio/Dockerfile`
- Build context: repository root
- Public HTTP port: `8080` (or the platform-provided `PORT`)
- Health check path: `/healthz`

## Required environment variables

- `DATABASE_URL`: PostgreSQL connection URL from the managed database
- `REDIS_URL`: Redis connection URL from the managed Redis add-on
- `JWT_ACCESS_SECRET`: long random secret (at least 32 characters)
- `JWT_REFRESH_SECRET`: a different long random secret
- `CORS_ORIGINS`: the public site origin, e.g. `https://your-app.example`

Optional:
- `GATEWAY_SECRET`: shared internal gateway secret (leave empty unless configured consistently)
- `LOG_LEVEL`: defaults to the service logger defaults

On startup the container synchronizes the Prisma schema, seeds demo data, and
starts all application services. The admin SPA is mounted at `/admin/`.

## Demo-only restrictions

Deposit and withdrawal API routes return HTTP 403. The player wallet only shows
virtual credits and game history. Credits have no cash value and cannot be
purchased or redeemed.

The seeded player login is `player@royalcasino.dev` / `Player@12345`.
The seeded admin API account is `admin@royalcasino.dev` / `Admin@12345`.
The separate admin-panel UI currently uses its own demo fixture login; see the
admin-panel login screen. Change seeded passwords before sharing a public demo.

This is an educational play-money demo, not a licensed gambling product.
