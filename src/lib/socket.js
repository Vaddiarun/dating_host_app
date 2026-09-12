import { io } from 'socket.io-client'
import { BASE_URL, getTokens } from '../api/client.js'

let socket = null

/** Opens (or reuses) the realtime connection, authenticating with whatever access token is
 * current at connect/reconnect time — `auth` as a callback so a token refresh is picked up
 * without tearing the socket down. */
export function connectSocket() {
  const { accessToken } = getTokens()
  if (!accessToken) return null
  if (socket) return socket
  socket = io(BASE_URL, {
    auth: (cb) => cb({ token: getTokens().accessToken }),
    reconnection: true,
    reconnectionDelay: 1500,
  })
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

export function getSocket() {
  return socket
}

/** Subscribe to a realtime event; returns an unsubscribe function. Safe to call before the
 * socket connects — it attaches lazily via getSocket() at call time and again on each call,
 * so prefer calling this from an effect that re-runs once the socket exists. */
export function onSocketEvent(event, handler) {
  const s = getSocket()
  if (!s) return () => {}
  s.on(event, handler)
  return () => s.off(event, handler)
}
