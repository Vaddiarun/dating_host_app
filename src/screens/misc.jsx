import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { StatusBar, PlainHeader, TopBar, Avatar, Segmented, IconBadge, ResultScreen, SectionTitle, ErrorCard } from '../ui/kit.jsx'
import { AppLayout, ImmersiveLayout, CenterLayout } from '../ui/layouts.jsx'
import { reportReasons } from '../data.js'
import { moderation as moderationApi, gifts as giftsApi, notifications as notificationsApi } from '../api/index.js'
import { useAuth } from '../state/AuthContext.jsx'
import { useNotificationsCount } from '../state/NotificationsContext.jsx'
import { errorMessage } from '../lib/errors.js'
import { dayLabel, clockTime } from '../lib/format.js'
import { onSocketEventWhenReady } from '../lib/socket.js'

/* 44 — Notifications */
// v1 notification types from the backend: gift, withdrawal_status, missed_call. Rendered
// generically (title/message from the payload) so any type added later still shows something.
const NOTIF_GROUP = { gift: 'Money', withdrawal_status: 'Money', missed_call: 'Calls' }
const NOTIF_ICON = { gift: 'gift', withdrawal_status: 'wallet', missed_call: 'phone' }
const NOTIF_TONE = { gift: 'gold', withdrawal_status: 'brand', missed_call: 'rose' }
const notifId = (n) => n.id ?? n._id
const notifRead = (n) => n.isRead ?? n.read ?? false
const notifTitle = (n) => n.title || n.message || { gift: 'You received a gift', withdrawal_status: 'Withdrawal status changed', missed_call: 'You missed a call' }[n.type] || 'Notification'
const notifSub = (n) => n.sub || n.subtitle || n.body || ''

