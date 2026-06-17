import 'dotenv/config'

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.WALLET_PORT ?? 4002),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-32-chars-min',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  cors: { origins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174').split(',') },

  // Fee config (basis points). 100 bps = 1%.
  withdrawalFeeBps: Number(process.env.WITHDRAWAL_FEE_BPS ?? 150), // 1.5%
  minWithdrawalMinor: Number(process.env.MIN_WITHDRAWAL_MINOR ?? 10_00), // $10
  maxWithdrawalMinor: Number(process.env.MAX_WITHDRAWAL_MINOR ?? 50_000_00), // $50k
  minDepositMinor: Number(process.env.MIN_DEPOSIT_MINOR ?? 5_00), // $5
  maxDepositMinor: Number(process.env.MAX_DEPOSIT_MINOR ?? 100_000_00),
} as const
