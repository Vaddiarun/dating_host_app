import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { getSocket, onSocketEvent } from '../lib/socket.js'
import { unlockAudio, playChime } from '../lib/sound.js'
import { beans as formatBeans, lakhBeans } from '../lib/format.js'
import Icon from '../ui/Icon.jsx'
import { GiftRays, ConfettiBurst, FloatingSparkles, useCountUpFrom0 } from '../ui/GiftCelebration.jsx'

const GIFT_POPUP_MS = 5000

/** A gift is a real-money, worth-celebrating moment — centered like a real celebration
 * rather than tucked in a corner: the gift pops in over spinning light rays, confetti bursts
 * out of it, sparkles drift up, and the credited beans count up. A thin bar shows when it will
 * close by itself. Tapping the backdrop (or the card's own dismiss) closes it early. Sits on
 * its own regardless of what screen is behind it (light or the dark call/live screens), so
 * it's a solid white card rather than something theme-matched. */
function GiftPopup({ data, onClose }) {
  const beans = useCountUpFrom0(data.beansCredited)
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center px-6 bg-ink-900/35 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
      role="alertdialog"
      aria-label={data.senderName ? `${data.senderName} sent you ${data.giftName}, ${data.beansCredited} beans` : `Gift received: ${data.giftName}`}
    >
      <div
        className="relative w-full max-w-[320px] rounded-3xl bg-white shadow-pop overflow-hidden animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <FloatingSparkles seed={data.at} />
        <button onClick={onClose} className="absolute z-10 top-3 right-3 h-7 w-7 grid place-items-center rounded-full text-ink-300 hover:bg-black/5 hover:text-ink-500" aria-label="Close">
          <Icon name="x" size={14} />
        </button>
        <div className="relative flex flex-col items-center text-center px-6 pt-9 pb-5">
          <div className="relative grid place-items-center h-24 w-24">
            <GiftRays size={250} />
            <span className="pointer-events-none absolute h-28 w-28 rounded-full bg-gold-300/40 blur-2xl animate-glow-breathe" />
            <ConfettiBurst seed={data.at} />
            <span className="relative grid place-items-center h-[72px] w-[72px] rounded-[22px] bg-gradient-to-br from-gold-300 to-gold-500 text-white shadow-[0_12px_30px_-8px_rgba(224,169,46,.9)] gift-pop">
              <Icon name="gift" size={32} />
            </span>
          </div>
          <h2 className="relative mt-3 text-[18px] font-extrabold text-ink-900 animate-slide-up" style={{ animationDelay: '250ms' }}>{data.senderName ? `${data.senderName} sent a gift!` : 'Gift received!'}</h2>
          <p className="relative text-[13px] text-ink-500 mt-0.5 animate-slide-up" style={{ animationDelay: '330ms' }}>{data.giftName}</p>
        </div>
        <div className="gift-shine flex items-center justify-between px-6 py-3 bg-gold-50/80 border-t border-black/5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gold-600 whitespace-nowrap">Added to balance</span>
          <span className="text-[17px] font-extrabold text-gold-600 tabular-nums whitespace-nowrap">+{formatBeans(beans)} beans</span>
        </div>
        {/* auto-dismiss countdown */}
        <span className="block h-[3px] bg-gold-400/70 gift-timer" style={{ animationDuration: `${GIFT_POPUP_MS}ms` }} />
      </div>
    </div>
  )
}

const REWARD_POPUP_MS = 9000

/** A daily/weekly reward win (notification:new, type "host_reward") — the biggest moment in the
 * app, so it gets the full celebration: trophy over rays and confetti, the rank, the beans
 * counting up, and a way through to the rewards screen. */
function RewardPopup({ data, onClose, onView }) {
  const count = useCountUpFrom0(data.rewardBeans)
  const weekly = data.period === 'weekly'
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-6 bg-ink-900/50 backdrop-blur-[2px] animate-fade-in" onClick={onClose} role="alertdialog" aria-label={data.title}>
      <div className="relative w-full max-w-[340px] rounded-3xl bg-[#140a2b] text-white shadow-pop overflow-hidden animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute -left-16 -top-20 h-60 w-60 rounded-full bg-brand-600/50 blur-3xl" />
        <FloatingSparkles seed={data.at} />
        <button onClick={onClose} className="absolute z-10 top-3 right-3 h-7 w-7 grid place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close">
          <Icon name="x" size={14} />
        </button>
        <div className="relative flex flex-col items-center text-center px-6 pt-9 pb-5">
          <div className="relative grid place-items-center h-24 w-24">
            <GiftRays size={260} />
            <span className="pointer-events-none absolute h-28 w-28 rounded-full bg-gold-300/40 blur-2xl animate-glow-breathe" />
            <ConfettiBurst seed={data.at} />
            <span className="relative grid place-items-center h-[76px] w-[76px] rounded-[24px] bg-gradient-to-br from-gold-300 to-gold-500 text-[#5a3d00] shadow-[0_12px_30px_-8px_rgba(224,169,46,.9)] gift-pop">
              <Icon name="trophy" size={36} />
            </span>
          </div>
          <p className="relative mt-4 text-[11px] font-bold uppercase tracking-[.16em] text-gold-300 animate-slide-up" style={{ animationDelay: '200ms' }}>{weekly ? 'Weekly Wins' : 'Daily Wins'}</p>
          <h2 className="relative mt-1 text-[22px] font-extrabold animate-slide-up" style={{ animationDelay: '260ms' }}>{data.rank ? `You finished #${data.rank}!` : data.title}</h2>
          {data.message && <p className="relative mt-1 text-[13px] text-white/65 animate-slide-up" style={{ animationDelay: '330ms' }}>{data.message}</p>}
        </div>
        {data.rewardBeans > 0 && (
          <div className="relative gift-shine flex items-center justify-between px-6 py-3 bg-gold-400/15 border-t border-white/10">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gold-300 whitespace-nowrap">Added to balance</span>
            <span className="text-[18px] font-extrabold text-gold-300 tabular-nums whitespace-nowrap">+{data.rewardBeans >= 1e5 && count === data.rewardBeans ? lakhBeans(count) : formatBeans(count)} beans</span>
          </div>
        )}
        <div className="relative px-5 pt-3 pb-5">
          <button onClick={onView} className="btn-gold">View my wins</button>
        </div>
        <span className="relative block h-[3px] bg-gold-400/70 gift-timer" style={{ animationDuration: `${REWARD_POPUP_MS}ms` }} />
      </div>
    </div>
  )
}