export function Notifications() {
  const { refresh: refreshUnreadBadge, decrementBy } = useNotificationsCount()
  const [f, setF] = useState('All')
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = (p = 1) => {
    if (p === 1) setLoading(true)
    setErr('')
    notificationsApi.list(p, 20)
      .then((res) => {
        const list = res.items || res.notifications || res.results || []
        setItems((prev) => (p === 1 ? list : [...prev, ...list]))
        setHasMore(list.length >= 20)
        setPage(p)
      })
      .catch((e) => setErr(errorMessage(e, 'Could not load your notifications.')))
      .finally(() => setLoading(false))
  }
  useEffect(() => load(1), []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => onSocketEventWhenReady('notification:new', (n) => setItems((prev) => [n, ...prev])), [])

  const markRead = (n) => {
    if (notifRead(n)) return
    setItems((prev) => prev.map((it) => (it === n ? { ...it, isRead: true, read: true } : it)))
    decrementBy(1)
    notificationsApi.markRead(notifId(n)).catch(() => refreshUnreadBadge()) // resync the badge if the call actually failed
  }

  const markAllRead = () => {
    setItems((prev) => prev.map((it) => ({ ...it, isRead: true, read: true })))
    decrementBy(Infinity)
    notificationsApi.markAllRead().catch(() => refreshUnreadBadge())
  }

  const unreadCount = items.filter((n) => !notifRead(n)).length
  const filtered = items.filter((n) => f === 'All' || (NOTIF_GROUP[n.type] || 'System') === f)
  const groups = filtered.reduce((acc, n) => { (acc[dayLabel(n.createdAt) || 'Earlier'] ||= []).push(n); return acc }, {})

  return (
    <AppLayout tab="/notifications" title="Notifications" back bottomNav={false} maxW="lg" bg="canvas">
      <TopBar title="Notifications" sub={unreadCount ? `${unreadCount} unread` : undefined} right={unreadCount > 0 && (
        <button onClick={markAllRead} className="text-[12px] font-semibold text-brand-600">Mark all read</button>
      )} />
      <div className="px-5 lg:px-0 pt-3 lg:pt-0 pb-6">
        <div className="flex items-center gap-3">
          <Segmented options={['All', 'Money', 'Calls', 'System']} value={f} onChange={setF} />
          <button onClick={markAllRead} className="hidden lg:block ml-auto shrink-0 text-[12px] font-semibold text-brand-600">Mark all read</button>
        </div>
        {loading && <p className="text-[13px] text-ink-400 mt-6 text-center">Loading…</p>}
        {!loading && err && <ErrorCard message={err} onRetry={() => load(1)} className="mt-6" />}
        {!loading && !err && filtered.length === 0 && <p className="text-[13px] text-ink-400 mt-6 text-center">Nothing here yet.</p>}
        {!err && Object.entries(groups).map(([day, list]) => (
          <div key={day}>
            <SectionTitle className="mt-5 mb-1">{day}</SectionTitle>
            <div className="card px-4 divide-y divide-black/5">
              {list.map((it, i) => (
                <button key={notifId(it) ?? i} onClick={() => markRead(it)} className="w-full flex items-center gap-3 py-3 text-left">
                  <IconBadge name={NOTIF_ICON[it.type] || 'bell'} tone={NOTIF_TONE[it.type] || 'brand'} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] ${notifRead(it) ? 'font-medium text-ink-700' : 'font-semibold text-ink-900'}`}>{notifTitle(it)}</p>
                    {notifSub(it) && <p className="text-[12px] text-ink-400 truncate">{notifSub(it)}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-ink-300">{clockTime(it.createdAt)}</p>
                    {!notifRead(it) && <span className="mt-1 inline-block h-2 w-2 rounded-full bg-brand-600" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
        {!loading && !err && hasMore && (
          <button onClick={() => load(page + 1)} className="btn-outline mt-4 text-[13px]">Load more</button>
        )}
      </div>
    </AppLayout>
  )
}

/* 45 — Report user */
export function ReportUser() {
  const nav = useNavigate()
  const location = useLocation()
  const targetId = location.state?.targetId
  const targetName = location.state?.targetName || 'this user'
  const [sel, setSel] = useState(reportReasons[0])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setBusy(true)
    setErr('')
    try {
      if (targetId) {
        await moderationApi.report('user', targetId, notes.trim() ? `${sel} — ${notes.trim()}` : sel)
      }
      nav('/report/submitted')
    } catch (e) {
      setErr(errorMessage(e, 'Could not submit the report.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout tab="/calls" title="Report user" back bottomNav={false} maxW="md" bg="white">
      <TopBar title="Report user" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-4">
        <div className="flex items-center gap-3">
          <Avatar name={targetName} size={44} />
          <div><p className="text-[15px] font-semibold text-ink-900">{targetName}</p></div>
        </div>
        <SectionTitle className="mt-5 mb-2">What happened?</SectionTitle>
        <div className="card divide-y divide-black/5">
          {reportReasons.map((r) => (
            <button key={r} onClick={() => setSel(r)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
              <span className={`h-5 w-5 rounded-full border-2 grid place-items-center ${sel === r ? 'border-brand-600 bg-brand-600' : 'border-black/20'}`}>{sel === r && <Icon name="check" size={12} className="text-white" />}</span>
              <span className="text-[14px] text-ink-900">{r}</span>
            </button>
          ))}
        </div>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add details (optional)" className="input mt-3" />
        <ErrorCard message={err} compact className="mt-3" />
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-[12px] text-brand-700">
          <Icon name="shield" size={14} className="mt-0.5 shrink-0" /> Reports are confidential. The user is never told who reported them.
        </div>
        <button onClick={submit} disabled={busy} className="btn-danger-outline mt-4 disabled:opacity-60"><Icon name="flag" size={16} /> {busy ? 'Submitting…' : 'Submit report'}</button>
      </div>
    </AppLayout>
  )
}

/* 47 — Report submitted */
export function ReportSubmitted() {
  const nav = useNavigate()
  return (
    <AppLayout tab="/calls" title="Report" back bottomNav={false} maxW="md" bg="white">
      <div className="py-8">
        <ResultScreen tone="green" icon="check" title="Report submitted" desc="Our safety team will review it shortly">
          <div className="card p-4 text-left space-y-3">
            {[['shield', 'Our safety team reviews within 24 hours'], ['bell', "We'll notify you of the outcome"]].map(([i, t]) => (
              <div key={t} className="flex items-center gap-3"><span className="grid place-items-center h-8 w-8 rounded-lg bg-brand-50 text-brand-600"><Icon name={i} size={15} /></span><span className="text-[13px] text-ink-700">{t}</span></div>
            ))}
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700 flex items-center gap-2"><Icon name="check" size={14} /> Thanks for helping keep the community safe.</div>
          <button onClick={() => nav('/home')} className="btn-primary">Back to home</button>
        </ResultScreen>
      </div>
    </AppLayout>
  )
}

/* 46 — Block user */
export function BlockUser() {
  const nav = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const name = location.state?.name || 'this user'
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const confirm = async () => {
    setBusy(true)
    setErr('')
    try {
      if (id) await moderationApi.block(id)
      nav(`/blocked/${id}`, { state: { name } })
    } catch (e) {
      setErr(errorMessage(e, 'Could not block this user.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout tab="/chat" title={name} back bottomNav={false} maxW="md" bg="canvas">
      <div className="fixed inset-0 z-[70] flex flex-col justify-end lg:justify-center lg:items-center" onClick={() => nav(-1)}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative bg-white rounded-t-3xl lg:rounded-2xl lg:max-w-sm w-full p-5 animate-sheet-up" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start gap-3">
            <span className="grid place-items-center h-11 w-11 rounded-full bg-rose-50 text-rose-500 shrink-0"><Icon name="ban" size={18} /></span>
            <div><p className="text-[17px] font-bold text-ink-900">Block {name}?</p><p className="text-[13px] text-ink-400 mt-0.5">They won't be able to call or message you, and your profile is hidden from them. You can unblock any time from Settings.</p></div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-gold-50 px-3 py-2.5 text-[12px] text-gold-600"><Icon name="alert" size={14} /> Blocking also ends any active call with this user.</div>
          <ErrorCard message={err} compact className="mt-3" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => nav(-1)} className="btn-outline">Cancel</button>
            <button onClick={confirm} disabled={busy} className="btn-danger-outline disabled:opacity-60"><Icon name="ban" size={16} /> {busy ? 'Blocking…' : 'Block'}</button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

/* 58 — Blocked confirmation */
export function Blocked() {
  const nav = useNavigate()
  const location = useLocation()
  const name = location.state?.name || 'They'
  return (
    <AppLayout tab="/chat" title="Blocked" back bottomNav={false} maxW="md" bg="white">
      <div className="py-8">
        <ResultScreen tone="green" icon="check" title={`${name} is blocked`} desc="They can no longer contact you">
          <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-[12px] text-brand-700 flex items-center gap-2"><Icon name="shield" size={14} /> Manage this anytime from Profile → Blocked creators.</div>
          <button onClick={() => nav('/home')} className="btn-primary">Back to home</button>
        </ResultScreen>
      </div>
    </AppLayout>
  )
}

/* 48 — Ask for a gift */
/**
 * The actual "ask for a gift" bottom sheet — factored out so it can be dropped in as an
 * overlay on top of a live call/broadcast (see calls.jsx / live.jsx) instead of only being
 * reachable by navigating to a whole separate route. Navigating away used to unmount the
 * call screen entirely, which tore down the live Agora session just to ask for a gift.
 */
export function GiftRequestSheet({ userId, onClose }) {
  const [catalog, setCatalog] = useState([])
  const [pick, setPick] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [catalogErr, setCatalogErr] = useState('')
  const [sendErr, setSendErr] = useState('')

  const loadCatalog = () => {
    setCatalogErr('')
    giftsApi.catalog().then((res) => {
      const list = res.gifts || []
      setCatalog(list)
      setPick(list[0]?.id || null)
    }).catch((e) => setCatalogErr(errorMessage(e, 'Could not load the gift catalog.')))
  }
  useEffect(loadCatalog, [])

  const send = async () => {
    if (!pick) return
    setBusy(true)
    setSendErr('')
    try {
      if (userId) await giftsApi.request(userId, pick)
      setSent(true)
      setTimeout(onClose, 1200)
    } catch (e) {
      setSendErr(errorMessage(e, 'Could not send that request.'))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl p-5 pt-4 text-ink-900 animate-sheet-up max-h-[80dvh] overflow-y-auto no-scrollbar">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-black/15" />
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-bold">Ask for a gift</h3>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-full bg-black/5 text-ink-500"><Icon name="x" size={15} /></button>
        </div>
        {sent ? (
          <p className="text-[13px] text-emerald-600 font-semibold mt-3 flex items-center gap-2"><Icon name="check" size={16} /> Request sent!</p>
        ) : (
          <>
            {catalog.length === 0 && <ErrorCard message={catalogErr} onRetry={loadCatalog} className="mt-2.5" />}
            <div className="grid grid-cols-3 gap-2.5 mt-2.5">
              {catalog.map((g) => (
                <button key={g.id} onClick={() => setPick(g.id)} className={`rounded-2xl border py-2.5 flex flex-col items-center gap-0.5 ${pick === g.id ? 'border-gold-400 bg-gold-50' : 'border-black/10'}`}>
                  <span className="text-xl">🎁</span>
                  <span className="text-[13px] font-semibold text-center px-1">{g.name}</span>
                  <span className="text-[12px] font-bold text-gold-500">{(g.pricePaise / 100).toLocaleString('en-IN')}</span>
                </button>
              ))}
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a sweet note…" className="input mt-2.5" />
            {sendErr && <p className="text-[12px] text-rose-500 mt-2">{sendErr}</p>}
            <button onClick={send} disabled={busy || !pick} className="btn-gold mt-2.5 disabled:opacity-60"><Icon name="gift" size={16} /> {busy ? 'Sending…' : 'Send request'}</button>
          </>
        )}
      </div>
    </div>
  )
}

export function AskGift() {
  const nav = useNavigate()
  const { ctx } = useParams()
  const location = useLocation()
  const userId = location.state?.userId
  const isLive = ctx?.startsWith('live')

  return (
    <ImmersiveLayout>
      <div className="flex min-h-[100dvh] w-full flex-col text-white bg-gradient-to-b from-night-700 via-night-800 to-night-900">
        <StatusBar dark />
        <div className="w-full max-w-[480px] mx-auto px-4">
          {isLive ? (
            <div className="flex items-center gap-2">
              <span className="pill bg-black/40 text-white text-[12px]"><Avatar name="You" size={20} /> You <span className="text-rose-400 font-bold">● LIVE</span></span>
            </div>
          ) : (
            <div className="rounded-2xl bg-white/8 px-3.5 py-2.5 flex items-center gap-3 border border-white/10">
              <Avatar name="Caller" size={34} /><span className="flex-1 text-[15px] font-semibold">Caller</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-h-[64px] grid place-items-center"><div className="h-40 w-40 sm:h-52 sm:w-52 rounded-full bg-white/5" /></div>
        <GiftRequestSheet userId={userId} onClose={() => nav(-1)} />
      </div>
    </ImmersiveLayout>
  )
}

/* 49 — Gift received (demo preview — no live gift-events feed from the backend yet) */
export function GiftReceived() {
  const nav = useNavigate()
  return (
    <ImmersiveLayout>
      <div className="mx-auto flex min-h-[100dvh] max-w-[520px] flex-col text-white bg-gradient-to-b from-night-800 to-night-900">
        <StatusBar dark />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <span className="grid place-items-center h-40 w-40 rounded-full bg-white/5 animate-slide-up">
            <span className="grid place-items-center h-24 w-24 rounded-full bg-gold-400 text-white text-4xl">👑</span>
          </span>
          <h2 className="mt-6 text-[22px] font-extrabold">Gift received!</h2>
          <p className="text-[13px] text-white/60 mt-1">Check Earnings for the latest gift totals</p>
        </div>
        <div className="px-4 pb-8">
          <button onClick={() => nav('/earnings')} className="btn bg-white/10 text-white mt-1"><Icon name="wallet" size={16} /> View earnings</button>
        </div>
      </div>
    </ImmersiveLayout>
  )
}

/* ---------------- system states ---------------- */

/* 50 — Loading */
export function LoadingState() {
  return (
    <AppLayout tab="/earnings" title="Earnings" maxW="xl" bg="canvas">
      <PlainHeader title="Earnings" sub="Loading…" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-4 space-y-4 animate-pulse">
        <div className="h-40 rounded-2xl bg-black/[.06]" />
        <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-black/[.06]" />)}</div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-black/[.06]" /><div className="flex-1 space-y-1.5"><div className="h-3 w-2/3 rounded bg-black/[.06]" /><div className="h-3 w-1/3 rounded bg-black/[.06]" /></div><div className="h-3 w-10 rounded bg-black/[.06]" /></div>
        ))}
      </div>
    </AppLayout>
  )
}

/* 51 — No calls */
export function NoCalls() {
  const nav = useNavigate()
  return (
    <AppLayout tab="/calls" title="Calls" maxW="md" bg="white">
      <PlainHeader title="Calls" />
      <div className="flex flex-col items-center px-6 pt-12 lg:pt-6 text-center">
        <span className="grid place-items-center h-28 w-28 rounded-[28px] bg-gradient-to-br from-brand-50 to-gold-50 text-brand-500"><Icon name="inbox" size={44} /></span>
        <h2 className="mt-5 text-[22px] font-extrabold text-ink-900">No calls yet</h2>
        <p className="mt-1.5 text-[13px] text-ink-400">Your first call is usually within 20 minutes of going online.</p>
        <div className="card w-full max-w-sm mt-5 p-4 text-left">
          <p className="text-[13px] font-bold text-ink-900 text-center mb-2">Get your first call faster</p>
          {['Add 3 photos to your gallery', 'Go online between 8–11 PM', 'Set a friendly bio'].map((t) => (
            <p key={t} className="flex items-center gap-2 text-[13px] text-ink-700 py-1"><Icon name="check" size={14} className="text-emerald-500" /> {t}</p>
          ))}
        </div>
        <button onClick={() => nav('/home?state=online')} className="btn-primary mt-4 max-w-sm"><Icon name="phone" size={16} /> Go online now</button>
      </div>
    </AppLayout>
  )
}

/* 52 — Something went wrong */
export function SomethingWrong() {
  return (
    <AppLayout tab="/earnings" title="Earnings" maxW="md" bg="white">
      <PlainHeader title="Earnings" />
      <div className="flex flex-col items-center px-6 pt-12 lg:pt-6 text-center">
        <span className="grid place-items-center h-28 w-28 rounded-full bg-rose-50 text-rose-500 border-2 border-dashed border-rose-200"><Icon name="alert" size={40} /></span>
        <h2 className="mt-5 text-[22px] font-extrabold text-ink-900">Something went wrong</h2>
        <p className="mt-1.5 text-[13px] text-ink-400">We couldn't load your earnings right now.</p>
        <button onClick={() => window.location.reload()} className="btn-primary mt-4 max-w-sm"><Icon name="refresh" size={16} /> Try again</button>
      </div>
    </AppLayout>
  )
}

function DarkState({ icon, title, desc, children }) {
  return (
    <ImmersiveLayout>
      <div className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col text-white bg-gradient-to-b from-night-800 to-night-900">
        <StatusBar dark />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <span className="grid place-items-center h-28 w-28 rounded-[28px] bg-white/10 text-white/80"><Icon name={icon} size={44} /></span>
          <h2 className="mt-5 text-[22px] font-extrabold">{title}</h2>
          <p className="mt-1.5 text-[14px] text-white/60 max-w-[18rem]">{desc}</p>
          <div className="w-full max-w-xs mt-5 space-y-3">{children}</div>
        </div>
      </div>
    </ImmersiveLayout>
  )
}

function LightState({ icon, iconWrap = 'bg-gradient-to-br from-brand-50 to-gold-50 text-brand-500', title, desc, children }) {
  return (
    <CenterLayout>
      <StatusBar />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className={`grid place-items-center h-28 w-28 rounded-[28px] ${iconWrap}`}><Icon name={icon} size={44} /></span>
        <h2 className="mt-5 text-[22px] font-extrabold text-ink-900">{title}</h2>
        <p className="mt-1.5 text-[14px] text-ink-400 max-w-[18rem]">{desc}</p>
        <div className="w-full max-w-xs mt-5 space-y-3">{children}</div>
      </div>
    </CenterLayout>
  )
}

/* 54 — Offline */
export function OfflineState() {
  return (
    <LightState icon="cloud-off" title="You're offline" desc="Check your mobile data or Wi-Fi and try again.">
      <div className="card p-3.5 flex items-center gap-3 text-left">
        <span className="grid place-items-center h-10 w-10 rounded-xl bg-black/5 text-ink-400 shrink-0"><Icon name="wifi-off" size={17} /></span>
        <span className="text-[13px] text-ink-500">Calls and live streams are paused while offline.</span>
      </div>
      <button onClick={() => window.location.reload()} className="btn-primary"><Icon name="refresh" size={16} /> Retry connection</button>
    </LightState>
  )
}

/* 55 — Reconnecting */
export function Reconnecting() {
  const nav = useNavigate()
  return (
    <ImmersiveLayout>
      <div className="mx-auto flex min-h-[100dvh] max-w-[520px] flex-col text-white bg-gradient-to-b from-night-700 via-night-800 to-night-900">
        <StatusBar dark />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="relative grid place-items-center">
            <span className="absolute h-48 w-48 rounded-full border border-white/15" />
            <span className="grid place-items-center h-28 w-28 rounded-full bg-brand-500/40"><Icon name="refresh" size={34} className="animate-spinslow" /></span>
          </div>
          <h2 className="mt-6 text-[22px] font-extrabold">Reconnecting…</h2>
          <p className="text-[14px] text-white/60 mt-1">Hang tight, we're restoring the call</p>
        </div>
        <div className="p-4 pb-8"><button onClick={() => nav('/calls')} className="btn bg-rose-500 text-white"><Icon name="phone-off" size={16} /> End call</button></div>
      </div>
    </ImmersiveLayout>
  )
}

/* 56 — Session expired */
export function SessionExpired() {
  const nav = useNavigate()
  const { logout } = useAuth()
  const go = async () => { try { await logout() } finally { nav('/login', { replace: true }) } }
  return (
    <LightState icon="lock" iconWrap="bg-gradient-to-br from-brand-50 to-gold-50 text-brand-500" title="Session expired" desc="For your security we signed you out after inactivity.">
      <div className="card p-3.5 flex items-center gap-3 text-left">
        <span className="grid place-items-center h-10 w-10 rounded-xl bg-black/5 text-ink-400 shrink-0"><Icon name="clock" size={17} /></span>
        <span className="text-[13px] text-ink-500">Your earnings and messages are safe. Just sign in again.</span>
      </div>
      <button onClick={go} className="btn-primary"><Icon name="chevron-right" size={16} /> Log in again</button>
    </LightState>
  )
}

/* 57 — Account suspended */
export function AccountSuspended() {
  return (
    <CenterLayout>
      <StatusBar />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className="grid place-items-center h-28 w-28 rounded-full bg-ink-700 text-white"><Icon name="user-x" size={44} /></span>
        <h2 className="mt-5 text-[22px] font-extrabold text-ink-900">Account suspended</h2>
        <p className="mt-1.5 text-[13px] text-ink-400 max-w-[18rem]">Your account was suspended for a community guidelines violation.</p>
        <div className="w-full max-w-sm mt-5 rounded-2xl p-4 text-left bg-black/[.03]">
          <p className="text-[13px] font-bold text-ink-900">Access removed</p>
          <p className="text-[12px] text-ink-400 mt-1">Calls, live streams and withdrawals are disabled. There is no login option while a suspension is active.</p>
        </div>
        <button className="btn-dark mt-4 max-w-sm"><Icon name="help" size={16} /> Appeal to support</button>
      </div>
    </CenterLayout>
  )
}

/* screenshot blocked */
export function ScreenshotBlocked() {
  const nav = useNavigate()
  const location = useLocation()
  const { context, contextId } = location.state || {}
  useEffect(() => {
    if (context && contextId) moderationApi.logCapture(context, contextId).catch(() => {})
  }, [context, contextId])
  return (
    <DarkState icon="camera-off" title="Screenshot blocked" desc="Recording and screenshots are disabled during calls and live streams to protect both sides.">
      <span className="mx-auto pill bg-white/10 text-white text-[12px]"><Icon name="shield" size={13} /> This attempt was logged</span>
      <button onClick={() => nav(-1)} className="btn bg-white/12 text-white">Got it</button>
    </DarkState>
  )
}
