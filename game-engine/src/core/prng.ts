import { createHmac, createHash } from 'node:crypto'

/**
 * Provably-fair pseudo-random number generator (Stake/Roobet-style).
 *
 * Determinism: outcomes are a pure function of (serverSeed, clientSeed, nonce).
 * - serverSeed is committed up-front as sha256(serverSeed) and revealed on
 *   rotation, so a player can later recompute every byte and verify the game
 *   was not manipulated.
 * - For each "round" r we compute HMAC_SHA256(serverSeed, `clientSeed:nonce:r`),
 *   yielding 32 bytes. Bytes are consumed 4 at a time to build a float in
 *   [0, 1); when exhausted we advance r. This matches the public Stake spec.
 */
export class FairRng {
  private bytes: number[] = []
  private byteIndex = 0
  private round = 0

  constructor(
    private readonly serverSeed: string,
    private readonly clientSeed: string,
    private readonly nonce: number,
  ) {}

  private refill(): void {
    const hmac = createHmac('sha256', this.serverSeed)
      .update(`${this.clientSeed}:${this.nonce}:${this.round}`)
      .digest()
    this.bytes = Array.from(hmac.values())
    this.byteIndex = 0
    this.round += 1
  }

  private nextByte(): number {
    if (this.byteIndex >= this.bytes.length) this.refill()
    return this.bytes[this.byteIndex++]
  }

  /** Next float in [0, 1) using 4 bytes of entropy (53-bit safe). */
  next(): number {
    let result = 0
    let divider = 256
    for (let i = 0; i < 4; i++) {
      result += this.nextByte() / divider
      divider *= 256
    }
    return result
  }

  /** Uniform integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive)
  }

  /**
   * In-place Fisher–Yates shuffle driven by the fair stream.
   * Used to produce a verifiable card shoe.
   */
  shuffle<T>(items: T[]): T[] {
    const a = items.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1)
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
}

/** Commit value published before play. */
export function hashServerSeed(serverSeed: string): string {
  return createHash('sha256').update(serverSeed).digest('hex')
}
