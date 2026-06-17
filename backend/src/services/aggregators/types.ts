import { z } from 'zod'

/**
 * Shared types & DTOs for the aggregator layer.
 *
 * Every provider speaks its own protocol; the adapters translate to/from these
 * unified shapes so the rest of the platform (controllers, callback service,
 * frontend) never depends on a specific provider's wire format.
 */

export type ProviderCode = 'PGSOFT' | 'PRAGMATIC' | 'EVOLUTION' | 'JILI'

// ── Credentials (decrypted at use-time) ──
export interface ProviderCredentials {
  apiKey: string
  secret: string
  endpoint: string
}

// ── Game list ──
export interface AggregatorGame {
  externalId: string
  name: string
  category: 'SLOTS' | 'LIVE' | 'TABLE' | 'CRASH' | 'FISHING' | 'LOTTERY' | 'OTHER'
  rtp?: number
  thumbnailUrl?: string
  currencies: string[]
}

// ── Launch ──
export interface LaunchContext {
  userId: string
  username: string
  gameExternalId: string
  currency: string
  /** Opaque session token WE issue; the provider echoes it on callbacks. */
  token: string
  /** Where provider callbacks should be sent. */
  callbackUrl: string
  /** Where the game should return the player on exit. */
  returnUrl: string
  lang?: string
}

export interface LaunchResult {
  launchUrl: string
  /** Provider-side game/session reference, if any. */
  providerRef?: string
}

// ── Unified callback (normalized from each provider's wire format) ──
export type CallbackAction = 'balance' | 'bet' | 'win' | 'refund' | 'rollback'

export interface NormalizedCallback {
  action: CallbackAction
  token: string // our AggregatorSession.token
  /** Provider's unique transaction id (idempotency anchor). */
  providerTxId: string
  /** Provider round id grouping bet+win (optional). */
  roundId?: string
  /** Positive minor units; direction implied by `action`. */
  amountMinor: number
  currency: string
  gameExternalId?: string
  /** A bet's reference, for win/refund correlation. */
  refProviderTxId?: string
  raw: unknown
}

export interface CallbackResult {
  ok: boolean
  balanceMinor: number
  currency: string
  /** Provider-specific transaction id we assign/echo. */
  transactionId?: string
  errorCode?: string
}

// ── Unified provider error → mapped to user-friendly messages ──
export class ProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 502,
    public readonly retriable = false,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

/** Map internal/provider error codes to safe, user-facing copy. */
export const USER_FACING_ERRORS: Record<string, string> = {
  PROVIDER_DOWN: 'This game is temporarily unavailable. Please try again shortly.',
  GAME_MAINTENANCE: 'This game is under maintenance.',
  PROVIDER_DISABLED: 'This provider is currently unavailable.',
  INSUFFICIENT_FUNDS: 'Insufficient balance for this bet.',
  SESSION_INVALID: 'Your game session has expired. Please relaunch the game.',
  CURRENCY_UNSUPPORTED: 'This game does not support your currency.',
  UNKNOWN: 'Something went wrong launching the game.',
}

export function userFacing(code: string): string {
  return USER_FACING_ERRORS[code] ?? USER_FACING_ERRORS.UNKNOWN
}

// ── Zod validation ──
export const launchGameSchema = z.object({
  provider: z.enum(['PGSOFT', 'PRAGMATIC', 'EVOLUTION', 'JILI']),
  gameId: z.string().min(1),
  currency: z.string().length(3).default('USD'),
  lang: z.string().min(2).max(5).optional(),
})
export type LaunchGameInput = z.infer<typeof launchGameSchema>

export const gameListQuerySchema = z.object({
  provider: z.enum(['PGSOFT', 'PRAGMATIC', 'EVOLUTION', 'JILI']).optional(),
  category: z.enum(['SLOTS', 'LIVE', 'TABLE', 'CRASH', 'FISHING', 'LOTTERY', 'OTHER']).optional(),
  q: z.string().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
})
export type GameListQuery = z.infer<typeof gameListQuerySchema>

// Generic provider callback envelope. The exact shape varies per provider;
// adapters parse their own format, so we accept a permissive record here and
// validate the normalized result instead.
export const rawCallbackSchema = z.record(z.string(), z.unknown())
