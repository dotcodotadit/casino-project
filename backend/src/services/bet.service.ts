import {
  Prisma,
  WalletType,
  Currency,
  TransactionType,
  TransactionStatus,
  type GameType,
} from '@prisma/client'
import type { GameRoundResult, BlackjackState } from '@casino/game-engine'
import { prisma } from '../lib/prisma.js'
import { config } from '../lib/config.js'
import { AppError } from '../lib/errors.js'
import { withRetry } from '../lib/retry.js'
import { gameService } from './game.service.js'

type Tx = Prisma.TransactionClient

/** A pure engine play function for an instant game. */
export type InstantPlay<O> = (stakeMinor: number, ctx: {
  serverSeed: string
  clientSeed: string
  nonce: number
}) => GameRoundResult<O>

export interface InstantBetResult<O> {
  betId: string
  game: GameType
  stake: number
  payout: number
  multiplier: number
  balanceAfter: number
  fairness: { serverSeedHash: string; clientSeed: string; nonce: number }
  outcome: O
}

function assertStake(stakeMinor: unknown): asserts stakeMinor is number {
  if (!Number.isInteger(stakeMinor) || (stakeMinor as number) <= 0) {
    throw AppError.badRequest('Invalid stake', 'INVALID_STAKE')
  }
  const v = stakeMinor as number
  if (v < config.bet.minMinor) throw AppError.badRequest(`Minimum bet is ${config.bet.minMinor}`, 'BET_MIN')
  if (v > config.bet.maxMinor) throw AppError.badRequest(`Maximum bet is ${config.bet.maxMinor}`, 'BET_MAX')
}

/**
 * Locked balance mutation inside an existing transaction. Mirrors the
 * wallet-service ledger: optimistic version check + immutable Transaction row.
 * Returns the new balance and the version it bumped TO.
 */
async function mutate(
  tx: Tx,
  params: {
    userId: string
    walletId: string
    expectedVersion: number
    balanceBefore: bigint
    delta: bigint
    txType: TransactionType
    gameRoundId?: string
    metadata?: Prisma.InputJsonValue
  },
): Promise<bigint> {
  const balanceAfter = params.balanceBefore + params.delta
  if (balanceAfter < 0n) throw AppError.unprocessable('Insufficient balance', 'INSUFFICIENT_FUNDS')

  const updated = await tx.wallet.updateMany({
    where: { id: params.walletId, version: params.expectedVersion },
    data: { balance: balanceAfter, version: { increment: 1 } },
  })
  if (updated.count === 0) throw AppError.conflict('Concurrent balance update — retry', 'WALLET_CONFLICT')

  await tx.transaction.create({
    data: {
      userId: params.userId,
      walletId: params.walletId,
      type: params.txType,
      status: TransactionStatus.COMPLETED,
      amount: params.delta < 0n ? -params.delta : params.delta,
      balanceBefore: params.balanceBefore,
      balanceAfter,
      gameRoundId: params.gameRoundId,
      metadata: params.metadata,
    },
  })
  return balanceAfter
}

async function getMainWallet(tx: Tx, userId: string) {
  const wallet = await tx.wallet.findUnique({
    where: { userId_type_currency: { userId, type: WalletType.MAIN, currency: Currency.USD } },
  })
  if (!wallet) throw AppError.notFound('Wallet not found', 'WALLET_NOT_FOUND')
  return wallet
}

