import { getIO, userRoom } from '../../services/socket.service.js'

/**
 * Server→client bonus socket pushes. Mirrors the game/balance event helpers:
 * every emit targets ONLY the owning user's room and is wrapped so a socket
 * failure can never affect the money-critical bonus transaction that triggered it.
 */

function emit(userId: string, event: string, payload: unknown): void {
  try {
    getIO().to(userRoom(userId)).emit(event, payload)
  } catch {
    /* socket not ready / user offline — non-fatal */
  }
}

/** Live wagering progress for a UserBonus (drives the progress bar). */
export function emitWageringProgress(
  userId: string,
  payload: { userBonusId: string; progressMinor: number; requiredMinor: number; percent: number },
): void {
  emit(userId, 'bonus:progress', payload)
}

/** A bonus was granted/credited. */
export function emitBonusGranted(
  userId: string,
  payload: { userBonusId: string; bonusId: string; amountMinor: number },
): void {
  emit(userId, 'bonus:granted', payload)
}

/** A bonus completed and released funds to MAIN. */
export function emitBonusCompleted(userId: string, payload: { userBonusId: string; releasedMinor: number }): void {
  emit(userId, 'bonus:completed', payload)
}

/** A bonus expired or was cancelled. */
export function emitBonusEnded(userId: string, payload: { userBonusId: string; reason: string }): void {
  emit(userId, 'bonus:ended', payload)
}
