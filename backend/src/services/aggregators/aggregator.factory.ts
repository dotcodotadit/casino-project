import { config } from '../../lib/config.js'
import type { IAggregatorProvider } from './aggregator.interface.js'
import type { ProviderCode, ProviderCredentials } from './types.js'
import { ProviderError } from './types.js'
import { BaseProvider } from './providers/base.provider.js'
import { PgSoftProvider } from './providers/pgsoft.service.js'
import { PragmaticProvider } from './providers/pragmatic.service.js'
import { EvolutionProvider } from './providers/evolution.service.js'
import { JiliProvider } from './providers/jili.service.js'

type ProviderCtor = new (deps: { credentials: ProviderCredentials; publicBaseUrl: string }) => BaseProvider

/** Registry mapping provider code → adapter class (add new providers here). */
const REGISTRY: Record<ProviderCode, ProviderCtor> = {
  PGSOFT: PgSoftProvider,
  PRAGMATIC: PragmaticProvider,
  EVOLUTION: EvolutionProvider,
  JILI: JiliProvider,
}

/** Default (env) credentials per provider — dev fallback / seed source. */
const ENV_CREDS: Record<ProviderCode, ProviderCredentials> = {
  PGSOFT: config.aggregators.pgsoft,
  PRAGMATIC: config.aggregators.pragmatic,
  EVOLUTION: config.aggregators.evolution,
  JILI: config.aggregators.jili,
}

// Cache adapters built from env creds (the common case).
const cache = new Map<ProviderCode, IAggregatorProvider>()

export const aggregatorFactory = {
  supported(): ProviderCode[] {
    return Object.keys(REGISTRY) as ProviderCode[]
  },

  envCredentials(code: ProviderCode): ProviderCredentials {
    const c = ENV_CREDS[code]
    if (!c) throw new ProviderError('PROVIDER_UNKNOWN', `Unknown provider ${code}`, 400)
    return c
  },

  /**
   * Build (or reuse) an adapter. Pass decrypted DB credentials to override the
   * env defaults; otherwise the cached env-cred instance is returned.
   */
  create(code: ProviderCode, credentials?: ProviderCredentials): IAggregatorProvider {
    const Ctor = REGISTRY[code]
    if (!Ctor) throw new ProviderError('PROVIDER_UNKNOWN', `Unknown provider ${code}`, 400)

    if (credentials) {
      return new Ctor({ credentials, publicBaseUrl: config.publicBaseUrl })
    }
    let inst = cache.get(code)
    if (!inst) {
      inst = new Ctor({ credentials: ENV_CREDS[code], publicBaseUrl: config.publicBaseUrl })
      cache.set(code, inst)
    }
    return inst
  },
}
