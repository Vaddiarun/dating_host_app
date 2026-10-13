import { useEffect, useState, useCallback, useRef, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { Avatar, Toggle, SectionTitle, ErrorCard, FloatingGoLive } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { useAuth } from '../state/AuthContext.jsx'
import { useNotificationsCount } from '../state/NotificationsContext.jsx'
import { earnings as earningsApi, presence as presenceApi } from '../api/index.js'
import { errorMessage } from '../lib/errors.js'
import { TodayReportCard } from './dailyReport.jsx'
import { RewardsTeaser } from './rewards.jsx'
import { Skel, SkelGroup, SkelHero, SkelCard } from '../ui/Skeleton.jsx'

function Header({ name, isOnline }) {
  const nav = useNavigate()
  const { unreadCount } = useNotificationsCount()
  return (
    <div className="lg:hidden bg-gradient-to-br from-brand-700 via-brand-800 to-night-900 rounded-b-3xl px-5 pt-4 pb-6 text-white">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-bold leading-tight truncate">Hi, {name}</p>
          <span className={`inline-flex items-center gap-1.5 mt-1 pill ${isOnline ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/15 text-white/70'}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" /> {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <button onClick={() => nav('/notifications')} className="relative h-10 w-10 grid place-items-center rounded-full bg-white/10 shrink-0">
          <Icon name="bell" size={18} />
          {unreadCount > 0 && <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-rose-500 text-white text-[10px]">{unreadCount}</span>}
        </button>
        <button onClick={() => nav('/settings')} className="shrink-0 rounded-full active:scale-95 transition" aria-label="Profile & settings">
          <Avatar name={name} size={40} ring="rgba(255,255,255,.8)" />
        </button>
      </div>
    </div>
  )
}

function PresenceCard({ isOnline, toggling, onToggle }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <span className={`grid place-items-center h-11 w-11 rounded-xl shrink-0 ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-black/5 text-ink-400'}`}><Icon name="video" size={18} /></span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-ink-900">{isOnline ? "You're online" : "You're offline"}</p>
        <p className="text-[12px] text-ink-400">{isOnline ? 'Waiting for calls' : "Viewers can't call you right now"}</p>
      </div>
      <Toggle on={isOnline} onChange={() => !toggling && onToggle(!isOnline)} />
    </div>
  )
}

function InviteBanner() {
  const nav = useNavigate()
  return (
    <button onClick={() => nav('/settings/refer')} className="card w-full text-left p-3.5 flex items-center gap-3 bg-brand-50/60 border-brand-100">
      <span className="grid place-items-center h-10 w-10 rounded-xl bg-brand-100 text-brand-600 shrink-0"><Icon name="sparkles" size={18} /></span>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-bold text-ink-900">Invite hosts &amp; earn 15%</p>
        <p className="text-[11.5px] text-ink-400">Grow the creator community together</p>
      </div>
      <span className="pill bg-brand-600 text-white text-[12px] font-bold shrink-0 px-3 py-1.5">Invite</span>
    </button>
  )
}

/* No backend field for any of this yet (performance score, conversion, livestream score) —
 * shown as a static placeholder per product's request, clearly separate from the real
 * online/offline card above it. Swap for real numbers once the backend exposes them. */
// Sports-car style gauge (Audi virtual cockpit look): dark instrument face, tick ring with
// numbers, a glowing red needle that does an ignition sweep on mount, a digital score in the
// middle and a perspective road under it that scrolls faster the higher the score.
const G = { W: 240, H: 196, CX: 120, CY: 108, R: 92, MAX: 120, START: 210, SWEEP: 240, INNER: 54 }
const METER = { score: 100, plus: true, tier: 'Excellent', conversion: '46:11' }

const gaugeAngle = (v) => ((G.START - (Math.min(v, G.MAX) / G.MAX) * G.SWEEP) * Math.PI) / 180
const gaugePt = (v, r) => [G.CX + r * Math.cos(gaugeAngle(v)), G.CY - r * Math.sin(gaugeAngle(v))]
function gaugeArc(v0, v1, r) {
  const [x0, y0] = gaugePt(v0, r)
  const [x1, y1] = gaugePt(v1, r)
  const large = ((v1 - v0) / G.MAX) * G.SWEEP > 180 ? 1 : 0
  return `M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}`
}
const GAUGE_TICKS = Array.from({ length: G.MAX / 5 + 1 }, (_, i) => {
  const v = i * 5
  const major = v % 20 === 0
  const [x1, y1] = gaugePt(v, G.R - (major ? 11 : 6))
  const [x2, y2] = gaugePt(v, G.R - 1)
  const [lx, ly] = gaugePt(v, G.R - 22)
  return { v, major, x1, y1, x2, y2, lx, ly }
})

// Road: world depth z (1 = bottom edge of the road, larger = further away) projected onto the
// screen between the horizon and the bottom of the inner dial.
const ROAD = { top: G.CY + 6, bottom: G.CY + G.INNER - 2, half: 30, dashes: 7, gap: 1.1, len: 0.5 }
const roadY = (z) => ROAD.top + (ROAD.bottom - ROAD.top) / z
const roadHalf = (y) => (ROAD.half * (y - ROAD.top)) / (ROAD.bottom - ROAD.top)

/** Ignition sweep: needle runs to the end of the scale, then settles on the score. */
function useIgnitionSweep(target) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(target); return }
    let raf
    let start
    const up = 650
    const down = 900
    const ease = (k) => 1 - Math.pow(1 - k, 3)
    const step = (now) => {
      start ??= now
      const t = now - start
      if (t < up) setV(G.MAX * ease(t / up))
      else if (t < up + down) setV(G.MAX + (target - G.MAX) * ease((t - up) / down))
      else { setV(target); return }
      raf = requestAnimationFrame(step)
    }
    const delay = setTimeout(() => { raf = requestAnimationFrame(step) }, 250)
    return () => { clearTimeout(delay); cancelAnimationFrame(raf) }
  }, [target])
  return v
}

