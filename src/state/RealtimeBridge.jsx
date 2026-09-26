import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { getSocket, onSocketEvent } from '../lib/socket.js'
import { unlockAudio } from '../lib/sound.js'
import { beans as formatBeans } from '../lib/format.js'
import Icon from '../ui/Icon.jsx'

/** A gift is a real-money, worth-celebrating moment — centered like a real celebration
 * rather than tucked in a corner, with a soft backdrop so it actually reads as a moment.
 * Tapping the backdrop (or the card's own dismiss) closes it early; otherwise it clears
 * itself. Sits on its own regardless of what screen is behind it (light or the dark
 * call/live screens), so it's a solid white card rather than something theme-matched. */
function GiftPopup({ data, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center px-6 bg-ink-900/25 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[320px] rounded-3xl bg-white shadow-pop overflow-hidden animate-drop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 h-7 w-7 grid place-items-center rounded-full text-ink-300 hover:bg-black/5 hover:text-ink-500">
          <Icon name="x" size={14} />
        </button>
        <div className="relative flex flex-col items-center text-center px-6 pt-8 pb-5">
          <span className="pointer-events-none absolute top-2 h-28 w-28 rounded-full bg-gold-300/40 blur-2xl animate-glow-breathe" />
          <span className="relative grid place-items-center h-16 w-16 rounded-2xl bg-gradient-to-br from-gold-300 to-gold-500 text-white shadow-[0_10px_28px_-8px_rgba(224,169,46,.8)] animate-logo-in">
            <Icon name="gift" size={28} />
          </span>
          <h2 className="mt-4 text-[18px] font-extrabold text-ink-900">{data.senderName ? `${data.senderName} sent a gift!` : 'Gift received!'}</h2>
          <p className="text-[13px] text-ink-500 mt-0.5">{data.giftName}</p>
        </div>
        <div className="flex items-center justify-between px-6 py-3 bg-gold-50/70 border-t border-black/5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gold-600">Credited to your balance</span>
          <span className="text-[16px] font-extrabold text-gold-600">+{formatBeans(data.beansCredited)} beans</span>
        </div>
      </div>
    </div>
  )
}

/** Mounted once at the app root while authed. Turns the backend's realtime push
 * (call:incoming / call:ended / gift:received / kyc:decision) into real navigation
 * + a notice, instead of the host having to poll or manually deep-link. */
export default function RealtimeBridge() {
  const { status, refreshMe } = useAuth()
  const nav = useNavigate()
  const [toast, setToast] = useState(null) // { icon, title } | null — quiet one-liners
  const [gift, setGift] = useState(null) // { senderName?, giftName, beansCredited } | null
  const toastTimerRef = useRef(null)
  const giftTimerRef = useRef(null)

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

    const showToast = (icon, title) => {
      clearTimeout(toastTimerRef.current)
      setToast({ icon, title })
      toastTimerRef.current = setTimeout(() => setToast(null), 3500)
    }

    const showGift = (data) => {
      clearTimeout(giftTimerRef.current)
      setGift(data)
      giftTimerRef.current = setTimeout(() => setGift(null), 5000)
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

      unsubs.push(onSocketEvent('gift:received', ({ gift: g, beansCredited, senderName }) => {
        showGift({ senderName, giftName: g?.name || 'Gift', beansCredited: beansCredited ?? 0 })
      }))

      unsubs.push(onSocketEvent('gift:requestDeclined', () => {
        showToast('gift', 'Gift request declined')
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
      clearTimeout(toastTimerRef.current)
      clearTimeout(giftTimerRef.current)
      unsubs.forEach((u) => u())
    }
  }, [status, nav, refreshMe])

  return (
    <>
      {toast && (
        <div className="fixed top-4 inset-x-0 z-[999] flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl bg-ink-900 text-white pl-3 pr-4 py-2.5 shadow-pop animate-fade-in">
            <span className="grid place-items-center h-8 w-8 rounded-full bg-gold-400/20 text-gold-300"><Icon name={toast.icon} size={16} /></span>
            <span className="text-[13px] font-semibold">{toast.title}</span>
          </div>
        </div>
      )}
      {gift && <GiftPopup data={gift} onClose={() => { clearTimeout(giftTimerRef.current); setGift(null) }} />}
    </>
  )
}
