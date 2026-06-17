import { PrismaClient } from '@prisma/client'

// Re-use the generated client from the backend workspace (single schema source of truth).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