/** The reward fields may sit at the top level of the notification or under data/metadata. */
function rewardFromNotification(n) {
  const d = { ...(n?.metadata || {}), ...(n?.data || {}), ...(n?.payload || {}) }
  // The text reads e.g. "Daily reward won! You ranked #1 — 150000 beans added", so fall back to
  // reading rank / beans / period from it when they aren't sent as fields.
  const text = [n?.title, n?.body, n?.message].filter(Boolean).join(' ')
  const rankInText = /#\s*(\d+)/.exec(text)?.[1]
  const beansInText = /(\d[\d,]*)\s*beans/i.exec(text)?.[1]
  return {
    title: n?.title || 'You won a reward!',
    message: n?.body || n?.message || '',
    rank: d.rank ?? n?.rank ?? (rankInText ? Number(rankInText) : null),
    rewardBeans: d.rewardBeans ?? n?.rewardBeans ?? (beansInText ? Number(beansInText.replace(/,/g, '')) : 0),
    period: d.period ?? n?.period ?? (/weekly/i.test(text) ? 'weekly' : 'daily'),
  }
}

/** Mounted once at the app root while authed. Turns the backend's realtime push
 * (call:incoming / call:ended / gift:received / kyc:decision) into real navigation
 * + a notice, instead of the host having to poll or manually deep-link. */
export default function RealtimeBridge() {
  const { status, refreshMe } = useAuth()
  const nav = useNavigate()
  const [toast, setToast] = useState(null) // { icon, title } | null — quiet one-liners
  const [gift, setGift] = useState(null) // { senderName?, giftName, beansCredited } | null
  const [reward, setReward] = useState(null) // { title, message, rank, rewardBeans, period, at } | null
  const toastTimerRef = useRef(null)
  const giftTimerRef = useRef(null)
  const rewardTimerRef = useRef(null)

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
      // `at` keys the popup, so a second gift arriving while one is showing replays the
      // celebration instead of silently swapping the text.
      setGift({ ...data, at: Date.now() })
      try { playChime() } catch { /* audio not unlocked yet — the visual still plays */ }
      giftTimerRef.current = setTimeout(() => setGift(null), GIFT_POPUP_MS)
    }

    const attach = () => {
      const socket = getSocket()
      if (!socket) {
        if (!cancelled) setTimeout(attach, 300)
        return
      }

      unsubs.push(onSocketEvent('call:incoming', ({ callId, userId, callerName, ratePerMinutePaise, type, callType }) => {
        const params = new URLSearchParams({ callId, callerId: userId ?? '', rate: ratePerMinutePaise ?? '' })
        if (callerName) params.set('callerName', callerName)
        // voice vs video — IncomingCall falls back to fetching the call if this isn't in the payload
        if (type || callType) params.set('type', type || callType)
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

      // Levels go up automatically on the backend as earnings cross each 1,00,000-bean mark.
      unsubs.push(onSocketEvent('host:level-up', ({ level }) => {
        showToast('crown', `Level up! You're now Level ${level} — your max prices went up`)
      }))

      unsubs.push(onSocketEvent('notification:new', (n) => {
        if (n?.type !== 'host_reward') return
        clearTimeout(rewardTimerRef.current)
        setReward({ ...rewardFromNotification(n), at: Date.now() })
        try { playChime() } catch { /* audio not unlocked yet — the visual still plays */ }
        rewardTimerRef.current = setTimeout(() => setReward(null), REWARD_POPUP_MS)
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
      clearTimeout(rewardTimerRef.current)
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
      {reward && (
        <RewardPopup
          key={reward.at}
          data={reward}
          onClose={() => { clearTimeout(rewardTimerRef.current); setReward(null) }}
          onView={() => { clearTimeout(rewardTimerRef.current); setReward(null); nav(`/rewards?tab=${reward.period}`) }}
        />
      )}
      {gift && <GiftPopup key={gift.at} data={gift} onClose={() => { clearTimeout(giftTimerRef.current); setGift(null) }} />}
    </>
  )
}
