import type { IAggregatorProvider, ProviderDeps } from '../aggregator.interface.js'
import type {
  ProviderCode,
  ProviderCredentials,
  AggregatorGame,
  LaunchContext,
  LaunchResult,
  NormalizedCallback,
} from '../types.js'

/**
 * Common provider behaviour. Concrete adapters only implement the bits that
 * actually differ between providers: their game catalog and how their callback
 * wire-format maps onto our {@link NormalizedCallback}.
 *
 * NOTE: these are integration-faithful SIMULATIONS — there is no live upstream
 * server in this demo. `launchGame` returns the provider's URL pattern carrying
 * our session token; real money flow happens via the (real) callback contract.
 */
export abstract class BaseProvider implements IAggregatorProvider {
  abstract readonly code: ProviderCode
  protected readonly creds: ProviderCredentials
  protected readonly publicBaseUrl: string

  constructor(deps: ProviderDeps) {
    this.creds = deps.credentials
    this.publicBaseUrl = deps.publicBaseUrl
  }

  abstract getGameList(): Promise<AggregatorGame[]>
  abstract parseCallback(rawBody: unknown): NormalizedCallback

  getCallbackSecret(): string {
    return this.creds.secret
  }

  /** Default launch-URL builder; providers may override the query shape. */
  async launchGame(ctx: LaunchContext): Promise<LaunchResult> {
    const url = new URL(`${this.creds.endpoint}/launch`)
    url.searchParams.set('token', ctx.token)
    url.searchParams.set('game', ctx.gameExternalId)
    url.searchParams.set('cur', ctx.currency)
    url.searchParams.set('lang', ctx.lang ?? 'en')
    url.searchParams.set('cb', ctx.callbackUrl)
    url.searchParams.set('return', ctx.returnUrl)
    url.searchParams.set('key', this.creds.apiKey)
    return { launchUrl: url.toString(), providerRef: ctx.gameExternalId }
  }

  async healthCheck(): Promise<boolean> {
    // A real adapter would ping `${endpoint}/ping`; simulated as healthy.
    return true
  }

  // ── helpers for subclasses ──

  /** Convert a provider's MAJOR-unit decimal amount into integer minor units. */
  protected toMinor(amountMajor: number | string): number {
    const n = typeof amountMajor === 'string' ? Number(amountMajor) : amountMajor
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.round(n * 100)
  }

  protected str(v: unknown, fallback = ''): string {
    return v == null ? fallback : String(v)
  }
}
