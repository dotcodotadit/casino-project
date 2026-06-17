import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { bonusBus } from '../../events/bonus.events.js'
import { bonusEngineService } from './bonus-engine.service.js'
import { wageringService } from './wagering.service.js'
import {
  emitWageringProgress,
  emitBonusGranted,
  emitBonusCompleted,
  emitBonusEnded,
} from '../../socket/events/bonus.events.js'

/**
 * Wire the bonus event bus to engine actions. This is the trigger backbone:
 *  - deposit.completed → first-deposit Welcome bonus, else generic Deposit/Reload
 *  - bet.settled       → apply turnover to active wagering
 *  - user.registered   → no-deposit welcome (if configured)
 *  - bonus.* lifecycle  → relay to the player's socket room
 *
 * Idempotency is enforced downstream (grantKey / contribution unique index), so
 * duplicate events are safe. Handlers never throw (the bus isolates them).
 *
 * Call once at boot (after Redis + socket are up). Starts the Redis bridge so
 * events from wallet-service/other instances are also handled here.
 */
let registered = false

export function registerBonusTriggers(): void {
  if (registered) return
  registered = true

  bonusBus.startBridge()

  // ── Deposit-driven bonuses ──
  bonusBus.on('deposit.completed', async (e) => {
    // Determine first deposit if the publisher didn't say.
    let isFirst = e.isFirstDeposit
    if (isFirst === undefined) {
      const count = await prisma.transaction.count({
        where: { userId: e.userId, type: 'DEPOSIT', status: 'COMPLETED' },
      })
      isFirst = count <= 1
    }

    const ctx = {
      userId: e.userId,
      triggerAmountMinor: e.amountMinor,
      ipAddress: e.ipAddress,
      deviceFingerprint: e.deviceFingerprint,
      // One welcome per user; reloads keyed per deposit tx.
      grantKey: isFirst ? `welcome:${e.userId}` : `deposit:${e.transactionId}`,
    }

    if (isFirst) {
      const granted = await bonusEngineService.autoGrantByKind('WELCOME', ctx)
      if (granted) return
    }
    // Reload first (recurring), then generic deposit match.
    const reload = await bonusEngineService.autoGrantByKind('RELOAD', ctx)
    if (reload) return
    await bonusEngineService.autoGrantByKind('DEPOSIT', ctx)
  })

  // ── No-deposit welcome on registration ──
  bonusBus.on('user.registered', async (e) => {
    await bonusEngineService.autoGrantByKind('NO_DEPOSIT', {
      userId: e.userId,
      ipAddress: e.ipAddress,
      deviceFingerprint: e.deviceFingerprint,
      grantKey: `nodeposit:${e.userId}`,
    })
  })

  // ── Wagering from settled bets ──
  bonusBus.on('bet.settled', async (e) => {
    await wageringService.applyTurnover({
      userId: e.userId,
      stakeMinor: e.stakeMinor,
      gameCategory: e.gameCategory,
      sourceType: e.sourceType,
      sourceRef: e.sourceRef,
    })
  })

  // ── Lifecycle → socket relays ──
  bonusBus.on('bonus.progress', (e) => {
    emitWageringProgress(e.userId, {
      userBonusId: e.userBonusId,
      progressMinor: e.progressMinor,
      requiredMinor: e.requiredMinor,
      percent: e.percent,
    })
  })
  bonusBus.on('bonus.granted', (e) => {
    emitBonusGranted(e.userId, { userBonusId: e.userBonusId, bonusId: e.bonusId, amountMinor: e.amountMinor })
  })
  bonusBus.on('bonus.completed', (e) => {
    emitBonusCompleted(e.userId, { userBonusId: e.userBonusId, releasedMinor: e.releasedMinor })
  })
  bonusBus.on('bonus.expired', (e) => {
    emitBonusEnded(e.userId, { userBonusId: e.userBonusId, reason: 'expired' })
  })
  bonusBus.on('bonus.cancelled', (e) => {
    emitBonusEnded(e.userId, { userBonusId: e.userBonusId, reason: e.reason })
  })

  logger.info('bonus triggers registered')
}
