import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { Prisma, type User, WalletType, Currency } from '@prisma/client'
import { prisma } from './lib/prisma.js'
import { config } from './lib/config.js'
import { logger } from './lib/logger.js'
import { AppError } from './lib/errors.js'
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  deviceFingerprint,
  refreshExpiry,
} from './lib/tokens.js'
import type { RegisterInput, LoginInput, AuthResult, PublicUser, RequestContext } from './types.js'

function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    username: u.username,
    role: u.role,
    emailVerified: u.emailVerified,
    phoneVerified: u.phoneVerified,
    kycLevel: u.kycLevel,
    createdAt: u.createdAt.toISOString(),
  }
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

// A VALID bcrypt hash (cost 12) used as a decoy when the user is missing, so the
// timing of a failed login matches a real password comparison (anti-enumeration).
// A malformed hash would make bcrypt.compare return instantly, leaking timing.
const DUMMY_BCRYPT_HASH = '$2a$12$9XlN.csrK6WL7TZrCSINx.w7PIp/yBwZqy5elTaXngqXP4FaKOiW6'

export const authService = {
  /** Register a new user, create default wallets, and issue tokens. */
  async register(input: RegisterInput, ctx: RequestContext): Promise<{ result: AuthResult; refreshToken: string }> {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { phone: input.phone }, { username: input.username }] },
      select: { email: true, phone: true, username: true },
    })
    if (existing) {
      // Generic message — don't reveal which field collided beyond category.
      if (existing.email === input.email) throw AppError.conflict('Email already in use', 'EMAIL_TAKEN')
      if (existing.phone === input.phone) throw AppError.conflict('Phone already in use', 'PHONE_TAKEN')
      throw AppError.conflict('Username already taken', 'USERNAME_TAKEN')
    }

    const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds)

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          phone: input.phone,
          username: input.username,
          passwordHash,
        },
      })
      // Provision default wallets (main + bonus USD, crypto USDT).
      await tx.wallet.createMany({
        data: [
          { userId: created.id, type: WalletType.MAIN, currency: Currency.USD },
          { userId: created.id, type: WalletType.BONUS, currency: Currency.USD },
          { userId: created.id, type: WalletType.CRYPTO, currency: Currency.USDT },
        ],
      })
      await tx.auditLog.create({
        data: { userId: created.id, action: 'auth.register', ipAddress: ctx.ip },
      })
      return created
    })

    const { result, refreshToken } = await this.issueSession(user, ctx)
    logger.info({ userId: user.id }, 'user registered')
    return { result, refreshToken }
  },

  /** Login with email OR phone. */
  async login(input: LoginInput, ctx: RequestContext): Promise<{ result: AuthResult; refreshToken: string }> {
    const where = isEmail(input.identifier)
      ? { email: input.identifier.toLowerCase() }
      : { phone: input.identifier }

    const user = await prisma.user.findUnique({ where })

    // Constant-ish work even when user missing, to reduce enumeration timing signal.
    const hash = user?.passwordHash ?? DUMMY_BCRYPT_HASH
    const ok = await bcrypt.compare(input.password, hash)

    if (!user || !ok) {
      throw AppError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS')
    }
    if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
      throw AppError.forbidden('Account is not active', 'ACCOUNT_INACTIVE')
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    await prisma.auditLog.create({ data: { userId: user.id, action: 'auth.login', ipAddress: ctx.ip } })

    return this.issueSession(user, ctx)
  },

  /** Create a refresh-token session (new rotation family) + access token. */
  async issueSession(
    user: User,
    ctx: RequestContext,
    familyId = randomUUID(),
  ): Promise<{ result: AuthResult; refreshToken: string }> {
    const { token, hash } = generateRefreshToken()

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hash,
        familyId,
        deviceFingerprint: deviceFingerprint(ctx.userAgent, ctx.ip, ctx.acceptLanguage),
        userAgent: ctx.userAgent.slice(0, 256),
        ipAddress: ctx.ip,
        expiresAt: refreshExpiry(),
      },
    })

    const accessToken = signAccessToken({ sub: user.id, role: user.role, username: user.username })

    return {
      result: { user: toPublicUser(user), tokens: { accessToken } },
      refreshToken: token,
    }
  },

  /**
   * Rotate a refresh token.
   * - Valid, unrevoked token  -> issue new token in same family, revoke old.
   * - Revoked token reused    -> BREACH: revoke entire family, force re-login.
   */
  async refresh(
    rawToken: string,
    ctx: RequestContext,
  ): Promise<{ result: AuthResult; refreshToken: string }> {
    const tokenHash = hashToken(rawToken)
    const session = await prisma.session.findUnique({ where: { refreshTokenHash: tokenHash } })

    if (!session) throw AppError.unauthorized('Invalid session', 'SESSION_INVALID')

    // Reuse detection: a revoked token being presented = token theft.
    if (session.revokedAt) {
      await prisma.session.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      logger.warn({ userId: session.userId, familyId: session.familyId }, 'refresh token reuse detected — family revoked')
      throw AppError.unauthorized('Session reuse detected — please log in again', 'SESSION_REUSE')
    }

    if (session.expiresAt < new Date()) {
      throw AppError.unauthorized('Session expired', 'SESSION_EXPIRED')
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } })
    if (!user || user.status !== 'ACTIVE') {
      throw AppError.unauthorized('Account unavailable', 'ACCOUNT_UNAVAILABLE')
    }

    // Rotate: create successor in same family, mark old as revoked+replaced.
    const { token, hash } = generateRefreshToken()
    const successor = await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hash,
        familyId: session.familyId,
        deviceFingerprint: session.deviceFingerprint,
        userAgent: ctx.userAgent.slice(0, 256),
        ipAddress: ctx.ip,
        expiresAt: refreshExpiry(),
      },
    })
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), replacedById: successor.id },
    })

    const accessToken = signAccessToken({ sub: user.id, role: user.role, username: user.username })
    return {
      result: { user: toPublicUser(user), tokens: { accessToken } },
      refreshToken: token,
    }
  },

  /** Revoke the presented refresh token (and optionally the whole family). */
  async logout(rawToken: string | undefined, allDevices = false): Promise<void> {
    if (!rawToken) return
    const session = await prisma.session.findUnique({ where: { refreshTokenHash: hashToken(rawToken) } })
    if (!session) return

    if (allDevices) {
      await prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    } else {
      await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
    }
  },

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw AppError.notFound('User not found', 'USER_NOT_FOUND')
    return toPublicUser(user)
  },
}

// Surface unique-constraint races as clean conflicts.
export function mapPrismaError(err: unknown): AppError | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return AppError.conflict('Resource already exists', 'UNIQUE_VIOLATION')
  }
  return null
}
