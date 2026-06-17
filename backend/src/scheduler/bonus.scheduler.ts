import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { wageringService } from '../services/bonus/wagering.service.js'
import { freespinService } from '../services/bonus/freespin.service.js'
import { cashbackService } from '../services/bonus/cashback.service.js'
import { bonusEngineService } from '../services/bonus/bonus-engine.service.js'

/**
 * Bonus scheduler — periodic maintenance jobs. Implemented with guarded
 * intervals (no extra cron dependency) so it runs anywhere the backend runs.
 * Each job is self-contained, catches its own errors, and is safe to run on
 * multiple instances (all mutations are idempotent / conflict-guarded).
 *
 * Jobs:
 *  - expirySweep   (every 5m)  → expire past-due UserBonuses + free spins
 *  - cashbackRun   (hourly)    → grant due CASHBACK bonuses per their period
 */

type Timer = ReturnType<typeof setInterval>
const timers: Timer[] = []

/** Expire UserBonuses whose wagering window elapsed; reclaim locked funds. */
async function expirySweep(): Promise<void> {
  const now = new Date()
  const due = await prisma.userBonus.findMany({
    where: { status: 'ACTIVE', expiresAt: { lt: now } },
    select: { id: true },
    take: 500,
  })
  for (const ub of due) {
    try {
      await wageringService.forfeit(ub.id, 'EXPIRED', 'wagering_window_elapsed')
    } catch (err) {
      logger.error({ err, userBonusId: ub.id }, 'expiry forfeit failed')
    }
  }
  const spins = await freespinService.expireDue(now)
  if (due.length || spins) logger.info({ bonuses: due.length, freeSpins: spins }, 'bonus expiry sweep')
}

/**
 * Grant cashback for all ACTIVE cashback bonuses whose period boundary has been
 * reached. Idempotent per (user, bonus, period-bucket) via grantKey so the same
 * window is never paid twice even across instances/restarts.
 */
async function cashbackRun(): Promise<void> {
  const bonuses = await prisma.bonus.findMany({
    where: { status: 'ACTIVE', kind: 'CASHBACK' },
  })
  for (const bonus of bonuses) {
    const periodH = bonus.cashbackPeriodHours ?? 24
    // Period bucket index — stable for the whole window so the grantKey is unique
    // per window, allowing exactly-once payout.
    const bucket = Math.floor(Date.now() / (periodH * 3_600_000))
    try {
      const eligible = await cashbackService.eligibleUsers(bonus)
      for (const { userId, amountMinor } of eligible) {
        try {
          await bonusEngineService.grant(bonus.id, {
            userId,
            triggerAmountMinor: amountMinor,
            grantKey: `cashback:${bonus.id}:${userId}:${bucket}`,
          })
        } catch {
          /* ineligible / already paid this bucket — skip */
        }
      }
    } catch (err) {
      logger.error({ err, bonusId: bonus.id }, 'cashback run failed')
    }
  }
}

/** Run a job immediately, then on an interval; never let a throw escape. */
function schedule(name: string, fn: () => Promise<void>, everyMs: number): void {
  const run = () => {
    fn().catch((err) => logger.error({ err, job: name }, 'scheduled bonus job failed'))
  }
  // Stagger the first run a little so boot isn't a thundering herd.
  setTimeout(run, 10_000)
  timers.push(setInterval(run, everyMs))
}

export function startBonusScheduler(): void {
  schedule('expirySweep', expirySweep, 5 * 60_000)
  schedule('cashbackRun', cashbackRun, 60 * 60_000)
  logger.info('bonus scheduler started')
}

export function stopBonusScheduler(): void {
  for (const t of timers) clearInterval(t)
  timers.length = 0
}

// Exposed for manual admin triggering / tests.
export const bonusJobs = { expirySweep, cashbackRun }
