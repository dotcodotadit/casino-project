import { BaseProvider } from './base.provider.js'
import { ProviderError, type AggregatorGame, type CallbackAction, type NormalizedCallback, type ProviderCode } from '../types.js'

/**
 * Jili adapter (slots + fishing). Uses `command` for the action, `sessionToken`
 * for the token, and `serialNo` for the transaction id.
 */
export class JiliProvider extends BaseProvider {
  readonly code: ProviderCode = 'JILI'

  async getGameList(): Promise<AggregatorGame[]> {
    return [
      { externalId: 'jili-super-ace', name: 'Super Ace', category: 'SLOTS', rtp: 0.97, currencies: ['USD'], thumbnailUrl: '' },
      { externalId: 'jili-golden-empire', name: 'Golden Empire', category: 'SLOTS', rtp: 0.965, currencies: ['USD'], thumbnailUrl: '' },
      { externalId: 'jili-money-coming', name: 'Money Coming', category: 'SLOTS', rtp: 0.97, currencies: ['USD'], thumbnailUrl: '' },
      { externalId: 'jili-fishing-war', name: 'Fishing War', category: 'FISHING', rtp: 0.97, currencies: ['USD'], thumbnailUrl: '' },
    ]
  }

  parseCallback(raw: unknown): NormalizedCallback {
    const b = raw as Record<string, unknown>
    const map: Record<string, CallbackAction> = {
      getbalance: 'balance',
      balance: 'balance',
      bet: 'bet',
      payout: 'win',
      win: 'win',
      refund: 'refund',
      cancelbet: 'rollback',
      rollback: 'rollback',
    }
    const action = map[this.str(b.command).toLowerCase()]
    if (!action) throw new ProviderError('CALLBACK_UNKNOWN_ACTION', `JILI unknown command: ${this.str(b.command)}`, 400)

    return {
      action,
      token: this.str(b.sessionToken),
      providerTxId: this.str(b.serialNo),
      roundId: b.roundNo ? this.str(b.roundNo) : undefined,
      amountMinor: this.toMinor(this.str(b.amount, '0')),
      currency: this.str(b.currency, 'USD'),
      gameExternalId: b.gameCode ? this.str(b.gameCode) : undefined,
      refProviderTxId: b.refSerialNo ? this.str(b.refSerialNo) : undefined,
      raw,
    }
  }
}
