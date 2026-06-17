import { KycLevel, KycStatus } from '@prisma/client'
import { prisma } from './lib/prisma.js'
import { logger } from './lib/logger.js'
import { AppError } from './lib/errors.js'
import type { KycSubmitInput, KycResult } from './types.js'

/**
 * KYC simulation with a 3-tier level system:
 *   NONE  -> can register & deposit small amounts
 *   BASIC -> email + phone verified (handled by OTP service)
 *   FULL  -> identity submitted & auto-approved (demo) -> withdrawals unlocked
 *
 * Real platforms integrate a provider (Sumsub, Onfido). Here we auto-review.
 */
export const kycService = {
  async getStatus(userId: string): Promise<{ level: KycLevel; status: KycStatus }> {
    const record = await prisma.kycRecord.findUnique({ where: { userId } })
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { kycLevel: true } })
    return {
      level: user?.kycLevel ?? KycLevel.NONE,
      status: record?.status ?? KycStatus.NONE,
    }
  },

  /** Submit identity for FULL verification (auto-approved in simulation). */
  async submitFull(userId: string, input: KycSubmitInput): Promise<KycResult> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw AppError.notFound('User not found', 'USER_NOT_FOUND')

    // Require BASIC (verified email + phone) before allowing FULL.
    if (!user.emailVerified || !user.phoneVerified) {
      throw AppError.badRequest('Verify email and phone first', 'KYC_PREREQ')
    }

    // Basic synthetic validation — age 18+ if DOB provided.
    if (input.dateOfBirth) {
      const dob = new Date(input.dateOfBirth)
      const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)
      if (age < 18) throw AppError.forbidden('Must be 18 or older', 'KYC_UNDERAGE')
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.kycRecord.upsert({
        where: { userId },
        update: {
          level: KycLevel.FULL,
          status: KycStatus.VERIFIED,
          fullName: input.fullName,
          documentId: input.documentId, // simulated — masked in real systems
          country: input.country,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
        create: {
          userId,
          level: KycLevel.FULL,
          status: KycStatus.VERIFIED,
          fullName: input.fullName,
          documentId: input.documentId,
          country: input.country,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          reviewedAt: new Date(),
        },
      })
      const updated = await tx.user.update({
        where: { id: userId },
        data: { kycLevel: KycLevel.FULL },
      })
      await tx.auditLog.create({ data: { userId, action: 'kyc.verified.full' } })
      return updated
    })

    logger.info({ userId }, 'KYC FULL verified (simulation)')
    return { level: result.kycLevel, status: KycStatus.VERIFIED }
  },

  /** Promote to BASIC once email + phone are verified. Called after OTP success. */
  async maybePromoteToBasic(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return
    if (user.emailVerified && user.phoneVerified && user.kycLevel === KycLevel.NONE) {
      await prisma.user.update({ where: { id: userId }, data: { kycLevel: KycLevel.BASIC } })
      logger.info({ userId }, 'KYC promoted to BASIC')
    }
  },

  /** Guard used by wallet-service: withdrawals require FULL KYC. */
  async assertCanWithdraw(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { kycLevel: true } })
    if (user?.kycLevel !== KycLevel.FULL) {
      throw AppError.forbidden('Complete full KYC to withdraw', 'KYC_REQUIRED')
    }
  },
}
