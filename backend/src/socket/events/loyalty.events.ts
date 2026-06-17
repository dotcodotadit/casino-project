import { getIO, userRoom } from '../../services/socket.service.js'

/**
 * Server→client loyalty/VIP socket pushes. Each emit targets ONLY the owning
 * user's room and is wrapped so a socket failure can never affect the atomic
 * point/level transaction that triggered it.
 */
function emit(userId: string, event: string, payload: unknown): void {
  try {
    getIO().to(userRoom(userId)).emit(event, payload)
  } catch {
    /* socket not ready / user offline — non-fatal */
  }
}

export function emitPointsUpdate(
  userId: string,
  payload: { loyaltyPoints: number; statusPoints: number; loyaltyBalance: number; source: string },
): void {
  emit(userId, 'loyalty:points', payload)
}

export function emitLevelUp(
  userId: string,
  payload: { fromLevel: number; toLevel: number; levelName: string },
): void {
  emit(userId, 'vip:levelup', payload)
}

export function emitDowngrade(
  userId: string,
  payload: { fromLevel: number; toLevel: number; levelName: string },
): void {
  emit(userId, 'vip:downgrade', payload)
}

export function emitMissionProgress(
  userId: string,
  payload: { userMissionId: string; missionKey: string; progress: number; target: number; percent: number },
): void {
  emit(userId, 'mission:progress', payload)
}

export function emitMissionCompleted(
  userId: string,
  payload: { userMissionId: string; missionKey: string; rewardPoints: number },
): void {
  emit(userId, 'mission:completed', payload)
}

export function emitWinBig(userId: string, payload: { payoutMinor: number; multiplier: number }): void {
  emit(userId, 'win:big', payload)
}
