import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { Avatar, Toggle, SectionTitle, ErrorCard, FloatingGoLive } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { useAuth } from '../state/AuthContext.jsx'
import { useNotificationsCount } from '../state/NotificationsContext.jsx'
import { earnings as earningsApi, presence as presenceApi } from '../api/index.js'
import { errorMessage } from '../lib/errors.js'

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
        <Avatar name={name} size={40} ring="rgba(255,255,255,.8)" className="shrink-0" />
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
  return (
    <div className="card p-3.5 flex items-center gap-3 bg-brand-50/60 border-brand-100">
      <span className="grid place-items-center h-10 w-10 rounded-xl bg-brand-100 text-brand-600 shrink-0"><Icon name="sparkles" size={18} /></span>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-bold text-ink-900">Invite hosts &amp; earn 15%</p>
        <p className="text-[11.5px] text-ink-400">Grow the creator community together</p>
      </div>
      {/* No referral/invite endpoint exists yet — kept as a static preview of the design
          rather than wiring a button to nothing. */}
      <span className="pill bg-black/10 text-ink-400 text-[12px] font-bold shrink-0 px-3 py-1.5">Coming soon</span>
    </div>
  )
}

/* No backend field for any of this yet (performance score, conversion, livestream score) —
 * shown as a static placeholder per product's request, clearly separate from the real
 * online/offline card above it. Swap for real numbers once the backend exposes them. */
// Gauge dial geometry, shared by the coloured segments and the tick marks below.
const GAUGE_R = 42
const GAUGE_CX = 50
const GAUGE_CY = 52
function gaugePoint(t) {
  const ang = Math.PI * (1 - t) // t=0 -> 180deg (left end), t=1 -> 0deg (right end)
  return [GAUGE_CX + GAUGE_R * Math.cos(ang), GAUGE_CY - GAUGE_R * Math.sin(ang)]
}
function gaugeArc(t0, t1) {
  const [x0, y0] = gaugePoint(t0)
  const [x1, y1] = gaugePoint(t1)
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${GAUGE_R},${GAUGE_R} 0 0,1 ${x1.toFixed(2)},${y1.toFixed(2)}`
}
// Four bands (red/orange/yellow/green) each pulled in from its quarter boundary so a visible
// gap separates one colour from the next, instead of one continuous gradient stroke.
const GAUGE_GAP = 0.014
const GAUGE_BANDS = [
  ['#e2415a', 0, 0.25],
  ['#f0a63c', 0.25, 0.5],
  ['#e9d24a', 0.5, 0.75],
  ['#3fb96f', 0.75, 1],
].map(([color, t0, t1]) => [color, t0 + GAUGE_GAP, t1 - GAUGE_GAP])

function PerformanceMeter() {
  const pct = 0.86 // decorative position along the dial for the "100+ / Excellent" tier
  const [swept, setSwept] = useState(false)
  // Needle starts pinned at the low end and sweeps into place on mount, like a real dashboard
  // gauge — requestAnimationFrame (not a plain state-on-mount) so the browser actually paints
  // the 0% frame first before the CSS transition kicks in, or it'd just snap straight there.
  useEffect(() => {
    const id = requestAnimationFrame(() => setSwept(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const needleDeg = ((swept ? pct : 0) - 0.5) * 180 // -90deg (low end) .. +90deg (high end)

  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 mb-1">
        <SectionTitle className="!mb-0">Performance Meter</SectionTitle>
        <Icon name="help" size={13} className="text-ink-300" />
      </div>
      <div className="flex flex-col items-center pt-1">
        <svg viewBox="0 0 100 56" className="w-48 h-auto overflow-visible">
          {GAUGE_BANDS.map(([color, t0, t1]) => (
            <path key={color} d={gaugeArc(t0, t1)} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />
          ))}
          {/* pulled in a few units from the arc (28→34 instead of 33→38.5) so there's a clear
              gap between the tick marks and the coloured band instead of touching it */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const ang = Math.PI * (1 - t)
            const x1 = 50 + 28 * Math.cos(ang), y1 = 52 - 28 * Math.sin(ang)
            const x2 = 50 + 34 * Math.cos(ang), y2 = 52 - 34 * Math.sin(ang)
            return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth="1.5" />
          })}
          {/* longer needle (y=15→9) so it reaches higher toward the arc */}
          <g style={{ transform: `rotate(${needleDeg}deg)`, transformOrigin: '50px 52px', transition: 'transform 900ms cubic-bezier(.22,1,.36,1)' }}>
            <line x1="50" y1="52" x2="50" y2="9" stroke="#1c1330" strokeWidth="2.5" strokeLinecap="round" />
          </g>
          <circle cx="50" cy="52" r="4.5" fill="#1c1330" />
        </svg>
        <p className="text-[22px] font-extrabold text-ink-900 -mt-1">100+</p>
        <p className="text-[12px] font-semibold text-emerald-600">Excellent</p>
        <p className="text-[11px] text-ink-400 mt-1">Conversion 46:11</p>
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
    <AppLayout title="Performance" back maxW="lg" bg="white" pad={false}>
      <div className="lg:hidden">
        <Header name={name} isOnline={isOnline} />
        {loading ? (
          <div className="px-5 pt-4 pb-24 space-y-4 animate-pulse">
            <div className="h-16 rounded-2xl bg-black/[.06]" />
            <div className="h-48 rounded-2xl bg-black/[.06]" />
          </div>
        ) : (
          <div className="px-5 pt-4 pb-24 space-y-4">
            <ErrorCard message={err} onRetry={load} compact />
            <PresenceCard isOnline={isOnline} toggling={toggling} onToggle={toggleOnline} />
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
      <div className="hidden lg:block px-8 py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Avatar name={name} size={48} ring="#6d3be6" />
          <div>
            <p className="text-[20px] font-extrabold text-ink-900">Hi, {name}</p>
            <p className="text-[13px] text-ink-400">{isOnline ? "You're online" : "You're offline"}</p>
          </div>
        </div>
        <ErrorCard message={err} onRetry={load} compact className="mb-4" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <PresenceCard isOnline={isOnline} toggling={toggling} onToggle={toggleOnline} />
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
