import { io, type Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '/'

let socket: Socket | null = null

/** Lazily create (or return) the singleton socket, authenticated with the access token. */
export function getSocket(token: string | null): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket'],
      auth: { token },
    })
  } else {
    socket.auth = { token }
  }
  return socket
}

export function connectSocket(token: string | null): Socket {
  const s = getSocket(token)
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket(): void {
  socket?.disconnect()
}
