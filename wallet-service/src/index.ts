import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { config } from './lib/config.js'
import { logger } from './lib/logger.js'
import { walletRoutes } from './routes/wallet.routes.js'
import { errorHandler } from './middleware/validate.middleware.js'
import { onBalanceChange } from './wallet.service.js'
import { publishBalanceChange } from './lib/publisher.js'

const app = express()

// Trust the gateway/reverse proxy so req.ip reflects the real client.
app.set('trust proxy', 1)

app.use(helmet())
app.use(cors({ origin: config.cors.origins, credentials: true }))
app.use(express.json({ limit: '100kb' }))
app.use(pinoHttp({ logger }))

app.get('/health', (_req, res) => res.json({ service: 'wallet', status: 'ok' }))

app.use('/api/wallet', walletRoutes)

app.use((_req, res) =>
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }),
)
app.use(errorHandler)

// Bridge ledger balance changes -> Redis -> backend Socket.io.
onBalanceChange(publishBalanceChange)

app.listen(config.port, () => {
  logger.info(`wallet-service listening on :${config.port}`)
})
