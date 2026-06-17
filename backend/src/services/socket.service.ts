import { Server as SocketIOServer, type Socket } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import { verifyAccessToken, type AccessTokenPayload } from '../lib/tokens.js'
import { config } from '../lib/config.js'
import { logger } from '../lib/logger.js'
import { registerBalanceEvents, startBalanceRelay } from '../socket/events/balance.events.js'
import { registerGameEvents } from '../socket/events/game.events.js'

// Per-user room name. Balance/notification events are emitted ONLY to this room
// so a user can never observe another user's data.
export const userRoom = (userId: string) => `user:${userId}`

// Augment the socket with the authenticated identity.
export interface AuthedSocket extends Socket {
  user?: AccessTokenPayload
}

let io: SocketIOServer | null = null

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialized')
  return io
}

/** Initialize Socket.io on the shared HTTP server. */
export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: config.cors.origins, credentials: true },
    transports: ['websocket'],
  })

  // ── Handshake auth: verify the JWT before the connection is accepted. ──
  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) return next(new Error('UNAUTHORIZED'))
    try {
      socket.user = verifyAccessToken(token)
      next()
    } catch {
      next(new Error('UNAUTHORIZED'))
    }
  })

  io.on('connection', (socket: AuthedSocket) => {
    const userId = socket.user!.sub
    socket.join(userRoom(userId))
    logger.info({ userId, socketId: socket.id }, 'socket connected')

    registerBalanceEvents(socket)
    registerGameEvents(socket)

    socket.on('disconnect', (reason) => {
      logger.info({ userId, socketId: socket.id, reason }, 'socket disconnected')
    })
  })

  // Start relaying wallet-service balance changes (Redis pub/sub) to rooms.
  startBalanceRelay(io)

  logger.info('Socket.io initialized')
  return io
}
