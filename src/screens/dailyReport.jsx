import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { TopBar, ErrorCard } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { rupees, clockTime, isoDate, duration } from '../lib/format.js'
import { errorMessage } from '../lib/errors.js'
import {
  loadDay, loadWeek, SOURCES, DAILY_GOAL_SECONDS, goalOf, onlineSecondsOf, lastNDays, trendVsPrevDay, buildInsights,
} from '../lib/dailyStats.js'
import { Skel, SkelGroup, SkelHero, SkelCard, SkelList } from '../ui/Skeleton.jsx'

const DAY_MS = 86400000
const ONLINE_GREEN = '#34d399'
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Animates a number from its previous value to `target` (ease-out, ~0.7s). */
function useCountUp(target) {
  const [value, setValue] = useState(target ?? 0)
  const fromRef = useRef(target ?? 0)
  useEffect(() => {
    if (target == null) return
    if (reducedMotion()) { setValue(target); fromRef.current = target; return }
    const from = fromRef.current
    const start = performance.now()
    let raf
    const step = (now) => {
      const t = Math.min(1, (now - start) / 700)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (target - from) * eased)
      if (t < 1) raf = requestAnimationFrame(step)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return value
}

const dayName = (iso, todayIso) => {
  if (iso === todayIso) return 'Today'
  if (iso === isoDate(new Date(Date.now() - DAY_MS))) return 'Yesterday'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
}
const shortDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })
const hoursShort = (sec) => `${(sec / 3600).toFixed(1).replace(/\.0$/, '')}h`
const plural = (n, [one, many]) => `${n} ${n === 1 ? one : many}`

/* ------------------------------------------------------------------ screen */

/* Daily report — what the host earned on a day, how long they were online, where the money
 * came from, and a few plain-language insights, with a 7-day view underneath. */
