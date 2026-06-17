import type {
  ProviderCode,
  ProviderCredentials,
  AggregatorGame,
  LaunchContext,
  LaunchResult,
  NormalizedCallback,
} from './types.js'

/**
 * Unified provider interface — the seam between our platform and any third-party
 * game provider. Each adapter (PGSoft, Pragmatic, Evolution, Jili…) implements
 * this so the factory/facade can treat them interchangeably (Strategy pattern).
 *
 * Adapters are responsible for:
 *  - translating our unified requests into the provider's wire format,
 *  - translating the provider's responses/callbacks back into our shapes,
 *  - signing outbound requests and exposing the secret used to VERIFY callbacks.
 */
export interface IAggregatorProvider {
  readonly code: ProviderCode

  /** Fetch (or return a catalog of) the provider's games. */
  getGameList(): Promise<AggregatorGame[]>

  /** Build a launch URL for an issued session token. */
  launchGame(ctx: LaunchContext): Promise<LaunchResult>

  /**
   * Parse a raw inbound callback body into our normalized shape. Throws if the
   * body is unrecognized. Does NOT touch the wallet — that's callback.service.
   */
  parseCallback(rawBody: unknown): NormalizedCallback

  /** The secret used to verify inbound callback HMAC signatures. */
  getCallbackSecret(): string

  /** Health probe (used by fallback/monitoring). */
  healthCheck(): Promise<boolean>
}

/** Construction dependencies shared by all adapters. */
export interface ProviderDeps {
  credentials: ProviderCredentials
  /** Absolute base URL providers use to call us back. */
  publicBaseUrl: string
}
