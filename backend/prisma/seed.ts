import { PrismaClient, WalletType, Currency, KycLevel } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { seedLoyalty } from './seed.loyalty.js'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding…')

  // Admin user
  const adminPassword = await bcrypt.hash('Admin@12345', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@royalcasino.dev' },
    update: {},
    create: {
      email: 'admin@royalcasino.dev',
      username: 'admin',
      phone: '+10000000000',
      passwordHash: adminPassword,
      role: 'ADMIN',
      emailVerified: true,
      phoneVerified: true,
      kycLevel: KycLevel.FULL,
    },
  })

  // Demo player with funded main wallet
  const playerPassword = await bcrypt.hash('Player@12345', 12)
  const player = await prisma.user.upsert({
    where: { email: 'player@royalcasino.dev' },
    update: {},
    create: {
      email: 'player@royalcasino.dev',
      username: 'demoplayer',
      phone: '+10000000001',
      passwordHash: playerPassword,
      role: 'PLAYER',
      emailVerified: true,
      phoneVerified: true,
      kycLevel: KycLevel.BASIC,
    },
  })

  // Wallets for the player
  for (const [type, currency, balance] of [
    [WalletType.MAIN, Currency.USD, 1_000_00n],
    [WalletType.BONUS, Currency.USD, 50_00n],
    [WalletType.CRYPTO, Currency.USDT, 0n],
  ] as const) {
    await prisma.wallet.upsert({
      where: { userId_type_currency: { userId: player.id, type, currency } },
      update: {},
      create: { userId: player.id, type, currency, balance },
    })
  }

  // Initial active server seed for provably-fair
  const seed = randomBytes(32).toString('hex')
  const seedHash = createHash('sha256').update(seed).digest('hex')
  await prisma.serverSeed.upsert({
    where: { seedHash },
    update: {},
    create: { seed, seedHash, active: true },
  })

  // ── Bonus engine: demo bonus templates + a promotion ──
  const welcome = await prisma.bonus.upsert({
    where: { code: 'WELCOME100' },
    update: {},
    create: {
      code: 'WELCOME100',
      name: 'Welcome 100% up to $500 + 50 Free Spins',
      description: 'Match your first deposit 100% up to $500, plus 50 free spins.',
      kind: 'WELCOME',
      rewardType: 'PERCENTAGE',
      claimMode: 'AUTO',
      status: 'ACTIVE',
      percentage: 1.0,
      maxAmountMinor: 500_00n,
      minDepositMinor: 20_00n,
      freeSpinCount: 50,
      freeSpinValueMinor: 20n,
      wagerMultiplier: 35,
      wagerIncludesDeposit: false,
      maxBetMinor: 5_00n,
      expiryHours: 168,
      priority: 100,
      conditions: { create: [{ type: 'FIRST_DEPOSIT_ONLY', operator: '==', value: 'true' }] },
    },
  })

  await prisma.bonus.upsert({
    where: { code: 'RELOAD50' },
    update: {},
    create: {
      code: 'RELOAD50',
      name: 'Weekend Reload 50%',
      description: 'Top up on weekends and get a 50% reload bonus up to $200.',
      kind: 'RELOAD',
      rewardType: 'PERCENTAGE',
      claimMode: 'AUTO',
      status: 'ACTIVE',
      percentage: 0.5,
      maxAmountMinor: 200_00n,
      minDepositMinor: 20_00n,
      wagerMultiplier: 25,
      maxBetMinor: 5_00n,
      expiryHours: 72,
      priority: 50,
    },
  })

  await prisma.bonus.upsert({
    where: { code: 'CASHBACK10' },
    update: {},
    create: {
      code: 'CASHBACK10',
      name: 'Daily 10% Cashback',
      description: 'Get 10% of your net daily losses back — instantly withdrawable.',
      kind: 'CASHBACK',
      rewardType: 'PERCENTAGE',
      claimMode: 'AUTO',
      status: 'ACTIVE',
      percentage: 0.1,
      maxAmountMinor: 100_00n,
      cashbackBasis: 'NET_LOSS',
      cashbackPeriodHours: 24,
      wagerMultiplier: 0,
      expiryHours: 168,
      priority: 40,
    },
  })

  await prisma.bonus.upsert({
    where: { code: 'FREESPINS50' },
    update: {},
    create: {
      code: 'FREESPINS50',
      name: '50 Free Spins (No Deposit)',
      description: 'Enter the code for 50 free spins — no deposit required.',
      kind: 'FREE_SPIN',
      rewardType: 'FREE_SPINS',
      claimMode: 'CODE',
      status: 'ACTIVE',
      freeSpinCount: 50,
      freeSpinValueMinor: 20n,
      maxAmountMinor: 50_00n,
      wagerMultiplier: 20,
      maxBetMinor: 2_00n,
      expiryHours: 72,
      priority: 10,
      conditions: { create: [{ type: 'NEW_USERS_ONLY', operator: '==', value: 'true' }] },
    },
  })

  await prisma.promotion.upsert({
    where: { slug: 'welcome-package' },
    update: {},
    create: {
      slug: 'welcome-package',
      title: 'Royal Welcome Package',
      subtitle: '100% up to $500 + 50 Free Spins',
      description: 'Kick off your journey with a full deposit match and free spins on top slots.',
      status: 'ACTIVE',
      sortOrder: 1,
      bonusId: welcome.id,
    },
  })

  // Loyalty & VIP program (tiers, benefits, missions, shop, settings).
  await seedLoyalty(prisma)

  console.log('Seed complete:', { admin: admin.email, player: player.email })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
