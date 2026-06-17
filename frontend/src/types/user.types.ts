export type UserRole = 'PLAYER' | 'ADMIN' | 'SUPPORT'
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'SELF_EXCLUDED'
export type KycLevel = 'NONE' | 'BASIC' | 'FULL'
export type KycStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED'

export interface User {
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

export interface AuthTokens {
  accessToken: string
}

export interface AuthResult {
  user: User
  tokens: AuthTokens
}

export interface RegisterInput {
  email: string
  phone: string
  username: string
  password: string
}

export interface KycState {
  level: KycLevel
  status: KycStatus
}