/** Moves the lane dashes towards the viewer. Writes the polygons straight to the DOM each frame
 * rather than re-rendering React 60 times a second. */
function useRoad(dashRefs, postRefs, speed) {
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const span = ROAD.dashes * ROAD.gap
    let raf
    let last
    let phase = 0
    const draw = () => {
      dashRefs.current.forEach((el, i) => {
        if (!el) return
        const zNear = 1 + ((i * ROAD.gap - phase) % span + span) % span
        const zFar = zNear + ROAD.len
        const yN = roadY(zNear)
        const yF = roadY(zFar)
        const wN = Math.max(0.4, roadHalf(yN) * 0.07)
        const wF = Math.max(0.3, roadHalf(yF) * 0.07)
        el.setAttribute('points', `${G.CX - wF},${yF} ${G.CX + wF},${yF} ${G.CX + wN},${yN} ${G.CX - wN},${yN}`)
        el.setAttribute('opacity', String(Math.min(1, 1.6 / zNear)))
      })
      postRefs.current.forEach((el, i) => {
        if (!el) return
        const k = Math.floor(i / 2)
        const side = i % 2 ? 1 : -1
        const z = 1 + ((k * ROAD.gap * 1.6 - phase) % (span * 0.8) + span * 0.8) % (span * 0.8)
        const y = roadY(z)
        const x = G.CX + side * roadHalf(y) * 1.6 * 1.12
        const h = Math.max(0.6, 6 / z)
        el.setAttribute('x', String(x - h * 0.18))
        el.setAttribute('y', String(y - h))
        el.setAttribute('width', String(h * 0.36))
        el.setAttribute('height', String(h))
        el.setAttribute('opacity', String(Math.min(0.9, 1.4 / z)))
      })
    }
    const step = (now) => {
      if (last != null) phase += ((now - last) / 1000) * speed
      last = now
      draw()
      raf = requestAnimationFrame(step)
    }
    draw()
    if (!reduced) raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [dashRefs, postRefs, speed])
}

