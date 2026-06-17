import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import pinoHttp from 'pino-http'
import { config } from './lib/config.js'
import { logger } from './lib/logger.js'
import { authRoutes } from './routes/auth.routes.js'
import { errorHandler } from './middleware/validate.middleware.js'

const app = express()

// Trust the gateway/reverse proxy so req.ip reflects the real client.
app.set('trust proxy', 1)

app.use(helmet())
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
  }),
)
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
app.use(pinoHttp({ logger }))

app.get('/health', (_req, res) => res.json({ service: 'auth', status: 'ok' }))

app.use('/api/auth', authRoutes)

// 404 + error handler last.
app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }))
app.use(errorHandler)

app.listen(config.port, () => {
  logger.info(`auth-service listening on :${config.port}`)
})