export const betService = {
  /**
   * Resolve a single-shot bet (slots / roulette) atomically:
   * debit stake → run engine → persist round → credit payout.
   */
  async resolveInstantBet<O>(input: {
    userId: string
    game: GameType
    stakeMinor: number
    play: InstantPlay<O>
  }): Promise<InstantBetResult<O>> {
    assertStake(input.stakeMinor)

    // Resolve seeds outside the tx (these self-heal/create rows).
    const [server, client] = await Promise.all([
      gameService.getActiveServerSeed(),
      gameService.getActiveClientSeed(input.userId),
    ])

    const stake = BigInt(input.stakeMinor)

    // Retry on serialization / nonce-collision / optimistic-lock conflicts.
    const result = await withRetry(() => prisma.$transaction(
      async (tx) => {
        const wallet = await getMainWallet(tx, input.userId)
        if (wallet.balance < stake) throw AppError.unprocessable('Insufficient balance', 'INSUFFICIENT_FUNDS')

        const nonce = await gameService.nextFairContext(tx, server.id, client.id)
        const play = input.play(input.stakeMinor, {
          serverSeed: server.seed,
          clientSeed: client.seed,
          nonce,
        })

        const round = await tx.gameRound.create({
          data: {
            userId: input.userId,
            game: input.game,
            stake,
            payout: BigInt(play.payoutMinor),
            serverSeedId: server.id,
            clientSeedId: client.id,
            nonce,
            outcome: play.outcome as Prisma.InputJsonValue,
          },
        })

        // Debit stake.
        let version = wallet.version
        let balance = await mutate(tx, {
          userId: input.userId,
          walletId: wallet.id,
          expectedVersion: version,
          balanceBefore: wallet.balance,
          delta: -stake,
          txType: TransactionType.BET,
          gameRoundId: round.id,
          metadata: { game: input.game },
        })
        version += 1

        // Credit payout (if any).
        if (play.payoutMinor > 0) {
          balance = await mutate(tx, {
            userId: input.userId,
            walletId: wallet.id,
            expectedVersion: version,
            balanceBefore: balance,
            delta: BigInt(play.payoutMinor),
            txType: TransactionType.PAYOUT,
            gameRoundId: round.id,
            metadata: { game: input.game },
          })
        }

        return { round, balance, play }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ))

    return {
      betId: result.round.id,
      game: input.game,
      stake: input.stakeMinor,
      payout: result.play.payoutMinor,
      multiplier: result.play.multiplier,
      balanceAfter: Number(result.balance),
      fairness: { serverSeedHash: server.seedHash, clientSeed: client.seed, nonce: result.round.nonce },
      outcome: result.play.outcome,
    }
  },

  /**
   * Blackjack: open a round (debit stake) and persist the shuffled shoe + state.
   * Naturals are settled immediately.
   */
  async blackjackDeal(input: {
    userId: string
    stakeMinor: number
    deal: (stakeMinor: number, ctx: { serverSeed: string; clientSeed: string; nonce: number }) => BlackjackState
    settlePayout: (state: BlackjackState) => number
    isResolved: (state: BlackjackState) => boolean
  }) {
    assertStake(input.stakeMinor)
    const [server, client] = await Promise.all([
      gameService.getActiveServerSeed(),
      gameService.getActiveClientSeed(input.userId),
    ])
    const stake = BigInt(input.stakeMinor)

    return withRetry(() => prisma.$transaction(
      async (tx) => {
        const wallet = await getMainWallet(tx, input.userId)
        if (wallet.balance < stake) throw AppError.unprocessable('Insufficient balance', 'INSUFFICIENT_FUNDS')

        const nonce = await gameService.nextFairContext(tx, server.id, client.id)
        const state = input.deal(input.stakeMinor, {
          serverSeed: server.seed,
          clientSeed: client.seed,
          nonce,
        })
        const resolved = input.isResolved(state)
        const payout = resolved ? input.settlePayout(state) : 0

        const round = await tx.gameRound.create({
          data: {
            userId: input.userId,
            game: 'BLACKJACK',
            stake,
            payout: BigInt(payout),
            serverSeedId: server.id,
            clientSeedId: client.id,
            nonce,
            outcome: state as unknown as Prisma.InputJsonValue,
            // Naturals settle immediately; mark terminal so it can't be re-settled.
            settledAt: resolved ? new Date() : null,
          },
        })

        let version = wallet.version
        let balance = await mutate(tx, {
          userId: input.userId,
          walletId: wallet.id,
          expectedVersion: version,
          balanceBefore: wallet.balance,
          delta: -stake,
          txType: TransactionType.BET,
          gameRoundId: round.id,
          metadata: { game: 'BLACKJACK' },
        })
        version += 1

        if (payout > 0) {
          balance = await mutate(tx, {
            userId: input.userId,
            walletId: wallet.id,
            expectedVersion: version,
            balanceBefore: balance,
            delta: BigInt(payout),
            txType: TransactionType.PAYOUT,
            gameRoundId: round.id,
            metadata: { game: 'BLACKJACK' },
          })
        }

        return { betId: round.id, state, payout, balanceAfter: Number(balance), server, client, nonce }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ))
  },

  /**
   * Blackjack: apply a player action to an existing round. `advance` mutates the
   * persisted state; if the result is terminal we credit the payout.
   */
  async blackjackAct(input: {
    userId: string
    betId: string
    advance: (state: BlackjackState) => BlackjackState
    settlePayout: (state: BlackjackState) => number
    isResolved: (state: BlackjackState) => boolean
  }) {
    return withRetry(() => prisma.$transaction(
      async (tx) => {
        const round = await tx.gameRound.findFirst({
          where: { id: input.betId, userId: input.userId, game: 'BLACKJACK' },
        })
        if (!round) throw AppError.notFound('Round not found', 'ROUND_NOT_FOUND')
        // Already terminally settled (e.g. dealt natural, or a prior action).
        if (round.settledAt) throw AppError.unprocessable('Round already finished', 'ROUND_FINISHED')

        const prev = round.outcome as unknown as BlackjackState
        if (prev.status !== 'PLAYER_TURN') {
          throw AppError.unprocessable('Round already finished', 'ROUND_FINISHED')
        }

        const next = input.advance(prev)
        const resolved = input.isResolved(next)
        const payout = resolved ? input.settlePayout(next) : 0

        if (resolved) {
          // Idempotent settle: only one actor may transition settledAt null→now.
          // Guards against double-credit if two actions race the same round.
          const settled = await tx.gameRound.updateMany({
            where: { id: round.id, settledAt: null },
            data: { outcome: next as unknown as Prisma.InputJsonValue, payout: BigInt(payout), settledAt: new Date() },
          })
          if (settled.count === 0) throw AppError.unprocessable('Round already finished', 'ROUND_FINISHED')
        } else {
          await tx.gameRound.update({
            where: { id: round.id },
            data: { outcome: next as unknown as Prisma.InputJsonValue },
          })
        }

        const wallet = await getMainWallet(tx, input.userId)
        let balance = wallet.balance
        if (payout > 0) {
          balance = await mutate(tx, {
            userId: input.userId,
            walletId: wallet.id,
            expectedVersion: wallet.version,
            balanceBefore: wallet.balance,
            delta: BigInt(payout),
            txType: TransactionType.PAYOUT,
            gameRoundId: round.id,
            metadata: { game: 'BLACKJACK' },
          })
        }

        return { betId: round.id, state: next, payout, balanceAfter: Number(balance) }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ))
  },

  /** Paginated bet history, optionally filtered by game. */
  async history(userId: string, opts: { game?: GameType; page: number; pageSize: number }) {
    const where = { userId, ...(opts.game ? { game: opts.game } : {}) }
    const [total, rows] = await prisma.$transaction([
      prisma.gameRound.count({ where }),
      prisma.gameRound.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
    ])
    return {
      items: rows.map((r) => ({
        id: r.id,
        game: r.game,
        stake: Number(r.stake),
        payout: Number(r.payout),
        nonce: r.nonce,
        createdAt: r.createdAt.toISOString(),
      })),
      page: opts.page,
      pageSize: opts.pageSize,
      total,
      totalPages: Math.ceil(total / opts.pageSize),
    }
  },
}
