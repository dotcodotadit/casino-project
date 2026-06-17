import { prisma } from '../../lib/prisma.js'
import { AppError } from '../../lib/errors.js'
import { loyaltySettings } from './loyalty.settings.js'
import { pointEngineService } from './point-engine.service.js'
import { toVipProgressView, type VipProgressView } from './loyalty.types.js'

/**
 * VIP read-model service: tier ladder, resolved per-tier benefits (Redis-cached),
 * and a user's progress view. No money/point mutation here — that lives in the
 * point/level-up services. Benefit reads are cached because they are hit on every
 * dashboard load and rarely change.
 */
export interface ResolvedBenefit {
  key: string
  name: string
  type: string
  unit: string | null
  value: number
  valueMinor: number | null
}

export const vipService = {
  /** Full tier ladder (ascending). */
  async levels() {
    const rows = await prisma.vipLevel.findMany({ orderBy: { level: 'asc' } })
    return rows.map((l) => ({
      id: l.id,
      level: l.level,
      name: l.name,
      color: l.color,
      icon: l.icon,
      requiredPoints: Number(l.requiredPoints),
      keepPoints: Number(l.keepPoints),
      pointMultiplier: l.pointMultiplier,
      cashbackPct: l.cashbackPct,
      weeklyBonus: Number(l.weeklyBonusMinor),
    }))
  },

  /** Resolved benefits for a level, Redis-cached (5 min). */
  async benefitsForLevel(levelId: string): Promise<ResolvedBenefit[]> {
    const cached = await loyaltySettings.getCachedBenefits(levelId)
    if (cached) return cached as ResolvedBenefit[]

    const rows = await prisma.vipTierBenefit.findMany({
      where: { levelId, enabled: true },
      include: { benefit: true },
    })
    const resolved: ResolvedBenefit[] = rows.map((r) => ({
      key: r.benefit.key,
      name: r.benefit.name,
      type: r.benefit.type,
      unit: r.benefit.unit,
      value: r.value,
      valueMinor: r.valueMinor != null ? Number(r.valueMinor) : null,
    }))
    await loyaltySettings.setCachedBenefits(levelId, resolved)
    return resolved
  },

  /** A user's progress view + resolved current-tier benefits + next tier delta. */
  async progressFor(userId: string): Promise<{ progress: VipProgressView; benefits: ResolvedBenefit[] }> {
    await pointEngineService.ensureProgress(userId)
    const p = await prisma.vipProgress.findUnique({ where: { userId }, include: { level: true } })
    if (!p) throw AppError.notFound('VIP progress not found', 'VIP_NOT_FOUND')

    const next = await prisma.vipLevel.findFirst({
      where: { level: { gt: p.level.level } },
      orderBy: { level: 'asc' },
    })
    const benefits = await this.benefitsForLevel(p.levelId)
    return { progress: toVipProgressView(p, next), benefits }
  },

  /**
   * Resolve a single numeric benefit value for a user (e.g. cashback %, point
   * multiplier). Used by other engines (e.g. bonus cashback boost) — cached.
   */
  async benefitValue(userId: string, benefitKey: string): Promise<number | null> {
    const p = await prisma.vipProgress.findUnique({ where: { userId } })
    if (!p) return null
    const benefits = await this.benefitsForLevel(p.levelId)
    return benefits.find((b) => b.key === benefitKey)?.value ?? null
  },

  /** Admin: full VIP overview for a single player. */
  async adminOverview(userId: string) {
    const p = await prisma.vipProgress.findUnique({
      where: { userId },
      include: { level: true, user: { select: { username: true, email: true } } },
    })
    if (!p) throw AppError.notFound('Player has no VIP progress', 'VIP_NOT_FOUND')
    const next = await prisma.vipLevel.findFirst({
      where: { level: { gt: p.level.level } },
      orderBy: { level: 'asc' },
    })
    return {
      user: p.user.username,
      email: p.user.email,
      ...toVipProgressView(p, next),
      graceEndsAt: p.graceEndsAt?.toISOString() ?? null,
    }
  },

  /** Admin: force a user to a specific tier (resets grace). Audited via ledger. */
  async adminSetLevel(userId: string, level: number, actorId: string) {
    const target = await prisma.vipLevel.findUnique({ where: { level } })
    if (!target) throw AppError.notFound('Level not found', 'LEVEL_NOT_FOUND')
    await pointEngineService.ensureProgress(userId)
    const updated = await prisma.vipProgress.update({
      where: { userId },
      data: {
        levelId: target.id,
        graceEndsAt: null,
        pendingDowngradeLevelId: null,
        lastLevelUpAt: new Date(),
      },
    })
    await prisma.loyaltyPointTransaction.create({
      data: {
        userId,
        type: 'STATUS',
        source: 'MANUAL_ADJUST',
        amount: 0n,
        balanceAfter: updated.statusPoints,
        reference: `admin-setlevel:${userId}:${level}:${Date.now()}`,
        metadata: { actorId, level },
      },
    })
    return updated
  },
}
