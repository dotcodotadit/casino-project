import { Prisma, LoyaltyPointSource, type Mission, type MissionMetric } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { withRetry } from '../../lib/retry.js'
import { AppError } from '../../lib/errors.js'
import { bonusBus } from '../../events/bonus.events.js'
import { pointEngineService } from './point-engine.service.js'
import { toUserMissionView, type UserMissionView } from './loyalty.types.js'

/**
 * Mission / challenge engine.
 *
 * Missions are templates; a UserMission is a player's progress for one *period*
 * (periodKey scopes recurring missions so each day/week/month is a fresh row,
 * uniquely indexed). Settled events advance progress atomically; reaching the
 * target marks COMPLETED, and claiming grants the reward (points + optional
 * bonus) exactly once.
 */

/** Period key for a mission type at a given time (UTC-based buckets). */
function periodKey(type: Mission['type'], now = new Date()): string {
  const d = now
  switch (type) {
    case 'DAILY':
      return `D:${d.toISOString().slice(0, 10)}` // D:2026-06-17
    case 'WEEKLY': {
      // ISO week number.
      const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
      const dayNum = (tmp.getUTCDay() + 6) % 7
      tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3)
      const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4))
      const week =
        1 + Math.round(((tmp.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
      return `W:${tmp.getUTCFullYear()}-${week}`
    }
    case 'MONTHLY':
      return `M:${d.toISOString().slice(0, 7)}` // M:2026-06
    default:
      return 'ALL' // ACHIEVEMENT / TIER — single lifetime row
  }
}

function periodExpiry(type: Mission['type'], now = new Date()): Date | null {
  const d = new Date(now)
  switch (type) {
    case 'DAILY':
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1))
    case 'WEEKLY': {
      const dayNum = (d.getUTCDay() + 6) % 7
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (7 - dayNum)))
    }
    case 'MONTHLY':
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
    default:
      return null
  }
}

/** Does a settled event metric match a mission's metric? Returns the increment. */
function matchIncrement(
  m: Mission,
  ev: { kind: 'bet' | 'deposit' | 'win' | 'points'; amountMinor?: number; payoutMinor?: number; gameCategory?: string; points?: number },
): number {
  switch (m.metric as MissionMetric) {
    case 'BET_COUNT':
      return ev.kind === 'bet' ? 1 : 0
    case 'BET_AMOUNT':
      return ev.kind === 'bet' ? ev.amountMinor ?? 0 : 0
    case 'DEPOSIT_AMOUNT':
      return ev.kind === 'deposit' ? ev.amountMinor ?? 0 : 0
    case 'WIN_AMOUNT':
      return ev.kind === 'win' ? ev.payoutMinor ?? 0 : 0
    case 'POINTS_EARNED':
      return ev.kind === 'points' ? ev.points ?? 0 : 0
    case 'GAME_CATEGORY_BETS': {
      const want = (m.params as { category?: string } | null)?.category?.toUpperCase()
      return ev.kind === 'bet' && ev.gameCategory?.toUpperCase() === want ? 1 : 0
    }
    case 'LOGIN_STREAK':
      return 0 // advanced explicitly via recordLogin
    default:
      return 0
  }
}

async function userLevelNumber(userId: string): Promise<number> {
  const p = await prisma.vipProgress.findUnique({ where: { userId }, include: { level: true } })
  return p?.level.level ?? 0
}

