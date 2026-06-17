import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import { bonusController } from '../controllers/bonus.controller.js'

/**
 * Bonus + promotion API. Mounted at /api/bonus.
 *  - Player routes require a valid access token.
 *  - Admin routes additionally require ADMIN/SUPPORT.
 */
export const bonusRoutes = Router()

bonusRoutes.use(requireAuth)

// ── Player ──
bonusRoutes.get('/available', bonusController.available)
bonusRoutes.get('/mine', bonusController.mine)
bonusRoutes.get('/progress', bonusController.progress)
bonusRoutes.get('/free-spins', bonusController.freeSpins)
bonusRoutes.get('/promotions', bonusController.promotions)
bonusRoutes.post('/claim', bonusController.claim)
bonusRoutes.post('/:id/cancel', bonusController.cancel)

// ── Admin ──
const admin = requireRole('ADMIN', 'SUPPORT')
bonusRoutes.get('/admin/list', admin, bonusController.adminList)
bonusRoutes.get('/admin/analytics', admin, bonusController.adminAnalytics)
bonusRoutes.get('/admin/history', admin, bonusController.adminHistory)
bonusRoutes.get('/admin/abuse', admin, bonusController.adminAbuseFlags)
bonusRoutes.post('/admin/abuse/:id/resolve', admin, bonusController.adminResolveAbuse)
bonusRoutes.get('/admin/settings', admin, bonusController.adminGetSettings)
bonusRoutes.put('/admin/settings', admin, bonusController.adminSetSetting)
bonusRoutes.get('/admin/promotions', admin, bonusController.adminPromotions)
bonusRoutes.post('/admin/promotions', admin, bonusController.adminUpsertPromotion)

bonusRoutes.post('/admin', admin, bonusController.adminCreate)
bonusRoutes.get('/admin/:id', admin, bonusController.adminGet)
bonusRoutes.patch('/admin/:id', admin, bonusController.adminUpdate)
bonusRoutes.post('/admin/:id/status', admin, bonusController.adminSetStatus)
bonusRoutes.put('/admin/:id/conditions', admin, bonusController.adminSetConditions)
bonusRoutes.post('/admin/:id/grant', admin, bonusController.adminGrant)
bonusRoutes.post('/admin/user-bonus/:id/cancel', admin, bonusController.adminCancelUserBonus)
