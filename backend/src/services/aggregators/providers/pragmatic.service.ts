import { BaseProvider } from './base.provider.js'
import { ProviderError, type AggregatorGame, type CallbackAction, type NormalizedCallback, type ProviderCode } from '../types.js'

/**
 * Pragmatic Play adapter. Callback uses `type` for the action, `hash` for the
 * session token, and `reference` for the transaction id (`betReference` links a
 * win back to its bet).
 */
export class PragmaticProvider extends BaseProvider {
  readonly code: ProviderCode = 'PRAGMATIC'

  async getGameList(): Promise<AggregatorGame[]> {
    return [
      { externalId: 'pp-gates-of-olympus', name: 'Gates of Olympus', category: 'SLOTS', rtp: 0.965, currencies: ['USD'], thumbnailUrl: '' },
      { externalId: 'pp-sweet-bonanza', name: 'Sweet Bonanza', category: 'SLOTS', rtp: 0.965, currencies: ['USD'], thumbnailUrl: '' },
      { externalId: 'pp-big-bass-bonanza', name: 'Big Bass Bonanza', category: 'SLOTS', rtp: 0.957, currencies: ['USD'], thumbnailUrl: '' },
      { externalId: 'pp-mega-roulette', name: 'Mega Roulette', category: 'LIVE', rtp: 0.974, currencies: ['USD'], thumbnailUrl: '' },
    ]
  }

  parseCallback(raw: unknown): NormalizedCallback {
    const b = raw as Record<string, unknown>
    const map: Record<string, CallbackAction> = {
      getbalance: 'balance',
      balance: 'balance',
      bet: 'bet',
      win: 'win',
      refund: 'refund',
      rollback: 'rollback',
    }
    const action = map[this.str(b.type).toLowerCase()]
    if (!action) throw new ProviderError('CALLBACK_UNKNOWN_ACTION', `PP unknown type: ${this.str(b.type)}`, 400)

    return {
      action,
      token: this.str(b.hash),
      providerTxId: this.str(b.reference),
      roundId: b.roundId ? this.str(b.roundId) : undefined,
      amountMinor: this.toMinor(this.str(b.amount, '0')),
      currency: this.str(b.currency, 'USD'),
      gameExternalId: b.gameId ? this.str(b.gameId) : undefined,
      refProviderTxId: b.betReference ? this.str(b.betReference) : undefined,
      raw,
    }
  }
}
