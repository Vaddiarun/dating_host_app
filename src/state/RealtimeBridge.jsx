import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { getSocket, onSocketEvent } from '../lib/socket.js'
import Icon from '../ui/Icon.jsx'

/** Mounted once at the app root while authed. Turns the backend's realtime push
 * (call:incoming / call:ended / gift:received) into real navigation + a toast,
 * instead of the host having to poll or manually deep-link into a call. */
export default function RealtimeBridge() {
  const { status } = useAuth()
  const nav = useNavigate()
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (status !== 'authed') return
    // The socket may still be mid-handshake right after login; retry attaching
    // listeners until it exists rather than missing the window entirely.
    let unsubs = []
    let cancelled = false

    const attach = () => {
      const socket = getSocket()
      if (!socket) {
        if (!cancelled) setTimeout(attach, 300)
        return
      }

      unsubs.push(onSocketEvent('call:incoming', ({ callId, userId, ratePerMinutePaise }) => {
        nav(`/call/incoming?callId=${callId}&callerId=${userId}&rate=${ratePerMinutePaise ?? ''}`)
      }))

      unsubs.push(onSocketEvent('call:ended', ({ callId }) => {
        const hash = window.location.hash
        if (hash.includes('/call/active') && hash.includes(`callId=${callId}`)) {
          nav(`/call/summary?callId=${callId}`)
        }
      }))

      unsubs.push(onSocketEvent('gift:received', ({ gift, beansCredited }) => {
        setToast({ name: gift?.name || 'Gift', beans: beansCredited })
        setTimeout(() => setToast(null), 4000)
      }))
    }
    attach()

    return () => {
      cancelled = true
      unsubs.forEach((u) => u())
    }
  }, [status, nav])

  if (!toast) return null
  return (
    <div className="fixed top-4 inset-x-0 z-[999] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl bg-ink-900 text-white pl-3 pr-4 py-2.5 shadow-pop animate-fade-in">
        <span className="grid place-items-center h-8 w-8 rounded-full bg-gold-400/20 text-gold-300"><Icon name="gift" size={16} /></span>
        <span className="text-[13px] font-semibold">{toast.name} received · +{toast.beans} beans</span>
      </div>
    </div>
  )
}
