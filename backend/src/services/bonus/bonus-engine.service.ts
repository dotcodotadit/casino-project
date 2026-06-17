import { Prisma } from '@prisma/client'
import type { Bonus } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { withRetry } from '../../lib/retry.js'
import { AppError } from '../../lib/errors.js'
import { bonusBus } from '../../events/bonus.events.js'
import {
  DEFAULT_CATEGORY_WEIGHTS,
  type BonusWithConditions,
  type GrantContext,
  type GrantResult,
} from './bonus.types.js'
import { conditionsService } from './conditions.service.js'
import { abuseService } from './abuse.service.js'
import { wageringService } from './wagering.service.js'
import { freespinService } from './freespin.service.js'

/**
 * Bonus engine — the core that turns a Bonus template + a trigger into a live,
 * funded UserBonus with wagering. Pure decision/computation logic lives here;
 * money movement is delegated to wageringService (atomic + audited).
 *
 * Grant pipeline:
 *   1. eligibility (conditions.service) + stacking check
 *   2. anti-abuse screen (abuse.service) — may block
 *   3. compute reward amount (% match / fixed / free-spins)
 *   4. create UserBonus (+ wager requirement snapshot) idempotently
 *   5. credit BONUS wallet, award free spins, emit events
 */
export const bonusEngineService = {
  /** Compute the reward (bonus credit) for a trigger amount under a template. */
  computeReward(bonus: Bonus, triggerAmountMinor: number): number {
    let amount = 0
    switch (bonus.rewardType) {
      case 'PERCENTAGE':
        amount = Math.floor(triggerAmountMinor * (bonus.percentage ?? 0))
        break
      case 'FIXED':
        amount = Number(bonus.fixedAmountMinor ?? 0n)
        break
      case 'FREE_SPINS':
        // Cash value of the package (informational; spins tracked separately).
        amount = (bonus.freeSpinCount ?? 0) * Number(bonus.freeSpinValueMinor ?? 0n)
        break
    }
    if (bonus.maxAmountMinor != null) amount = Math.min(amount, Number(bonus.maxAmountMinor))
    return Math.max(0, amount)
  },

  /** Wagering requirement (turnover) for a bonus + grant + trigger amount. */
  computeWagerRequired(bonus: Bonus, grantedMinor: number, triggerAmountMinor: number): number {
    if (bonus.wagerMultiplier <= 0) return 0
    const base = bonus.wagerIncludesDeposit ? grantedMinor + triggerAmountMinor : grantedMinor
    return Math.ceil(base * bonus.wagerMultiplier)
  },

  /** Category weights for a bonus (config override → global setting → default). */
  async resolveWeights(bonus: Bonus): Promise<Record<string, number>> {
    const cfg = (bonus.config as { categoryWeights?: Record<string, number> } | null)?.categoryWeights
    if (cfg) return cfg
    const global = await conditionsService.categoryWeights()
    return global ?? DEFAULT_CATEGORY_WEIGHTS
  },

  /** Load an ACTIVE bonus template with conditions, or throw. */
  async loadActive(bonusId: string): Promise<BonusWithConditions> {
    const bonus = await prisma.bonus.findUnique({ where: { id: bonusId }, include: { conditions: true } })
    if (!bonus) throw AppError.notFound('Bonus not found', 'BONUS_NOT_FOUND')
    return bonus
  },

  /**
   * Stacking guard: unless this bonus allows stacking AND all of the user's
   * active bonuses also allow it, a user may hold only one active bonus.
   */
  async canStack(userId: string, bonus: Bonus): Promise<boolean> {
    const active = await prisma.userBonus.findMany({
      where: { userId, status: { in: ['ACTIVE', 'PENDING'] } },
      include: { bonus: true },
    })
    if (active.length === 0) return true
    if (!bonus.allowStacking) return false
    return active.every((ub) => ub.bonus.allowStacking)
  },

  /**
   * Grant a bonus to a user from a trigger. Idempotent via `grantKey`.
   * Throws AppError on ineligibility/abuse for MANUAL/CODE claims; auto-grants
   * (from events) should call this in a try/catch and treat throws as "skip".
   */
  async grant(bonusId: string, ctx: GrantContext): Promise<GrantResult> {
    const bonus = await this.loadActive(bonusId)
    const trigger = ctx.triggerAmountMinor ?? 0

    // 1. Eligibility.
    const elig = await conditionsService.evaluate(bonus, {
      userId: ctx.userId,
      depositAmountMinor: ctx.triggerAmountMinor,
      ipAddress: ctx.ipAddress,
      deviceFingerprint: ctx.deviceFingerprint,
    })
    if (!elig.eligible) throw AppError.unprocessable(elig.reasons.join('; '), 'BONUS_INELIGIBLE')

    // 2. Stacking.
    if (!(await this.canStack(ctx.userId, bonus))) {
      throw AppError.conflict('An active bonus already exists', 'BONUS_STACK_DENIED')
    }

    // 3. Anti-abuse.
    const verdict = await abuseService.screenGrant({
      userId: ctx.userId,
      bonusId: bonus.id,
      ipAddress: ctx.ipAddress,
      deviceFingerprint: ctx.deviceFingerprint,
    })
    if (verdict.blocked) throw AppError.forbidden('Bonus blocked by risk controls', 'BONUS_ABUSE_BLOCKED')

    // 4. Compute amounts.
    const granted = this.computeReward(bonus, trigger)
    const wagerRequired = this.computeWagerRequired(bonus, granted, trigger)
    const isFreeSpinOnly = bonus.rewardType === 'FREE_SPINS'
    if (granted <= 0 && !isFreeSpinOnly && (bonus.freeSpinCount ?? 0) <= 0) {
      throw AppError.unprocessable('Bonus reward is zero for this trigger', 'BONUS_ZERO_REWARD')
    }

    const expiresAt = new Date(Date.now() + bonus.expiryHours * 3_600_000)
    const weights = await this.resolveWeights(bonus)
    // No-deposit/free credit: cap convertible winnings at the bonus amount.
    const maxConvertible =
      bonus.kind === 'NO_DEPOSIT' || bonus.kind === 'FREE_SPIN'
        ? bonus.maxAmountMinor ?? BigInt(Math.max(granted, 0))
        : null

    // 5. Create the UserBonus idempotently (grantKey unique).
    const created = await withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          if (ctx.grantKey) {
            const existing = await tx.userBonus.findUnique({ where: { grantKey: ctx.grantKey } })
            if (existing) return { userBonus: existing, replay: true as const }
          }

          const userBonus = await tx.userBonus.create({
            data: {
              userId: ctx.userId,
              bonusId: bonus.id,
              status: 'ACTIVE',
              grantedAmountMinor: BigInt(granted),
              triggerAmountMinor: BigInt(trigger),
              wagerRequiredMinor: BigInt(wagerRequired),
              maxConvertibleMinor: maxConvertible,
              activatedAt: new Date(),
              expiresAt,
              grantKey: ctx.grantKey,
              metadata: { kind: bonus.kind, ip: ctx.ipAddress },
            },
          })

          if (wagerRequired > 0) {
            await tx.bonusWagerRequirement.create({
              data: {
                userBonusId: userBonus.id,
                multiplier: bonus.wagerMultiplier,
                baseAmountMinor: BigInt(bonus.wagerIncludesDeposit ? granted + trigger : granted),
                requiredMinor: BigInt(wagerRequired),
                maxBetMinor: bonus.maxBetMinor,
                categoryWeights: weights as Prisma.InputJsonValue,
                expiresAt,
              },
            })
          }

          await tx.bonusAuditLog.create({
            data: {
              bonusId: bonus.id,
              userBonusId: userBonus.id,
              userId: ctx.userId,
              actorId: ctx.actorId ?? 'system',
              action: 'bonus.grant',
              amountMinor: BigInt(granted),
              metadata: { trigger, wagerRequired, kind: bonus.kind },
            },
          })

          return { userBonus, replay: false as const }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    )

    if (created.replay) {
      logger.info({ grantKey: ctx.grantKey }, 'bonus grant replay — returning existing')
      return {
        userBonus: created.userBonus,
        grantedAmountMinor: Number(created.userBonus.grantedAmountMinor),
        wagerRequiredMinor: Number(created.userBonus.wagerRequiredMinor),
      }
    }

    // 6. Side-effects: credit funds + free spins + events (outside the grant tx).
    if (granted > 0) {
      await wageringService.creditBonusFunds({
        userId: ctx.userId,
        userBonusId: created.userBonus.id,
        amountMinor: granted,
        reference: `bonus-grant:${created.userBonus.id}`,
        metadata: { bonusId: bonus.id, kind: bonus.kind },
      })
    }

    if ((bonus.freeSpinCount ?? 0) > 0) {
      await freespinService.award({
        userId: ctx.userId,
        totalSpins: bonus.freeSpinCount!,
        spinValueMinor: Number(bonus.freeSpinValueMinor ?? 0n),
        gameId: bonus.freeSpinGameId ?? undefined,
        userBonusId: created.userBonus.id,
        expiryHours: bonus.expiryHours,
      })
    }

    bonusBus.publish('bonus.granted', {
      userId: ctx.userId,
      userBonusId: created.userBonus.id,
      bonusId: bonus.id,
      amountMinor: granted,
    })
    bonusBus.publish('bonus.activated', { userId: ctx.userId, userBonusId: created.userBonus.id })

    // If there is no wagering, release immediately (instantly withdrawable).
    if (wagerRequired === 0 && granted > 0) {
      await wageringService.release(created.userBonus.id)
    }

    logger.info(
      { userId: ctx.userId, bonusId: bonus.id, granted, wagerRequired },
      'bonus granted',
    )
    return { userBonus: created.userBonus, grantedAmountMinor: granted, wagerRequiredMinor: wagerRequired }
  },

  /**
   * Find the best auto-grantable bonus of a given kind for a user/trigger and
   * grant it. Returns null when none qualifies (used by event triggers).
   */
  async autoGrantByKind(
    kind: Bonus['kind'],
    ctx: GrantContext,
  ): Promise<GrantResult | null> {
    const candidates = await prisma.bonus.findMany({
      where: { kind, status: 'ACTIVE', claimMode: 'AUTO' },
      orderBy: { priority: 'desc' },
      include: { conditions: true },
    })
    for (const bonus of candidates) {
      try {
        return await this.grant(bonus.id, ctx)
      } catch (err) {
        // Ineligible/abuse/stack → try the next candidate.
        logger.debug({ bonusId: bonus.id, err: (err as Error).message }, 'auto-grant candidate skipped')
      }
    }
    return null
  },
}
