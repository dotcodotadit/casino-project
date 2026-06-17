import { logger } from '../../lib/logger.js'
import { bonusBus } from '../../events/bonus.events.js'
import { loyaltyService } from './loyalty.service.js'
import { missionService } from './mission.service.js'
import {
  emitPointsUpdate,
  emitLevelUp,
  emitDowngrade,
  emitMissionProgress,
  emitMissionCompleted,
  emitWinBig,
} from '../../socket/events/loyalty.events.js'

/**
 * Wire the shared event bus to the loyalty engine. Reuses the SAME bus as the
 * Bonus Engine (no second bridge needed — registerBonusTriggers already started
 * the Redis bridge). Consumes money events to accrue points/advance missions and
 * relays loyalty lifecycle events to the player's socket room.
 *
 * Handlers never throw (the bus isolates them); accrual is idempotent downstream.
 */
let registered = false

export function registerLoyaltyTriggers(): void {
  if (registered) return
  registered = true

  // ── Money events → point accrual + missions ──
  bonusBus.on('bet.settled', async (e) => {
    await loyaltyService.handleBet({
      userId: e.userId,
      stakeMinor: e.stakeMinor,
      payoutMinor: e.payoutMinor,
      gameCategory: e.gameCategory,
      sourceRef: e.sourceRef,
    })
  })

  bonusBus.on('deposit.completed', async (e) => {
    await loyaltyService.handleDeposit({
      userId: e.userId,
      amountMinor: e.amountMinor,
      transactionId: e.transactionId,
    })
  })

  bonusBus.on('user.login', async (e) => {
    await missionService.recordLogin(e.userId)
  })

  // ── Loyalty lifecycle → socket relays ──
  bonusBus.on('points.earned', (e) => {
    emitPointsUpdate(e.userId, {
      loyaltyPoints: e.loyaltyPoints,
      statusPoints: e.statusPoints,
      loyaltyBalance: e.loyaltyBalance,
      source: e.source,
    })
  })
  bonusBus.on('vip.levelup', (e) => {
    emitLevelUp(e.userId, { fromLevel: e.fromLevel, toLevel: e.toLevel, levelName: e.levelName })
  })
  bonusBus.on('vip.downgrade', (e) => {
    emitDowngrade(e.userId, { fromLevel: e.fromLevel, toLevel: e.toLevel, levelName: e.levelName })
  })
  bonusBus.on('mission.progress', (e) => {
    emitMissionProgress(e.userId, {
      userMissionId: e.userMissionId,
      missionKey: e.missionKey,
      progress: e.progress,
      target: e.target,
      percent: e.percent,
    })
  })
  bonusBus.on('mission.completed', (e) => {
    emitMissionCompleted(e.userId, {
      userMissionId: e.userMissionId,
      missionKey: e.missionKey,
      rewardPoints: e.rewardPoints,
    })
  })
  bonusBus.on('win.big', (e) => {
    emitWinBig(e.userId, { payoutMinor: e.payoutMinor, multiplier: e.multiplier })
  })

  logger.info('loyalty triggers registered')
}
