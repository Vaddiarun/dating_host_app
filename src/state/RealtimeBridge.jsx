import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { getSocket, onSocketEvent } from '../lib/socket.js'
import { unlockAudio } from '../lib/sound.js'
import Icon from '../ui/Icon.jsx'

/** Mounted once at the app root while authed. Turns the backend's realtime push
 * (call:incoming / call:ended / gift:received / kyc:decision) into real navigation
 * + a toast, instead of the host having to poll or manually deep-link. */
export default function RealtimeBridge() {
  const { status, refreshMe } = useAuth()
  const nav = useNavigate()
  const [toast, setToast] = useState(null)

  // The incoming-call ringtone fires from an async socket push, with no click/tap happening
  // at that exact moment — a browser only lets audio actually play if its AudioContext was
  // resumed from inside a real user gesture, so without this the ring would be silently
  // dropped the very first time a call comes in. Any tap/keypress anywhere in the app while
  // logged in warms it up ahead of time, well before a real call needs it.
  useEffect(() => {
    if (status !== 'authed') return
    window.addEventListener('pointerdown', unlockAudio)
    window.addEventListener('keydown', unlockAudio)
    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [status])

  useEffect(() => {
    if (status !== 'authed') return
    // The socket may still be mid-handshake right after login; retry attaching
    // listeners until it exists rather than missing the window entirely.
    let unsubs = []
    let cancelled = false

    const showToast = (icon, text) => {
      setToast({ icon, text })
      setTimeout(() => setToast(null), 3500)
    }

    const attach = () => {
      const socket = getSocket()
      if (!socket) {
        if (!cancelled) setTimeout(attach, 300)
        return
      }

      unsubs.push(onSocketEvent('call:incoming', ({ callId, userId, callerName, ratePerMinutePaise }) => {
        const params = new URLSearchParams({ callId, callerId: userId ?? '', rate: ratePerMinutePaise ?? '' })
        if (callerName) params.set('callerName', callerName)
        nav(`/call/incoming?${params.toString()}`)
      }))

      // call:ended also fires for a call that rang out unanswered or was declined
      // (status: "missed" | "rejected") — the host is on /call/incoming or
      // /call/connecting then, not /call/active, and there's nothing to summarize.
      unsubs.push(onSocketEvent('call:ended', ({ callId, status: callStatus }) => {
        const hash = window.location.hash
        if (!callId || !hash.includes(`callId=${callId}`)) return
        if (hash.includes('/call/active')) {
          nav(`/call/summary?callId=${callId}`)
        } else if (hash.includes('/call/incoming') || hash.includes('/call/connecting')) {
          showToast('phone-off', callStatus === 'missed' ? 'Call missed' : 'Call ended before you joined')
          nav('/calls', { replace: true })
        }
      }))

      unsubs.push(onSocketEvent('gift:received', ({ gift, beansCredited }) => {
        showToast('gift', `${gift?.name || 'Gift'} received · +${beansCredited} beans`)
      }))

      // Only steer navigation while the host is somewhere in the onboarding flow —
      // once approved they're on the real app and this shouldn't ever fire again anyway.
      unsubs.push(onSocketEvent('kyc:decision', async ({ status: kycStatus, rejectionReason }) => {
        const me = await refreshMe().catch(() => null)
        if (!window.location.hash.includes('/onboarding/')) return
        if (kycStatus === 'approved') nav('/onboarding/verified', { replace: true })
        else if (kycStatus === 'rejected') nav('/onboarding/rejected', { replace: true, state: { reason: rejectionReason } })
        else if (me) showToast('shield', 'Your verification status was updated')
      }))
    }
    attach()

    return () => {
      cancelled = true
      unsubs.forEach((u) => u())
    }
  }, [status, nav, refreshMe])

  if (!toast) return null
  return (
    <div className="fixed top-4 inset-x-0 z-[999] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl bg-ink-900 text-white pl-3 pr-4 py-2.5 shadow-pop animate-fade-in">
        <span className="grid place-items-center h-8 w-8 rounded-full bg-gold-400/20 text-gold-300"><Icon name={toast.icon} size={16} /></span>
        <span className="text-[13px] font-semibold">{toast.text}</span>
      </div>
    </div>
  )
}