export const missionService = {
  periodKey,

  /** Active missions visible to a user (respecting tier gating + window). */
  async activeMissionsFor(userId: string): Promise<Mission[]> {
    const now = new Date()
    const levelNo = await userLevelNumber(userId)
    const missions = await prisma.mission.findMany({
      where: {
        status: 'ACTIVE',
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      include: { minLevel: true },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    })
    return missions.filter((m) => !m.minLevel || m.minLevel.level <= levelNo)
  },

  /** Get-or-create the current-period UserMission row for a mission. */
  async ensureUserMission(userId: string, mission: Mission) {
    const key = periodKey(mission.type)
    const existing = await prisma.userMission.findUnique({
      where: { userId_missionId_periodKey: { userId, missionId: mission.id, periodKey: key } },
    })
    if (existing) return existing
    try {
      return await prisma.userMission.create({
        data: {
          userId,
          missionId: mission.id,
          periodKey: key,
          target: mission.target,
          expiresAt: periodExpiry(mission.type),
        },
      })
    } catch (err) {
      // Race: another request created it — re-read.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return prisma.userMission.findUniqueOrThrow({
          where: { userId_missionId_periodKey: { userId, missionId: mission.id, periodKey: key } },
        })
      }
      throw err
    }
  },

  /** A user's missions (current period rows) as views. */
  async listFor(userId: string): Promise<UserMissionView[]> {
    const missions = await this.activeMissionsFor(userId)
    const views: UserMissionView[] = []
    for (const m of missions) {
      const um = await this.ensureUserMission(userId, m)
      views.push(toUserMissionView({ ...um, mission: m }))
    }
    return views
  },

  /**
   * Advance all of a user's active missions for a settled event. Atomic per
   * mission; emits `mission.progress` / `mission.completed`. Never throws to the
   * caller (event handler) — failures are logged per mission.
   */
  async advanceForEvent(
    userId: string,
    ev: { kind: 'bet' | 'deposit' | 'win' | 'points'; amountMinor?: number; payoutMinor?: number; gameCategory?: string; points?: number },
  ): Promise<void> {
    const missions = await this.activeMissionsFor(userId)
    for (const m of missions) {
      const inc = matchIncrement(m, ev)
      if (inc <= 0) continue
      try {
        await this.advance(userId, m, inc)
      } catch (err) {
        logger.error({ err, missionId: m.id, userId }, 'mission advance failed')
      }
    }
  },

  /** Atomically add `inc` to a user's mission progress; complete when target met. */
  async advance(userId: string, mission: Mission, inc: number): Promise<void> {
    await this.ensureUserMission(userId, mission)
    const key = periodKey(mission.type)

    const out = await withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const um = await tx.userMission.findUnique({
            where: { userId_missionId_periodKey: { userId, missionId: mission.id, periodKey: key } },
          })
          if (!um || um.status !== 'IN_PROGRESS') return null

          const newProgress = um.progress + BigInt(inc)
          const met = newProgress >= um.target
          await tx.userMission.update({
            where: { id: um.id },
            data: {
              progress: newProgress,
              status: met ? 'COMPLETED' : 'IN_PROGRESS',
              completedAt: met ? new Date() : null,
            },
          })
          return {
            id: um.id,
            progress: Number(newProgress),
            target: Number(um.target),
            met,
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    )
    if (!out) return

    bonusBus.publish('mission.progress', {
      userId,
      userMissionId: out.id,
      missionKey: mission.key,
      progress: out.progress,
      target: out.target,
      percent: out.target > 0 ? Math.min(100, Math.round((out.progress / out.target) * 100)) : 0,
    })
    if (out.met) {
      bonusBus.publish('mission.completed', {
        userId,
        userMissionId: out.id,
        missionKey: mission.key,
        rewardPoints: Number(mission.rewardPoints),
      })
    }
  },

  /**
   * Claim a completed mission's reward (points + optional bonus). Idempotent via
   * the CLAIMED status transition guarded inside the transaction.
   */
  async claim(userId: string, userMissionId: string): Promise<{ rewardPoints: number }> {
    const claimed = await withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const um = await tx.userMission.findFirst({
            where: { id: userMissionId, userId },
            include: { mission: true },
          })
          if (!um) throw AppError.notFound('Mission not found', 'MISSION_NOT_FOUND')
          if (um.status === 'CLAIMED') throw AppError.unprocessable('Already claimed', 'MISSION_CLAIMED')
          if (um.status !== 'COMPLETED') throw AppError.unprocessable('Mission not completed', 'MISSION_INCOMPLETE')

          const upd = await tx.userMission.updateMany({
            where: { id: um.id, status: 'COMPLETED' },
            data: { status: 'CLAIMED', claimedAt: new Date() },
          })
          if (upd.count === 0) throw AppError.conflict('Concurrent claim', 'WALLET_CONFLICT')
          return um
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    )

    // Grant reward points outside the claim tx (its own atomic ledger write).
    const reward = Number(claimed.mission.rewardPoints)
    const rewardStatus = Number(claimed.mission.rewardStatusPoints)
    if (reward > 0 || rewardStatus > 0) {
      await pointEngineService.earn({
        userId,
        loyaltyPoints: reward,
        statusPoints: rewardStatus,
        source: LoyaltyPointSource.MISSION,
        reference: `mission-claim:${userMissionId}`,
        metadata: { missionKey: claimed.mission.key },
      })
    }

    // Optional linked bonus — granted lazily to avoid a hard import cycle.
    if (claimed.mission.rewardBonusId) {
      try {
        const { bonusEngineService } = await import('../bonus/bonus-engine.service.js')
        await bonusEngineService.grant(claimed.mission.rewardBonusId, {
          userId,
          grantKey: `mission-bonus:${userMissionId}`,
        })
      } catch (err) {
        logger.warn({ err, userMissionId }, 'mission reward bonus grant skipped')
      }
    }

    logger.info({ userId, userMissionId, reward }, 'mission reward claimed')
    return { rewardPoints: reward }
  },

  /** Record a login for LOGIN_STREAK missions (called from user.login event). */
  async recordLogin(userId: string): Promise<void> {
    const missions = (await this.activeMissionsFor(userId)).filter((m) => m.metric === 'LOGIN_STREAK')
    for (const m of missions) {
      try {
        await this.advance(userId, m, 1)
      } catch (err) {
        logger.error({ err, missionId: m.id }, 'login streak advance failed')
      }
    }
  },

  /** Scheduler: expire un-claimed missions whose period elapsed. */
  async expireDue(now = new Date()): Promise<number> {
    const res = await prisma.userMission.updateMany({
      where: { status: { in: ['IN_PROGRESS', 'COMPLETED'] }, expiresAt: { lt: now, not: null } },
      data: { status: 'EXPIRED' },
    })
    return res.count
  },
}
