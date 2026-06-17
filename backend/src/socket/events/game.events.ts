import type { AuthedSocket } from '../../services/socket.service.js'
import { getIO, userRoom } from '../../services/socket.service.js'
import { logger } from '../../lib/logger.js'

/**
 * Game-related socket events. The game engine (built in the previous phase)
 * resolves rounds over HTTP; this module pushes live round results / notices
 * to the player's room so the UI can react in real time.
 */
export function registerGameEvents(socket: AuthedSocket): void {
  const userId = socket.user!.sub

  // Client subscribes to a specific game feed (e.g. live multiplier in crash-style games).
  socket.on('game:watch', (payload: { game?: string }) => {
    logger.debug({ userId, game: payload?.game }, 'game:watch')
    socket.emit('game:watching', { game: payload?.game ?? null })
  })
}

/** Server-side helper: push a resolved bet result to a user. */
export function emitBetResult(userId: string, result: unknown): void {
  getIO().to(userRoom(userId)).emit('game:result', result)
}

/**
 * Push a resolved bet AND the new balance in one shot. Called by game
 * controllers after a bet settles so the UI updates the reel/table and the
 * wallet header simultaneously. Wrapped in try/catch — a socket failure must
 * never roll back a settled bet.
 */
export function emitGameResolved(
  userId: string,
  payload: { game: string; betId: string; payout: number; balanceAfter: number; outcome?: unknown },
): void {
  try {
    const io = getIO()
    io.to(userRoom(userId)).emit('game:result', payload)
    io.to(userRoom(userId)).emit('balance:update', {
      walletType: 'MAIN',
      currency: 'USD',
      balance: payload.balanceAfter,
      delta: 0,
      txId: payload.betId,
    })
  } catch {
    /* socket not ready / user offline — non-fatal */
  }
}

/** Server-side helper: push a generic notification to a user. */
export function emitNotification(userId: string, notification: { type: string; message: string }): void {
  getIO().to(userRoom(userId)).emit('notification', notification)
}
