import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext.jsx'
import { notifications as notificationsApi } from '../api/index.js'
import { onSocketEventWhenReady } from '../lib/socket.js'

const NotificationsCountContext = createContext(null)

/** Tracks the unread-notifications badge shown in the sidebar / top bar / mobile header, so it
 * reflects the real feed (GET /me/notifications) instead of the "4" placeholder those screens
 * used to hardcode. There's no dedicated unread-count endpoint, so this counts unread items in
 * the first page — exact as long as unread notifications fit on one page, an undercount beyond
 * that (a stale-but-live approximation is still better than a number that never changes). */
export function NotificationsProvider({ children }) {
  const { status } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(() => {
    if (status !== 'authed') return
    notificationsApi.list(1, 50)
      .then((res) => {
        const list = res.items || res.notifications || res.results || []
        setUnreadCount(list.filter((n) => !(n.isRead ?? n.read ?? false)).length)
      })
      .catch(() => {}) // badge just stays at its last known value
  }, [status])

  useEffect(() => {
    if (status !== 'authed') { setUnreadCount(0); return }
    refresh()
  }, [status, refresh])

  useEffect(() => {
    if (status !== 'authed') return
    return onSocketEventWhenReady('notification:new', () => setUnreadCount((c) => c + 1))
  }, [status])

  const decrementBy = useCallback((n) => setUnreadCount((c) => Math.max(0, c - n)), [])

  return (
    <NotificationsCountContext.Provider value={{ unreadCount, refresh, decrementBy }}>
      {children}
    </NotificationsCountContext.Provider>
  )
}

export function useNotificationsCount() {
  const ctx = useContext(NotificationsCountContext)
  if (!ctx) throw new Error('useNotificationsCount must be used within NotificationsProvider')
  return ctx
}
