import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { TopBar, SectionTitle, ErrorCard, Avatar } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { rewards as rewardsApi, earnings as earningsApi, presence as presenceApi, config as configApi } from '../api/index.js'
import { beans, lakhBeans, rupees } from '../lib/format.js'
import { errorMessage } from '../lib/errors.js'
import { Skel, SkelGroup, SkelHero, SkelList } from '../ui/Skeleton.jsx'

/* Daily Wins / Weekly Wins — hosts are ranked by beans earned from calls, gifts and paid
 * messages in the period (a day is midnight to midnight IST, a week Monday to Monday), and the
 * top ranks win reward beans on top. Everything shown comes from GET /me/rewards; a period the
 * admin has switched off (`enabled: false`) is hidden entirely. */

const PERIODS = { daily: { label: 'Daily Wins', short: 'Today', noun: 'day' }, weekly: { label: 'Weekly Wins', short: 'This week', noun: 'week' } }
const IST = 'Asia/Kolkata'
const MEDAL = {
  1: 'from-[#ffe08a] to-[#e0a92e] text-[#6b4a00]',
  2: 'from-[#f1f1f4] to-[#b9bcc6] text-[#3a3d48]',
  3: 'from-[#f6c39a] to-[#c47a43] text-[#5a2e0c]',
}

/** Ticks once a second while mounted — drives the countdowns. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function countdownParts(endIso, now) {
  const ms = Math.max(0, new Date(endIso).getTime() - now)
  const s = Math.floor(ms / 1000)
  return { ms, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}
const pad2 = (n) => String(n).padStart(2, '0')

/** "2d 05h" for a week, "05:12:33" for a day — short enough for a teaser line. */
export function countdownText(endIso, now) {
  const c = countdownParts(endIso, now)
  if (c.ms === 0) return 'Closing…'
  if (c.d) return `${c.d}d ${pad2(c.h)}h`
  return `${pad2(c.h)}:${pad2(c.m)}:${pad2(c.s)}`
}

/** "Today · 13 Oct" / "13 – 19 Oct". periodEnd is the next period's start, so the last day of a
 * week is the instant before it. */
function periodLabel(key, p) {
  if (!p?.periodStart) return ''
  const fmt = (d, opts) => new Date(d).toLocaleDateString('en-IN', { timeZone: IST, ...opts })
  if (key === 'daily') return fmt(p.periodStart, { day: 'numeric', month: 'short' })
  const lastDay = new Date(new Date(p.periodEnd).getTime() - 1)
  return `${fmt(p.periodStart, { day: 'numeric', month: 'short' })} – ${fmt(lastDay, { day: 'numeric', month: 'short' })}`
}

/** Consecutive ranks with the same prize (after the podium) collapse into one "#4 – #10" row,
 * so a 50-rank table doesn't become a 50-row scroll. */
function groupTiers(tiers, keepEach = false) {
  const out = []
  for (const t of [...(tiers || [])].sort((a, b) => a.rank - b.rank)) {
    const last = out[out.length - 1]
    if (!keepEach && t.rank > 3 && last && last.from > 3 && last.rewardBeans === t.rewardBeans && last.to === t.rank - 1) last.to = t.rank
    else out.push({ from: t.rank, to: t.rank, rewardBeans: t.rewardBeans })
  }
  return out
}

/** What the host's standing means, in one place, so the hero, the teaser and the nudge agree. */
export function standing(p) {
  const tiers = [...(p?.tiers || [])].sort((a, b) => a.rank - b.rank)
  const lastPrizeRank = tiers.length ? tiers[tiers.length - 1].rank : 0
  const ranked = p?.myRank != null
  const winning = ranked && (p.myRewardBeans ?? 0) > 0
  const qualifyPct = p?.minQualifyingBeans ? Math.min(100, Math.round(((p.myBeans ?? 0) / p.minQualifyingBeans) * 100)) : 100
  const nextUp = winning && p.myRank > 1 ? tiers.find((t) => t.rank === p.myRank - 1) : null
  return { tiers, lastPrizeRank, ranked, winning, qualifyPct, nextUp, lastTier: tiers[tiers.length - 1] }
}

/* Who holds each rank right now: tiers[].host = { hostId, name, imageUrl, beans, isMe }, or
 * null while nobody has reached that rank. name / imageUrl can be null too ("Host" and the
 * initial avatar then). Returns rank -> holder for the ranks that have one. */
export function holdersOf(p) {
  const map = new Map()
  for (const t of p?.tiers || []) {
    if (t.host) map.set(t.rank, { rank: t.rank, name: t.host.name || 'Host', avatarUrl: t.host.imageUrl || t.host.avatarUrl || null, beans: t.host.beans, isMe: !!t.host.isMe })
  }
  return map
}
/** True once the backend sends tiers[].host at all — then every rank gets a holder slot. */
const tiersHaveHosts = (p) => (p?.tiers || []).some((t) => 'host' in t)

