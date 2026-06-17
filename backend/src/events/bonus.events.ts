import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { redis, redisSub } from '../lib/redis.js'
import { logger } from '../lib/logger.js'

// Unique per process — lets the Redis bridge skip messages this instance itself
// published (ioredis delivers a publisher its own messages).
const INSTANCE_ID = randomUUID()

/**
 * Bonus event system.
 *
 * Two layers:
 *  - A process-local {@link EventEmitter} (`bonusBus`) that the engine subscribes
 *    to. Handlers run asynchronously and are isolated — one throwing never breaks
 *    the emitter or the caller that fired the event.
 *  - A Redis pub/sub bridge so events raised in ANY service (wallet, backend,
 *    aggregator) reach the bonus engine wherever it runs, and so multiple backend
 *    instances stay consistent. Locally-emitted events are mirrored to Redis; the
 *    subscriber re-injects remote events into the local bus (tagging them so they
 *    are not re-published in a loop).
 *
 * This is the trigger backbone: deposits, losses, bet settlements and logins all
 * become events the engine reacts to (welcome bonus, reload, loss cashback, …).
 */

export const BONUS_EVENT_CHANNEL = 'bonus:events'

export type BonusEventType =
  | 'user.registered'
  | 'user.login'
  | 'deposit.completed'
  | 'bet.settled'
  | 'session.loss' // emitted by cashback windowing / period close
  | 'bonus.granted'
  | 'bonus.activated'
  | 'bonus.progress'
  | 'bonus.completed'
  | 'bonus.expired'
  | 'bonus.cancelled'
  // ── Loyalty / VIP (consumed by loyalty engine + socket relay) ──
  | 'win.big'
  | 'points.earned'
  | 'vip.levelup'
  | 'vip.downgrade'
  | 'mission.progress'
  | 'mission.completed'

export interface BonusEventPayloads {
  'user.registered': { userId: string; ipAddress?: string; deviceFingerprint?: string }
  'user.login': { userId: string; ipAddress?: string }
  'deposit.completed': {
    userId: string
    amountMinor: number
    transactionId: string
    ipAddress?: string
    deviceFingerprint?: string
    isFirstDeposit?: boolean
  }
  'bet.settled': {
    userId: string
    stakeMinor: number
    payoutMinor: number
    gameCategory?: string
    sourceType: 'GAME_ROUND' | 'PROVIDER_TX'
    sourceRef: string
  }
  'session.loss': { userId: string; netLossMinor: number; periodHours: number }
  'bonus.granted': { userId: string; userBonusId: string; bonusId: string; amountMinor: number }
  'bonus.activated': { userId: string; userBonusId: string }
  'bonus.progress': {
    userId: string
    userBonusId: string
    progressMinor: number
    requiredMinor: number
    percent: number
  }
  'bonus.completed': { userId: string; userBonusId: string; releasedMinor: number }
  'bonus.expired': { userId: string; userBonusId: string }
  'bonus.cancelled': { userId: string; userBonusId: string; reason: string }
  // ── Loyalty / VIP ──
  'win.big': { userId: string; payoutMinor: number; multiplier: number; sourceRef: string }
  'points.earned': {
    userId: string
    loyaltyPoints: number
    statusPoints: number
    loyaltyBalance: number
    source: string
  }
  'vip.levelup': { userId: string; fromLevel: number; toLevel: number; levelName: string }
  'vip.downgrade': { userId: string; fromLevel: number; toLevel: number; levelName: string }
  'mission.progress': {
    userId: string
    userMissionId: string
    missionKey: string
    progress: number
    target: number
    percent: number
  }
  'mission.completed': {
    userId: string
    userMissionId: string
    missionKey: string
    rewardPoints: number
  }
}

interface Envelope<T extends BonusEventType = BonusEventType> {
  type: T
  payload: BonusEventPayloads[T]
  /** Publishing instance id — used to skip self-delivered Redis messages. */
  origin: string
}

class BonusBus extends EventEmitter {
  private bridged = false

  constructor() {
    super()
    // Bonus handlers can be many (one per trigger); lift the default cap.
    this.setMaxListeners(50)
  }

  /** Emit locally AND mirror to Redis so other instances/services react too. */
  publish<T extends BonusEventType>(type: T, payload: BonusEventPayloads[T]): void {
    this.dispatch({ type, payload, origin: INSTANCE_ID })
    redis
      .publish(BONUS_EVENT_CHANNEL, JSON.stringify({ type, payload, origin: INSTANCE_ID }))
      .catch((err) => logger.error({ err, type }, 'bonus event publish failed'))
  }

  /** Type-safe subscribe. Handler errors are caught so a bad handler is isolated. */
  on<T extends BonusEventType>(type: T, handler: (payload: BonusEventPayloads[T]) => void | Promise<void>): this {
    return super.on(type, (payload: BonusEventPayloads[T]) => {
      Promise.resolve()
        .then(() => handler(payload))
        .catch((err) => logger.error({ err, type }, 'bonus event handler error'))
    })
  }

  private dispatch<T extends BonusEventType>(env: Envelope<T>): void {
    super.emit(env.type, env.payload)
  }

  /** Start relaying remote bonus events from Redis into the local bus (once). */
  startBridge(): void {
    if (this.bridged) return
    this.bridged = true
    redisSub.subscribe(BONUS_EVENT_CHANNEL, (err) => {
      if (err) {
        logger.error({ err }, 'failed to subscribe to bonus event channel')
        return
      }
      logger.info('subscribed to bonus event channel')
    })
    redisSub.on('message', (channel, raw) => {
      if (channel !== BONUS_EVENT_CHANNEL) return
      try {
        const env = JSON.parse(raw) as Envelope
        // Skip messages we ourselves published (already dispatched locally).
        if (env.origin === INSTANCE_ID) return
        this.dispatch(env)
      } catch (err) {
        logger.error({ err }, 'failed to relay bonus event')
      }
    })
  }
}

export const bonusBus = new BonusBus()
