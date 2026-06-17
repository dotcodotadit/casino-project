import type { Transaction } from '@prisma/client'
import { prisma } from './lib/prisma.js'
import type { HistoryQuery, PaginatedTransactions, TransactionDTO } from './types.js'

function toDTO(tx: Transaction): TransactionDTO {
  return {
    id: tx.id,
    type: tx.type,
    status: tx.status,
    amount: Number(tx.amount),
    feeAmount: Number(tx.feeAmount),
    balanceAfter: Number(tx.balanceAfter),
    method: tx.method,
    reference: tx.reference,
    createdAt: tx.createdAt.toISOString(),
  }
}

export const transactionService = {
  /** Paginated, filterable transaction history for a user. */
  async history(userId: string, query: HistoryQuery): Promise<PaginatedTransactions> {
    const where = {
      userId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
    }

    const [total, rows] = await prisma.$transaction([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ])

    return {
      items: rows.map(toDTO),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    }
  },

  async getById(userId: string, txId: string): Promise<TransactionDTO | null> {
    const tx = await prisma.transaction.findFirst({ where: { id: txId, userId } })
    return tx ? toDTO(tx) : null
  },
}