function PeriodToggle({ keys, value, onChange }) {
  if (keys.length < 2) return null
  return (
    <div className="inline-flex rounded-full bg-white/10 p-1 ring-1 ring-white/10">
      {keys.map((k) => (
        <button key={k} onClick={() => onChange(k)} className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition ${value === k ? 'bg-white text-brand-700 shadow' : 'text-white/70 hover:text-white'}`}>
          {PERIODS[k].label}
        </button>
      ))}
    </div>
  )
}

function Countdown({ endIso, now, noun }) {
  const c = countdownParts(endIso, now)
  const cells = c.d ? [[c.d, 'days'], [c.h, 'hrs'], [c.m, 'min']] : [[c.h, 'hrs'], [c.m, 'min'], [c.s, 'sec']]
  return (
    <div className="flex flex-col items-center">
      <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-white/60">{c.ms ? `This ${noun} ends in` : 'Closing — results soon'}</p>
      <div className="mt-2 flex items-start gap-1.5">
        {cells.map(([v, l], i) => (
          <div key={l} className="flex items-start gap-1.5">
            {i > 0 && <span className="pt-1.5 text-[20px] font-extrabold text-white/40">:</span>}
            <div className="flex flex-col items-center">
              <span className="min-w-[52px] rounded-xl bg-white/10 px-2 py-1.5 text-center text-[24px] font-extrabold tabular-nums text-white ring-1 ring-white/10">{pad2(v)}</span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/50">{l}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The big "where do I stand" block inside the dark hero. Three states: winning a prize right
 * now, ranked but outside the prizes, or not qualified yet. */
function StandingBlock({ p, paisePerBean }) {
  const st = standing(p)
  const approx = (b) => (paisePerBean ? `≈ ${rupees(b * paisePerBean)}` : null)

  if (st.winning) {
    return (
      <div className="text-center">
        <p className="text-[13px] font-semibold text-white/70">You're ranked</p>
        <p className="text-[52px] font-black leading-none bg-gradient-to-b from-[#fff3c4] to-gold-400 bg-clip-text text-transparent">#{p.myRank}</p>
        <div className="mt-3 inline-flex flex-col items-center rounded-2xl bg-gold-400/15 px-5 py-2.5 ring-1 ring-gold-300/30">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gold-300">If it ended now you'd win</span>
          <span className="text-[24px] font-extrabold text-gold-300">{lakhBeans(p.myRewardBeans)} beans</span>
          {approx(p.myRewardBeans) && <span className="text-[11px] text-white/50">{approx(p.myRewardBeans)}</span>}
        </div>
      </div>
    )
  }

  if (st.ranked) {
    return (
      <div className="text-center">
        <p className="text-[13px] font-semibold text-white/70">You're ranked</p>
        <p className="text-[52px] font-black leading-none text-white">#{p.myRank}</p>
        <p className="mt-2 text-[13px] text-white/75">
          Top {st.lastPrizeRank} win. Reach <span className="font-bold text-gold-300">#{st.lastPrizeRank}</span> to win {lakhBeans(st.lastTier?.rewardBeans)} beans.
        </p>
      </div>
    )
  }

  return (
    <div className="text-center">
      <p className="text-[13px] font-semibold text-white/70">You're not ranked yet</p>
      <p className="mt-1 text-[30px] font-extrabold leading-tight text-white">{beans(p.beansToQualify)} <span className="text-[16px] font-semibold text-white/60">beans to qualify</span></p>
      <div className="mx-auto mt-3 max-w-[280px]">
        <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-gold-300 to-gold-500 transition-all duration-700" style={{ width: `${st.qualifyPct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-white/50">
          <span>{beans(p.myBeans)} earned</span>
          <span>{beans(p.minQualifyingBeans)} needed</span>
        </div>
      </div>
    </div>
  )
}

function Hero({ periodKey, p, keys, onPeriod, now, paisePerBean }) {
  return (
    <div className="relative overflow-hidden bg-[#140a2b] text-white lg:rounded-[28px] lg:shadow-pop">
      <div className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-brand-600/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-10 h-64 w-64 rounded-full bg-fuchsia-600/25 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 bottom-0 h-40 w-72 -translate-x-1/2 rounded-full bg-gold-400/15 blur-3xl" />
      <div className="relative px-5 pt-3 pb-6 lg:pt-6">
        <div className="flex justify-center"><PeriodToggle keys={keys} value={periodKey} onChange={onPeriod} /></div>
        <p className="mt-3 text-center text-[12px] font-semibold text-white/60">
          {PERIODS[periodKey].short} · {periodLabel(periodKey, p)}
        </p>
        <div className="mt-4"><Countdown endIso={p.periodEnd} now={now} noun={PERIODS[periodKey].noun} /></div>
        <div className="mx-auto my-5 h-px w-2/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <StandingBlock p={p} paisePerBean={paisePerBean} />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/[.06] px-3 py-3 text-center ring-1 ring-white/10">
            <p className="text-[11px] text-white/55">My beans {PERIODS[periodKey].short.toLowerCase()}</p>
            <p className="mt-0.5 text-[18px] font-extrabold tabular-nums">{beans(p.myBeans)}</p>
          </div>
          <div className="rounded-2xl bg-white/[.06] px-3 py-3 text-center ring-1 ring-white/10">
            <p className="text-[11px] text-white/55">Prize pool</p>
            <p className="mt-0.5 text-[18px] font-extrabold text-gold-300">{lakhBeans(p.totalRewardBeans)} beans</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Short motivating line under the hero — always about the next concrete step. */
function Nudge({ p }) {
  const st = standing(p)
  let icon = 'zap'
  let text
  if (st.winning && p.myRank === 1) { icon = 'crown'; text = <>You're on top. Stay online to keep <b>#1</b> — others are earning too.</> }
  else if (st.nextUp) text = <>Move up to <b>#{st.nextUp.rank}</b> and win <b>{lakhBeans(st.nextUp.rewardBeans)}</b> instead of {lakhBeans(p.myRewardBeans)}.</>
  else if (st.winning) text = <>You're in the prizes. Keep earning so nobody pushes you out.</>
  else if (st.ranked) text = <>Every call, gift and paid message moves you up. Top {st.lastPrizeRank} win.</>
  else text = <>Earn <b>{beans(p.beansToQualify)}</b> more beans from calls, gifts or messages to get ranked.</>
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gold-300/40 bg-gold-50 px-4 py-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-400/20 text-gold-600"><Icon name={icon} size={16} /></span>
      <p className="text-[13px] leading-snug text-ink-700 [&_b]:font-bold [&_b]:text-ink-900">{text}</p>
    </div>
  )
}

function ActionButtons({ online, toggling, onGoOnline }) {
  const nav = useNavigate()
  return (
    <div className="grid grid-cols-2 gap-3">
      {online ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-3 py-3.5 text-[14px] font-bold text-emerald-700">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
          You're online
        </div>
      ) : (
        <button onClick={onGoOnline} disabled={toggling || online == null} className="btn-primary !py-3.5 disabled:opacity-60"><Icon name="phone" size={16} /> {toggling ? 'Going online…' : 'Go online'}</button>
      )}
      <button onClick={() => nav('/live')} className="btn-outline !py-3.5"><Icon name="live" size={16} className="text-rose-500" /> Go live</button>
    </div>
  )
}

function TierTable({ p }) {
  const holders = holdersOf(p)
  const hasHolders = tiersHaveHosts(p)
  const groups = groupTiers(p.tiers, hasHolders)
  const inGroup = (g) => p.myRank != null && p.myRank >= g.from && p.myRank <= g.to
  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <SectionTitle>Prizes</SectionTitle>
        <span className="text-[12px] text-ink-400">Min. {beans(p.minQualifyingBeans)} beans to qualify</span>
      </div>
      <div className="card overflow-hidden">
        {groups.map((g, i) => {
          const holder = g.from === g.to ? holders.get(g.from) : null
          const mine = inGroup(g) || !!holder?.isMe
          const podium = g.from <= 3 && g.from === g.to
          return (
            <div key={g.from} className={`flex items-center gap-3 px-4 py-3 ${i ? 'border-t border-black/5' : ''} ${mine ? 'bg-brand-50' : ''}`}>
              {podium ? (
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[14px] font-black shadow-sm ${MEDAL[g.from]}`}>{g.from}</span>
              ) : (
                <span className="grid h-9 w-11 -mx-1 shrink-0 place-items-center rounded-full bg-black/[.04] text-[11.5px] font-bold text-ink-500 tabular-nums">{g.from === g.to ? `#${g.from}` : `${g.from}–${g.to}`}</span>
              )}
              {hasHolders && !holder ? (
                <>
                  <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full border-2 border-dashed border-black/15 text-[15px] font-bold text-ink-300">—</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-ink-400">Nobody yet</p>
                    <p className="text-[12px] font-medium text-emerald-600">This spot can be yours</p>
                  </div>
                </>
              ) : holder ? (
                <>
                  <Avatar name={holder.name || 'Host'} src={holder.avatarUrl} size={38} ring={mine ? '#5b2ee5' : undefined} />
                  <div className="flex-1 min-w-0">
                    <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink-900">
                      <span className="truncate">{holder.name || 'Host'}</span>
                      {mine && <span className="pill shrink-0 !px-2 !py-0.5 bg-brand-600 text-white text-[10px] font-bold">YOU</span>}
                    </p>
                    {holder.beans != null && <p className="text-[12px] text-ink-400 tabular-nums">{beans(holder.beans)} beans earned</p>}
                  </div>
                </>
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink-900">
                    {g.from === g.to ? `Rank ${g.from}` : `Ranks ${g.from} – ${g.to}`}
                    {mine && <span className="ml-2 pill !px-2 !py-0.5 bg-brand-600 text-white text-[10px] font-bold align-middle">YOU · #{p.myRank}</span>}
                  </p>
                  {g.from !== g.to && <p className="text-[12px] text-ink-400">each</p>}
                </div>
              )}
              <span className={`text-[15px] font-extrabold whitespace-nowrap ${g.from <= 3 ? 'text-gold-600' : 'text-ink-900'}`}>{lakhBeans(g.rewardBeans)} <span className="text-[12px] font-semibold text-ink-400">beans</span></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HowItWorks({ periodKey }) {
  const daily = periodKey === 'daily'
  return (
    <div>
      <SectionTitle className="mb-2">How it works</SectionTitle>
      <div className="card p-4 space-y-3 text-[13px] text-ink-600">
        {[
          ['trending-up', <>You're ranked by beans earned from <b>calls, gifts and paid messages</b>.</>],
          ['clock', daily ? <>A day runs <b>midnight to midnight</b>, India time.</> : <>A week runs <b>Monday to Monday</b>, midnight India time.</>],
          ['shield-check', <>Reach the minimum beans to get ranked. The top ranks win the prizes above.</>],
          ['wallet', <>About <b>5 minutes after the {daily ? 'day' : 'week'} ends</b>, rewards are added to your beans and you get a notification.</>],
          ['info', <>Reward beans can be withdrawn, but they don't count towards your host level.</>],
        ].map(([icon, text], i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><Icon name={icon} size={14} /></span>
            <p className="pt-1 leading-snug [&_b]:font-semibold [&_b]:text-ink-900">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PastWins() {
  const [items, setItems] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback((p = 1) => {
    setErr('')
    setBusy(true)
    rewardsApi.history(p, 20)
      .then((res) => {
        const list = res?.payouts || (Array.isArray(res) ? res : [])
        setItems((prev) => (p === 1 ? list : [...(prev || []), ...list]))
        setHasMore(res?.hasMore ?? list.length >= 20)
        setPage(p)
      })
      .catch((e) => { setErr(errorMessage(e, 'Could not load your past wins.')); setItems((prev) => prev || []) })
      .finally(() => setBusy(false))
  }, [])
  useEffect(() => { load(1) }, [load])

  const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric', month: 'short' })
  const when = (w) => (w.period === 'weekly' ? `Week of ${fmt(w.periodStart)}` : fmt(w.periodStart))

  return (
    <div>
      <SectionTitle className="mb-2">My past wins</SectionTitle>
      {items === null && <SkelGroup><SkelList rows={3} avatar="square" /></SkelGroup>}
      {err && <ErrorCard message={err} onRetry={() => load(1)} compact className="mb-2" />}
      {items && items.length === 0 && !err && (
        <div className="card flex flex-col items-center px-6 py-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-gold-50 text-gold-500"><Icon name="trophy" size={26} /></span>
          <p className="mt-3 text-[15px] font-bold text-ink-900">No wins yet</p>
          <p className="mt-1 max-w-xs text-[13px] text-ink-400">Your first one could be today. Wins show up here once they're paid.</p>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="card px-4 divide-y divide-black/5">
          {items.map((w, i) => (
            <div key={`${w.period}-${w.periodStart}-${i}`} className="flex items-center gap-3 py-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-[14px] font-black ${MEDAL[w.rank] || 'from-brand-50 to-brand-100 text-brand-700'}`}>#{w.rank}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-ink-900 truncate">{PERIODS[w.period]?.label || 'Reward'} · {when(w)}</p>
                <p className="text-[12px] text-ink-400 truncate">Earned {beans(w.beansEarned)} beans{w.paidAt ? ` · paid ${fmt(w.paidAt)}` : ''}</p>
              </div>
              <span className="text-[15px] font-extrabold text-emerald-600 whitespace-nowrap">+{lakhBeans(w.rewardBeans)}</span>
            </div>
          ))}
        </div>
      )}
      {hasMore && <button onClick={() => load(page + 1)} disabled={busy} className="btn-outline mt-3 text-[13px] disabled:opacity-60">{busy ? 'Loading…' : 'Load more'}</button>}
    </div>
  )
}

/** Fetches /me/rewards, refreshes it every minute while the tab is visible, and again a few
 * seconds after a period closes so the new day/week appears without a manual reload. */
export function useRewards(refreshMs = 60000) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const load = useCallback(() => {
    setErr('')
    return rewardsApi.get().then(setData).catch((e) => setErr(errorMessage(e, 'Could not load rewards.')))
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, refreshMs)
    return () => clearInterval(t)
  }, [load, refreshMs])

  const ends = [data?.daily, data?.weekly].filter((p) => p?.enabled && p.periodEnd).map((p) => new Date(p.periodEnd).getTime())
  const nextEnd = ends.length ? Math.min(...ends) : null
  const reloadRef = useRef(null)
  useEffect(() => {
    if (!nextEnd) return
    const wait = nextEnd - Date.now() + 5000
    if (wait > 2 ** 31 - 1) return
    reloadRef.current = setTimeout(load, Math.max(5000, wait))
    return () => clearTimeout(reloadRef.current)
  }, [nextEnd, load])

  return { data, err, load }
}

export function Rewards() {
  const [sp, setSp] = useSearchParams()
  const { data, err, load } = useRewards(30000)
  const now = useNow()
  const [online, setOnline] = useState(null)
  const [toggling, setToggling] = useState(false)
  const [actionErr, setActionErr] = useState('')
  const [paisePerBean, setPaisePerBean] = useState(null)

  useEffect(() => {
    earningsApi.dashboard().then((d) => setOnline(!!d?.isOnline)).catch(() => setOnline(false))
    configApi.get().then((c) => setPaisePerBean(c?.paisePerBean || null)).catch(() => {})
  }, [])

  const keys = Object.keys(PERIODS).filter((k) => data?.[k]?.enabled)
  const wanted = sp.get('tab')
  const periodKey = keys.includes(wanted) ? wanted : keys[0]
  const p = periodKey ? data[periodKey] : null
  const debug = sp.has('debug')
  const setPeriod = (k) => setSp(debug ? { tab: k, debug: '1' } : { tab: k }, { replace: true })

  const goOnline = async () => {
    setToggling(true)
    setActionErr('')
    try {
      await presenceApi.setOnline(true)
      setOnline(true)
    } catch (e) {
      setActionErr(errorMessage(e, 'Could not go online.'))
    } finally {
      setToggling(false)
    }
  }

  return (
    <AppLayout title="Daily & Weekly Wins" back bottomNav={false} maxW="xl" bg="canvas">
      <TopBar title="Daily & Weekly Wins" sub="Earn more, rank higher, win beans" />
      {debug && <RawResponse data={data} err={err} onReload={load} />}

      {!data && !err && (
        <SkelGroup className="lg:grid lg:grid-cols-[400px_1fr] lg:gap-6 lg:items-start">
          <SkelHero height="h-[420px]" className="!rounded-none lg:!rounded-[28px]" />
          <div className="px-5 lg:px-0 pt-4 lg:pt-0 space-y-4">
            <Skel className="h-14 rounded-2xl" />
            <SkelList rows={5} avatar="circle" />
          </div>
        </SkelGroup>
      )}

      {!data && err && <ErrorCard message={err} onRetry={load} className="mt-6" />}

      {data && !p && (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-gold-50 text-gold-500"><Icon name="trophy" size={36} /></span>
          <h2 className="mt-5 text-[20px] font-extrabold text-ink-900">No rewards running right now</h2>
          <p className="mt-1.5 max-w-sm text-[14px] text-ink-400">Daily and weekly rewards are switched off at the moment. We'll notify you when they're back.</p>
          <div className="mt-8 w-full max-w-md text-left"><PastWins /></div>
        </div>
      )}

      {p && (
        <div className="pb-28 lg:grid lg:grid-cols-[400px_1fr] lg:gap-6 lg:items-start">
          <div className="lg:sticky lg:top-6 space-y-4">
            <Hero periodKey={periodKey} p={p} keys={keys} onPeriod={setPeriod} now={now} paisePerBean={paisePerBean} />
            <div className="px-5 lg:px-0 space-y-3">
              {err && <ErrorCard message={err} onRetry={load} compact />}
              <Nudge p={p} />
              <ActionButtons online={online} toggling={toggling} onGoOnline={goOnline} />
              <ErrorCard message={actionErr} compact />
            </div>
          </div>
          <div className="mt-5 lg:mt-0 px-5 lg:px-0 space-y-6">
            <TierTable p={p} />
            <HowItWorks periodKey={periodKey} />
            <PastWins />
          </div>
        </div>
      )}

      {p && <PinnedStanding p={p} />}
    </AppLayout>
  )
}

/** Open /rewards?debug=1 to see exactly what the backend sent for this logged-in host — both
 * GET /host/me/rewards and GET /host/me/rewards/history, as raw JSON, with copy buttons. For
 * checking the API, not for hosts; nothing links here. */
function RawResponse({ data, err, onReload }) {
  const [history, setHistory] = useState(undefined)
  const [historyErr, setHistoryErr] = useState('')
  const [copied, setCopied] = useState('')
  const [at, setAt] = useState(() => new Date())
  useEffect(() => {
    rewardsApi.history(1, 20).then(setHistory).catch((e) => { setHistory(null); setHistoryErr(errorMessage(e)) })
  }, [])
  useEffect(() => { setAt(new Date()) }, [data])

  const copy = async (key, value) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2))
      setCopied(key)
      setTimeout(() => setCopied(''), 1500)
    } catch { /* clipboard blocked — the text is still selectable */ }
  }

  const blocks = [
    ['rewards', 'GET /host/me/rewards', data, err],
    ['history', 'GET /host/me/rewards/history?page=1&pageSize=20', history, historyErr],
  ]
  return (
    <div className="mx-5 lg:mx-0 my-4 space-y-3">
      <div className="flex items-center gap-2 rounded-xl bg-gold-50 px-3 py-2 text-[12px] text-gold-600 ring-1 ring-gold-300/40">
        <Icon name="info" size={14} />
        <span className="flex-1">Debug view — raw backend response · fetched {at.toLocaleTimeString('en-IN')}</span>
        <button onClick={onReload} className="font-semibold">Reload</button>
      </div>
      {blocks.map(([key, label, value, error]) => (
        <div key={key} className="overflow-hidden rounded-2xl bg-[#0f0f14] text-white ring-1 ring-black/10">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <span className="flex-1 truncate font-mono text-[11.5px] text-white/70">{label}</span>
            {value != null && (
              <button onClick={() => copy(key, value)} className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold">{copied === key ? 'Copied' : 'Copy'}</button>
            )}
          </div>
          <pre className="max-h-[60vh] overflow-auto p-3 font-mono text-[11.5px] leading-relaxed text-emerald-200 whitespace-pre select-text">
            {error ? `Error: ${error}` : value === undefined ? 'Loading…' : JSON.stringify(value, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  )
}

/** Always-visible bar with the host's own standing, so it's never scrolled away. */
function PinnedStanding({ p }) {
  const ranked = p.myRank != null
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 lg:left-[248px] pointer-events-none">
      <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-[#140a2b] px-4 py-3 text-white shadow-pop ring-1 ring-white/10 animate-slide-up">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${ranked ? 'bg-gradient-to-br from-gold-300 to-gold-500 text-[#5a3d00]' : 'bg-white/10 text-gold-300'}`}>
          <Icon name={ranked ? 'trophy' : 'zap'} size={17} />
        </span>
        <p className="flex-1 min-w-0 text-[13.5px] leading-snug">
          {ranked ? (
            <>You're <b>#{p.myRank}</b> · {beans(p.myBeans)} beans · winning <b className="text-gold-300">{lakhBeans(p.myRewardBeans)}</b></>
          ) : (
            <>Earn <b className="text-gold-300">{beans(p.beansToQualify)}</b> more beans to get ranked</>
          )}
        </p>
      </div>
    </div>
  )
}

/** Compact card for Home / Performance — the host's live standing in today's (or this week's)
 * race with a ticking countdown, so they see it every time they open the app. Renders nothing
 * while loading, on error, or when both periods are switched off. */
export function RewardsTeaser({ className = '' }) {
  const nav = useNavigate()
  const { data } = useRewards()
  const now = useNow()
  const keys = Object.keys(PERIODS).filter((k) => data?.[k]?.enabled)
  if (!keys.length) return null

  return (
    <button onClick={() => nav(`/rewards?tab=${keys[0]}`)} className={`group relative w-full overflow-hidden rounded-2xl bg-[#140a2b] p-4 text-left text-white shadow-pop active:scale-[.99] transition ${className}`}>
      <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand-600/50 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-gold-400/20 blur-3xl" />
      <div className="relative flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-400/20 text-gold-300"><Icon name="trophy" size={18} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-extrabold leading-tight">Daily & Weekly Wins</p>
          <p className="text-[11.5px] text-white/60">Top earners win bonus beans</p>
        </div>
        <Icon name="chevron-right" size={18} className="text-white/50 transition group-hover:translate-x-0.5" />
      </div>
      <div className={`relative mt-3 grid gap-2.5 ${keys.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {keys.map((k) => {
          const p = data[k]
          const st = standing(p)
          return (
            <div key={k} className="rounded-xl bg-white/[.07] px-3 py-2.5 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-white/60 whitespace-nowrap">{k === 'daily' ? 'Today' : 'Week'}</span>
                <span className="flex items-center gap-1 text-[11px] font-semibold tabular-nums text-white/70 whitespace-nowrap"><Icon name="timer" size={11} /> {countdownText(p.periodEnd, now)}</span>
              </div>
              {st.winning ? (
                <p className="mt-1 text-[15px] font-extrabold">#{p.myRank} <span className="text-gold-300">· {lakhBeans(p.myRewardBeans)}</span></p>
              ) : st.ranked ? (
                <p className="mt-1 text-[15px] font-extrabold">#{p.myRank} <span className="text-[12px] font-semibold text-white/60">· top {st.lastPrizeRank} win</span></p>
              ) : (
                <>
                  <p className="mt-1 text-[13px] font-bold">{beans(p.beansToQualify)} <span className="font-medium text-white/60">to qualify</span></p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gold-400" style={{ width: `${st.qualifyPct}%` }} /></div>
                </>
              )}
              <p className="mt-1 text-[11px] text-white/50">Prize pool {lakhBeans(p.totalRewardBeans)}</p>
            </div>
          )
        })}
      </div>
    </button>
  )
}

/** The most recent win, if it was paid in the last 24 hours — "You won #2 yesterday" on Home. */
function useRecentWin() {
  const [win, setWin] = useState(null)
  useEffect(() => {
    rewardsApi.history(1, 1)
      .then((res) => {
        const w = (res?.payouts || (Array.isArray(res) ? res : []))[0]
        if (w?.paidAt && Date.now() - new Date(w.paidAt).getTime() < 24 * 3600e3) setWin(w)
      })
      .catch(() => {})
  }, [])
  return win
}

/** Today's top 3 — needs `leaders` from the backend (requested); hidden until it's sent. */
function MiniPodium({ leaders, myRank }) {
  const top = [...leaders].sort((a, b) => a.rank - b.rank).slice(0, 3)
  const order = [top[1], top[0], top[2]].filter(Boolean)
  return (
    <div className="flex items-end justify-center gap-2.5">
      {order.map((l) => {
        const first = l.rank === 1
        const me = l.isMe || l.rank === myRank
        return (
          <div key={l.rank} className="flex w-[62px] flex-col items-center text-center">
            <div className="relative">
              {first && <span className="absolute -top-[18px] left-1/2 -translate-x-1/2 text-[15px] leading-none" aria-hidden>👑</span>}
              <Avatar name={l.name || 'Host'} src={l.avatarUrl} size={first ? 48 : 38} ring={me ? '#e9c46a' : 'rgba(255,255,255,.65)'} />
              <span className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gradient-to-br px-1 text-[10px] font-black ${MEDAL[l.rank]}`}>{l.rank}</span>
            </div>
            <p className={`mt-2.5 w-full truncate text-[11px] font-bold ${me ? 'text-gold-300' : ''}`}>{me ? 'You' : l.name || 'Host'}</p>
            <p className="text-[10px] tabular-nums text-white/55">{lakhBeans(l.beans)}</p>
          </div>
        )
      })}
    </div>
  )
}

/** Top-of-Home Daily Wins banner — the host's live rank, the countdown to midnight, today's top 3
 * (from tiers[].host) and exactly how far they are from the next rank, so the race is the first
 * thing they see. */
export function DailyWinsBanner({ className = '' }) {
  const nav = useNavigate()
  const { data } = useRewards()
  const now = useNow()
  const recent = useRecentWin()
  const keys = Object.keys(PERIODS).filter((k) => data?.[k]?.enabled)
  if (!keys.length) return null

  const main = keys[0]
  const p = data[main]
  const otherKey = keys[1]
  const other = otherKey ? data[otherKey] : null
  const st = standing(p)
  const holders = holdersOf(p)
  const top = [...holders.values()].filter((h) => h.rank <= 3)
  const leaders = top.length ? top : null
  // Beans needed to pass the host one rank up: their beans minus ours, plus one.
  const ahead = p.myRank > 1 ? holders.get(p.myRank - 1) : null
  const beansToNextRank = p.beansToNextRank ?? (ahead?.beans != null ? Math.max(1, ahead.beans - (p.myBeans ?? 0) + 1) : null)
  const nextTier = p.myRank > 1 ? st.tiers.find((t) => t.rank === p.myRank - 1) : null

  let gap
  if (st.ranked && p.myRank === 1) gap = <>You're <b>#1</b>. Stay online to hold it till the end.</>
  else if (st.ranked && beansToNextRank != null) gap = <><b>{beans(beansToNextRank)} beans</b> behind #{p.myRank - 1}{nextTier ? <> · win <b className="text-gold-300">{lakhBeans(nextTier.rewardBeans)}</b></> : null}</>
  else if (st.nextUp) gap = <>Move up to <b>#{st.nextUp.rank}</b> to win <b className="text-gold-300">{lakhBeans(st.nextUp.rewardBeans)}</b></>
  else if (st.ranked) gap = <>Reach <b>#{st.lastPrizeRank}</b> to win <b className="text-gold-300">{lakhBeans(st.lastTier?.rewardBeans)}</b></>
  else gap = <>Earn <b>{beans(p.beansToQualify)}</b> more beans to get ranked</>

  const open = (k) => nav(`/rewards?tab=${k}`)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => open(main)}
      onKeyDown={(e) => { if (e.key === 'Enter') open(main) }}
      className={`relative w-full cursor-pointer overflow-hidden rounded-3xl bg-[#140a2b] text-left text-white shadow-pop transition active:scale-[.995] ${className}`}
    >
      <div className="pointer-events-none absolute -left-14 -top-20 h-56 w-56 rounded-full bg-brand-600/55 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-6 h-48 w-48 rounded-full bg-fuchsia-600/25 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 -bottom-10 h-32 w-56 rounded-full bg-gold-400/15 blur-3xl" />

      <div className="relative p-4">
        {/* header: title + countdown */}
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-500 text-[#5a3d00] shadow-[0_6px_16px_-6px_rgba(224,169,46,.9)]"><Icon name="trophy" size={18} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-extrabold leading-tight">{PERIODS[main].label}</p>
            <p className="text-[11px] text-white/55 truncate">Prize pool <span className="font-bold text-gold-300">{lakhBeans(p.totalRewardBeans)} beans</span></p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-bold tabular-nums ring-1 ring-white/10">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" /></span>
            {countdownText(p.periodEnd, now)}
          </span>
        </div>

        {recent && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-gold-400/15 px-3 py-2 text-[12px] ring-1 ring-gold-300/30">
            <span aria-hidden>🎉</span>
            <span className="flex-1 min-w-0 truncate">You won <b>#{recent.rank}</b> {recent.period === 'weekly' ? 'last week' : 'yesterday'}</span>
            <span className="font-extrabold text-gold-300">+{lakhBeans(recent.rewardBeans)}</span>
          </div>
        )}

        {/* standing (+ podium when the backend sends today's leaders) */}
        <div className={`mt-4 grid items-end gap-3 ${leaders ? 'grid-cols-[1fr_auto]' : 'grid-cols-1'}`}>
          <div className="min-w-0">
            {st.ranked ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Your rank</p>
                <p className={`text-[44px] font-black leading-none ${st.winning ? 'bg-gradient-to-b from-[#fff3c4] to-gold-400 bg-clip-text text-transparent' : ''}`}>#{p.myRank}</p>
                <p className="mt-1.5 text-[12px] text-white/70">
                  {st.winning ? <>Winning <b className="text-gold-300">{lakhBeans(p.myRewardBeans)} beans</b></> : <>Top {st.lastPrizeRank} win prizes</>}
                </p>
                <p className="text-[11px] text-white/45">{beans(p.myBeans)} beans earned {main === 'daily' ? 'today' : 'this week'}</p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Not ranked yet</p>
                <p className="mt-0.5 text-[24px] font-extrabold leading-tight">{beans(p.beansToQualify)} <span className="text-[13px] font-semibold text-white/60">to qualify</span></p>
                <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-gold-300 to-gold-500" style={{ width: `${st.qualifyPct}%` }} /></div>
                <p className="mt-1 text-[11px] text-white/50">{beans(p.myBeans)} / {beans(p.minQualifyingBeans)} beans</p>
              </>
            )}
          </div>
          {leaders && <MiniPodium leaders={leaders} myRank={p.myRank} />}
        </div>

        {/* the one next step */}
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-white/[.07] px-3 py-2.5 ring-1 ring-white/10">
          <Icon name="zap" size={15} className="shrink-0 text-gold-300" />
          <p className="flex-1 min-w-0 text-[12.5px] leading-snug text-white/85 [&_b]:font-bold [&_b]:text-white">{gap}</p>
          <Icon name="chevron-right" size={16} className="shrink-0 text-white/50" />
        </div>

        {other && (
          <button
            onClick={(e) => { e.stopPropagation(); open(otherKey) }}
            className="mt-2.5 flex w-full items-center gap-2 rounded-xl px-1 py-1 text-left text-[12px] text-white/65 hover:text-white"
          >
            <Icon name="calendar" size={13} className="shrink-0" />
            <span className="flex-1 min-w-0 truncate">
              <b className="font-bold text-white/85">{PERIODS[otherKey].label}</b>
              {' · '}{other.myRank != null ? `#${other.myRank}${(other.myRewardBeans ?? 0) > 0 ? ` · winning ${lakhBeans(other.myRewardBeans)}` : ''}` : `${beans(other.beansToQualify)} to qualify`}
            </span>
            <span className="shrink-0 tabular-nums">ends {countdownText(other.periodEnd, now)}</span>
          </button>
        )}
      </div>
    </div>
  )
}
