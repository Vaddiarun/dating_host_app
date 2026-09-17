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
function PerformanceMeter() {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5">
        <SectionTitle className="!mb-0">Performance Meter</SectionTitle>
        <Icon name="help" size={13} className="text-ink-300" />
      </div>
      <div className="flex flex-col items-center pt-1">
        <svg viewBox="0 0 120 66" className="w-40 h-auto">
          <defs>
            <linearGradient id="perfGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#e2415a" />
              <stop offset="35%" stopColor="#f0a63c" />
              <stop offset="65%" stopColor="#e9d24a" />
              <stop offset="100%" stopColor="#3fb96f" />
            </linearGradient>
          </defs>
          <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="url(#perfGrad)" strokeWidth="11" strokeLinecap="round" />
        </svg>
        <p className="text-[22px] font-extrabold text-ink-900 -mt-6">100+</p>
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
