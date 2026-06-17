import type { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { callbackService } from '../services/aggregators/callback.service.js'
import { ProviderError, type NormalizedCallback } from '../services/aggregators/types.js'

/**
 * Single callback entrypoint per provider (POST /api/aggregator/callback/:provider).
 * The signature middleware has already verified HMAC + IP and attached the
 * provider + adapter. Here we:
 *   1. parse the provider's wire format → NormalizedCallback,
 *   2. persist a CallbackLog (audit + retry source),
 *   3. apply the wallet effect via the idempotent callback.service,
 *   4. respond in the seamless-wallet convention (HTTP 200, status in body).
 */
export const aggregatorCallbackController = {
  async handle(req: Request, res: Response): Promise<void> {
    const provider = req.aggProvider!
    const adapter = req.aggAdapter!

    let normalized: NormalizedCallback | null = null
    let logId: string | null = null

    try {
      normalized = adapter.parseCallback(req.body)

      const log = await prisma.callbackLog.create({
        data: {
          providerCode: provider.code,
          action: normalized.action,
          ipAddress: req.ip,
          signatureValid: true,
          status: 'RECEIVED',
          idempotencyKey: `${provider.code}:${normalized.action}:${normalized.providerTxId}`,
          payload: req.body as Prisma.InputJsonValue,
        },
      })
      logId = log.id

      const result = await callbackService.process(provider, normalized)

      const body = {
        status: 'OK',
        balance: Number((result.balanceMinor / 100).toFixed(2)),
        balanceMinor: result.balanceMinor,
        currency: result.currency,
        transactionId: result.transactionId,
      }
      await prisma.callbackLog.update({
        where: { id: log.id },
        data: { status: 'PROCESSED', response: body as Prisma.InputJsonValue },
      })
      res.status(200).json(body)
    } catch (e) {
      const code = e instanceof ProviderError ? e.code : 'INTERNAL'
      const message = e instanceof Error ? e.message : 'callback failed'
      logger.error({ provider: provider.code, code, err: message }, 'callback processing failed')

      if (logId) {
        await prisma.callbackLog
          .update({ where: { id: logId }, data: { status: 'FAILED', error: `${code}: ${message}` } })
          .catch(() => {})
      }
      // Seamless-wallet convention: HTTP 200 with an error status the provider parses.
      res.status(200).json({ status: 'ERROR', code })
    }
  },
}
