import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import { aggregatorController } from '../controllers/aggregator.controller.js'

/**
 * Player + admin aggregator API. Mounted at /api/aggregator.
 * (Provider callbacks are mounted separately at /api/aggregator/callback and are
 * NOT covered by these auth guards.)
 */
export const aggregatorRoutes = Router()

// ── Player (authenticated) ──
aggregatorRoutes.use(requireAuth)
aggregatorRoutes.get('/providers', aggregatorController.getProviders)
aggregatorRoutes.get('/games', aggregatorController.getGames)
aggregatorRoutes.post('/launch', aggregatorController.launch)
aggregatorRoutes.get('/balance', aggregatorController.getBalance)

// ── Admin (ADMIN/SUPPORT role) ──
const admin = requireRole('ADMIN', 'SUPPORT')
aggregatorRoutes.get('/admin/providers', admin, aggregatorController.adminProviders)
aggregatorRoutes.patch('/admin/providers/:code', admin, aggregatorController.adminUpdateProvider)
aggregatorRoutes.post('/admin/providers/:code/sync', admin, aggregatorController.adminSync)
aggregatorRoutes.post('/admin/sync-all', admin, aggregatorController.adminSyncAll)
aggregatorRoutes.get('/admin/sessions', admin, aggregatorController.adminSessions)
aggregatorRoutes.get('/admin/provider-transactions', admin, aggregatorController.adminProviderTransactions)
aggregatorRoutes.get('/admin/callbacks', admin, aggregatorController.adminCallbacks)
aggregatorRoutes.post('/admin/callbacks/:id/retry', admin, aggregatorController.adminRetryCallback)
