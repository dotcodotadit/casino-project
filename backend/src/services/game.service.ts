import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { hashServerSeed } from '@casino/game-engine'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'

/**
 * Provably-fair seed lifecycle.
 *
 * Commit/reveal flow:
 *   1. A server seed is generated; sha256(seed) is published immediately
 *      (returned with every bet as `serverSeedHash`).
 *   2. Each bet reuses the active server seed with an incrementing per-(server,
 *      client) nonce. Outcome = f(serverSeed, clientSeed, nonce).
 *   3. On rotation the raw server seed is revealed so a player can recompute and
 *      verify every historical round. A fresh seed (new commit) takes over.
 *
 * This is the standard, secure model — revealing a seed mid-life would let a
 * player predict subsequent nonces, so reveal happens only on rotation.
 */

type Tx = Prisma.TransactionClient

export interface FairContext {
  serverSeed: string
  serverSeedId: string
  serverSeedHash: string
  clientSeed: string
  clientSeedId: string
  nonce: number
}

export const gameService = {
  /** Get the active server seed, creating one if none exists. */
  async getActiveServerSeed() {
    const existing = await prisma.serverSeed.findFirst({ where: { active: true } })
    if (existing) return existing
    const seed = randomBytes(32).toString('hex')
    return prisma.serverSeed.create({
      data: { seed, seedHash: hashServerSeed(seed), active: true },
    })
  },

  /** Get the user's active client seed, creating a random one if none. */
  async getActiveClientSeed(userId: string) {
    const existing = await prisma.clientSeed.findFirst({ where: { userId, active: true } })
    if (existing) return existing
    return prisma.clientSeed.create({
      data: { userId, seed: randomBytes(8).toString('hex'), active: true },
    })
  },

  /** Let a user set their own client seed (provably-fair best practice). */
  async setClientSeed(userId: string, seed: string) {
    await prisma.$transaction([
      prisma.clientSeed.updateMany({ where: { userId, active: true }, data: { active: false } }),
      prisma.clientSeed.create({ data: { userId, seed, active: true } }),
    ])
    return this.getActiveClientSeed(userId)
  },

  /**
   * Compute the fair context for the next bet INSIDE a transaction. The nonce is
   * the count of existing rounds for this (serverSeed, clientSeed) pair; under a
   * serializable transaction this is collision-free.
   */
  async nextFairContext(tx: Tx, serverSeedId: string, clientSeedId: string): Promise<number> {
    return tx.gameRound.count({ where: { serverSeedId, clientSeedId } })
  },

  /**
   * Rotate the active server seed: reveal the old one, activate a new commit.
   * Returns the revealed seed + its hash so clients can verify past rounds.
   */
  async rotateServerSeed() {
    const seed = randomBytes(32).toString('hex')
    const revealed = await prisma.$transaction(async (tx) => {
      const current = await tx.serverSeed.findFirst({ where: { active: true } })
      if (current) {
        await tx.serverSeed.update({
          where: { id: current.id },
          data: { active: false, rotatedAt: new Date() },
        })
      }
      await tx.serverSeed.create({ data: { seed, seedHash: hashServerSeed(seed), active: true } })
      return current
    })
    logger.info({ revealedSeedId: revealed?.id }, 'server seed rotated')
    return {
      revealed: revealed ? { seed: revealed.seed, seedHash: revealed.seedHash } : null,
      newHash: hashServerSeed(seed),
    }
  },

  /** Public fairness info: current commit + the user's client seed. */
  async getFairness(userId: string) {
    const [server, client] = await Promise.all([
      this.getActiveServerSeed(),
      this.getActiveClientSeed(userId),
    ])
    return {
      serverSeedHash: server.seedHash,
      clientSeed: client.seed,
      // next nonce for this pair (informational)
      nextNonce: await prisma.gameRound.count({
        where: { serverSeedId: server.id, clientSeedId: client.id },
      }),
    }
  },
}
