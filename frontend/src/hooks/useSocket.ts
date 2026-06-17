import { useEffect, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import { connectSocket, disconnectSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/authStore'
import { useWalletStore } from '@/store/walletStore'
import { useBonusStore } from '@/store/useBonusStore'
import { useLoyaltyStore } from '@/store/useLoyaltyStore'
import { notify } from '@/store/useNotifications'
import type { BalanceUpdate } from '@/types/wallet.types'
import type { BonusProgressEvent, BonusCompletedEvent, BonusEndedEvent } from '@/types/bonus.types'
import type {
  PointsEvent,
  LevelUpEvent,
  MissionProgressEvent,
  MissionCompletedEvent,
} from '@/types/loyalty.types'

interface SocketHandlers {
  onBalance?: (u: BalanceUpdate) => void
  onGameResult?: (result: unknown) => void
  onNotification?: (n: { type: string; message: string }) => void
}

/**
 * Connects the authenticated socket and wires real-time events into stores.
 * Re-connects whenever the access token changes (e.g. after refresh/login),
 * and tears down on logout/unmount. By default it pipes `balance:update`
 * straight into the wallet store so balances stay live everywhere.
 */
export function useSocket(handlers: SocketHandlers = {}): { socket: Socket | null } {
  const accessToken = useAuthStore((s) => s.accessToken)
  const applyBalanceUpdate = useWalletStore((s) => s.applyBalanceUpdate)
  const socketRef = useRef<Socket | null>(null)

  // Keep latest handlers without forcing reconnects.
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!accessToken) {
      disconnectSocket()
      socketRef.current = null
      return
    }

    const socket = connectSocket(accessToken)
    socketRef.current = socket

    const onBalance = (u: BalanceUpdate) => {
      applyBalanceUpdate(u)
      handlersRef.current.onBalance?.(u)
    }
    const onResult = (r: unknown) => {
      // Surface notable wins as a notification.
      const res = r as { game?: string; payout?: number } | undefined
      if (res?.payout && res.payout > 0) {
        notify({ title: 'You won!', message: `${res.game ?? 'Game'} payout credited`, variant: 'win' })
      }
      handlersRef.current.onGameResult?.(r)
    }
    const onNotif = (n: { type: string; message: string }) => {
      notify({ title: n.type || 'Notice', message: n.message, variant: 'info' })
      handlersRef.current.onNotification?.(n)
    }

    // ── Bonus realtime → bonus store ──
    const onBonusProgress = (e: BonusProgressEvent) => useBonusStore.getState().applyProgress(e)
    const onBonusCompleted = (e: BonusCompletedEvent) => useBonusStore.getState().applyCompleted(e)
    const onBonusGranted = () => {
      notify({ title: 'Bonus credited', message: 'A bonus was added to your account', variant: 'success' })
      void useBonusStore.getState().fetchAll()
    }
    const onBonusEnded = (e: BonusEndedEvent) => useBonusStore.getState().applyEnded(e)

    // ── Loyalty / VIP realtime → loyalty store ──
    const onPoints = (e: PointsEvent) => useLoyaltyStore.getState().applyPoints(e)
    const onLevelUp = (e: LevelUpEvent) => useLoyaltyStore.getState().applyLevelUp(e)
    const onMissionProgress = (e: MissionProgressEvent) => useLoyaltyStore.getState().applyMissionProgress(e)
    const onMissionCompleted = (e: MissionCompletedEvent) => useLoyaltyStore.getState().applyMissionCompleted(e)

    socket.on('balance:update', onBalance)
    socket.on('game:result', onResult)
    socket.on('notification', onNotif)
    socket.on('bonus:progress', onBonusProgress)
    socket.on('bonus:completed', onBonusCompleted)
    socket.on('bonus:granted', onBonusGranted)
    socket.on('bonus:ended', onBonusEnded)
    socket.on('loyalty:points', onPoints)
    socket.on('vip:levelup', onLevelUp)
    socket.on('mission:progress', onMissionProgress)
    socket.on('mission:completed', onMissionCompleted)
    socket.emit('balance:subscribe')

    return () => {
      socket.off('balance:update', onBalance)
      socket.off('game:result', onResult)
      socket.off('notification', onNotif)
      socket.off('bonus:progress', onBonusProgress)
      socket.off('bonus:completed', onBonusCompleted)
      socket.off('bonus:granted', onBonusGranted)
      socket.off('bonus:ended', onBonusEnded)
      socket.off('loyalty:points', onPoints)
      socket.off('vip:levelup', onLevelUp)
      socket.off('mission:progress', onMissionProgress)
      socket.off('mission:completed', onMissionCompleted)
    }
  }, [accessToken, applyBalanceUpdate])

  return { socket: socketRef.current }
}
