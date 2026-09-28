// Data layer for the Daily report — loads one day's stats (online time + earnings by source)
// and a per-day series, normalizes them into one model, and derives plain-language insights.
// UI lives in screens/dailyReport.jsx.
import { earnings as earningsApi, stats as statsApi } from '../api/index.js'
import { isoDate, rupees, duration } from './format.js'

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
const DAY_MS = 86400000

// Set once GET /me/stats/* has answered 404 — no point asking again on every day switch until
// the backend ships it; the fallback endpoints are used instead for the rest of the session.
let statsUnavailable = false
const isMissingEndpoint = (e) => e?.status === 404 || e?.status === 501

// TEMPORARY — until GET /me/stats/* is live, show realistic sample numbers (clearly labelled
// "Sample data" in the UI) instead of blanks, so the screens can be reviewed. Once the backend
// answers, real data is used automatically; set this to false (or delete the sample code) then.
const USE_SAMPLE_DATA = true

// Deterministic per date, so a day shows the same sample numbers every time it's opened.
function seeded(dateIso) {
  let h = 0
  for (const ch of dateIso) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 2 ** 32 }
}

function sampleDay(dateIso, isToday) {
  const r = seeded(dateIso)
  const dayStart = new Date(`${dateIso}T00:00:00`).getTime()
  const H = 3600000
  const sessions = []
  let t = dayStart + (9 + r() * 2) * H
  for (let i = 0; i < 3; i++) {
    const len = (0.8 + r() * 1.6) * H
    let end = t + len
    if (isToday && end > Date.now()) { if (t < Date.now()) sessions.push({ start: new Date(t).toISOString(), end: null }); break }
    sessions.push({ start: new Date(t).toISOString(), end: new Date(end).toISOString() })
    t = end + (1 + r() * 3) * H
  }
  const openStart = sessions.find((s) => !s.end)
  const totalSeconds = Math.round(sessions.reduce((a, s) => a + ((s.end ? new Date(s.end).getTime() : Date.now()) - new Date(s.start).getTime()), 0) / 1000)
  const videoCount = 4 + Math.floor(r() * 6)
  const voiceCount = 2 + Math.floor(r() * 5)
  const giftCount = 2 + Math.floor(r() * 7)
  const video = { amountPaise: videoCount * (6000 + Math.floor(r() * 3000)), count: videoCount, seconds: videoCount * (420 + Math.floor(r() * 420)) }
  const voice = { amountPaise: voiceCount * (2500 + Math.floor(r() * 1500)), count: voiceCount, seconds: voiceCount * (300 + Math.floor(r() * 300)) }
  const gifts = { amountPaise: giftCount * (2000 + Math.floor(r() * 3000)), count: giftCount, seconds: null }
  const live = r() > 0.4 ? { amountPaise: 8000 + Math.floor(r() * 9000), count: 1, seconds: 1800 + Math.floor(r() * 1800) } : { amountPaise: 0, count: 0, seconds: 0 }
  const otherItems = [{ label: 'Daily login bonus', amountPaise: 2000 }, ...(r() > 0.5 ? [{ label: 'Peak-hour bonus', amountPaise: 3000 }] : [])]
  const other = { amountPaise: otherItems.reduce((a, i) => a + i.amountPaise, 0), count: otherItems.length, seconds: null }
  const answered = videoCount + voiceCount
  const missed = Math.floor(r() * 3)
  const talkSeconds = video.seconds + voice.seconds
  return {
    complete: true,
    sample: true,
    totalPaise: video.amountPaise + voice.amountPaise + gifts.amountPaise + live.amountPaise + other.amountPaise,
    sources: { video, voice, gifts, live, other },
    otherItems,
    online: { totalSeconds, sessions, isOnlineNow: !!openStart, asOf: new Date().toISOString() },
    calls: { received: answered + missed, answered, missed, rejected: 0, talkSeconds, avgCallSeconds: Math.round(talkSeconds / Math.max(1, answered)) },
  }
}

function sampleWeek(from, to) {
  const out = []
  const todayIso = isoDate(new Date())
  for (let t = new Date(`${from}T00:00:00`).getTime(); t <= new Date(`${to}T00:00:00`).getTime(); t += DAY_MS) {
    const iso = isoDate(new Date(t))
    const d = sampleDay(iso, iso === todayIso)
    out.push({ date: iso, earningsPaise: d.totalPaise, onlineSeconds: d.online.totalSeconds, sample: true })
  }
  return out
}


