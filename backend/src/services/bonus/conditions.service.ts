import { KycLevel } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import {
  BONUS_SETTING_KEYS,
  DEFAULT_ABUSE,
  DEFAULT_GLOBAL,
  DEFAULT_CATEGORY_WEIGHTS,
  type AbuseSettings,
  type GlobalBonusSettings,
  type BonusWithConditions,
} from './bonus.types.js'

const KYC_RANK: Record<KycLevel, number> = {
  [KycLevel.NONE]: 0,
  [KycLevel.BASIC]: 1,
  [KycLevel.FULL]: 2,
}

export interface EligibilityInput {
  userId: string
  depositAmountMinor?: number
  ipAddress?: string
  deviceFingerprint?: string
}

export interface EligibilityResult {
  eligible: boolean
  reasons: string[]
}

/**
 * Settings cache — reads hot-reloadable BonusSetting rows with a short TTL so the
 * admin panel can change rules WITHOUT a redeploy, while the hot path (bet
 * settlement) is not hammered with DB reads.
 */
class SettingsCache {
  private cache = new Map<string, { value: unknown; at: number }>()
  private ttlMs = 30_000

  async get<T>(key: string, fallback: T): Promise<T> {
    const hit = this.cache.get(key)
    const now = Date.now()
    if (hit && now - hit.at < this.ttlMs) return hit.value as T
    try {
      const row = await prisma.bonusSetting.findUnique({ where: { key } })
      const value = (row?.value as T) ?? fallback
      this.cache.set(key, { value, at: now })
      return value
    } catch (err) {
      logger.warn({ err, key }, 'bonus setting read failed — using fallback')
      return fallback
    }
  }

  invalidate(key?: string): void {
    if (key) this.cache.delete(key)
    else this.cache.clear()
  }
}

const settingsCache = new SettingsCache()

export const conditionsService = {
  invalidateSettings: (key?: string) => settingsCache.invalidate(key),

  async abuseSettings(): Promise<AbuseSettings> {
    return settingsCache.get(BONUS_SETTING_KEYS.ABUSE, DEFAULT_ABUSE)
  },

  async globalSettings(): Promise<GlobalBonusSettings> {
    return settingsCache.get(BONUS_SETTING_KEYS.GLOBAL, DEFAULT_GLOBAL)
  },

  async categoryWeights(): Promise<Record<string, number>> {
    return settingsCache.get(BONUS_SETTING_KEYS.CATEGORY_WEIGHTS, DEFAULT_CATEGORY_WEIGHTS)
  },

  /**
   * Evaluate every condition on a bonus for a user. Returns all failing reasons
   * (not just the first) so the UI can explain exactly why a bonus is locked.
   */
  async evaluate(bonus: BonusWithConditions, input: EligibilityInput): Promise<EligibilityResult> {
    const reasons: string[] = []
    const now = new Date()

    // Window check on the template itself.
    if (bonus.startsAt && bonus.startsAt > now) reasons.push('Promotion has not started')
    if (bonus.endsAt && bonus.endsAt < now) reasons.push('Promotion has ended')
    if (bonus.status !== 'ACTIVE') reasons.push('Bonus is not active')

    // Per-user and global claim caps.
    const claimCount = await prisma.userBonus.count({
      where: { userId: input.userId, bonusId: bonus.id, status: { notIn: ['FORFEITED', 'CANCELLED'] } },
    })
    if (claimCount >= bonus.maxClaimsPerUser) reasons.push('Claim limit reached')

    if (bonus.maxClaimsTotal != null) {
      const total = await prisma.userBonus.count({
        where: { bonusId: bonus.id, status: { notIn: ['FORFEITED', 'CANCELLED'] } },
      })
      if (total >= bonus.maxClaimsTotal) reasons.push('Bonus fully redeemed')
    }

    if (bonus.minDepositMinor != null && input.depositAmountMinor != null) {
      if (BigInt(input.depositAmountMinor) < bonus.minDepositMinor) {
        reasons.push(`Minimum deposit is ${Number(bonus.minDepositMinor)}`)
      }
    }

    // Load the user once for condition rows that need profile data.
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      include: { kyc: true },
    })
    if (!user) return { eligible: false, reasons: ['User not found'] }

    for (const c of bonus.conditions) {
      const fail = await this.evaluateCondition(c, { user, input })
      if (fail) reasons.push(fail)
    }

    return { eligible: reasons.length === 0, reasons }
  },

  /** Evaluate a single condition; returns a failure reason or null if it passes. */
  async evaluateCondition(
    c: BonusWithConditions['conditions'][number],
    ctx: { user: NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>> & { kyc: unknown }; input: EligibilityInput },
  ): Promise<string | null> {
    const { user, input } = ctx
    switch (c.type) {
      case 'MIN_DEPOSIT': {
        const need = Number(c.value)
        if ((input.depositAmountMinor ?? 0) < need) return `Minimum deposit ${need} required`
        return null
      }
      case 'MIN_KYC_LEVEL': {
        const need = (c.value as KycLevel) in KYC_RANK ? (c.value as KycLevel) : KycLevel.NONE
        if (KYC_RANK[user.kycLevel] < KYC_RANK[need]) return `KYC level ${need} required`
        return null
      }
      case 'NEW_USERS_ONLY': {
        const hadBonus = await prisma.userBonus.count({ where: { userId: user.id } })
        if (hadBonus > 0) return 'For new users only'
        return null
      }
      case 'FIRST_DEPOSIT_ONLY': {
        const deposits = await prisma.transaction.count({
          where: { userId: user.id, type: 'DEPOSIT', status: 'COMPLETED' },
        })
        // <=1 because the triggering deposit may already be recorded.
        if (deposits > 1) return 'First deposit only'
        return null
      }
      case 'MIN_ACCOUNT_AGE_HOURS': {
        const ageH = (Date.now() - user.createdAt.getTime()) / 3_600_000
        if (ageH < Number(c.value)) return `Account must be ${c.value}h old`
        return null
      }
      case 'COUNTRY_ALLOW': {
        const params = (c.params as { countries?: string[] }) ?? {}
        const country = (user as unknown as { kyc?: { country?: string } }).kyc?.country
        if (params.countries && country && !params.countries.includes(country)) {
          return 'Not available in your country'
        }
        return null
      }
      case 'COUNTRY_DENY': {
        const params = (c.params as { countries?: string[] }) ?? {}
        const country = (user as unknown as { kyc?: { country?: string } }).kyc?.country
        if (params.countries && country && params.countries.includes(country)) {
          return 'Not available in your country'
        }
        return null
      }
      case 'GAME_CATEGORY':
      case 'CUSTOM':
        // Informational at grant time; enforced during wagering/play.
        return null
      default:
        return null
    }
  },
}
