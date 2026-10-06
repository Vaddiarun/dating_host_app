import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { Avatar, Toggle, SectionTitle, ErrorCard, FloatingGoLive } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { useAuth } from '../state/AuthContext.jsx'
import { useNotificationsCount } from '../state/NotificationsContext.jsx'
import { earnings as earningsApi, presence as presenceApi } from '../api/index.js'
import { errorMessage } from '../lib/errors.js'
import { TodayReportCard } from './dailyReport.jsx'
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
// LED-segment meter: a half-ring of bars that light up one by one up to the score (no needle).
const LED_CX = 100
const LED_CY = 104
const LED_COUNT = 28
const ledColor = (t) => (t < 0.25 ? '#f43f5e' : t < 0.5 ? '#f59e0b' : t < 0.75 ? '#eab308' : '#10b981')
const LED_SEGMENTS = Array.from({ length: LED_COUNT }, (_, i) => {
  const t = (i + 0.5) / LED_COUNT
  const a = Math.PI * (1 - t) // t=0 left end, t=1 right end
  const p = (r) => [LED_CX + r * Math.cos(a), LED_CY - r * Math.sin(a)]
  const [x1, y1] = p(64)
  const [x2, y2] = p(88)
  return { t, x1, y1, x2, y2, color: ledColor(t) }
})

function PerformanceMeter() {
  const pct = 0.86 // how far the bars light up for the "100+ / Excellent" tier (placeholder until the backend sends a score)
  const [lit, setLit] = useState(false)
  // Bars start dim and light up in sequence on mount — requestAnimationFrame so the dim frame
  // paints first and the CSS transitions actually run instead of snapping.
  useEffect(() => {
    const id = requestAnimationFrame(() => setLit(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 mb-1">
        <SectionTitle className="!mb-0">Performance Meter</SectionTitle>
        <Icon name="help" size={13} className="text-ink-300" />
      </div>
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 200 112" className="w-60 max-w-full h-auto">
          {LED_SEGMENTS.map((s, i) => (
            <line
              key={i}
              x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
              stroke={s.color} strokeWidth="5.5" strokeLinecap="round"
              style={{ opacity: lit && s.t <= pct ? 1 : 0.15, transition: 'opacity 400ms ease', transitionDelay: `${i * 35}ms` }}
            />
          ))}
          <text x={LED_CX} y={LED_CY - 12} textAnchor="middle" fontSize="28" fontWeight="800" fill="#1c1330">100+</text>
          <text x={LED_CX} y={LED_CY + 2} textAnchor="middle" fontSize="8.5" fontWeight="700" letterSpacing="1" fill="#8c8a96">SCORE</text>
        </svg>

        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-bold text-emerald-700">
          <Icon name="trending-up" size={12} /> Excellent
        </span>
        <p className="text-[11.5px] text-ink-400 mt-2">Conversion <span className="font-semibold text-ink-700">46:11</span></p>
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
