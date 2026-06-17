import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import { loyaltyController } from '../controllers/loyalty.controller.js'
import { vipController } from '../controllers/vip.controller.js'

/**
 * Loyalty & VIP API. Mounted at /api/loyalty.
 *  - Player routes: valid access token.
 *  - Admin routes: ADMIN/SUPPORT role.
 */
export const loyaltyRoutes = Router()

loyaltyRoutes.use(requireAuth)

// ── Player: VIP ──
loyaltyRoutes.get('/vip/levels', vipController.levels)
loyaltyRoutes.get('/vip/me', vipController.me)
loyaltyRoutes.get('/vip/levels/:id/benefits', vipController.levelBenefits)

// ── Player: points / missions / shop ──
loyaltyRoutes.get('/points/history', loyaltyController.pointHistory)
loyaltyRoutes.get('/missions', loyaltyController.missions)
loyaltyRoutes.post('/missions/:id/claim', loyaltyController.claimMission)
loyaltyRoutes.get('/shop', loyaltyController.shop)
loyaltyRoutes.post('/shop/redeem', loyaltyController.redeem)
loyaltyRoutes.get('/shop/redemptions', loyaltyController.redemptions)

// ── Admin ──
const admin = requireRole('ADMIN', 'SUPPORT')
loyaltyRoutes.get('/admin/analytics', admin, loyaltyController.adminAnalytics)
loyaltyRoutes.post('/admin/levels', admin, loyaltyController.adminCreateLevel)
loyaltyRoutes.patch('/admin/levels/:id', admin, loyaltyController.adminUpdateLevel)
loyaltyRoutes.get('/admin/benefits', admin, loyaltyController.adminBenefits)
loyaltyRoutes.post('/admin/benefits', admin, loyaltyController.adminUpsertBenefit)
loyaltyRoutes.put('/admin/tier-benefit', admin, loyaltyController.adminSetTierBenefit)
loyaltyRoutes.get('/admin/missions', admin, loyaltyController.adminMissions)
loyaltyRoutes.post('/admin/missions', admin, loyaltyController.adminUpsertMission)
loyaltyRoutes.get('/admin/settings', admin, loyaltyController.adminGetSettings)
loyaltyRoutes.put('/admin/settings', admin, loyaltyController.adminSetSetting)
loyaltyRoutes.post('/admin/adjust', admin, loyaltyController.adminAdjust)
loyaltyRoutes.post('/admin/shop', admin, loyaltyController.adminUpsertShopItem)
loyaltyRoutes.get('/admin/redemptions', admin, loyaltyController.adminRedemptions)
loyaltyRoutes.post('/admin/redemptions/:id/fulfil', admin, loyaltyController.adminFulfilRedemption)
loyaltyRoutes.get('/admin/vip/:userId', admin, vipController.adminOverview)
loyaltyRoutes.post('/admin/vip/:userId/level', admin, vipController.adminSetLevel)