export function DailyReport() {
  const todayIso = isoDate(new Date())
  const [date, setDate] = useState(todayIso)
  const [day, setDay] = useState(null)
  const [week, setWeek] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [, tick] = useState(0)
  const reqRef = useRef(0)
  const isToday = date === todayIso

  const load = useCallback(() => {
    const req = ++reqRef.current
    setLoading(true)
    setErr('')
    loadDay(date, date === isoDate(new Date()))
      .then((d) => { if (req === reqRef.current) setDay(d) })
      .catch((e) => { if (req === reqRef.current) setErr(errorMessage(e, 'Could not load this day.')) })
      .finally(() => { if (req === reqRef.current) setLoading(false) })
  }, [date])
  useEffect(load, [load])

  useEffect(() => {
    const days = lastNDays(7)
    loadWeek(isoDate(days[0]), isoDate(days[6])).then(setWeek).catch(() => setWeek([]))
  }, [])

  // While online right now, keep the online time counting on screen.
  const liveOnline = isToday && day?.online?.isOnlineNow
  useEffect(() => {
    if (!liveOnline) return
    const t = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [liveOnline])

  const insights = buildInsights(day, date, week, isToday)

  return (
    <AppLayout tab="/earnings" title="Daily report" back bottomNav={false} maxW="xl" bg="canvas">
      <TopBar title="Daily report" sub={dayName(date, todayIso)} />
      <div className="px-4 lg:px-0 pt-3 lg:pt-0 pb-10 lg:pb-0 space-y-4 lg:space-y-5">
        <DayPicker date={date} todayIso={todayIso} week={week} onPick={setDate} />

        {err ? (
          <ErrorCard message={err} onRetry={load} />
        ) : loading && !day ? (
          <SkelGroup className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-5">
            <SkelHero height="h-56" className="rounded-3xl lg:col-span-7" />
            <SkelCard lines={4} className="rounded-3xl lg:col-span-5" />
            <SkelList rows={4} avatar="square" className="lg:col-span-7" />
            <SkelCard lines={3} className="rounded-3xl lg:col-span-5" />
          </SkelGroup>
        ) : day && (
          <>
            {day.sample && <SampleNotice />}
            {/* Phone: one column in reading order (the order-* classes). Laptop: two columns —
                money on the left (hero, sources), time & activity on the right (insights,
                online, calls) — with the 7-day chart as a full-width row underneath. The column wrappers are `display: contents` on phone, so every
                card is rendered once and simply re-flows between the two layouts.
                Held at reduced opacity while the next day loads — no layout jump. */}
            <div className={`flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
              <div className="contents lg:block lg:col-span-7 lg:space-y-5">
                <div className="order-1"><Hero day={day} date={date} week={week} isToday={isToday} /></div>
                <div className="order-3"><MoneyMix day={day} /></div>
              </div>
              <div className="contents lg:block lg:col-span-5 lg:space-y-5">
                {insights.length > 0 && <div className="order-2"><InsightsCard insights={insights} /></div>}
                <div className="order-4"><OnlineCard online={day.online} date={date} isToday={isToday} /></div>
                {day.calls && <div className="order-5"><CallsCard calls={day.calls} complete={day.complete} /></div>}
              </div>
              {week.length > 0 && <div className="order-6 lg:col-span-12"><WeekChart week={week} selected={date} todayIso={todayIso} onPick={setDate} /></div>}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

/* ------------------------------------------------------------------ pieces */

function SampleNotice() {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-gold-50 px-3.5 py-2.5 text-[12px] text-gold-600">
      <Icon name="alert" size={14} className="shrink-0" />
      <span><span className="font-bold">Preview with sample numbers.</span> Your real figures appear here automatically once tracking goes live.</span>
    </div>
  )
}

function DayPicker({ date, todayIso, week, onPick }) {
  const days = lastNDays(7).map(isoDate)
  const max = Math.max(1, ...week.map((d) => d.earningsPaise))
  return (
    <div className="flex items-stretch gap-1.5">
      <div className="flex-1 grid grid-cols-7 gap-1.5">
        {days.map((iso) => {
          const active = iso === date
          const w = week.find((d) => d.date === iso)
          const fill = w ? Math.max(0.08, w.earningsPaise / max) : 0
          return (
            <button
              key={iso}
              onClick={() => onPick(iso)}
              aria-pressed={active}
              className={`relative rounded-2xl pt-2 pb-2.5 flex flex-col items-center transition-all duration-200 ${active ? 'bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-[0_8px_20px_-8px_rgba(91,46,229,.7)] -translate-y-0.5' : 'bg-white text-ink-700 border border-black/[.06] hover:border-brand-200'}`}
            >
              <span className={`text-[9.5px] font-semibold uppercase ${active ? 'text-white/75' : 'text-ink-400'}`}>{iso === todayIso ? 'Today' : shortDay(iso)}</span>
              <span className="text-[16px] font-extrabold leading-tight mt-0.5">{Number(iso.slice(8))}</span>
              {/* micro-bar: how that day went, at a glance */}
              <span className={`mt-1.5 h-1 w-6 rounded-full overflow-hidden ${active ? 'bg-white/25' : 'bg-black/[.06]'}`}>
                <span className={`block h-full rounded-full ${active ? 'bg-white' : 'bg-brand-400'}`} style={{ width: `${fill * 100}%` }} />
              </span>
            </button>
          )
        })}
      </div>
      <label className="relative w-11 shrink-0 grid place-items-center rounded-2xl bg-white border border-black/[.06] text-ink-500 cursor-pointer hover:border-brand-200" title="Pick an older date">
        <Icon name="calendar" size={18} />
        <input type="date" max={todayIso} value={date} onChange={(e) => e.target.value && onPick(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Pick a date" />
      </label>
    </div>
  )
}

function TrendChip({ trend, onDark }) {
  if (!trend) return null
  const up = trend.pct >= 0
  const base = onDark
    ? (up ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300')
    : (up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500')
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${base}`}>
      <Icon name="trending-up" size={12} className={up ? '' : '-scale-y-100'} />
      {up ? '+' : '−'}{Math.abs(trend.pct)}% <span className="font-medium opacity-80">vs yesterday</span>
    </span>
  )
}

/** Progress ring toward the daily online goal. */
function GoalRing({ seconds, goal = DAILY_GOAL_SECONDS, size = 104, stroke = 9, onDark = true }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = seconds == null ? 0 : Math.min(1, seconds / goal)
  const animated = useCountUp(pct)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={seconds == null ? 'Online time not available' : `Online ${duration(seconds)} of ${duration(goal)} goal`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={onDark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.06)'} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ONLINE_GREEN} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - animated)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`text-[15px] font-extrabold leading-none ${onDark ? 'text-white' : 'text-ink-900'}`}>{seconds == null ? '—' : duration(seconds)}</span>
        <span className={`text-[9.5px] mt-1 ${onDark ? 'text-white/60' : 'text-ink-400'}`}>of {duration(goal)} goal</span>
      </div>
    </div>
  )
}

function Hero({ day, date, week, isToday }) {
  const online = onlineSecondsOf(day)
  const money = useCountUp(day.totalPaise)
  const trend = trendVsPrevDay(day, date, week)
  const perHour = online > 600 ? (day.totalPaise / online) * 3600 : null
  const calls = day.calls?.answered
  const gifts = day.sources.gifts?.count
  return (
    <section className="relative overflow-hidden rounded-3xl p-5 text-white bg-gradient-to-br from-night-800 via-brand-800 to-brand-600 shadow-[0_18px_40px_-18px_rgba(59,31,153,.8)]">
      {/* soft light blobs for depth */}
      <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-brand-400/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-fuchsia-500/20 blur-3xl" />

      <div className="relative flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-white/70">{isToday ? 'Money earned today' : 'Money earned'}</p>
          <p className="text-[38px] font-extrabold leading-[1.05] mt-1 tracking-tight">{rupees(money)}</p>
          <div className="mt-2 min-h-[22px]"><TrendChip trend={trend} onDark /></div>
          {isToday && day.online?.isOnlineNow && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-300">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
              Online now
            </p>
          )}
        </div>
        <GoalRing seconds={online} goal={goalOf(day)} />
      </div>

      <div className="relative mt-5 grid grid-cols-3 rounded-2xl bg-white/[.08] backdrop-blur-sm divide-x divide-white/10">
        <HeroStat icon="wallet" label="Per hour" value={perHour != null ? rupees(perHour) : '—'} />
        <HeroStat icon="phone" label="Calls" value={calls != null ? String(calls) : '—'} />
        <HeroStat icon="gift" label="Gifts" value={gifts != null ? String(gifts) : '—'} />
      </div>
    </section>
  )
}

function HeroStat({ icon, label, value }) {
  return (
    <div className="px-3 py-3">
      <p className="flex items-center gap-1 text-[10.5px] text-white/60"><Icon name={icon} size={11} /> {label}</p>
      <p className="text-[16px] font-bold mt-0.5">{value}</p>
    </div>
  )
}

const TONES = {
  good: 'bg-emerald-50 text-emerald-600',
  warn: 'bg-gold-50 text-gold-600',
  info: 'bg-brand-50 text-brand-600',
}

function InsightsCard({ insights }) {
  return (
    <section className="card rounded-3xl p-4">
      <header className="flex items-center gap-2 mb-3">
        <span className="grid place-items-center h-7 w-7 rounded-lg bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white"><Icon name="sparkles" size={14} /></span>
        <h2 className="text-[15px] font-bold text-ink-900">Smart insights</h2>
      </header>
      <ul className="space-y-2.5">
        {insights.map((it, i) => (
          <li key={i} className="flex items-start gap-3 animate-slide-up" style={{ animationDelay: `${i * 70}ms` }}>
            <span className={`grid place-items-center h-9 w-9 rounded-xl shrink-0 ${TONES[it.tone]}`}>
              <Icon name={it.icon} size={16} className={it.down ? '-scale-y-100' : ''} />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[13.5px] font-semibold text-ink-900 leading-snug">{it.title}</p>
              <p className="text-[12px] text-ink-400 leading-snug mt-0.5">{it.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* Part-to-whole: one stacked bar (2px gaps between segments) + a labelled list that doubles as
 * the table view. Tapping/hovering a row or segment highlights that source. */
function MoneyMix({ day }) {
  const [active, setActive] = useState(null)
  const total = day.totalPaise
  const rows = SOURCES
    .filter((s) => day.sources[s.key] || (s.key === 'other' && day.complete))
    .map((s) => ({ ...s, ...(day.sources[s.key] || { amountPaise: 0 }) }))
  const withMoney = rows.filter((r) => r.amountPaise > 0)
  const pct = (v) => (total > 0 ? Math.round((v / total) * 100) : 0)

  return (
    <section className="card rounded-3xl p-4">
      <header className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">Where your money came from</h2>
          <p className="text-[12px] text-ink-400 mt-0.5">{withMoney.length ? `${plural(withMoney.length, ['source', 'sources'])} today` : 'Nothing earned yet'}</p>
        </div>
        <p className="text-[15px] font-extrabold text-ink-900">{rupees(total)}</p>
      </header>

      {total > 0 && (
        <div className="flex h-3.5 w-full gap-[2px] mb-4" role="img" aria-label="Earnings split by source">
          {withMoney.map((r) => (
            <button
              key={r.key}
              onMouseEnter={() => setActive(r.key)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive((a) => (a === r.key ? null : r.key))}
              className="h-full rounded-[4px] transition-opacity duration-150 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(r.amountPaise / total) * 100}%`, minWidth: 6, background: r.color, opacity: active && active !== r.key ? 0.3 : 1 }}
              aria-label={`${r.label}: ${rupees(r.amountPaise)}`}
            />
          ))}
        </div>
      )}

      <ul className="-mx-1">
        {rows.map((r) => {
          const bits = []
          if (r.count != null) bits.push(plural(r.count, r.unit))
          if (r.seconds) bits.push(duration(r.seconds))
          const dim = active && active !== r.key
          return (
            <li key={r.key}>
              <button
                onMouseEnter={() => setActive(r.key)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive((a) => (a === r.key ? null : r.key))}
                className={`w-full flex items-center gap-3 rounded-2xl px-1 py-2 text-left transition ${dim ? 'opacity-40' : ''} ${active === r.key ? 'bg-black/[.03]' : ''}`}
              >
                <span className="grid place-items-center h-9 w-9 rounded-xl shrink-0" style={{ background: `${r.color}14`, color: r.color }}><Icon name={r.icon} size={16} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-ink-900">{r.label}</span>
                  <span className="block text-[11.5px] text-ink-400">{bits.length ? bits.join(' · ') : '—'}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[14px] font-bold text-ink-900">{rupees(r.amountPaise)}</span>
                  <span className="block text-[11px] font-semibold text-ink-400">{pct(r.amountPaise)}%</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {day.otherItems.length > 0 && (
        <div className="mt-2 rounded-2xl bg-black/[.025] px-3 py-2.5 space-y-1.5">
          {day.otherItems.map((it, i) => (
            <div key={i} className="flex justify-between text-[12px]"><span className="text-ink-500 flex items-center gap-1.5"><Icon name="sparkles" size={11} className="text-ink-300" />{it.label}</span><span className="font-semibold text-ink-900">{rupees(it.amountPaise)}</span></div>
          ))}
        </div>
      )}
    </section>
  )
}

function OnlineCard({ online, date, isToday }) {
  const [tip, setTip] = useState(null)
  if (!online) {
    return (
      <section className="card rounded-3xl p-4 flex items-center gap-3">
        <span className="grid place-items-center h-10 w-10 rounded-xl bg-black/5 text-ink-400 shrink-0"><Icon name="clock" size={18} /></span>
        <div><p className="text-[14px] font-semibold text-ink-900">Your online time</p><p className="text-[12px] text-ink-400">Coming soon — daily online hours will show here.</p></div>
      </section>
    )
  }
  const total = online.totalSeconds + (online.isOnlineNow && online.asOf ? Math.max(0, (Date.now() - new Date(online.asOf).getTime()) / 1000) : 0)
  const dayStart = new Date(`${date}T00:00:00`).getTime()
  const segs = online.sessions.map((s) => {
    const a = Math.max(dayStart, new Date(s.start).getTime())
    const b = Math.min(dayStart + DAY_MS, s.end ? new Date(s.end).getTime() : Date.now())
    return { a, b, left: ((a - dayStart) / DAY_MS) * 100, width: Math.max(0.8, ((b - a) / DAY_MS) * 100), open: !s.end }
  }).filter((s) => s.b > s.a)
  const longest = segs.reduce((m, s) => Math.max(m, (s.b - s.a) / 1000), 0)
  const first = online.sessions[0]?.start
  const lastEnd = online.sessions.length ? online.sessions[online.sessions.length - 1].end : null
  const nowPct = ((Date.now() - dayStart) / DAY_MS) * 100

  return (
    <section className="card rounded-3xl p-4">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">Your online time</h2>
          <p className="text-[26px] font-extrabold text-ink-900 leading-tight mt-1">{duration(total)}</p>
        </div>
        {isToday && online.isOnlineNow
          ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-bold text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online now</span>
          : <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[.04] px-2.5 py-1 text-[11.5px] font-semibold text-ink-500"><span className="h-1.5 w-1.5 rounded-full bg-ink-300" /> Offline</span>}
      </header>

      {/* 24-hour timeline: each bar is one stretch online. Tap a bar for its times. */}
      <div className="relative mt-4">
        {tip && (
          <div className="absolute -top-9 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-pop" style={{ left: `${Math.min(85, Math.max(15, tip.x))}%` }}>
            {tip.text}
          </div>
        )}
        <div className="relative h-9 rounded-xl bg-black/[.035]">
          {[25, 50, 75].map((p) => <span key={p} className="absolute top-1.5 bottom-1.5 w-px bg-black/[.06]" style={{ left: `${p}%` }} />)}
          {segs.map((s, i) => (
            <button
              key={i}
              onMouseEnter={() => setTip({ x: s.left + s.width / 2, text: `${clockTime(new Date(s.a).toISOString())} – ${s.open ? 'now' : clockTime(new Date(s.b).toISOString())} · ${duration((s.b - s.a) / 1000)}` })}
              onMouseLeave={() => setTip(null)}
              onClick={() => setTip((t) => (t ? null : { x: s.left + s.width / 2, text: `${clockTime(new Date(s.a).toISOString())} – ${s.open ? 'now' : clockTime(new Date(s.b).toISOString())} · ${duration((s.b - s.a) / 1000)}` }))}
              className="absolute top-1.5 bottom-1.5 rounded-[6px] transition-transform hover:scale-y-110"
              style={{ left: `${s.left}%`, width: `${s.width}%`, background: s.open ? ONLINE_GREEN : '#6d3be6' }}
              aria-label={`Online ${duration((s.b - s.a) / 1000)}`}
            />
          ))}
          {isToday && nowPct > 0 && nowPct < 100 && (
            <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-ink-900/70" style={{ left: `${nowPct}%` }}><span className="absolute -top-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-ink-900" /></span>
          )}
        </div>
        <div className="flex justify-between text-[10px] font-medium text-ink-300 mt-1.5 px-0.5"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>12am</span></div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <MiniStat label="Sessions" value={String(online.sessions.length)} />
        <MiniStat label="Longest" value={longest ? duration(longest) : '—'} />
        <MiniStat label="Started" value={first ? clockTime(first) : '—'} />
        <MiniStat label="Ended" value={isToday && online.isOnlineNow ? 'Still on' : lastEnd ? clockTime(lastEnd) : '—'} />
      </div>
    </section>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-black/[.03] px-2 py-2.5 text-center">
      <p className="text-[13px] font-bold text-ink-900 leading-tight">{value}</p>
      <p className="text-[10.5px] text-ink-400 mt-0.5">{label}</p>
    </div>
  )
}

function CallsCard({ calls, complete }) {
  const received = calls ? (calls.received ?? calls.answered ?? 0) : 0
  const rate = calls && complete && received > 0 ? Math.round(((calls.answered ?? 0) / received) * 100) : null
  const animatedRate = useCountUp(rate ?? 0)
  if (!calls) return null
  return (
    <section className="card rounded-3xl p-4">
      <h2 className="text-[15px] font-bold text-ink-900">Calls</h2>
      {rate != null ? (
        <>
          <div className="mt-3 flex items-end justify-between">
            <p className="text-[13px] text-ink-500"><span className="text-[22px] font-extrabold text-ink-900">{calls.answered}</span> of {received} calls answered</p>
            <p className={`text-[13px] font-bold ${rate >= 80 ? 'text-emerald-600' : 'text-gold-600'}`}>{Math.round(animatedRate)}%</p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-black/[.05] overflow-hidden">
            <div className={`h-full rounded-full ${rate >= 80 ? 'bg-emerald-500' : 'bg-gold-400'}`} style={{ width: `${animatedRate}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Talk time" value={duration(calls.talkSeconds)} />
            <MiniStat label="Avg. call" value={duration(calls.avgCallSeconds)} />
            <MiniStat label="Missed" value={String(calls.missed ?? 0)} />
          </div>
        </>
      ) : (
        <p className="mt-2 text-[13px] text-ink-500"><span className="text-[22px] font-extrabold text-ink-900">{calls.answered ?? 0}</span> calls today</p>
      )}
    </section>
  )
}

/* Earnings per day for the last week. One measure per axis: bars are money; online hours sit
 * as plain text under each day (not a second axis). A solid hairline marks the average. */
function WeekChart({ week, selected, todayIso, onPick }) {
  const [hover, setHover] = useState(null)
  if (!week.length) return null
  const max = Math.max(1, ...week.map((d) => d.earningsPaise))
  const total = week.reduce((a, d) => a + d.earningsPaise, 0)
  const avg = total / week.length
  const hasOnline = week.some((d) => d.onlineSeconds != null)
  const onlineTotal = week.reduce((a, d) => a + (d.onlineSeconds || 0), 0)
  const PLOT = 132
  const shown = hover || selected
  const shownDay = week.find((d) => d.date === shown)

  return (
    <section className="relative card rounded-3xl p-4">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">Last 7 days</h2>
          <p className="text-[12px] text-ink-400 mt-0.5">{rupees(total)} earned{hasOnline ? ` · ${duration(onlineTotal)} online` : ''}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-ink-400"><span className="h-px w-4 bg-ink-900/40" /> Daily average {rupees(avg)}</p>
        </div>
        {shownDay && (
          <div className="text-right">
            <p className="text-[11px] text-ink-400">{shown === todayIso ? 'Today' : new Date(`${shown}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
            <p className="text-[15px] font-extrabold text-ink-900">{rupees(shownDay.earningsPaise)}</p>
          </div>
        )}
      </header>

      <div className="relative mt-4" style={{ height: PLOT }}>
        {/* average line */}
        <div className="absolute inset-x-0 z-10 border-t border-ink-900/20 pointer-events-none" style={{ bottom: `${(avg / max) * (PLOT - 18)}px` }} />
        <div className="absolute inset-x-0 bottom-0 border-t border-black/[.08]" />
        <div className="absolute inset-0 flex items-end gap-2">
          {week.map((d) => {
            const active = d.date === selected
            const hot = d.date === hover
            return (
              <button
                key={d.date}
                onClick={() => onPick(d.date)}
                onMouseEnter={() => setHover(d.date)}
                onMouseLeave={() => setHover(null)}
                className="group flex-1 h-full flex items-end"
                aria-label={`${d.date}: ${rupees(d.earningsPaise)}`}
              >
                <span
                  className={`block w-full rounded-t-[6px] transition-all duration-300 ${active ? 'bg-gradient-to-t from-brand-600 to-brand-400' : hot ? 'bg-brand-300' : 'bg-brand-100'}`}
                  style={{ height: `${Math.max(3, (d.earningsPaise / max) * (PLOT - 18))}px` }}
                />
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-2">
        {week.map((d) => (
          <button key={d.date} onClick={() => onPick(d.date)} className="flex-1 text-center">
            <span className={`block text-[10.5px] ${d.date === selected ? 'font-bold text-ink-900' : 'text-ink-400'}`}>{d.date === todayIso ? 'Today' : shortDay(d.date)}</span>
            {hasOnline && <span className="block text-[9.5px] text-ink-300 whitespace-nowrap">{d.onlineSeconds != null ? hoursShort(d.onlineSeconds) : '—'}</span>}
          </button>
        ))}
      </div>

      {/* table twin for screen readers — sr-only goes on a wrapper: a <table> ignores the 1px
          box sr-only relies on and grows to its content, which stretched the page */}
      <div className="sr-only">
      <table>
        <caption>Earnings and online time, last 7 days</caption>
        <thead><tr><th>Day</th><th>Earned</th><th>Online</th></tr></thead>
        <tbody>{week.map((d) => <tr key={d.date}><td>{d.date}</td><td>{rupees(d.earningsPaise)}</td><td>{d.onlineSeconds != null ? duration(d.onlineSeconds) : '—'}</td></tr>)}</tbody>
      </table>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ compact card */

/* "Today" summary for other screens (Performance): money earned, online-goal ring, trend and
 * the top insight — tapping through to the full Daily report. */
export function TodayReportCard() {
  const nav = useNavigate()
  const todayIso = isoDate(new Date())
  const [day, setDay] = useState(null)
  const [week, setWeek] = useState([])
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const days = lastNDays(7)
    loadDay(todayIso, true).then(setDay).catch(() => setFailed(true))
    loadWeek(isoDate(days[0]), isoDate(days[6])).then(setWeek).catch(() => {})
  }, [todayIso])
  const money = useCountUp(day?.totalPaise ?? 0)
  if (failed) return null
  const trend = trendVsPrevDay(day, todayIso, week)
  const insight = buildInsights(day, todayIso, week, true)[0]

  return (
    <button onClick={() => nav('/earnings/daily')} className="relative w-full overflow-hidden rounded-3xl p-4 text-left text-white bg-gradient-to-br from-night-800 via-brand-800 to-brand-600 shadow-[0_14px_32px_-16px_rgba(59,31,153,.8)] active:scale-[.99] transition">
      <div className="pointer-events-none absolute -top-14 -right-8 h-40 w-40 rounded-full bg-brand-400/30 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <p className="text-[12px] font-semibold text-white/75">Today's report</p>
        <span className="flex items-center gap-1.5">
          {day?.sample && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/85">Sample</span>}
          <Icon name="chevron-right" size={16} className="text-white/70" />
        </span>
      </div>
      {!day ? (
        <div className="relative mt-3 flex items-center gap-3" role="status" aria-busy="true">
          <span className="sr-only">Loading…</span>
          <div className="flex-1 space-y-2.5"><Skel dark className="h-2.5 w-20 rounded-md" /><Skel dark className="h-8 w-32 rounded-lg" /><Skel dark className="h-5 w-28 rounded-full" /></div>
          <Skel dark className="h-[88px] w-[88px] rounded-full" />
        </div>
      ) : (
        <>
          <div className="relative mt-1 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] text-white/60">Money earned</p>
              <p className="text-[30px] font-extrabold leading-tight tracking-tight">{rupees(money)}</p>
              <div className="mt-1 min-h-[22px]"><TrendChip trend={trend} onDark /></div>
            </div>
            <GoalRing seconds={onlineSecondsOf(day)} goal={goalOf(day)} size={88} stroke={8} />
          </div>
          {insight && (
            <div className="relative mt-3 flex items-center gap-2.5 rounded-2xl bg-white/[.09] px-3 py-2.5">
              <Icon name={insight.icon} size={15} className={`shrink-0 text-white/85 ${insight.down ? '-scale-y-100' : ''}`} />
              <p className="flex-1 min-w-0 text-[12px] leading-snug"><span className="font-semibold">{insight.title}</span></p>
              <span className="text-[11.5px] font-semibold text-white/80 whitespace-nowrap">Full report</span>
            </div>
          )}
        </>
      )}
    </button>
  )
}
