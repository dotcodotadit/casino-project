import type { PrismaClient } from '@prisma/client'

/**
 * Seed the Loyalty & VIP program: 8 tiers (Bronze → Grand Master), a set of
 * reusable benefits with per-tier values, starter missions (daily/weekly/
 * monthly/achievement), VIP-shop items, and the default hot-reloadable settings.
 * Idempotent via upserts on natural keys (level/name/key/sku).
 */
export async function seedLoyalty(prisma: PrismaClient): Promise<void> {
  // ── 8 VIP tiers ──
  const TIERS = [
    { level: 0, name: 'Bronze', color: '#cd7f32', requiredPoints: 0n, keepPoints: 0n, pointMultiplier: 1.0, cashbackPct: 0, weeklyBonusMinor: 0n },
    { level: 1, name: 'Silver', color: '#c0c0c0', requiredPoints: 1_000n, keepPoints: 500n, pointMultiplier: 1.1, cashbackPct: 3, weeklyBonusMinor: 0n },
    { level: 2, name: 'Gold', color: '#ffd700', requiredPoints: 5_000n, keepPoints: 2_500n, pointMultiplier: 1.25, cashbackPct: 5, weeklyBonusMinor: 10_00n },
    { level: 3, name: 'Platinum', color: '#e5e4e2', requiredPoints: 20_000n, keepPoints: 10_000n, pointMultiplier: 1.5, cashbackPct: 7, weeklyBonusMinor: 25_00n },
    { level: 4, name: 'Diamond', color: '#b9f2ff', requiredPoints: 60_000n, keepPoints: 30_000n, pointMultiplier: 1.75, cashbackPct: 10, weeklyBonusMinor: 50_00n },
    { level: 5, name: 'Elite', color: '#9b59b6', requiredPoints: 150_000n, keepPoints: 80_000n, pointMultiplier: 2.0, cashbackPct: 12, weeklyBonusMinor: 100_00n },
    { level: 6, name: 'Legend', color: '#e74c3c', requiredPoints: 400_000n, keepPoints: 220_000n, pointMultiplier: 2.5, cashbackPct: 15, weeklyBonusMinor: 250_00n },
    { level: 7, name: 'Grand Master', color: '#f1c40f', requiredPoints: 1_000_000n, keepPoints: 600_000n, pointMultiplier: 3.0, cashbackPct: 20, weeklyBonusMinor: 500_00n },
  ]
  const levels = []
  for (const t of TIERS) {
    levels.push(
      await prisma.vipLevel.upsert({ where: { level: t.level }, update: {}, create: t }),
    )
  }

  // ── Reusable benefit definitions ──
  const BENEFITS = [
    { key: 'cashback', name: 'Weekly Cashback', type: 'CASHBACK_PCT' as const, unit: '%' },
    { key: 'bonus_boost', name: 'Bonus Boost', type: 'BONUS_BOOST_PCT' as const, unit: '%' },
    { key: 'withdraw_limit', name: 'Daily Withdrawal Limit', type: 'WITHDRAWAL_LIMIT' as const, unit: 'USD' },
    { key: 'withdraw_speed', name: 'Withdrawal Processing', type: 'WITHDRAWAL_SPEED' as const, unit: 'hours' },
    { key: 'point_multiplier', name: 'Point Multiplier', type: 'POINT_MULTIPLIER' as const, unit: '×' },
    { key: 'manager', name: 'Dedicated VIP Manager', type: 'DEDICATED_MANAGER' as const, unit: 'bool' },
    { key: 'birthday', name: 'Birthday Gift', type: 'BIRTHDAY_GIFT' as const, unit: 'USD' },
  ]
  const benefits: Record<string, { id: string }> = {}
  for (const b of BENEFITS) {
    benefits[b.key] = await prisma.vipBenefit.upsert({
      where: { key: b.key }, update: {}, create: b,
    })
  }

  // Per-tier benefit values (index aligned with TIERS by level).
  const cashbackByLevel = [0, 3, 5, 7, 10, 12, 15, 20]
  const boostByLevel = [0, 5, 10, 15, 20, 25, 35, 50]
  const withdrawLimitByLevel = [500_00, 1_000_00, 2_500_00, 5_000_00, 10_000_00, 25_000_00, 50_000_00, 100_000_00]
  const withdrawSpeedByLevel = [48, 36, 24, 12, 6, 3, 1, 1]
  const birthdayByLevel = [0, 5_00, 10_00, 25_00, 50_00, 100_00, 250_00, 500_00]

  for (const lvl of levels) {
    const i = lvl.level
    const set = async (benefitId: string, value: number, valueMinor?: bigint, enabled = true) => {
      await prisma.vipTierBenefit.upsert({
        where: { levelId_benefitId: { levelId: lvl.id, benefitId } },
        update: { value, valueMinor: valueMinor ?? null, enabled },
        create: { levelId: lvl.id, benefitId, value, valueMinor: valueMinor ?? null, enabled },
      })
    }
    await set(benefits.cashback.id, cashbackByLevel[i])
    await set(benefits.bonus_boost.id, boostByLevel[i])
    await set(benefits.withdraw_limit.id, 0, BigInt(withdrawLimitByLevel[i]))
    await set(benefits.withdraw_speed.id, withdrawSpeedByLevel[i])
    await set(benefits.point_multiplier.id, lvl.pointMultiplier)
    await set(benefits.manager.id, i >= 4 ? 1 : 0, undefined, i >= 4)
    await set(benefits.birthday.id, 0, BigInt(birthdayByLevel[i]), birthdayByLevel[i] > 0)
  }

  // ── Starter missions ──
  const MISSIONS = [
    { key: 'daily-bets', name: 'Daily Grind', description: 'Place 20 bets today', type: 'DAILY' as const, metric: 'BET_COUNT' as const, target: 20n, rewardPoints: 100n, rewardStatusPoints: 100n, sortOrder: 1 },
    { key: 'daily-slots', name: 'Slot Lover', description: 'Play 50 slot rounds today', type: 'DAILY' as const, metric: 'GAME_CATEGORY_BETS' as const, target: 50n, rewardPoints: 150n, rewardStatusPoints: 150n, sortOrder: 2, params: { category: 'SLOTS' } },
    { key: 'weekly-wager', name: 'High Roller', description: 'Wager $1,000 this week', type: 'WEEKLY' as const, metric: 'BET_AMOUNT' as const, target: 100_000n, rewardPoints: 1_000n, rewardStatusPoints: 1_000n, sortOrder: 1 },
    { key: 'monthly-deposit', name: 'Big Spender', description: 'Deposit $2,000 this month', type: 'MONTHLY' as const, metric: 'DEPOSIT_AMOUNT' as const, target: 200_000n, rewardPoints: 5_000n, rewardStatusPoints: 5_000n, sortOrder: 1 },
    { key: 'ach-first-deposit', name: 'Welcome Aboard', description: 'Make your first deposit', type: 'ACHIEVEMENT' as const, metric: 'DEPOSIT_AMOUNT' as const, target: 1n, rewardPoints: 500n, rewardStatusPoints: 250n, sortOrder: 1 },
    { key: 'ach-big-win', name: 'Lucky Streak', description: 'Land a 50× win', type: 'ACHIEVEMENT' as const, metric: 'WIN_AMOUNT' as const, target: 1n, rewardPoints: 1_000n, rewardStatusPoints: 500n, sortOrder: 2 },
  ]
  for (const m of MISSIONS) {
    const { params, ...rest } = m as typeof m & { params?: object }
    await prisma.mission.upsert({
      where: { key: m.key },
      update: {},
      create: { ...rest, status: 'ACTIVE', ...(params ? { params } : {}) },
    })
  }

  // ── VIP shop items ──
  const ITEMS = [
    { sku: 'FS10', name: '10 Free Spins', description: 'On selected slots', type: 'FREE_SPINS' as const, costPoints: 500n, payload: { spins: 10, spinValueMinor: 20 }, valueMinor: null as bigint | null, stock: null as number | null, minLevel: 0, sortOrder: 1 },
    { sku: 'FS50', name: '50 Free Spins', description: 'On selected slots', type: 'FREE_SPINS' as const, costPoints: 2_000n, payload: { spins: 50, spinValueMinor: 20 }, valueMinor: null, stock: null, minLevel: 1, sortOrder: 2 },
    { sku: 'BM5', name: '$5 Bonus Money', description: 'Instant bonus credit', type: 'BONUS_MONEY' as const, costPoints: 1_000n, payload: {}, valueMinor: 5_00n, stock: null, minLevel: 1, sortOrder: 3 },
    { sku: 'BM25', name: '$25 Bonus Money', description: 'Instant bonus credit', type: 'BONUS_MONEY' as const, costPoints: 4_500n, payload: {}, valueMinor: 25_00n, stock: null, minLevel: 2, sortOrder: 4 },
    { sku: 'HEADSET', name: 'Gaming Headset', description: 'Premium VIP merchandise', type: 'PHYSICAL' as const, costPoints: 50_000n, payload: {}, valueMinor: null, stock: 10, minLevel: 4, sortOrder: 5 },
    { sku: 'IPHONE', name: 'Latest iPhone', description: 'Grand Master exclusive', type: 'PHYSICAL' as const, costPoints: 500_000n, payload: {}, valueMinor: null, stock: 3, minLevel: 7, sortOrder: 6 },
  ]
  for (const it of ITEMS) {
    await prisma.vipShopItem.upsert({
      where: { sku: it.sku },
      update: {},
      create: { ...it, enabled: true },
    })
  }

  // ── Default hot-reloadable settings ──
  const SETTINGS: Array<{ key: string; value: object }> = [
    { key: 'points', value: { loyaltyPerStakeMinor: 0.01, statusPerStakeMinor: 0.01, loyaltyPerDepositMinor: 0.05, statusPerDepositMinor: 0.05, categoryWeights: { SLOTS: 1, TABLE: 0.5, LIVE: 0.5, CRASH: 1, FISHING: 1, LOTTERY: 1, OTHER: 0.5 } } },
    { key: 'downgrade', value: { enabled: true, graceDays: 7, reviewPeriodDays: 30 } },
    { key: 'winBig', value: { multiplier: 50, absMinor: 100_00, bonusStatusPoints: 50 } },
  ]
  for (const s of SETTINGS) {
    await prisma.loyaltySetting.upsert({ where: { key: s.key }, update: {}, create: s })
  }

  console.log('Loyalty seed complete:', { tiers: levels.length, missions: MISSIONS.length, shopItems: ITEMS.length })
}
