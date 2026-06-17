# Game Aggregator Integration — Seamless Wallet

Integrates third-party providers (PG Soft, Pragmatic Play, Evolution, Jili) under
one **unified interface** with a **seamless wallet**: the player never leaves our
platform; every bet/win is a server-to-server callback that adjusts the player's
balance atomically and syncs the UI in real time.

> ⚠️ Educational/demo. Adapters are integration-faithful **simulations** — there
> is no live upstream provider server. The seamless-wallet contract (the part that
> matters for money correctness) is fully implemented and testable.

## Architecture

```
Player ─launch─► backend /api/aggregator/launch ─► sessionService (token) ─► provider launch URL
                                                                              │
Browser ◄── iframe (GameLauncher) ◄───────────────────────────────────────────┘
   ▲                                            Provider server
   │ socket balance:update                            │ bet / win / rollback (HMAC-signed)
   │                                                   ▼
backend ◄── callback.service (idempotent, ACID) ◄── /api/aggregator/callback/:provider
                 │                                  (aggregatorSignature: HMAC + IP allowlist)
                 ▼
            Wallet (optimistic lock) + Transaction + ProviderTransaction
```

Key files (`backend/src`):
- `services/aggregators/aggregator.interface.ts` — the unified provider contract.
- `services/aggregators/providers/*.service.ts` — one adapter per provider (Strategy).
- `services/aggregators/aggregator.factory.ts` — code → adapter registry.
- `services/aggregators/aggregator.service.ts` — facade (game list, sync, launch).
- `services/aggregators/session.service.ts` — launch-session tokens.
- `services/aggregators/callback.service.ts` — **the seamless-wallet ledger**.
- `middleware/aggregator-signature.middleware.ts` — HMAC + IP allowlist.
- `controllers/aggregator{,-callback}.controller.ts`, `routes/aggregator{,-callback}.routes.ts`.
- `utils/signature.utils.ts`, `lib/crypto.ts` (AES-256-GCM credential encryption).

## Seamless wallet guarantees
- **Idempotent**: every effect is keyed `${provider}:${action}:${providerTxId}`,
  enforced by an existence check **and** a UNIQUE constraint, with retry — a
  replayed callback returns the same balance and never double-charges.
- **ACID**: balance write + internal `Transaction` + `ProviderTransaction` happen
  in one SERIALIZABLE DB transaction with optimistic version locking.
- **Real-time**: emits `balance:update` to the player's socket room after commit.
- **Security**: HMAC-SHA256 signature per callback, per-provider IP allowlist,
  dedicated rate limiter, encrypted credentials at rest, generic error mapping.

---

## Testing the integration (curl / Postman)

Assumes the stack is up (`npm run dev`) and a user exists. Amounts are decimal
(major units); the adapter converts to integer minor units.

### 1. Authenticate & launch
```bash
# Login (player) — capture accessToken
ACCESS=$(curl -s http://localhost:8080/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"identifier":"neo@example.com","password":"Passw0rd!"}' | jq -r .data.tokens.accessToken)

# Launch a PG Soft game — capture the session token
TOKEN=$(curl -s http://localhost:8080/api/aggregator/launch \
  -H "authorization: Bearer $ACCESS" -H 'content-type: application/json' \
  -d '{"provider":"PGSOFT","gameId":"pg-fortune-tiger","currency":"USD"}' | jq -r .data.token)
```

### 2. Sign & send a BET callback
The signature is `HMAC_SHA256(secret, rawBody)` in the `x-signature` header.
Dev secret for PG Soft is `pgsoft-dev-secret` (see `.env.example`).

```bash
BODY=$(jq -nc --arg t "$TOKEN" \
  '{action:"bet",token:$t,txn_id:"PG-1001",round_id:"R-1",amount:"1.50",currency:"USD",game_id:"pg-fortune-tiger"}')

SIG=$(node -e "const c=require('crypto');process.stdout.write(c.createHmac('sha256','pgsoft-dev-secret').update(process.argv[1]).digest('hex'))" "$BODY")

curl -s http://localhost:8080/api/aggregator/callback/pgsoft \
  -H 'content-type: application/json' -H "x-signature: $SIG" -d "$BODY" | jq
# → { "status":"OK", "balance": <new balance>, ... }   (player balance debited 1.50, socket updates live)
```