/* Normalized day model the screen renders — built either from the dedicated stats endpoint
 * (complete) or from the existing breakdown/dashboard endpoints (earnings only; online time
 * and call counts are null there, and the UI says so instead of showing zeros). */
function fromStats(d) {
  const e = d.earnings || {}
  const src = (x) => (x ? { amountPaise: x.amountPaise ?? 0, count: x.count ?? null, seconds: x.seconds ?? null } : null)
  return {
    complete: true,
    goalSeconds: d.dailyGoalSeconds || null,
    totalPaise: e.totalPaise ?? 0,
    sources: { video: src(e.videoCalls), voice: src(e.voiceCalls), gifts: src(e.gifts), live: src(e.liveStreams), other: src(e.other) },
    otherItems: e.other?.items || [],
    online: d.online ? {
      totalSeconds: d.online.totalSeconds ?? 0,
      sessions: d.online.sessions || [],
      isOnlineNow: !!d.online.isOnlineNow,
      asOf: d.online.asOf || null,
    } : null,
    calls: d.calls || null,
  }
}

export async function loadDay(date, isToday) {
  if (!statsUnavailable) {
    try {
      return fromStats(await statsApi.daily(date, TZ))
    } catch (e) {
      if (!isMissingEndpoint(e)) throw e
      statsUnavailable = true
    }
  }
  if (USE_SAMPLE_DATA) return sampleDay(date, isToday)
  const [b, dash] = await Promise.all([earningsApi.breakdown(date, date), isToday ? earningsApi.dashboard().catch(() => null) : null])
  const amt = (v) => (v != null ? { amountPaise: v, count: null, seconds: null } : null)
  return {
    complete: false,
    totalPaise: b?.grossEarningsPaise ?? dash?.todayEarningsPaise ?? 0,
    sources: { video: amt(b?.bySource?.videoCalls), voice: amt(b?.bySource?.voiceCalls), gifts: amt(b?.bySource?.gifts), live: amt(b?.bySource?.liveStreams), other: null },
    otherItems: [],
    online: null,
    calls: dash?.todayCallsCount != null ? { answered: dash.todayCallsCount } : null,
  }
}

export async function loadWeek(from, to) {
  if (!statsUnavailable) {
    try {
      const res = await statsApi.range(from, to, TZ)
      return (res.days || []).map((d) => ({ date: d.date, earningsPaise: d.earningsPaise ?? 0, onlineSeconds: d.onlineSeconds ?? null }))
    } catch (e) {
      if (!isMissingEndpoint(e)) throw e
      statsUnavailable = true
    }
  }
  if (USE_SAMPLE_DATA) return sampleWeek(from, to)
  const s = await earningsApi.summary()
  return (s?.last7Days || []).map((d) => ({ date: String(d.date).slice(0, 10), earningsPaise: d.amountPaise ?? 0, onlineSeconds: null }))
}

/** Earnings sources in display order. Colors are a validated categorical set (adjacent pairs
 * pass colour-blind separation in this order) — keep the order if you change them. Every use
 * pairs the color with a visible label, so identity is never color alone. */
export const SOURCES = [
  { key: 'video', label: 'Video calls', icon: 'video', color: '#6d3be6', unit: ['call', 'calls'] },
  { key: 'gifts', label: 'Gifts', icon: 'gift', color: '#eda100', unit: ['gift', 'gifts'] },
  { key: 'voice', label: 'Voice calls', icon: 'phone', color: '#2a78d6', unit: ['call', 'calls'] },
  { key: 'live', label: 'Live streams', icon: 'live', color: '#eb6834', unit: ['stream', 'streams'] },
  // Backend: paid chat messages + adjustments (there's no bonus system yet), each labelled in items.
  { key: 'other', label: 'Messages & other', icon: 'chat', color: '#1baf7a', unit: ['item', 'items'] },
]

// Fallback daily online-time goal — the backend sends the real one as dailyGoalSeconds.
export const DAILY_GOAL_SECONDS = 6 * 3600

/** The online-time goal for a loaded day (backend value, else the 6h fallback). */
export const goalOf = (day) => day?.goalSeconds || DAILY_GOAL_SECONDS

/** Seconds of a still-open session not yet counted in totalSeconds — the backend's total is
 * as of `asOf`, and the session keeps running on screen after that. */
