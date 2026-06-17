import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { levelUpService } from '../services/loyalty/level-up.service.js'
import { missionService } from '../services/loyalty/mission.service.js'
import { loyaltySettings } from '../services/loyalty/loyalty.settings.js'

/**
 * Loyalty scheduler — periodic maintenance (guarded intervals, no cron dep, like
 * the bonus scheduler). All jobs are idempotent / conflict-guarded so they are
 * safe to run on multiple instances.
 *
 * Jobs:
 *  - missionExpiry   (every 10m) → expire un-claimed missions past their period
 *  - downgradeSweep  (hourly)    → apply VIP downgrades whose grace window ended
 *  - periodReset     (hourly)    → reset STATUS points at end of review period
 */
type Timer = ReturnType<typeof setInterval>
const timers: Timer[] = []

async function missionExpiry(): Promise<void> {
  const n = await missionService.expireDue()
  if (n) logger.info({ expired: n }, 'missions expired')
}

async function downgradeSweep(): Promise<void> {
  await levelUpService.applyDueDowngrades()
}

/**
 * Reset STATUS points for users whose review period elapsed. lifetimePoints is
 * preserved; statusPoints resets to the current tier floor (keepPoints) so they
 * neither instantly downgrade nor keep stale XP — a fresh window starts.
 */
async function periodReset(): Promise<void> {
  const cfg = await loyaltySettings.downgradeConfig()
  if (!cfg.enabled) return
  const cutoff = new Date(Date.now() - cfg.reviewPeriodDays * 86_400_000)
  const due = await prisma.vipProgress.findMany({
    where: { periodStartedAt: { lt: cutoff } },
    include: { level: true },
    take: 500,
  })
  let count = 0
  for (const p of due) {
    try {
      await prisma.vipProgress.update({
        where: { id: p.id },
        data: { statusPoints: p.level.keepPoints, periodStartedAt: new Date() },
      })
      // Re-evaluate so a below-floor reset arms the grace window.
      await levelUpService.evaluate(p.userId)
      count++
    } catch (err) {
      logger.error({ err, userId: p.userId }, 'period reset failed')
    }
  }
  if (count) logger.info({ count }, 'VIP period reset applied')
}

function schedule(name: string, fn: () => Promise<void>, everyMs: number): void {
  const run = () => {
    fn().catch((err) => logger.error({ err, job: name }, 'scheduled loyalty job failed'))
  }
  setTimeout(run, 15_000) // stagger after bonus scheduler
  timers.push(setInterval(run, everyMs))
}

export function startLoyaltyScheduler(): void {
  schedule('missionExpiry', missionExpiry, 10 * 60_000)
  schedule('downgradeSweep', downgradeSweep, 60 * 60_000)
  schedule('periodReset', periodReset, 60 * 60_000)
  logger.info('loyalty scheduler started')
}

export function stopLoyaltyScheduler(): void {
  for (const t of timers) clearInterval(t)
  timers.length = 0
}

export const loyaltyJobs = { missionExpiry, downgradeSweep, periodReset }
