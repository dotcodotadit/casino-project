import { z } from 'zod'
import type { UserRole, KycLevel, KycStatus } from '@prisma/client'

// ── Validation schemas (Zod) ────────────────────────────────

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a digit')

const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be E.164 format, e.g. +14155552671')

export const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  phone: phoneSchema,
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username: letters, numbers, underscore only'),
  password: passwordSchema,
})

export const loginSchema = z.object({
  // identifier may be email OR phone
  identifier: z.string().min(3).max(254).trim(),
  password: z.string().min(1).max(128),
})

export const otpRequestSchema = z.object({
  channel: z.enum(['EMAIL', 'PHONE']),
})

export const otpVerifySchema = z.object({
  channel: z.enum(['EMAIL', 'PHONE']),
  code: z.string().length(6).regex(/^\d{6}$/),
})

export const kycSubmitSchema = z.object({
  fullName: z.string().min(2).max(100),
  documentId: z.string().min(4).max(64),
  country: z.string().min(2).max(56),
  dateOfBirth: z.string().datetime().optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type OtpRequestInput = z.infer<typeof otpRequestSchema>
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>
export type KycSubmitInput = z.infer<typeof kycSubmitSchema>

// ── DTOs ────────────────────────────────────────────────────

export interface PublicUser {
  id: string
  email: string
  phone: string | null
  username: string
  role: UserRole
  emailVerified: boolean
  phoneVerified: boolean
  kycLevel: KycLevel
  createdAt: string
}

export interface AuthResult {
  user: PublicUser
  tokens: { accessToken: string }
  // refreshToken is delivered via httpOnly cookie, never in body
}

export interface RequestContext {
  ip: string
  userAgent: string
  acceptLanguage: string
}

export interface KycResult {
  level: KycLevel
  status: KycStatus
}
