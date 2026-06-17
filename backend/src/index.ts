import { createServer } from 'node:http'
import { createApp } from './app.js'
import { config } from './lib/config.js'
import { logger } from './lib/logger.js'
import { initSocket } from './services/socket.service.js'
import { aggregatorService } from './services/aggregators/aggregator.service.js'
import { registerBonusTriggers } from './services/bonus/bonus-triggers.js'
import { startBonusScheduler } from './scheduler/bonus.scheduler.js'
import { registerLoyaltyTriggers } from './services/loyalty/loyalty-triggers.js'
import { startLoyaltyScheduler } from './scheduler/loyalty.scheduler.js'

const app = createApp()
const httpServer = createServer(app)

// Attach Socket.io (JWT handshake auth + per-user rooms + Redis balance relay).
initSocket(httpServer)

// Bonus engine: wire event triggers (deposit/bet/etc) + start cron jobs.
registerBonusTriggers()
startBonusScheduler()

// Loyalty/VIP engine: reuse the same event bus (bridge already started by the
// bonus triggers) for point accrual / missions, plus its maintenance jobs.
registerLoyaltyTriggers()
startLoyaltyScheduler()

httpServer.listen(config.port, () => {
  logger.info(`backend listening on :${config.port} (http + socket.io)`)
})

// Seed providers + import their game catalogs (non-fatal if DB is unreachable).
void aggregatorService
  .ensureSeeded()
  .then(() => aggregatorService.syncAll())
  .then((counts) => logger.info({ counts }, 'aggregator catalog synced'))
  .catch((err) => logger.error({ err: err.message }, 'aggregator seed/sync failed'))

// Graceful shutdown.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    logger.info({ sig }, 'shutting down')
    httpServer.close(() => process.exit(0))
  })
}