export function openSessionExtra(online) {
  if (!online?.isOnlineNow || !online.asOf) return 0
  return Math.max(0, (Date.now() - new Date(online.asOf).getTime()) / 1000)
}

export function onlineSecondsOf(day) {
  return day?.online ? day.online.totalSeconds + openSessionExtra(day.online) : null
}

export const lastNDays = (n) => Array.from({ length: n }, (_, i) => new Date(Date.now() - (n - 1 - i) * DAY_MS))
export const prevIso = (iso) => isoDate(new Date(new Date(`${iso}T00:00:00`).getTime() - DAY_MS))

/** Change vs the previous day, from the week series: { pct, deltaPaise } or null. */
export function trendVsPrevDay(day, date, week) {
  const prev = week.find((d) => d.date === prevIso(date))
  if (!day || !prev || !prev.earningsPaise) return null
  const deltaPaise = day.totalPaise - prev.earningsPaise
  return { deltaPaise, pct: Math.round((deltaPaise / prev.earningsPaise) * 100) }
}

/**
 * Up to three short, plain-language insights for the selected day, most useful first.
 * Each: { tone: 'good'|'warn'|'info', icon, title, body }. Only states things the data
 * actually supports — no insight is shown when its inputs are missing.
 */
export function buildInsights(day, date, week, isToday) {
  if (!day) return []
  const out = []
  const online = onlineSecondsOf(day)
  const trend = trendVsPrevDay(day, date, week)

  if (isToday && online != null) {
    const goal = goalOf(day)
    const left = goal - online
    if (left > 60) out.push({ tone: 'info', icon: 'clock', title: `${duration(left)} more to reach your goal`, body: `Stay online a little longer to hit your ${duration(goal)} daily goal.` })
    else out.push({ tone: 'good', icon: 'check', title: 'Daily online goal reached', body: `You've been online ${duration(online)} today — great consistency.` })
  }

  if (trend && Math.abs(trend.pct) >= 5) {
    out.push(trend.pct > 0
      ? { tone: 'good', icon: 'trending-up', title: `${trend.pct}% more than yesterday`, body: `You earned ${rupees(trend.deltaPaise)} more than the day before.` }
      : { tone: 'warn', icon: 'trending-up', down: true, title: `${Math.abs(trend.pct)}% less than yesterday`, body: `That's ${rupees(-trend.deltaPaise)} less than the day before.` })
  }

  const ranked = SOURCES.map((s) => ({ ...s, amt: day.sources[s.key]?.amountPaise || 0 })).sort((a, b) => b.amt - a.amt)
  if (ranked[0].amt > 0 && day.totalPaise > 0) {
    const share = Math.round((ranked[0].amt / day.totalPaise) * 100)
    out.push({ tone: 'info', icon: ranked[0].icon, title: `${ranked[0].label} earned you the most`, body: `${share}% of your money came from ${ranked[0].label.toLowerCase()}.` })
  }

  if (online > 600 && day.totalPaise > 0) {
    const perHour = (day.totalPaise / online) * 3600
    const others = week.filter((d) => d.date !== date && d.onlineSeconds > 600)
    if (others.length >= 2) {
      const avg = others.reduce((a, d) => a + (d.earningsPaise / d.onlineSeconds) * 3600, 0) / others.length
      const diff = Math.round(((perHour - avg) / avg) * 100)
      if (Math.abs(diff) >= 5) {
        out.push(diff > 0
          ? { tone: 'good', icon: 'wallet', title: `${rupees(perHour)} per hour online`, body: `${diff}% better than your usual ${rupees(avg)} an hour.` }
          : { tone: 'warn', icon: 'wallet', title: `${rupees(perHour)} per hour online`, body: `Below your usual ${rupees(avg)} an hour — evenings usually bring more calls.` })
      }
    }
  }

  if (day.calls?.missed > 0) {
    out.push({ tone: 'warn', icon: 'phone-off', title: `${day.calls.missed} missed ${day.calls.missed === 1 ? 'call' : 'calls'}`, body: 'Keep the app open while you are online so you catch every call.' })
  }

  if (day.totalPaise === 0) {
    out.push({ tone: 'info', icon: 'sparkles', title: isToday ? 'No earnings yet today' : 'No earnings this day', body: 'Going online in the evening, when most users are active, usually brings the most calls.' })
  }

  // Keep the goal/trend first, then the rest; at most three so it stays scannable.
  return out.slice(0, 3)
}
