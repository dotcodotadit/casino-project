import { api } from '@/lib/api'
import type { AuthResult, RegisterInput, User, KycState } from '@/types/user.types'

/** Envelope returned by every backend endpoint. */
interface Envelope<T> {
  success: boolean
  data: T
}

/**
 * Auth API client. The refresh token lives in an httpOnly cookie and is never
 * touched here; we only handle the short-lived access token + user profile.
 */
export const authService = {
  async login(identifier: string, password: string): Promise<AuthResult> {
    const { data } = await api.post<Envelope<AuthResult>>('/auth/login', { identifier, password })
    return data.data
  },

  async register(input: RegisterInput): Promise<AuthResult> {
    const { data } = await api.post<Envelope<AuthResult>>('/auth/register', input)
    return data.data
  },

  async refresh(): Promise<AuthResult> {
    const { data } = await api.post<Envelope<AuthResult>>('/auth/refresh')
    return data.data
  },

  async logout(allDevices = false): Promise<void> {
    await api.post('/auth/logout', { allDevices })
  },

  async me(): Promise<User> {
    const { data } = await api.get<Envelope<User>>('/auth/me')
    return data.data
  },

  // ── OTP verification (email/phone) ──
  async requestOtp(channel: 'EMAIL' | 'PHONE'): Promise<{ devCode?: string }> {
    const { data } = await api.post<Envelope<{ devCode?: string }>>('/auth/otp/request', { channel })
    return data.data
  },

  async verifyOtp(channel: 'EMAIL' | 'PHONE', code: string): Promise<void> {
    await api.post('/auth/otp/verify', { channel, code })
  },

  // ── KYC ──
  async kycStatus(): Promise<KycState> {
    const { data } = await api.get<Envelope<KycState>>('/auth/kyc')
    return data.data
  },

  async submitKyc(input: {
    fullName: string
    documentId: string
    country: string
    dateOfBirth?: string
  }): Promise<KycState> {
    const { data } = await api.post<Envelope<KycState>>('/auth/kyc', input)
    return data.data
  },
}
