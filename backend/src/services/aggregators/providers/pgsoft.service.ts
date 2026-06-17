import { BaseProvider } from './base.provider.js'
import { ProviderError, type AggregatorGame, type CallbackAction, type NormalizedCallback, type ProviderCode } from '../types.js'

/**
 * PG Soft adapter. Single callback endpoint with an `action` field; amounts are
 * decimal major units; the session token field is `token`.
 */
export class PgSoftProvider extends BaseProvider {
  readonly code: ProviderCode = 'PGSOFT'

  async getGameList(): Promise<AggregatorGame[]> {
    return [
      { externalId: 'pg-mahjong-ways', name: 'Mahjong Ways', category: 'SLOTS', rtp: 0.965, currencies: ['USD'], thumbnailUrl: '' },
      { externalId: 'pg-fortune-tiger', name: 'Fortune Tiger', category: 'SLOTS', rtp: 0.969, currencies: ['USD'], thumbnailUrl: '' },
      { externalId: 'pg-wild-bandito', name: 'Wild Bandito', category: 'SLOTS', rtp: 0.964, currencies: ['USD'], thumbnailUrl: '' },
      { externalId: 'pg-lucky-neko', name: 'Lucky Neko', category: 'SLOTS', rtp: 0.965, currencies: ['USD'], thumbnailUrl: '' },
    ]
  }

  parseCallback(raw: unknown): NormalizedCallback {
    const b = raw as Record<string, unknown>
    const actionMap: Record<string, CallbackAction> = {
      balance: 'balance',
      bet: 'bet',
      debit: 'bet',
      win: 'win',
      credit: 'win',
      refund: 'refund',
      rollback: 'rollback',
      cancel: 'rollback',
    }
    const action = actionMap[this.str(b.action).toLowerCase()]
    if (!action) throw new ProviderError('CALLBACK_UNKNOWN_ACTION', `PG unknown action: ${this.str(b.action)}`, 400)

    return {
      action,
      token: this.str(b.token),
      providerTxId: this.str(b.txn_id ?? b.bet_id),
      roundId: b.round_id ? this.str(b.round_id) : undefined,
      amountMinor: this.toMinor(this.str(b.amount, '0')),
      currency: this.str(b.currency, 'USD'),
      gameExternalId: b.game_id ? this.str(b.game_id) : undefined,
      refProviderTxId: b.ref_id ? this.str(b.ref_id) : undefined,
      raw,
    }
  }
}