### 3. Send a WIN, then prove idempotency
```bash
WIN=$(jq -nc --arg t "$TOKEN" '{action:"win",token:$t,txn_id:"PG-1002",round_id:"R-1",amount:"5.00",currency:"USD"}')
SIG=$(node -e "const c=require('crypto');process.stdout.write(c.createHmac('sha256','pgsoft-dev-secret').update(process.argv[1]).digest('hex'))" "$WIN")
curl -s http://localhost:8080/api/aggregator/callback/pgsoft -H 'content-type: application/json' -H "x-signature: $SIG" -d "$WIN" | jq

# Re-send the SAME win → balance is unchanged (idempotent replay), not credited twice:
curl -s http://localhost:8080/api/aggregator/callback/pgsoft -H 'content-type: application/json' -H "x-signature: $SIG" -d "$WIN" | jq
```

### 4. Negative tests
- Wrong/empty `x-signature` → `401 INVALID_SIGNATURE`.
- Unknown token → `{status:"ERROR", code:"SESSION_INVALID"}`.
- Bet larger than balance → `{status:"ERROR", code:"INSUFFICIENT_FUNDS"}`.

**Postman**: create a collection with a pre-request script that computes the HMAC:
```js
const body = JSON.stringify(pm.request.body.raw ? JSON.parse(pm.request.body.raw) : {})
const sig = CryptoJS.HmacSHA256(body, pm.environment.get('PROVIDER_SECRET')).toString()
pm.request.headers.upsert({ key: 'x-signature', value: sig })
```

---

## Adding a new provider (future)

1. **Adapter** — create `providers/<name>.service.ts` extending `BaseProvider`;
   implement `getGameList()` and `parseCallback()` (map the provider's wire format
   → `NormalizedCallback`). Override `launchGame()` if the URL shape differs.
2. **Register** — add the code to `ProviderCode` in `types.ts`, to `REGISTRY` and
   `ENV_CREDS` in `aggregator.factory.ts`, and to `config.aggregators` + `.env`.
3. **Seed** — `ensureSeeded()` will create the `Provider` row on next boot;
   `syncGames()` imports its catalog.
4. **Done** — the factory, callback engine, controllers, gateway routing, and the
   player/admin UIs all work unchanged (that's the point of the unified interface).

No changes to `callback.service`, controllers, routes, or the frontend are needed.

---

## Third-party aggregator recommendations

In production you rarely integrate 50+ providers one-by-one; you connect to an
**aggregator** that exposes a single API and fans out to providers.

| Aggregator | Pros | Cons |
|---|---|---|
| **SOFTSWISS** (Game Aggregator) | Huge catalog (10k+ games, 200+ providers); mature seamless-wallet; strong reporting, bonus engine, jackpots; well-documented. | Premium pricing/rev-share; heavier onboarding/compliance; opinionated stack. |
| **Hub88** (Yolo Group) | Clean, well-documented single wallet API; fast certification; strong Tier-1 provider coverage; reliable. | Catalog slightly smaller than SOFTSWISS; rev-share; KYC/licensing gating. |
| **EveryMatrix (CasinoEngine)** | Enterprise-grade, modular (PAM/bonus/CMS); very large catalog; multi-jurisdiction compliance tooling. | Complex; enterprise contracts/cost; longer integration. |
| **Pragmatic Play Aggregation** | First-party Pragmatic + curated third parties; excellent uptime; simple if Pragmatic-centric. | Narrower than neutral aggregators; provider mix tied to Pragmatic. |
| **BetConstruct / Digitain** | Full sportsbook + casino platform; turnkey; broad markets. | Platform lock-in; less "just aggregation"; cost. |

**How to choose**
- *Time-to-market / lean*: **Hub88** — simplest seamless wallet, quick certification.
- *Maximum catalog + tooling*: **SOFTSWISS** or **EveryMatrix**.
- *Already Pragmatic-heavy*: Pragmatic aggregation, add a neutral aggregator later.

**Integration reality**: every one of these speaks a **seamless wallet** contract
nearly identical to what this layer implements (issue session token → provider
calls your `bet`/`win`/`rollback` endpoints → you debit/credit atomically and
return the new balance). To onboard a real aggregator you'd add ONE adapter for
*the aggregator* (not per provider), mapping its callback format here — the rest
of the platform is already shaped for it.
