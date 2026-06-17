import { BaseProvider } from './base.provider.js'
import { ProviderError, type AggregatorGame, type CallbackAction, type NormalizedCallback, type ProviderCode } from '../types.js'

/**
 * Evolution (live casino) adapter. Live games stream bets/wins under a `sid`
 * session id; the transaction object nests amount under `transaction.amount`.
 */
export class EvolutionProvider extends BaseProvider {
  readonly code: ProviderCode = 'EVOLUTION'

  async getGameList(): Promise<AggregatorGame[]> {
    return [
      { externalId: 'evo-lightning-roulette', name: 'Lightning Roulette', category: 'LIVE', rtp: 0.974, currencies: ['USD'], thumbnailUrl: '' },
      { externalId: 'evo-crazy-time', name: 'Crazy Time', category: 'LIVE', rtp: 0.953, currencies: ['USD'], thumbnailUrl: '' },
      { externalId: 'evo-blackjack-lobby', name: 'Live Blackjack', category: 'LIVE', rtp: 0.995, currencies: ['USD'], thumbnailUrl: '' },
      { externalId: 'evo-monopoly-live', name: 'Monopoly Live', category: 'LIVE', rtp: 0.961, currencies: ['USD'], thumbnailUrl: '' },
    ]
  }

  parseCallback(raw: unknown): NormalizedCallback {
    const b = raw as Record<string, unknown>
    const tx = (b.transaction ?? {}) as Record<string, unknown>
    const map: Record<string, CallbackAction> = {
      check: 'balance',
      balance: 'balance',
      debit: 'bet',
      credit: 'win',
      cancel: 'rollback',
      refund: 'refund',
    }
    const action = map[this.str(b.action).toLowerCase()]
    if (!action) throw new ProviderError('CALLBACK_UNKNOWN_ACTION', `EVO unknown action: ${this.str(b.action)}`, 400)

    return {
      action,
      token: this.str(b.sid),
      providerTxId: this.str(tx.id ?? b.uuid),
      roundId: b.game ? this.str((b.game as Record<string, unknown>).id) : undefined,
      amountMinor: this.toMinor(this.str(tx.amount, '0')),
      currency: this.str(b.currency, 'USD'),
      gameExternalId: b.gameId ? this.str(b.gameId) : undefined,
      refProviderTxId: tx.refId ? this.str(tx.refId) : undefined,
      raw,
    }
  }
}
