import 'dotenv/config'

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.BACKEND_PORT ?? 4000),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-32-chars-min',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174').split(','),
  },

  // Gateway pattern: when set, /api requests must carry a matching
  // `x-gateway-secret` so the service can only be reached THROUGH the gateway.
  gatewaySecret: process.env.GATEWAY_SECRET ?? '',

  // Bet limits in MINOR units (cents).
  bet: {
    minMinor: Number(process.env.MIN_BET_MINOR ?? 10), // $0.10
    maxMinor: Number(process.env.MAX_BET_MINOR ?? 1_000_00), // $1,000
  },

  // Master key for AES-256-GCM encryption of provider credentials at rest.
  credentialEncKey: process.env.CREDENTIAL_ENC_KEY ?? 'dev-credential-encryption-key-change-me',

  // Base URL the providers use to reach our callbacks (behind the gateway).
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:8080',

  // Aggregator providers. Credentials here are dev fallbacks; in prod the
  // canonical source is the encrypted Provider.credentialsEnc row, and these env
  // values seed it. `secret` signs/verifies callbacks; `endpoint` is the upstream API.
  aggregators: {
    pgsoft: {
      apiKey: process.env.PGSOFT_API_KEY ?? 'pgsoft-dev-key',
      secret: process.env.PGSOFT_SECRET ?? 'pgsoft-dev-secret',
      endpoint: process.env.PGSOFT_ENDPOINT ?? 'https://api.pgsoft.example/v2',
    },
    pragmatic: {
      apiKey: process.env.PRAGMATIC_API_KEY ?? 'pragmatic-dev-key',
      secret: process.env.PRAGMATIC_SECRET ?? 'pragmatic-dev-secret',
      endpoint: process.env.PRAGMATIC_ENDPOINT ?? 'https://api.pragmaticplay.example/v1',
    },
    evolution: {
      apiKey: process.env.EVOLUTION_API_KEY ?? 'evolution-dev-key',
      secret: process.env.EVOLUTION_SECRET ?? 'evolution-dev-secret',
      endpoint: process.env.EVOLUTION_ENDPOINT ?? 'https://api.evolution.example/api',
    },
    jili: {
      apiKey: process.env.JILI_API_KEY ?? 'jili-dev-key',
      secret: process.env.JILI_SECRET ?? 'jili-dev-secret',
      endpoint: process.env.JILI_ENDPOINT ?? 'https://api.jili.example/game',
    },
  },
} as const
