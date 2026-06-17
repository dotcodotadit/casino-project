# Casino Project — Monorepo

> ⚠️ **Educational / demo project only.** This is a clone built to learn full-stack
> architecture. It uses a **provably-fair RNG simulation** and **KYC simulation** —
> there is **no real money, no payment processor, and no gambling license**. Do not
> deploy as a real gambling service.

## Stack

| Layer        | Tech                                                             |
|--------------|-----------------------------------------------------------------|
| Frontend     | React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui + Zustand + React Router v6 |
| Backend      | Node.js + Express + TypeScript + Prisma + PostgreSQL            |
| Auth         | JWT + Refresh Token + bcrypt                                     |
| Real-time    | Socket.io (game state + balance)                                |
| Game engine  | Pure TypeScript (slots, roulette, blackjack, RNG)               |
| Admin        | React (separate Vite app)                                       |
| Gateway      | Express reverse proxy + rate limiting                           |
| Infra        | Docker Compose + Nginx                                          |

## Workspace layout

```
casino-project/
├── frontend/        React player app
├── backend/         Core API (games, sockets, Prisma)
├── game-engine/     Pure reusable game logic (no I/O)
├── wallet-service/  Deposit / withdraw / balance ledger
├── auth-service/    Register / login / JWT / KYC
├── admin-panel/     Admin React app
├── api-gateway/     Reverse proxy + global rate limiting
├── docs/
└── deployment/      Docker + Nginx
```

## Quick start

```bash
npm install                 # installs all workspaces
npm run engine:build        # build shared game-engine first
docker compose -f deployment/docker/docker-compose.yml up -d postgres
npm run prisma:migrate      # set up DB
npm run dev                 # run all services concurrently
```

## Default ports

| Service       | Port |
|---------------|------|
| api-gateway   | 8080 |
| auth-service  | 4001 |
| wallet-service| 4002 |
| backend       | 4000 |
| frontend      | 5173 |
| admin-panel   | 5174 |
| postgres      | 5432 |

## Build order

The `game-engine` is a shared dependency. Build it before the services that
import it (`backend`, `wallet-service`).