function PerformanceMeter() {
  const uid = useId().replace(/:/g, '')
  const v = useIgnitionSweep(METER.score)
  const dashRefs = useRef([])
  const postRefs = useRef([])
  useRoad(dashRefs, postRefs, 0.8 + (METER.score / G.MAX) * 2.6)
  const settled = Math.abs(v - METER.score) < 0.5
  const [nx1, ny1] = gaugePt(v, G.INNER + 6)
  const [nx2, ny2] = gaugePt(v, G.R + 4)

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[radial-gradient(120%_90%_at_50%_0%,#23232c_0%,#0c0c11_55%,#050507_100%)] p-4 text-white shadow-pop ring-1 ring-white/10">
      {/* brushed-metal sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="flex items-center gap-1.5">
        <p className="text-[12px] font-semibold uppercase tracking-[.14em] text-white/55">Performance Meter</p>
        <Icon name="help" size={13} className="text-white/30" />
        <span className="ml-auto rounded-md bg-white/[.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.18em] text-[#ff4d5e] ring-1 ring-white/10">Dynamic</span>
      </div>

      <div className="flex flex-col items-center">
        <svg viewBox={`0 0 ${G.W} ${G.H}`} className="w-full max-w-[300px] h-auto" role="img" aria-label={`Performance score ${METER.score}${METER.plus ? '+' : ''}, ${METER.tier}`}>
          <defs>
            <linearGradient id={`${uid}-arc`} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#ff1e3c" stopOpacity=".35" />
              <stop offset="100%" stopColor="#ff3b4e" />
            </linearGradient>
            <radialGradient id={`${uid}-face`} cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#1d1d26" />
              <stop offset="100%" stopColor="#060609" />
            </radialGradient>
            <linearGradient id={`${uid}-road`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a2a35" stopOpacity="0" />
              <stop offset="100%" stopColor="#2a2a35" />
            </linearGradient>
            <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff3b4e" stopOpacity="0" />
              <stop offset="100%" stopColor="#ff3b4e" stopOpacity=".28" />
            </linearGradient>
            <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id={`${uid}-inner`}><circle cx={G.CX} cy={G.CY} r={G.INNER - 1} /></clipPath>
          </defs>

          {/* outer bezel + track */}
          <path d={gaugeArc(0, G.MAX, G.R + 7)} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="1" strokeLinecap="round" />
          <path d={gaugeArc(0, G.MAX, G.R + 3)} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="4" strokeLinecap="round" />
          {v > 0.5 && <path d={gaugeArc(0, v, G.R + 3)} fill="none" stroke={`url(#${uid}-arc)`} strokeWidth="4" strokeLinecap="round" filter={`url(#${uid}-glow)`} />}

          {/* ticks + numbers */}
          {GAUGE_TICKS.map((t) => (
            <g key={t.v}>
              <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.v <= v ? '#fff' : 'rgba(255,255,255,.28)'} strokeWidth={t.major ? 2 : 1} strokeLinecap="round" />
              {t.major && Math.abs(t.v - v) > 6 && (
                <text x={t.lx} y={t.ly + 3} textAnchor="middle" fontSize="9" fontWeight="600" fill={t.v <= v ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.35)'} style={{ fontVariantNumeric: 'tabular-nums' }}>{t.v}</text>
              )}
            </g>
          ))}

          {/* inner dial: digital readout over the road */}
          <circle cx={G.CX} cy={G.CY} r={G.INNER} fill={`url(#${uid}-face)`} stroke="rgba(255,255,255,.12)" strokeWidth="1" />
          <g clipPath={`url(#${uid}-inner)`}>
            <rect x={G.CX - G.INNER} y={ROAD.top - 14} width={G.INNER * 2} height="14" fill={`url(#${uid}-sky)`} />
            <polygon points={`${G.CX},${ROAD.top} ${G.CX + ROAD.half * 1.6},${G.CY + G.INNER} ${G.CX - ROAD.half * 1.6},${G.CY + G.INNER}`} fill={`url(#${uid}-road)`} />
            <line x1={G.CX} y1={ROAD.top} x2={G.CX - ROAD.half * 1.6} y2={G.CY + G.INNER} stroke="rgba(255,255,255,.55)" strokeWidth=".8" />
            <line x1={G.CX} y1={ROAD.top} x2={G.CX + ROAD.half * 1.6} y2={G.CY + G.INNER} stroke="rgba(255,255,255,.55)" strokeWidth=".8" />
            {Array.from({ length: ROAD.dashes }, (_, i) => (
              <polygon key={i} ref={(el) => { dashRefs.current[i] = el }} fill="#fff" />
            ))}
            {Array.from({ length: 8 }, (_, i) => (
              <rect key={i} ref={(el) => { postRefs.current[i] = el }} rx=".3" fill={i % 2 ? '#ff6b78' : '#ffe2a8'} />
            ))}
            <line x1={G.CX - G.INNER} y1={ROAD.top} x2={G.CX + G.INNER} y2={ROAD.top} stroke="rgba(255,77,94,.5)" strokeWidth=".6" />
            {/* our car, from behind — body, rear window and a full-width LED tail-light bar */}
            <g transform={`translate(${G.CX} ${G.CY + G.INNER - 9})`}>
              <ellipse cx="0" cy="6.5" rx="16" ry="2.2" fill="#000" opacity=".6" />
              <path d="M-14 5 L-14 -1 Q-14 -3 -12 -3.5 L-8 -4 L-6 -8.5 Q-5.5 -9.5 -4 -9.5 L4 -9.5 Q5.5 -9.5 6 -8.5 L8 -4 L12 -3.5 Q14 -3 14 -1 L14 5 Q14 6 13 6 L-13 6 Q-14 6 -14 5 Z" fill="#1a1a22" stroke="rgba(255,255,255,.35)" strokeWidth=".5" />
              <path d="M-5.2 -8 L5.2 -8 L6.8 -4.3 L-6.8 -4.3 Z" fill="#3a3a48" />
              <rect x="-12.5" y="-2.2" width="25" height="1.6" rx=".8" fill="#ff2a3d" filter={`url(#${uid}-glow)`} />
              <rect x="-4" y="1.6" width="8" height="2.2" rx=".4" fill="#0b0b10" stroke="rgba(255,255,255,.25)" strokeWidth=".3" />
            </g>
          </g>
          <text x={G.CX} y={G.CY - 14} textAnchor="middle" fontSize="30" fontWeight="800" fill="#fff" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>
            {Math.round(v)}{settled && METER.plus ? '+' : ''}
          </text>
          <text x={G.CX} y={G.CY - 1} textAnchor="middle" fontSize="7.5" fontWeight="700" letterSpacing="2" fill="rgba(255,255,255,.5)">SCORE</text>

          {/* needle */}
          <line x1={nx1} y1={ny1} x2={nx2} y2={ny2} stroke="#ff3b4e" strokeWidth="2.6" strokeLinecap="round" filter={`url(#${uid}-glow)`} />
          <line x1={nx1} y1={ny1} x2={nx2} y2={ny2} stroke="#ffd2d7" strokeWidth=".8" strokeLinecap="round" />
        </svg>

        {/* trip-computer strip */}
        <div className="-mt-3 grid w-full max-w-[300px] grid-cols-2 divide-x divide-white/10 rounded-xl bg-white/[.04] py-2 ring-1 ring-white/10">
          <div className="flex flex-col items-center">
            <span className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-white/40">Rating</span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-bold text-emerald-400"><Icon name="trending-up" size={12} /> {METER.tier}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-white/40">Conversion</span>
            <span className="mt-0.5 text-[13px] font-bold tabular-nums">{METER.conversion}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LivestreamScore() {
  return (
    <div className="card p-4">
      <SectionTitle className="mb-2">Livestream Score</SectionTitle>
      <p className="text-[26px] font-extrabold text-ink-900 leading-none">0.0</p>
      <p className="text-[12px] font-semibold text-rose-500 mt-0.5">Very Bad</p>
      <div className="relative h-2 rounded-full mt-3 bg-gradient-to-r from-rose-500 via-gold-400 to-emerald-500">
        <span className="absolute -top-1 left-0 h-4 w-4 rounded-full bg-white border-2 border-rose-500" />
      </div>
      <div className="flex justify-between text-[10px] text-ink-400 mt-1.5">
        <span>Very Bad</span><span>Average</span><span>Excellent</span>
      </div>
    </div>
  )
}

function HelpVideosRow() {
  const nav = useNavigate()
  return (
    <button onClick={() => nav('/settings/help')} className="card p-4 flex items-center gap-3 w-full text-left">
      <span className="grid place-items-center h-11 w-11 rounded-xl bg-brand-50 text-brand-600 shrink-0"><Icon name="video" size={18} /></span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-ink-900">Help Videos</p>
        <p className="text-[11.5px] text-ink-400">Browse through topics that matter to you</p>
      </div>
      <Icon name="chevron-right" size={16} className="text-ink-300 shrink-0" />
    </button>
  )
}

function LeaderboardLinks() {
  const nav = useNavigate()
  return (
    <div className="grid grid-cols-2 gap-3">
      <button onClick={() => nav('/leaderboard/spenders')} className="card p-3.5 flex flex-col items-center gap-1.5 text-center">
        <Icon name="crown" size={20} className="text-gold-400" />
        <span className="text-[13px] font-bold text-ink-900">Top Spenders</span>
      </button>
      <button onClick={() => nav('/leaderboard/performers')} className="card p-3.5 flex flex-col items-center gap-1.5 text-center">
        <Icon name="crown" size={20} className="text-brand-500" />
        <span className="text-[13px] font-bold text-ink-900">Top Performers</span>
      </button>
    </div>
  )
}

/* Performance dashboard — reachable from Profile & settings. Online/offline is real
 * (same presence API Home uses); the meter/score/invite sections are placeholder design
 * previews, since no backend field for any of them exists yet. */
export default function Performance() {
  const nav = useNavigate()
  const { me } = useAuth()
  const [dash, setDash] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    setErr('')
    earningsApi.dashboard().then(setDash).catch((e) => setErr(errorMessage(e, 'Could not load your status.'))).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const isOnline = !!dash?.isOnline
  const name = me?.name || 'Host'

  const toggleOnline = async (next) => {
    setToggling(true)
    try {
      await presenceApi.setOnline(next)
      setDash((d) => (d ? { ...d, isOnline: next } : d))
    } catch (e) {
      setErr(errorMessage(e, 'Could not update your status.'))
    } finally {
      setToggling(false)
    }
  }

  return (
    <AppLayout title="Performance" back maxW="xl" bg="white" pad={false}>
      <div className="lg:hidden">
        <Header name={name} isOnline={isOnline} />
        {loading ? (
          <SkelGroup className="px-5 pt-4 pb-24 space-y-4">
            <div className="card p-4 flex items-center gap-3"><Skel className="h-11 w-11 rounded-xl" /><div className="flex-1 space-y-2"><Skel className="h-3.5 w-1/3 rounded-md" /><Skel className="h-2.5 w-1/2 rounded-md" /></div><Skel className="h-7 w-12 rounded-full" /></div>
            <SkelHero height="h-44" className="rounded-3xl" />
            <Skel className="h-16 rounded-2xl" />
            <SkelCard lines={3} />
          </SkelGroup>
        ) : (
          <div className="px-5 pt-4 pb-24 space-y-4">
            <ErrorCard message={err} onRetry={load} compact />
            <PresenceCard isOnline={isOnline} toggling={toggling} onToggle={toggleOnline} />
            <TodayReportCard />
            <RewardsTeaser />
            <InviteBanner />
            <PerformanceMeter />
            <LivestreamScore />
            <HelpVideosRow />
            <LeaderboardLinks />
          </div>
        )}
        <FloatingGoLive />
      </div>

      {/* desktop — same content, no phone-style chrome */}
      <div className="hidden lg:block px-8 py-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => nav('/settings')} className="rounded-full hover:opacity-90 transition" aria-label="Profile & settings">
            <Avatar name={name} size={48} ring="#6d3be6" />
          </button>
          <div>
            <p className="text-[20px] font-extrabold text-ink-900">Hi, {name}</p>
            <p className="text-[13px] text-ink-400">{isOnline ? "You're online" : "You're offline"}</p>
          </div>
        </div>
        <ErrorCard message={err} onRetry={load} compact className="mb-4" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <PresenceCard isOnline={isOnline} toggling={toggling} onToggle={toggleOnline} />
            <TodayReportCard />
            <RewardsTeaser />
            <InviteBanner />
            <HelpVideosRow />
            <LeaderboardLinks />
          </div>
          <div className="space-y-4">
            <PerformanceMeter />
            <LivestreamScore />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
