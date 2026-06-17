import type { Request, Response, NextFunction } from 'express'
import { authService } from '../auth.service.js'
import { kycService } from '../kyc.service.js'
import { otpService } from '../otp.service.js'
import { config } from '../lib/config.js'
import type { RequestContext } from '../types.js'

function ctxFrom(req: Request): RequestContext {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? '',
    acceptLanguage: req.headers['accept-language'] ?? '',
  }
}

// httpOnly + SameSite=strict refresh cookie.
function setRefreshCookie(res: Response, token: string) {
  res.cookie(config.cookie.name, token, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: 'strict',
    domain: config.cookie.domain,
    path: '/api/auth',
    maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
  })
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(config.cookie.name, { path: '/api/auth' })
}

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { result, refreshToken } = await authService.register(req.body, ctxFrom(req))
      setRefreshCookie(res, refreshToken)
      res.status(201).json({ success: true, data: result })
    } catch (e) {
      next(e)
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { result, refreshToken } = await authService.login(req.body, ctxFrom(req))
      setRefreshCookie(res, refreshToken)
      res.json({ success: true, data: result })
    } catch (e) {
      next(e)
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const raw = req.cookies?.[config.cookie.name]
      const { result, refreshToken } = await authService.refresh(raw, ctxFrom(req))
      setRefreshCookie(res, refreshToken)
      res.json({ success: true, data: result })
    } catch (e) {
      clearRefreshCookie(res)
      next(e)
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.logout(req.cookies?.[config.cookie.name], req.body?.allDevices === true)
      clearRefreshCookie(res)
      res.json({ success: true, data: { loggedOut: true } })
    } catch (e) {
      next(e)
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await authService.getProfile(req.auth!.sub)
      res.json({ success: true, data: profile })
    } catch (e) {
      next(e)
    }
  },

  // ── OTP ──
  async requestOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const out = await otpService.request(req.auth!.sub, req.body.channel)
      res.json({ success: true, data: out })
    } catch (e) {
      next(e)
    }
  },

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      await otpService.verify(req.auth!.sub, req.body.channel, req.body.code)
      await kycService.maybePromoteToBasic(req.auth!.sub)
      res.json({ success: true, data: { verified: true } })
    } catch (e) {
      next(e)
    }
  },

  // ── KYC ──
  async kycStatus(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await kycService.getStatus(req.auth!.sub) })
    } catch (e) {
      next(e)
    }
  },

  async kycSubmit(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await kycService.submitFull(req.auth!.sub, req.body)
      res.json({ success: true, data: result })
    } catch (e) {
      next(e)
    }
  },
}
