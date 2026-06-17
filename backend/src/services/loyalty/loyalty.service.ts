import { Prisma, LoyaltyPointSource, type MissionStatus, type MissionType } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { bonusBus } from '../../events/bonus.events.js'
import { pointEngineService } from './point-engine.service.js'
import { levelUpService } from './level-up.service.js'
import { missionService } from './mission.service.js'
import { loyaltyAbuseService } from './abuse.service.js'
import { loyaltySettings } from './loyalty.settings.js'

/**
 * Loyalty facade — orchestrates the event-driven accrual flow and exposes admin
 * CRUD/analytics. Keeps trigger glue in one place: a settled bet/deposit/win
 * earns points (point-engine), advances missions (mission-service), and may
 * trigger a level-up (level-up-service).
 */
export const loyaltyService = {
  /** Current tier point multiplier for a user (defaults to 1). */
  async tierMultiplier(userId: string): Promise<number> {
    const p = await prisma.vipProgress.findUnique({ where: { userId }, include: { level: true } })
    return p?.level.pointMultiplier ?? 1
  },

  /**
   * Handle a settled bet: accrue weighted points, advance missions, detect a big
   * win, re-evaluate tier. Idempotent via the round reference.
   */
  async handleBet(ev: {
    userId: string
    stakeMinor: number
    payoutMinor: number
    gameCategory?: string
    sourceRef: string
  }): Promise<void> {
    const category = ev.gameCategory ?? 'SLOTS'
    const multiplier = await this.tierMultiplier(ev.userId)
    const pts = await pointEngineService.computeBetPoints(ev.stakeMinor, category, multiplier)

    const earned = await pointEngineService.earn({
      userId: ev.userId,
      loyaltyPoints: pts.loyaltyPoints,
      statusPoints: pts.statusPoints,
      source: LoyaltyPointSource.BET,
      reference: `bet:${ev.sourceRef}`,
      metadata: { category, stakeMinor: ev.stakeMinor },
    })

    // Missions: bet count/amount + category + points.
    await missionService.advanceForEvent(ev.userId, {
      kind: 'bet',
      amountMinor: ev.stakeMinor,
      gameCategory: category,
    })

    // Big-win detection (bonus status points + event for UI celebration).
    if (ev.payoutMinor > 0 && ev.stakeMinor > 0) {
      const cfg = await loyaltySettings.winBigConfig()
      const mult = ev.payoutMinor / ev.stakeMinor
      if (mult >= cfg.multiplier || ev.payoutMinor >= cfg.absMinor) {
        await pointEngineService.earn({
          userId: ev.userId,
          loyaltyPoints: 0,
          statusPoints: cfg.bonusStatusPoints,
          source: LoyaltyPointSource.WIN_BIG,
          reference: `winbig:${ev.sourceRef}`,
          metadata: { multiplier: Number(mult.toFixed(2)) },
        })
        await missionService.advanceForEvent(ev.userId, { kind: 'win', payoutMinor: ev.payoutMinor })
        bonusBus.publish('win.big', {
          userId: ev.userId,
          payoutMinor: ev.payoutMinor,
          multiplier: Number(mult.toFixed(2)),
          sourceRef: ev.sourceRef,
        })
      }
    }

    if (earned.applied) {
      await missionService.advanceForEvent(ev.userId, { kind: 'points', points: pts.statusPoints })
      await levelUpService.evaluate(ev.userId)
      void loyaltyAbuseService.checkVelocity(ev.userId)
    }
  },

  /** Handle a completed deposit: accrue points + advance deposit missions. */
  async handleDeposit(ev: { userId: string; amountMinor: number; transactionId: string }): Promise<void> {
    const multiplier = await this.tierMultiplier(ev.userId)
    const pts = await pointEngineService.computeDepositPoints(ev.amountMinor, multiplier)
    const earned = await pointEngineService.earn({
      userId: ev.userId,
      loyaltyPoints: pts.loyaltyPoints,
      statusPoints: pts.statusPoints,
      source: LoyaltyPointSource.DEPOSIT,
      reference: `deposit:${ev.transactionId}`,
      metadata: { amountMinor: ev.amountMinor },
    })
    await missionService.advanceForEvent(ev.userId, { kind: 'deposit', amountMinor: ev.amountMinor })
    if (earned.applied) await levelUpService.evaluate(ev.userId)
  },

  // ── Admin: VIP level CRUD ──
  async createLevel(data: Prisma.VipLevelCreateInput) {
    const level = await prisma.vipLevel.create({ data })
    await loyaltySettings.invalidateBenefits(level.id)
    return level
  },
  async updateLevel(id: string, data: Prisma.VipLevelUpdateInput) {
    const level = await prisma.vipLevel.update({ where: { id }, data })
    await loyaltySettings.invalidateBenefits(id)
    return level
  },
  async deleteLevel(id: string) {
    await loyaltySettings.invalidateBenefits(id)
    return prisma.vipLevel.delete({ where: { id } })
  },

  // ── Admin: benefits ──
  async listBenefits() {
    return prisma.vipBenefit.findMany({ orderBy: { createdAt: 'asc' } })
  },
  async upsertBenefit(data: Prisma.VipBenefitUncheckedCreateInput & { id?: string }) {
    const { id, ...rest } = data
    if (id) return prisma.vipBenefit.update({ where: { id }, data: rest })
    return prisma.vipBenefit.create({ data: rest })
  },
  async setTierBenefit(levelId: string, benefitId: string, value: number, valueMinor?: number, enabled = true) {
    const result = await prisma.vipTierBenefit.upsert({
      where: { levelId_benefitId: { levelId, benefitId } },
      update: { value, valueMinor: valueMinor != null ? BigInt(valueMinor) : null, enabled },
      create: { levelId, benefitId, value, valueMinor: valueMinor != null ? BigInt(valueMinor) : null, enabled },
    })
    await loyaltySettings.invalidateBenefits(levelId)
    return result
  },

  // ── Admin: missions ──
  async listMissions(filter: { type?: MissionType; status?: MissionStatus } = {}) {
    return prisma.mission.findMany({
      where: { ...(filter.type ? { type: filter.type } : {}), ...(filter.status ? { status: filter.status } : {}) },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
      include: { _count: { select: { userMissions: true } } },
    })
  },
  async upsertMission(data: Prisma.MissionUncheckedCreateInput & { id?: string }) {
    const { id, ...rest } = data
    if (id) return prisma.mission.update({ where: { id }, data: rest })
    return prisma.mission.create({ data: rest })
  },

  // ── Admin: settings (hot reload) ──
  async getSettings() {
    return {
      points: await loyaltySettings.pointConfig(),
      abuse: await loyaltySettings.abuseConfig(),
      downgrade: await loyaltySettings.downgradeConfig(),
      winBig: await loyaltySettings.winBigConfig(),
    }
  },
  async setSetting(key: string, value: Prisma.InputJsonValue) {
    const saved = await prisma.loyaltySetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
    loyaltySettings.invalidate(key)
    return saved
  },

  // ── Admin: analytics ──
  async analytics() {
    const [issued, spent, byLevel, redemptions] = await Promise.all([
      prisma.loyaltyPointTransaction.aggregate({
        where: { type: 'LOYALTY', amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      prisma.loyaltyPointTransaction.aggregate({
        where: { type: 'LOYALTY', amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      prisma.vipProgress.groupBy({ by: ['levelId'], _count: { _all: true }, orderBy: { levelId: 'asc' } }),
      prisma.redemptionHistory.count(),
    ])
    const levels = await prisma.vipLevel.findMany({ orderBy: { level: 'asc' } })
    const levelMap = new Map(levels.map((l) => [l.id, l]))
    const totalIssued = Number(issued._sum.amount ?? 0n)
    const totalSpent = -Number(spent._sum.amount ?? 0n)
    return {
      totalPointsIssued: totalIssued,
      totalPointsRedeemed: totalSpent,
      redemptionRate: totalIssued > 0 ? Number((totalSpent / totalIssued).toFixed(3)) : 0,
      totalRedemptions: redemptions,
      levelDistribution: byLevel
        .map((g) => ({
          level: levelMap.get(g.levelId)?.level ?? 0,
          name: levelMap.get(g.levelId)?.name ?? '—',
          players: g._count._all,
        }))
        .sort((a, b) => a.level - b.level),
    }
  },

  async adminRedemptions(opts: { page: number; pageSize: number; status?: string }) {
    const where = opts.status ? { status: opts.status as Prisma.EnumRedemptionStatusFilter } : {}
    const [total, rows] = await prisma.$transaction([
      prisma.redemptionHistory.count({ where }),
      prisma.redemptionHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
        include: { item: { select: { name: true, type: true } }, user: { select: { username: true } } },
      }),
    ])
    return {
      items: rows.map((r) => ({
        id: r.id,
        user: r.user.username,
        item: r.item.name,
        type: r.item.type,
        costPoints: Number(r.costPoints),
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page: opts.page,
      pageSize: opts.pageSize,
      totalPages: Math.ceil(total / opts.pageSize),
    }
  },

  async fulfilRedemption(id: string) {
    return prisma.redemptionHistory.update({ where: { id }, data: { status: 'FULFILLED' } })
  },
}
