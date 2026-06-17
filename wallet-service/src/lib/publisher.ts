import { redis } from './redis.js'
import { logger } from './logger.js'
import type { BalanceChange } from '../types.js'

/**
 * Real-time bridge across the service boundary.
 *
 * Balance mutations happen here in wallet-service, but Socket.io lives in the
 * backend. Rather than couple the two processes, we publish balance changes to
 * a Redis channel; the backend subscribes and emits to the user's socket room.
 * This scales across multiple instances of either service.
 */
export const BALANCE_CHANNEL = 'wallet:balance'

// Dedicated publisher connection (the shared `redis` is fine for pub, but we
// keep the channel name centralized here for both sides to import).
export function publishBalanceChange(change: BalanceChange): void {
  redis
    .publish(BALANCE_CHANNEL, JSON.stringify(change))
    .catch((err) => logger.error({ err }, 'failed to publish balance change'))
}

// ── Bonus event bridge ──
// Must match backend/src/events/bonus.events.ts → BONUS_EVENT_CHANNEL.
export const BONUS_EVENT_CHANNEL = 'bonus:events'

/**
 * Publish a bonus trigger event to the backend's bonus engine. wallet-service
 * has no bonus logic itself — it just announces money events (e.g. a completed
 * deposit) so the engine can grant welcome/reload bonuses. Fire-and-forget;
 * `origin` is omitted so the engine treats it as a remote event.
 */
export function publishBonusEvent(type: string, payload: Record<string, unknown>): void {
  redis
    .publish(BONUS_EVENT_CHANNEL, JSON.stringify({ type, payload, origin: 'wallet-service' }))
    .catch((err) => logger.error({ err, type }, 'failed to publish bonus event'))
}
