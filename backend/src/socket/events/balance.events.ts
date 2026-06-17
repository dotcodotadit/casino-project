import type { Server as SocketIOServer } from 'socket.io'
import type { AuthedSocket } from '../../services/socket.service.js'
import { userRoom } from '../../services/socket.service.js'
import { redisSub } from '../../lib/redis.js'
import { logger } from '../../lib/logger.js'

// Must match wallet-service/src/lib/publisher.ts → BALANCE_CHANNEL.
const BALANCE_CHANNEL = 'wallet:balance'

// Shape published by wallet-service (BalanceChange).
interface BalanceChangeMessage {
  userId: string
  walletType: string
  currency: string
  balance: number
  delta: number
  txId: string
}

/**
 * Per-socket balance events. The client can request a re-sync; actual pushes
 * come from the Redis relay below.
 */
export function registerBalanceEvents(socket: AuthedSocket): void {
  // Client hint that it's ready to receive balance updates (optional).
  socket.on('balance:subscribe', () => {
    socket.emit('balance:subscribed', { ok: true })
  })
}

/**
 * Subscribe to the wallet-service Redis channel once and fan out each balance
 * change to the owning user's room only. Decouples the two services and scales
 * horizontally (every backend instance relays to its own connected sockets).
 */
export function startBalanceRelay(io: SocketIOServer): void {
  redisSub.subscribe(BALANCE_CHANNEL, (err) => {
    if (err) {
      logger.error({ err }, 'failed to subscribe to balance channel')
      return
    }
    logger.info('subscribed to wallet balance channel')
  })

  redisSub.on('message', (channel, raw) => {
    if (channel !== BALANCE_CHANNEL) return
    try {
      const change = JSON.parse(raw) as BalanceChangeMessage
      io.to(userRoom(change.userId)).emit('balance:update', {
        walletType: change.walletType,
        currency: change.currency,
        balance: change.balance,
        delta: change.delta,
        txId: change.txId,
      })
    } catch (err) {
      logger.error({ err }, 'failed to relay balance change')
    }
  })
}
