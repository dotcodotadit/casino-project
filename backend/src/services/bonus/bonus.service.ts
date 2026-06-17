import { Prisma } from '@prisma/client'
import type { BonusKind, BonusStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { AppError } from '../../lib/errors.js'
import { conditionsService } from './conditions.service.js'
import { bonusEngineService } from './bonus-engine.service.js'
import { wageringService } from './wagering.service.js'
import { freespinService } from './freespin.service.js'
import { toUserBonusView, type UserBonusView } from './bonus.types.js'

/**
 * Bonus facade — the API surface used by the controller. Player-facing reads +
 * claim/cancel, plus admin CRUD/analytics. Heavy lifting (granting, wagering)
 * lives in the engine/wagering services; this layer orchestrates and shapes
 * data for transport.
 */
export const bonusService = {
  // ── Player ──────────────────────────────────────────────────────────────

  /** Bonuses the player can claim now (MANUAL/CODE + eligible), with reasons. */
  async availableFor(userId: string) {
    const bonuses = await prisma.bonus.findMany({
      where: { status: 'ACTIVE', claimMode: { in: ['MANUAL', 'CODE'] } },
      orderBy: { priority: 'desc' },
      include: { conditions: true },
    })
    const results = []
    for (const bonus of bonuses) {
      const elig = await conditionsService.evaluate(bonus, { userId })
      results.push({
        id: bonus.id,
        name: bonus.name,
        description: bonus.description,
        kind: bonus.kind,
        rewardType: bonus.rewardType,
        claimMode: bonus.claimMode,
        requiresCode: bonus.claimMode === 'CODE',
        percentage: bonus.percentage,
        maxAmount: bonus.maxAmountMinor != null ? Number(bonus.maxAmountMinor) : null,
        minDeposit: bonus.minDepositMinor != null ? Number(bonus.minDepositMinor) : null,
        wagerMultiplier: bonus.wagerMultiplier,
        freeSpins: bonus.freeSpinCount ?? 0,
        eligible: elig.eligible,
        reasons: elig.reasons,
      })
    }
    return results
  },

  /** A player's bonuses (active + history). */
  async myBonuses(userId: string, status?: string): Promise<UserBonusView[]> {
    const rows = await prisma.userBonus.findMany({
      where: { userId, ...(status ? { status: status as Prisma.EnumUserBonusStatusFilter } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { bonus: true },
    })
    return rows.map(toUserBonusView)
  },

  /** Live wagering progress for the player's ACTIVE bonuses (for the UI bar). */
  async wageringProgress(userId: string) {
    const rows = await prisma.userBonus.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { activatedAt: 'asc' },
      include: { bonus: true },
    })
    return rows.map(toUserBonusView)
  },

  /** Manual/code claim from the promotions page. */
  async claim(userId: string, input: { bonusId?: string; code?: string; ipAddress?: string; deviceFingerprint?: string }) {
    let bonusId = input.bonusId
    if (!bonusId && input.code) {
      const byCode = await prisma.bonus.findUnique({ where: { code: input.code } })
      if (!byCode) throw AppError.notFound('Invalid promo code', 'BONUS_CODE_INVALID')
      bonusId = byCode.id
    }
    if (!bonusId) throw AppError.badRequest('bonusId or code required', 'BONUS_CLAIM_INPUT')

    const bonus = await prisma.bonus.findUnique({ where: { id: bonusId } })
    if (!bonus) throw AppError.notFound('Bonus not found', 'BONUS_NOT_FOUND')
    if (bonus.claimMode === 'AUTO') throw AppError.unprocessable('This bonus is granted automatically', 'BONUS_AUTO')

    // No-deposit/manual claims use a per-user grantKey so the claim is idempotent.
    const grantKey = `claim:${bonusId}:${userId}`
    const res = await bonusEngineService.grant(bonusId, {
      userId,
      grantKey,
      ipAddress: input.ipAddress,
      deviceFingerprint: input.deviceFingerprint,
    })
    return toUserBonusView(
      (await prisma.userBonus.findUnique({ where: { id: res.userBonus.id }, include: { bonus: true } }))!,
    )
  },

  /** Player cancels/forfeits one of their bonuses. */
  async cancel(userId: string, userBonusId: string) {
    const ub = await prisma.userBonus.findFirst({ where: { id: userBonusId, userId } })
    if (!ub) throw AppError.notFound('Bonus not found', 'USER_BONUS_NOT_FOUND')
    if (!['ACTIVE', 'PENDING'].includes(ub.status)) {
      throw AppError.unprocessable('Bonus cannot be cancelled', 'BONUS_NOT_CANCELLABLE')
    }
    await wageringService.forfeit(userBonusId, 'FORFEITED', 'player_cancelled')
    return { ok: true }
  },

  /** Player's free-spin packages. */
  freeSpins: (userId: string) => freespinService.list(userId),

  // ── Admin ───────────────────────────────────────────────────────────────

  async listBonuses(filter: { kind?: BonusKind; status?: BonusStatus } = {}) {
    const rows = await prisma.bonus.findMany({
      where: { ...(filter.kind ? { kind: filter.kind } : {}), ...(filter.status ? { status: filter.status } : {}) },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { userBonuses: true, conditions: true } } },
    })
    return rows.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      kind: b.kind,
      rewardType: b.rewardType,
      claimMode: b.claimMode,
      status: b.status,
      percentage: b.percentage,
      maxAmount: b.maxAmountMinor != null ? Number(b.maxAmountMinor) : null,
      wagerMultiplier: b.wagerMultiplier,
      priority: b.priority,
      claims: b._count.userBonuses,
      conditions: b._count.conditions,
      createdAt: b.createdAt.toISOString(),
    }))
  },

  async getBonus(id: string) {
    const b = await prisma.bonus.findUnique({ where: { id }, include: { conditions: true } })
    if (!b) throw AppError.notFound('Bonus not found', 'BONUS_NOT_FOUND')
    return b
  },

  async createBonus(data: Prisma.BonusCreateInput) {
    return prisma.bonus.create({ data })
  },

  async updateBonus(id: string, data: Prisma.BonusUpdateInput, actorId?: string) {
    const updated = await prisma.bonus.update({ where: { id }, data })
    await prisma.bonusAuditLog.create({
      data: { bonusId: id, actorId: actorId ?? 'admin', action: 'bonus.edit', metadata: { fields: Object.keys(data) } },
    })
    return updated
  },

  async setStatus(id: string, status: BonusStatus, actorId?: string) {
    const updated = await prisma.bonus.update({ where: { id }, data: { status } })
    await prisma.bonusAuditLog.create({
      data: { bonusId: id, actorId: actorId ?? 'admin', action: `bonus.${status.toLowerCase()}`, metadata: { status } },
    })
    return updated
  },

  /** Replace a bonus's condition set (used by the promotion builder). */
  async setConditions(
    bonusId: string,
    conditions: Array<{ type: Prisma.BonusConditionCreateInput['type']; operator?: string; value: string; params?: Prisma.InputJsonValue }>,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.bonusCondition.deleteMany({ where: { bonusId } })
      if (conditions.length) {
        await tx.bonusCondition.createMany({
          data: conditions.map((c) => ({
            bonusId,
            type: c.type,
            operator: c.operator ?? '==',
            value: c.value,
            params: c.params,
          })),
        })
      }
      return tx.bonusCondition.findMany({ where: { bonusId } })
    })
  },

  /** Admin: manually grant a bonus to a user. */
  async adminGrant(bonusId: string, userId: string, actorId: string, triggerAmountMinor?: number) {
    return bonusEngineService.grant(bonusId, {
      userId,
      triggerAmountMinor,
      grantKey: `admin:${bonusId}:${userId}:${Date.now()}`,
      actorId,
    })
  },

  /** Admin: cancel a user's bonus. */
  async adminCancel(userBonusId: string, reason: string) {
    await wageringService.forfeit(userBonusId, 'CANCELLED', reason)
    return { ok: true }
  },

  /** Paginated claim history (admin report). */
  async claimHistory(opts: { page: number; pageSize: number; status?: string; bonusId?: string }) {
    const where = {
      ...(opts.status ? { status: opts.status as Prisma.EnumUserBonusStatusFilter } : {}),
      ...(opts.bonusId ? { bonusId: opts.bonusId } : {}),
    }
    const [total, rows] = await prisma.$transaction([
      prisma.userBonus.count({ where }),
      prisma.userBonus.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
        include: { bonus: { select: { name: true, kind: true } }, user: { select: { username: true, email: true } } },
      }),
    ])
    return {
      items: rows.map((r) => ({
        id: r.id,
        user: r.user.username,
        email: r.user.email,
        bonus: r.bonus.name,
        kind: r.bonus.kind,
        status: r.status,
        granted: Number(r.grantedAmountMinor),
        wagerRequired: Number(r.wagerRequiredMinor),
        wagerProgress: Number(r.wagerProgressMinor),
        released: Number(r.releasedAmountMinor),
        createdAt: r.createdAt.toISOString(),
      })),
      page: opts.page,
      pageSize: opts.pageSize,
      total,
      totalPages: Math.ceil(total / opts.pageSize),
    }
  },

  /** Aggregate analytics across bonuses (admin dashboard). */
  async analytics() {
    const [byStatus, byKind, totals, flags] = await Promise.all([
      prisma.userBonus.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      prisma.bonus.groupBy({ by: ['kind'], _count: { _all: true }, orderBy: { kind: 'asc' } }),
      prisma.userBonus.aggregate({
        _sum: { grantedAmountMinor: true, releasedAmountMinor: true, wagerProgressMinor: true },
      }),
      prisma.bonusAbuseFlag.count({ where: { resolved: false } }),
    ])
    const granted = Number(totals._sum.grantedAmountMinor ?? 0n)
    const released = Number(totals._sum.releasedAmountMinor ?? 0n)
    return {
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      byKind: byKind.map((k) => ({ kind: k.kind, count: k._count._all })),
      totalGranted: granted,
      totalReleased: released,
      // Cost-to-release ratio (how much locked bonus actually converts).
      conversionRate: granted > 0 ? Number((released / granted).toFixed(3)) : 0,
      openAbuseFlags: flags,
    }
  },

  async abuseFlags(resolved = false) {
    const rows = await prisma.bonusAbuseFlag.findMany({
      where: { resolved },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { username: true, email: true } } },
    })
    return rows.map((f) => ({
      id: f.id,
      user: f.user.username,
      email: f.user.email,
      reason: f.reason,
      severity: f.severity,
      details: f.details,
      resolved: f.resolved,
      createdAt: f.createdAt.toISOString(),
    }))
  },

  async resolveAbuseFlag(id: string) {
    return prisma.bonusAbuseFlag.update({ where: { id }, data: { resolved: true } })
  },

  // ── Promotions ──
  async listPromotions(publicOnly = false) {
    return prisma.promotion.findMany({
      where: publicOnly ? { status: 'ACTIVE' } : {},
      orderBy: { sortOrder: 'asc' },
      include: { bonus: { select: { id: true, name: true, kind: true } } },
    })
  },

  async upsertPromotion(data: Prisma.PromotionUncheckedCreateInput & { id?: string }) {
    const { id, ...rest } = data
    if (id) return prisma.promotion.update({ where: { id }, data: rest })
    return prisma.promotion.create({ data: rest })
  },
}
