import { prisma } from '../../lib/prisma.js'
import { redis } from '../../lib/redis.js'
import { logger } from '../../lib/logger.js'
import {
  LOYALTY_SETTING_KEYS,
  DEFAULT_POINT_CONFIG,
  DEFAULT_ABUSE_CONFIG,
  DEFAULT_DOWNGRADE_CONFIG,
  DEFAULT_WIN_BIG_CONFIG,
  type PointConfig,
  type LoyaltyAbuseConfig,
  type DowngradeConfig,
  type WinBigConfig,
} from './loyalty.types.js'

/**
 * Hot-reloadable settings cache (30s TTL) backed by the LoyaltySetting table,
 * plus a Redis-backed cache for resolved VIP tier benefits. Keeps the hot path
 * (point accrual on every bet) off the DB for config reads while still letting
 * admins change rates live.
 */
class TtlCache {
  private cache = new Map<string, { value: unknown; at: number }>()
  constructor(private ttlMs = 30_000) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const hit = this.cache.get(key)
    const now = Date.now()
    if (hit && now - hit.at < this.ttlMs) return hit.value as T
    try {
      const row = await prisma.loyaltySetting.findUnique({ where: { key } })
      const value = row?.value != null ? ({ ...fallback, ...(row.value as object) } as T) : fallback
      this.cache.set(key, { value, at: now })
      return value
    } catch (err) {
      logger.warn({ err, key }, 'loyalty setting read failed — using fallback')
      return fallback
    }
  }

  invalidate(key?: string): void {
    if (key) this.cache.delete(key)
    else this.cache.clear()
  }
}

const cache = new TtlCache()

const BENEFIT_CACHE_PREFIX = 'vip:benefits:'
const BENEFIT_CACHE_TTL = 300 // seconds

export const loyaltySettings = {
  pointConfig: () => cache.get<PointConfig>(LOYALTY_SETTING_KEYS.POINTS, DEFAULT_POINT_CONFIG),
  abuseConfig: () => cache.get<LoyaltyAbuseConfig>(LOYALTY_SETTING_KEYS.ABUSE, DEFAULT_ABUSE_CONFIG),
  downgradeConfig: () => cache.get<DowngradeConfig>(LOYALTY_SETTING_KEYS.DOWNGRADE, DEFAULT_DOWNGRADE_CONFIG),
  winBigConfig: () => cache.get<WinBigConfig>(LOYALTY_SETTING_KEYS.WIN_BIG, DEFAULT_WIN_BIG_CONFIG),
  invalidate: (key?: string) => cache.invalidate(key),

  /** Read cached resolved benefits for a level (Redis), or null on miss/error. */
  async getCachedBenefits(levelId: string): Promise<unknown[] | null> {
    try {
      const raw = await redis.get(BENEFIT_CACHE_PREFIX + levelId)
      return raw ? (JSON.parse(raw) as unknown[]) : null
    } catch {
      return null
    }
  },

  async setCachedBenefits(levelId: string, benefits: unknown[]): Promise<void> {
    try {
      await redis.set(BENEFIT_CACHE_PREFIX + levelId, JSON.stringify(benefits), 'EX', BENEFIT_CACHE_TTL)
    } catch {
      /* cache best-effort */
    }
  },

  async invalidateBenefits(levelId?: string): Promise<void> {
    try {
      if (levelId) {
        await redis.del(BENEFIT_CACHE_PREFIX + levelId)
      } else {
        const keys = await redis.keys(BENEFIT_CACHE_PREFIX + '*')
        if (keys.length) await redis.del(...keys)
      }
    } catch {
      /* best-effort */
    }
  },
}
