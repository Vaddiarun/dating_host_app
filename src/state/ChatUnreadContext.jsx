import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from './AuthContext.jsx'
import { chat as chatApi } from '../api/index.js'
import { onSocketEventWhenReady } from '../lib/socket.js'

const ChatUnreadContext = createContext(null)
const READ_KEY = 'host_chat_last_read' // { [conversationId]: ISO time the host last opened it }
const BASELINE_KEY = 'host_chat_read_baseline' // first run: everything before this counts as read

function loadRead() {
  try { return JSON.parse(localStorage.getItem(READ_KEY)) || {} } catch { return {} }
}
function saveRead(map) {
  try { localStorage.setItem(READ_KEY, JSON.stringify(map)) } catch { /* storage unavailable */ }
}
function baseline() {
  try {
    let b = localStorage.getItem(BASELINE_KEY)
    if (!b) { b = new Date().toISOString(); localStorage.setItem(BASELINE_KEY, b) }
    return b
  } catch { return new Date(0).toISOString() }
}

/** Unread chats for the Chat badge (it used to be a hard-coded "3"). The conversations endpoint
 * has no unread field, so this compares each conversation's lastMessageAt with when the host last
 * opened it (kept on this device) — the same "chats with new messages" count WhatsApp shows on
 * its tab. A message the host sent themselves never counts. Refreshed on every chat:message. */
export function ChatUnreadProvider({ children }) {
  const { status, me } = useAuth()
  const [conversations, setConversations] = useState([])
  const [readMap, setReadMap] = useState(loadRead)
  const [base] = useState(baseline)

  const refresh = useCallback(() => {
    if (status !== 'authed') return
    chatApi.listConversations().then((res) => setConversations(res.conversations || [])).catch(() => {})
  }, [status])

  useEffect(() => {
    if (status !== 'authed') { setConversations([]); return }
    refresh()
  }, [status, refresh])

  useEffect(() => {
    if (status !== 'authed') return
    return onSocketEventWhenReady('chat:message', refresh)
  }, [status, refresh])

  const markRead = useCallback((conversationId) => {
    if (!conversationId) return
    setReadMap((prev) => {
      const next = { ...prev, [conversationId]: new Date().toISOString() }
      saveRead(next)
      return next
    })
  }, [])

  const unreadIds = useMemo(() => {
    const ids = new Set()
    for (const c of conversations) {
      if (!c.lastMessageAt) continue
      const lastSender = c.lastMessage?.senderId ?? c.lastMessageSenderId
      if (lastSender && me?.id && lastSender === me.id) continue // the host's own message
      const readAt = readMap[c.id] || base
      if (new Date(c.lastMessageAt) > new Date(readAt)) ids.add(c.id)
    }
    return ids
  }, [conversations, readMap, base, me?.id])

  const value = useMemo(() => ({ chatUnread: unreadIds.size, unreadIds, markRead, refresh }), [unreadIds, markRead, refresh])
  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>
}

const EMPTY = { chatUnread: 0, unreadIds: new Set(), markRead: () => {}, refresh: () => {} }
/** Safe outside the provider too (returns zero), so shared UI never crashes on a missing wrapper. */
export function useChatUnread() {
  return useContext(ChatUnreadContext) || EMPTY
}
