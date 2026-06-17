import { Router } from 'express'
import { authController } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { validateBody } from '../middleware/validate.middleware.js'
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.middleware.js'
import {
  registerSchema,
  loginSchema,
  otpRequestSchema,
  otpVerifySchema,
  kycSubmitSchema,
} from '../types.js'

export const authRoutes = Router()

// Public
authRoutes.post('/register', authLimiter, validateBody(registerSchema), authController.register)
authRoutes.post('/login', authLimiter, validateBody(loginSchema), authController.login)
authRoutes.post('/refresh', authLimiter, authController.refresh)
authRoutes.post('/logout', authController.logout)

// Authenticated
authRoutes.get('/me', requireAuth, authController.me)

// OTP (verification)
authRoutes.post('/otp/request', requireAuth, otpLimiter, validateBody(otpRequestSchema), authController.requestOtp)
authRoutes.post('/otp/verify', requireAuth, otpLimiter, validateBody(otpVerifySchema), authController.verifyOtp)

// KYC
authRoutes.get('/kyc', requireAuth, authController.kycStatus)
authRoutes.post('/kyc', requireAuth, validateBody(kycSubmitSchema), authController.kycSubmit)
