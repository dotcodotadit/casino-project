import { randomBytes } from 'node:crypto'
import type { Provider, Game } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { config } from '../../lib/config.js'
import { AppError } from '../../lib/errors.js'
import type { IAggregatorProvider } from './aggregator.interface.js'

/**
 * Launch-session lifecycle. A session is the opaque handle that ties a player to
 * a provider game: we issue a random `token`, the provider echoes it on every
 * callback so we can resolve which user/wallet to debit/credit.
 */

const SESSION_TTL_MS = 60 * 60 * 1000 // 1h
const appOrigin = config.cors.origins[0] ?? 'http://localhost:5173'

export const sessionService = {
  /** Create a session + provider launch URL (called by the facade). */
  async create(params: {
    userId: string
    username: string
    provider: Provider
    game: Game
    adapter: IAggregatorProvider
    currency: string
    ip?: string
    lang?: string
  }) {
    const token = randomBytes(24).toString('base64url')
    const callbackUrl = `${config.publicBaseUrl}/api/aggregator/callback/${params.provider.code.toLowerCase()}`
    const returnUrl = `${appOrigin}/games`

    const { launchUrl } = await params.adapter.launchGame({
      userId: params.userId,
      username: params.username,
      gameExternalId: params.game.externalId,
      currency: params.currency,
      token,
      callbackUrl,
      returnUrl,
      lang: params.lang,
    })

    const session = await prisma.aggregatorSession.create({
      data: {
        userId: params.userId,
        providerId: params.provider.id,
        gameId: params.game.id,
        token,
        launchUrl,
        currency: params.currency,
        ipAddress: params.ip,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })

    return { sessionId: session.id, token, launchUrl }
  },

  /** Resolve an active session by its token (used by callbacks). Null if invalid/expired. */
  async getActiveByToken(token: string) {
    const session = await prisma.aggregatorSession.findUnique({
      where: { token },
      include: { provider: true, game: true, user: { select: { id: true, status: true } } },
    })
    if (!session) return null
    if (session.status !== 'ACTIVE' || session.expiresAt < new Date()) return null
    return session
  },

  async close(sessionId: string) {
    await prisma.aggregatorSession.update({
      where: { id: sessionId },
      data: { status: 'CLOSED', closedAt: new Date() },
    })
  },

  /** Sweep expired sessions (cron-friendly). */
  async expireStale() {
    const res = await prisma.aggregatorSession.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    })
    return res.count
  },

  /** List a user's sessions (admin/monitor). */
  async assertOwned(sessionId: string, userId: string) {
    const s = await prisma.aggregatorSession.findFirst({ where: { id: sessionId, userId } })
    if (!s) throw AppError.notFound('Session not found', 'SESSION_NOT_FOUND')
    return s
  },
}
