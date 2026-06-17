import type { User } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'
import { z } from 'zod'

// ── Validation ──
export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username: letters, numbers, underscore only')
    .optional(),
})
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export interface UserProfileDTO {
  id: string
  email: string
  phone: string | null
  username: string
  role: User['role']
  status: User['status']
  emailVerified: boolean
  phoneVerified: boolean
  kycLevel: User['kycLevel']
  createdAt: string
  lastLoginAt: string | null
}

function toProfile(u: User): UserProfileDTO {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    username: u.username,
    role: u.role,
    status: u.status,
    emailVerified: u.emailVerified,
    phoneVerified: u.phoneVerified,
    kycLevel: u.kycLevel,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  }
}

export const userService = {
  async getProfile(userId: string): Promise<UserProfileDTO> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw AppError.notFound('User not found', 'USER_NOT_FOUND')
    return toProfile(user)
  },

  /** Update mutable profile fields. Username uniqueness enforced at DB level. */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfileDTO> {
    if (input.username) {
      const taken = await prisma.user.findFirst({
        where: { username: input.username, NOT: { id: userId } },
        select: { id: true },
      })
      if (taken) throw AppError.conflict('Username already taken', 'USERNAME_TAKEN')
    }
    const user = await prisma.user.update({ where: { id: userId }, data: { username: input.username } })
    return toProfile(user)
  },

  /** Self-exclusion (responsible gambling). Sets status; sessions revoked elsewhere. */
  async selfExclude(userId: string): Promise<void> {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { status: 'SELF_EXCLUDED' } }),
      prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.auditLog.create({ data: { userId, action: 'user.self_exclude' } }),
    ])
  },
}
