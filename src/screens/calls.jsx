import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { StatusBar, PlainHeader, Avatar, Segmented, SectionTitle, ErrorCard, Toggle } from '../ui/kit.jsx'
import { BeautyControls } from '../ui/BeautyControls.jsx'
import { EmojiPicker, insertAtCaret } from '../ui/EmojiPicker.jsx'
import { FloatingComments, recentComments } from '../ui/FloatingComments.jsx'
import { GiftRequestSheet } from './misc.jsx'
import { AppLayout, ImmersiveLayout } from '../ui/layouts.jsx'
import { calls as callsApi, chat as chatApi, profile as profileApi } from '../api/index.js'
import { rupees, clockTime, dayLabel } from '../lib/format.js'
import { joinAndPublish, leaveChannel, switchToNextCamera } from '../lib/agora.js'
import { getBeautySettings, setBeautySettings } from '../lib/beautyFilter.js'
import { useAuth } from '../state/AuthContext.jsx'
import { errorMessage } from '../lib/errors.js'
import { playRingtone } from '../lib/sound.js'
import { onSocketEvent } from '../lib/socket.js'
import { Skel, SkelGroup, SkelList, SkelResult } from '../ui/Skeleton.jsx'

/** 'voice' | 'video' | null (unknown) for a call-ish object or raw type string. The user app
 * creates calls with `type: 'voice' | 'video'` (POST /calls); history rows expose it as
 * `callType`, so both spellings are accepted, plus 'audio' as a synonym for voice. */
function callKind(src) {
  const t = typeof src === 'string' ? src : (src?.type ?? src?.callType)
  if (t === 'voice' || t === 'audio') return 'voice'
  if (t === 'video') return 'video'
  return null
}

/* 15 — Calls list */
const CALL_FILTERS = { All: 'all', Video: 'video', Voice: 'voice', Missed: 'missed' }
// Backend call statuses: ringing | ongoing | completed | missed | rejected. `failed` exists in
// the database but is never set — treated as missed just in case.
const LIVE_STATUSES = ['ringing', 'ongoing']
const MISSED_STATUSES = ['missed', 'failed']
// Call-length rating from the backend (durationQuality): under 4 min = bad, 4–10 min = good,
// over 10 min = excellent; null for missed / rejected / live calls (no badge then).
const QUALITY = {
  bad: { label: 'Bad', cls: 'bg-rose-50 text-rose-500' },
  good: { label: 'Good', cls: 'bg-emerald-50 text-emerald-600' },
  excellent: { label: 'Excellent', cls: 'bg-gold-50 text-gold-600', star: true },
}

function QualityPill({ q, size = 'sm' }) {
  const meta = QUALITY[q]
  if (!meta) return null
  const big = size === 'lg'
  return (
    <span title="Call length rating" className={`inline-flex items-center gap-1 rounded-full font-semibold shrink-0 ${meta.cls} ${big ? 'px-2.5 py-1 text-[12px]' : 'px-1.5 py-px text-[10.5px]'}`}>
      {meta.star && <Icon name="star" size={big ? 12 : 10} fill="currentColor" />}{meta.label}
    </span>
  )
}

// Extra context for a completed call, from endReason (normal hang-ups get no note).
const END_NOTES = { insufficient_balance: 'wallet ran out', reaped_stale_ongoing: 'connection lost' }

/** "12 min 5 sec" / "45 sec" — call length for the list row. */
function callLength(sec) {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m ? `${m} min${s ? ` ${s} sec` : ''}` : `${s} sec`
}

export function CallsList() {
  const nav = useNavigate()
  const [f, setF] = useState('All')
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [summary, setSummary] = useState(null) // { totalCalls, earnedPaise } — whole filter, not just loaded pages
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [err, setErr] = useState('')
  const [moreErr, setMoreErr] = useState('')
  const reqRef = useRef(0)
  const sentinelRef = useRef(null)

  // Page 1 replaces the list (new tab / retry); later pages append. The filter is applied by
  // the server, so "Missed" covers every call, not just the ones already loaded.
  const load = (pageNo = 1) => {
    const req = ++reqRef.current
    if (pageNo === 1) { setLoading(true); setErr('') } else { setLoadingMore(true); setMoreErr('') }
    callsApi.list(CALL_FILTERS[f], pageNo, 20)
      .then((res) => {
        if (req !== reqRef.current) return // a newer tab/page request superseded this one
        const list = res.calls || []
        setItems((prev) => (pageNo === 1 ? list : [...prev, ...list]))
        setPage(pageNo)
        setHasMore(!!res.hasMore)
        // summary covers every call matching the filter; fall back to `total` if it's absent
        if (res.summary) setSummary(res.summary)
        else if (pageNo === 1) setSummary({ totalCalls: res.total ?? null, earnedPaise: null })
      })
      .catch((e) => {
        if (req !== reqRef.current) return
        if (pageNo === 1) setErr(errorMessage(e, 'Could not load your calls.'))
        else setMoreErr(errorMessage(e, 'Could not load more calls.'))
      })
      .finally(() => {
        if (req !== reqRef.current) return
        setLoading(false)
        setLoadingMore(false)
      })
  }
  useEffect(() => { load(1) }, [f]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load the next page automatically when the end of the list scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loading || loadingMore || moreErr) return
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) load(page + 1) }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, loadingMore, moreErr, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = items.reduce((acc, c) => {
    const day = dayLabel(c.startedAt || c.createdAt)
    ;(acc[day] ||= []).push(c)
    return acc
  }, {})

  const totalCalls = summary?.totalCalls ?? items.length
  // Earned = host's share after commission (same as the dashboard), not what the user paid.
  const totalEarned = summary?.earnedPaise ?? items.reduce((sum, c) => sum + (c.earnedPaise || 0), 0)

  return (
    <AppLayout tab="/calls" title="Calls" maxW="xl" bg="canvas">
      <PlainHeader title="Calls" sub="Recent calls" right={<button className="h-10 w-10 grid place-items-center rounded-xl border border-black/10 text-ink-700"><Icon name="search" size={18} /></button>} />
      {/* Laptop: filters + list on the left, the summary cards in a sticky right rail. */}
      <div className="px-5 lg:px-0 pt-3 lg:pt-0 pb-4 lg:grid lg:grid-cols-[1fr_300px] lg:gap-x-6 lg:items-start">
        <div className="lg:col-start-1"><Segmented options={['All', 'Video', 'Voice', 'Missed']} value={f} onChange={setF} /></div>
        <div className="grid grid-cols-3 gap-3 mt-4 lg:mt-0 lg:grid-cols-1 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6">
          {[['phone', String(totalCalls), f === 'All' ? 'Calls' : `${f} calls`], ['wallet', rupees(totalEarned), 'Earned']].map(([i, v, l]) => (
            <div key={i} className="card p-3.5"><Icon name={i} size={16} className="text-brand-600" />{loading ? <Skel className="h-5 w-14 rounded-md my-1" /> : <p className="text-[18px] font-extrabold text-ink-900 mt-0.5">{v}</p>}<p className="text-[12px] text-ink-400">{l}</p></div>
          ))}
        </div>
        <div className="lg:col-start-1">
        {loading && <SkelGroup><SkelList rows={6} title /></SkelGroup>}
        {!loading && err && <ErrorCard message={err} onRetry={() => load(1)} className="mt-6" />}
        {!loading && !err && items.length === 0 && <p className="text-[13px] text-ink-400 mt-6 text-center">{f === 'Missed' ? 'No missed calls.' : 'No calls yet.'}</p>}
        {!loading && !err && Object.entries(groups).map(([day, list]) => (
          <div key={day}>
            <SectionTitle className="mt-5 mb-1">{day}</SectionTitle>
            <div className="card px-4 lg:px-4 divide-y divide-black/5">
              {list.map((c) => {
                const live = LIVE_STATUSES.includes(c.status)
                const missed = MISSED_STATUSES.includes(c.status)
                const cancelled = missed && c.endReason === 'cancelled_by_caller' // user hung up before the host answered
                const declined = c.status === 'rejected'
                const kind = c.type === 'voice' ? 'Voice call' : 'Video call'
                const note = c.status === 'completed' && END_NOTES[c.endReason]
                return (
                  // A live call has no summary yet — not tappable until it ends.
                  <button key={c.id} disabled={live} onClick={() => nav(`/call/summary?callId=${c.id}`)} className="w-full flex items-center gap-3 py-3 text-left disabled:cursor-default">
                    <Avatar name={c.callerName || 'Caller'} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="flex items-center gap-1.5 min-w-0"><span className="text-[15px] font-semibold text-ink-900 truncate">{c.callerName || 'Caller'}</span><QualityPill q={c.durationQuality} /></p>
                      <p className="text-[12px] text-ink-400 flex items-center gap-1 min-w-0">
                        <Icon name={c.type === 'voice' ? 'phone' : 'video'} size={11} className="shrink-0" /> <span className="truncate">{kind}{c.status === 'completed' && c.durationSeconds ? ` · ${callLength(c.durationSeconds)}` : ''}</span>
                      </p>
                      {note && <p className="text-[11px] font-medium text-gold-600 mt-0.5 first-letter:uppercase">{note}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {live ? <span className="pill bg-emerald-50 text-emerald-600 text-[11px]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live now</span>
                        : cancelled ? <span className="pill bg-black/5 text-ink-500 text-[11px]">Cancelled</span>
                        : missed ? <span className="pill bg-rose-50 text-rose-500 text-[11px]">Missed</span>
                        : declined ? <span className="pill bg-black/5 text-ink-500 text-[11px]">Declined</span>
                        : <p className="text-[14px] font-bold text-emerald-600">+ {rupees(c.earnedPaise)}</p>}
                      <p className="text-[11px] text-ink-300 mt-0.5">{clockTime(c.startedAt || c.createdAt)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {/* pagination: auto-loads near the end; the button is the fallback */}
        {!loading && !err && hasMore && (
          <div ref={sentinelRef} className="mt-4">
            {loadingMore ? <SkelGroup><SkelList rows={2} /></SkelGroup> : (
              <>
                {moreErr && <ErrorCard message={moreErr} compact className="mb-3" />}
                <button onClick={() => load(page + 1)} className="btn-outline text-[13px]">{moreErr ? 'Try again' : 'Load more'}</button>
              </>
            )}
          </div>
        )}
        </div>
      </div>
    </AppLayout>
  )
}

/* Shared shell for full-bleed call screens. The background/gradient always fills the
 * whole viewport (no more black bars either side on wide desktop windows) — only the
 * actual content column is capped and centered, so buttons don't stretch to the screen
 * edges on a big monitor. */
function CallStage({ children }) {
  return (
    <ImmersiveLayout>
      <div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden text-white bg-gradient-to-b from-night-700 via-night-800 to-night-900">
        <div className="pointer-events-none absolute -top-20 left-1/4 h-56 w-56 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-gold-400/10 blur-3xl" />
        <StatusBar dark />
        <div className="relative flex flex-1 flex-col w-full max-w-[480px] mx-auto">{children}</div>
      </div>
    </ImmersiveLayout>
  )
}

/* 16 — Incoming call */
export function IncomingCall() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const callId = sp.get('callId')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const rate = sp.get('rate')
  const callerName = sp.get('callerName') || 'Caller'
  const [kind, setKind] = useState(() => callKind(sp.get('type')))

  // The ring payload may not say voice vs video — the call record always does.
  useEffect(() => {
    if (kind || !callId) return
    callsApi.get(callId).then((c) => setKind(callKind(c))).catch(() => {})
  }, [callId, kind])

  // Rings until the host actually acts on it — accept/decline below stop it explicitly,
  // and leaving this screen any other way stops it via this same cleanup. Vibration is a
  // supplementary nudge alongside it (e.g. phone on silent) — harmless no-op on devices/
  // browsers without the API (most desktop browsers, iOS Safari).
  useEffect(() => {
    const stopRing = playRingtone()
    let vibeTimer = null
    if (navigator.vibrate) {
      const pattern = [400, 200, 400, 1000]
      navigator.vibrate(pattern)
      const total = pattern.reduce((a, b) => a + b, 0)
      vibeTimer = setInterval(() => navigator.vibrate(pattern), total)
    }
    return () => {
      stopRing()
      clearInterval(vibeTimer)
      navigator.vibrate?.(0)
    }
  }, [])

  const accept = async () => {
    if (!callId) { nav('/call/connecting'); return }
    setBusy(true)
    setErr('')
    try {
      const res = await callsApi.accept(callId)
      nav(`/call/connecting?callId=${callId}`, { state: { channelName: res.channelName, agoraToken: res.agoraToken, callerName: res.callerName || callerName, callerId: res.userId || res.callerId || sp.get('callerId') || undefined, callType: callKind(res) || kind } })
    } catch (e) {
      setErr(errorMessage(e, 'Could not accept this call.'))
    } finally {
      setBusy(false)
    }
  }

  // Previously just navigated away with no server call at all, so the backend (and the
  // caller, who's waiting on `call:ended`) never learned the call was declined — the
  // caller's ringing screen would just sit there until the ringing timeout expired.
  const decline = async () => {
    if (callId) {
      try { await callsApi.reject(callId) } catch {
        // best-effort — leaving the incoming-call screen either way; a failed reject here
        // (e.g. the call already timed out server-side) shouldn't trap the host on this screen
      }
    }
    nav('/calls')
  }

  return (
    <CallStage>
      <div className="flex-1 flex flex-col items-center pt-16 px-6">
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-brand-400/40 animate-pulse-ring" />
          <Avatar name={callerName} size={150} className="ring-4 ring-white/20" />
        </div>
        <div className="mt-6 flex items-center gap-2"><h2 className="text-[28px] font-extrabold">{callerName}</h2></div>
        <p className="text-[14px] text-white/70 mt-1 flex items-center gap-1.5">
          <Icon name={kind === 'voice' ? 'phone' : 'video'} size={14} />
          {kind === 'voice' ? 'Incoming voice call' : kind === 'video' ? 'Incoming video call' : 'Incoming call'}
        </p>
        {rate && <span className="pill bg-white/10 text-white text-[13px] mt-4">Earn {rupees(Number(rate))} / min</span>}
        {err && <p className="text-[13px] text-rose-300 mt-4 px-6 text-center">{err}</p>}
      </div>
      <div className="pb-14 px-10 flex items-end justify-between">
        <button onClick={decline} disabled={busy} className="flex flex-col items-center gap-2">
          <span className="h-16 w-16 grid place-items-center rounded-full bg-rose-500"><Icon name="phone-off" size={24} /></span>
          <span className="text-[12px] text-white/70">Decline</span>
        </button>
        <button onClick={accept} disabled={busy} className="flex flex-col items-center gap-2">
          <span className="h-20 w-20 grid place-items-center rounded-full bg-emerald-500 shadow-[0_0_0_10px_rgba(16,185,129,.2)]"><Icon name="phone" size={28} /></span>
          <span className="text-[12px] text-white/70">Accept</span>
        </button>
      </div>
    </CallStage>
  )
}

/* 17 — Connecting */
export function Connecting() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const location = useLocation()
  const callId = sp.get('callId')
  const callerName = location.state?.callerName || 'Caller'
  useEffect(() => {
    const t = setTimeout(() => nav(callId ? `/call/active?callId=${callId}` : '/call/active', { state: location.state }), 1800)
    return () => clearTimeout(t)
  }, [nav, callId, location.state])
  return (
    <CallStage>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <Avatar name={callerName} size={150} className="ring-4 ring-white/15" />
        <h2 className="mt-7 text-[24px] font-extrabold">Connecting…</h2>
        <p className="text-[14px] text-white/60 mt-1">Securing an encrypted line</p>
        <span className="pill bg-white/10 text-white text-[12px] mt-4"><Icon name="lock" size={13} /> End-to-end encrypted</span>
      </div>
      <div className="pb-16 flex justify-center">
        <button onClick={() => nav('/calls')} className="h-16 w-16 grid place-items-center rounded-full bg-rose-500"><Icon name="phone-off" size={24} /></button>
      </div>
    </CallStage>
  )
}

/* In-call chat drawer — a compact version of the Thread component in chat.jsx (same
 * send/receive API), not the full conversation-history view: this is the live session log
 * the "in-call chat toggle" screen calls for, not a place to browse past messages. */
function CallChatDrawer({ recipientId, recipientName, messages, onSend, onClose }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }) }, [messages])

  const send = async () => {
    const content = text.trim()
    if (!content || sending) return
    if (!recipientId) { setErr('Still connecting to the caller — try again in a moment.'); return }
    setSending(true)
    setErr('')
    setText('')
    try {
      const res = await chatApi.send(recipientId, content)
      onSend({ id: res.messageId, senderId: res.senderId, content: res.content, createdAt: res.createdAt, at: Date.now() })
    } catch (e) {
      setText(content)
      setErr(errorMessage(e, 'Could not send that message.'))
    } finally {
      setSending(false)
    }
  }

  const comments = messages.map((m) => ({ id: m.id, name: m.senderId === recipientId ? recipientName : 'You', text: m.content, at: m.at }))

  // No panel — the conversation floats over the video like Instagram live comments, with just a
  // soft bottom gradient so white text stays readable on a bright background.
  return (
    <div className={`absolute inset-x-0 bottom-0 z-30 flex flex-col pt-16 bg-gradient-to-t from-black/75 via-black/35 to-transparent animate-fade-in ${emojiOpen ? 'max-h-[70%]' : 'max-h-[50%]'}`}>
      {messages.length === 0
        ? <p className="px-4 pb-2 text-[12px] text-white/70" style={{ textShadow: '0 1px 3px rgba(0,0,0,.75)' }}>No messages yet — say hello!</p>
        : <FloatingComments comments={comments} fadeOut={false} scrollable endRef={bottomRef} className="flex-1 px-4" />}
      {err && <p className="px-4 pt-1 text-[11px] text-rose-300">{err}</p>}
      <div className="flex items-center gap-2 p-3">
        <button onClick={() => setEmojiOpen((o) => !o)} className={`h-9 w-9 shrink-0 grid place-items-center rounded-full ${emojiOpen ? 'bg-white text-ink-900' : 'bg-white/15 text-white'}`}><Icon name="smile" size={18} /></button>
        <input
          ref={inputRef}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setEmojiOpen(false)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Message…"
          className="flex-1 rounded-full bg-white/15 border border-white/20 text-white placeholder-white/60 px-4 py-2 text-[13px] outline-none backdrop-blur-sm"
        />
        <button onClick={send} disabled={sending || !text.trim()} className="h-9 w-9 shrink-0 grid place-items-center rounded-full bg-brand-600 text-white disabled:opacity-50"><Icon name="send" size={16} /></button>
        <button onClick={onClose} className="h-9 w-9 shrink-0 grid place-items-center rounded-full bg-white/15 text-white"><Icon name="x" size={16} /></button>
      </div>
      {emojiOpen && <EmojiPicker dark onPick={(e) => setText((t) => insertAtCaret(inputRef.current, t, e))} />}
    </div>
  )
}

/* In-call beauty editor — the same controls as Settings → Beauty filter, applied live to the
 * video the caller is seeing. Edits last for this call only unless saved as the default, so a
 * quick tweak for bad lighting doesn't silently overwrite the host's usual look. */
function CallBeautySheet({ settings, onChange, onClose }) {
  const [status, setStatus] = useState('') // '' | 'saving' | 'synced' | 'local'
  const [saveErr, setSaveErr] = useState('')

  const saveDefault = async () => {
    setStatus('saving')
    setSaveErr('')
    // Local cache first, same as the Settings screen — every camera pipeline reads it
    // synchronously, so it counts as saved even if the account sync below fails.
    setBeautySettings(settings)
    try {
      await profileApi.updateBeautySettings(settings)
      setStatus('synced')
    } catch (e) {
      setSaveErr(errorMessage(e, 'Saved on this device, but could not sync to your account.'))
      setStatus('local')
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl bg-black/75 backdrop-blur-md max-h-[50%]">
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
        <span className="text-[13px] font-semibold text-white flex-1">Beauty</span>
        <Toggle on={settings.enabled} onChange={(v) => onChange({ enabled: v })} />
        <button onClick={onClose} className="h-7 w-7 grid place-items-center rounded-full bg-white/10 text-white"><Icon name="x" size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-2">
        <BeautyControls settings={settings} onChange={onChange} dark compact />
      </div>
      <div className="flex items-center gap-3 px-4 pb-4 pt-2">
        <p className={`flex-1 text-[11px] ${status === 'local' ? 'text-gold-300' : 'text-white/50'}`}>
          {status === 'synced' ? 'Saved as your default look.' : status === 'local' ? saveErr : 'Changes apply to this call only.'}
        </p>
        <button onClick={saveDefault} disabled={status === 'saving'} className="shrink-0 rounded-full bg-white/12 px-3.5 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
          {status === 'saving' ? 'Saving…' : 'Save as default'}
        </button>
      </div>
    </div>
  )
}

/* 18 — On call */
export function ActiveCall() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const location = useLocation()
  const { me } = useAuth()
  const callId = sp.get('callId')
  const { channelName, agoraToken, callerName: navCallerName, callerId: navCallerId, callType: navCallType } = location.state || {}
  // null until known — the join below waits for it, since a voice call must never open the camera.
  const [kind, setKind] = useState(() => callKind(navCallType))
  const isVoice = kind === 'voice'
  const [muted, setMuted] = useState(false)
  const [cam, setCam] = useState(true)
  const [call, setCall] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [ending, setEnding] = useState(false)
  const [rtcErr, setRtcErr] = useState('')
  const [callErr, setCallErr] = useState('')
  const [remoteJoined, setRemoteJoined] = useState(false)
  const [flipping, setFlipping] = useState(false)
  const [giftOpen, setGiftOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [beautyOpen, setBeautyOpen] = useState(false)
  const [beauty, setBeauty] = useState(getBeautySettings)
  const [mainView, setMainView] = useState('remote') // 'remote' | 'local' — tap the small tile to swap
  // Freeform drag position for whichever tile is currently the small PIP — like WhatsApp's
  // draggable self-view bubble, not just a fixed corner. null = default top-right corner.
  const [pipPos, setPipPos] = useState(null)
  const stageRef = useRef(null)
  const dragRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, origX: 0, origY: 0 })
  const remoteVideoRef = useRef(null)
  const localVideoRef = useRef(null)
  const sessionRef = useRef(null)
  const joinRef = useRef(null) // { key, promise } — see the join effect below
  const leaveTimerRef = useRef(null)

  useEffect(() => {
    if (!callId) { setKind((k) => k || 'video'); return }
    callsApi.get(callId)
      .then((c) => { setCall(c); setKind((k) => k || callKind(c) || 'video') })
      .catch((e) => {
        setCallErr(errorMessage(e, 'Could not load call details.'))
        setKind((k) => k || 'video') // unknown — fall back to the old always-video behavior rather than never joining
      })
  }, [callId])


  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!channelName || !agoraToken) { setRtcErr('No call credentials — rejoin from Calls.'); return }
    if (!kind) return // still finding out voice vs video
    const key = `${channelName}|${agoraToken}`
    clearTimeout(leaveTimerRef.current)
    let cancelled = false

    // React 18 Strict Mode (dev only) mounts, synchronously unmounts, then remounts this same
    // component — before the first `client.join()` round-trip to Agora has any chance to
    // resolve. Checking only the *resolved* session is too late, since by the time the remount
    // runs nothing has resolved yet, so it would start a second real join with the same uid —
    // Agora's server sees two simultaneous joins and throws UID_CONFLICT. Caching the *promise*
    // itself (refs survive the synthetic remount) closes that gap: the remount attaches its own
    // .then() to the SAME in-flight join instead of starting another one.
    if (!(joinRef.current && joinRef.current.key === key)) {
      joinRef.current = {
        key,
        promise: joinAndPublish({
          channelName,
          token: agoraToken,
          uid: me?.id,
          video: kind === 'video', // voice calls publish the mic only — no camera at all
          beautySettings: beauty,
          alwaysBeautyPipeline: true, // so the in-call Beauty sheet can switch it on mid-call
          onRemoteUser: (user, mediaType, left) => {
            // Agora fires this once per media type (audio and video publish/
            // subscribe independently) — this used to bail out entirely for
            // anything but 'video', so the caller's subscribed audio track was
            // never actually started. Subscribing alone doesn't play it; the
            // SDK requires an explicit .play() call, same as video.
            if (left) {
              if (mediaType === 'video') setRemoteJoined(false)
              return
            }
            if (mediaType === 'video') {
              // Explicit `fit: 'cover'` — left unset, the SDK letterboxes the remote feed
              // (black bars either side) whenever its captured aspect ratio doesn't match
              // this container's; cover crops to fill instead, like every other call UI.
              user.videoTrack?.play(remoteVideoRef.current, { fit: 'cover' })
              setRemoteJoined(true)
            } else if (mediaType === 'audio') {
              user.audioTrack?.play()
            }
          },
        }),
      }
    }

    joinRef.current.promise
      .then((session) => {
        if (cancelled) return // a still-mounted invocation (if any) owns this session now
        sessionRef.current = session
        session.localVideoTrack?.play(localVideoRef.current, { fit: 'cover' })
      })
      .catch((e) => {
        if (cancelled) return
        console.error('Agora join failed:', e)
        setRtcErr(errorMessage(e, 'Could not start the camera/mic for this call.'))
      })

    return () => {
      cancelled = true
      leaveTimerRef.current = setTimeout(() => {
        // Nothing re-claimed this join within the grace window — this is a real unmount.
        if (joinRef.current?.key !== key) return
        joinRef.current.promise.then((session) => leaveChannel(session)).catch(() => {})
        joinRef.current = null
        sessionRef.current = null
      }, 400)
    }
  }, [channelName, agoraToken, kind])

  useEffect(() => { sessionRef.current?.localAudioTrack?.setEnabled(!muted) }, [muted])
  useEffect(() => { sessionRef.current?.localVideoTrack?.setEnabled(cam) }, [cam])

  const updateBeauty = (patch) => {
    setBeauty((b) => ({ ...b, ...patch }))
    sessionRef.current?.beautyCamera?.updateSettings(patch)
  }

  // The beauty sheet and chat drawer share the bottom of the screen — only one at a time.
  // Opening beauty also makes the self-view full-screen so the effect is actually visible
  // while adjusting, then puts the layout back the way it was.
  const beautyPrevViewRef = useRef('remote')
  const openBeauty = () => {
    setChatOpen(false)
    beautyPrevViewRef.current = mainView
    setMainView('local')
    setBeautyOpen(true)
  }
  const closeBeauty = () => {
    setBeautyOpen(false)
    setMainView(beautyPrevViewRef.current)
  }

  const flipCamera = async () => {
    if (!sessionRef.current?.localVideoTrack) return
    setFlipping(true)
    try {
      const switched = await switchToNextCamera(sessionRef.current.localVideoTrack, sessionRef.current.beautyCamera, localVideoRef.current)
      if (switched === null) setRtcErr('Only one camera is available on this device.')
    } catch (e) {
      setRtcErr(errorMessage(e, 'Could not switch cameras.'))
    } finally {
      setFlipping(false)
    }
  }

  // WhatsApp-style drag: the small PIP tile follows the pointer while held, and only swaps
  // main/PIP (the old tap behavior) if the pointer never actually moved — so a genuine drag
  // doesn't also trigger a swap, and a plain tap still works exactly as before.
  const PIP_W = 112
  const PIP_H = 160
  const PIP_MARGIN = 12

  const clampPip = (x, y) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return { x, y }
    return {
      x: Math.min(Math.max(x, PIP_MARGIN), Math.max(PIP_MARGIN, rect.width - PIP_W - PIP_MARGIN)),
      // keep clear of the header card up top and the control row at the bottom
      y: Math.min(Math.max(y, 88), Math.max(88, rect.height - PIP_H - 110)),
    }
  }

  const onPipPointerDown = (e) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const origX = pipPos ? pipPos.x : rect.width - PIP_W - 16
    const origY = pipPos ? pipPos.y : 96
    dragRef.current = { dragging: true, moved: false, startX: e.clientX, startY: e.clientY, origX, origY }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPipPointerMove = (e) => {
    const d = dragRef.current
    if (!d.dragging) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true
    if (d.moved) setPipPos(clampPip(d.origX + dx, d.origY + dy))
  }
  const onPipPointerUp = () => {
    const d = dragRef.current
    if (!d.dragging) return
    d.dragging = false
    if (!d.moved) setMainView((v) => (v === 'remote' ? 'local' : 'remote'))
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  const callerName = call?.callerName || navCallerName || 'Caller'
  // Who's on the other end — needed to send chat/gift requests. The call record may name it
  // differently (or fail to load), so the id from the ring itself is the fallback; without one,
  // sending a message used to silently do nothing.
  const counterpartId = call?.userId || call?.callerId || navCallerId || null
  const ratePaise = call?.ratePerMinutePaiseSnapshot ?? 0

  // In-call chat toggle (UX_SCREENS_AND_FLOWS.md's "Video call — ongoing" screen) — a live,
  // session-scoped log rather than loading the counterpart's full message history, since
  // that's not what this panel is for.
  useEffect(() => {
    if (!counterpartId) return
    return onSocketEvent('chat:message', (m) => {
      if (m.senderId !== counterpartId) return
      setChatMessages((prev) => [...prev, { id: m.messageId, senderId: m.senderId, content: m.content, createdAt: m.createdAt, at: Date.now() }])
    })
  }, [counterpartId])

  const estBeans = Math.round((ratePaise * elapsed) / 60)

  const endCall = async () => {
    if (sessionRef.current) {
      await leaveChannel(sessionRef.current)
      sessionRef.current = null
      joinRef.current = null
    }
    if (!callId) { nav('/call/summary'); return }
    setEnding(true)
    try {
      await callsApi.end(callId)
    } catch {
      // still navigate to summary — the call may already have ended server-side
    } finally {
      nav(`/call/summary?callId=${callId}`)
    }
  }

  return (
    <ImmersiveLayout>
      <div ref={stageRef} className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden text-white bg-gradient-to-b from-night-700 to-night-900">
        <StatusBar dark />
        <div className="w-full max-w-[480px] mx-auto px-4 pt-2 space-y-2">
          {/* bg-black/45 (not the near-invisible white/8 this used to be) so the card actually
              reads as a distinct floating element against an equally-dark video background,
              instead of blending into it as a flat full-width strip. */}
          <div className="rounded-2xl bg-black/45 backdrop-blur-md shadow-lg shadow-black/30 px-3.5 py-2.5 flex items-center gap-3 border border-white/10">
            <Avatar name={callerName} size={38} className="ring-2 ring-white/15" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold truncate">{callerName}</p>
              <p className="text-[11.5px] text-white/55 flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {mm}:{ss} · {isVoice ? 'Voice call' : 'HD'}
              </p>
            </div>
            <span className="flex items-center gap-1.5 shrink-0 rounded-full bg-gold-400/15 border border-gold-400/25 px-2.5 py-1.5 text-[13px] font-bold text-gold-300">
              <Icon name="gift" size={13} /> {estBeans}
            </span>
          </div>
          {callErr && <p className="text-[12px] text-rose-300 px-1">{callErr}</p>}
        </div>
        {isVoice ? (
          <>
            {/* Voice call — nothing to show but who you're talking to. */}
            <div className="flex-1 flex flex-col items-center justify-center px-6">
              <div className="relative">
                <span className="absolute inset-0 rounded-full bg-brand-400/30 animate-pulse-ring" />
                <Avatar name={callerName} size={140} className="ring-4 ring-white/15" />
              </div>
              <p className="mt-6 text-[22px] font-extrabold">{callerName}</p>
              <p className="mt-1 text-[14px] text-white/60 flex items-center gap-1.5"><Icon name="phone" size={14} /> Voice call · {mm}:{ss}</p>
              {rtcErr && <p className="mt-4 text-[13px] text-rose-300 text-center">{rtcErr}</p>}
            </div>
          </>
        ) : (
          <>
            {/* The small PIP tile is freely draggable anywhere on screen — like WhatsApp's
                self-view bubble — and a plain tap (no movement) still swaps which video is
                full-screen, same as before. Whichever is small stays `absolute` with an explicit
                z-20; the big one is a plain in-flow `flex-1 relative` — that z-gap is what keeps
                the small tile painting on top regardless of which video it currently holds (see
                the stacking-order note this was originally added for). */}
            <button
              onPointerDown={mainView === 'remote' ? onPipPointerDown : undefined}
              onPointerMove={mainView === 'remote' ? onPipPointerMove : undefined}
              onPointerUp={mainView === 'remote' ? onPipPointerUp : undefined}
              onPointerCancel={mainView === 'remote' ? onPipPointerUp : undefined}
              style={mainView === 'local' ? undefined : { top: pipPos ? pipPos.y : 96, left: pipPos ? pipPos.x : undefined, right: pipPos ? undefined : 16, touchAction: 'none' }}
              className={mainView === 'local'
                ? 'flex-1 relative w-full text-left'
                : 'absolute z-20 h-40 w-28 rounded-2xl overflow-hidden bg-gradient-to-br from-brand-400 to-night-800 cursor-grab active:cursor-grabbing'}
            >
              <div ref={localVideoRef} className="absolute inset-0 agora-video-fill" />
              <span
                onClick={(e) => { e.stopPropagation(); flipCamera() }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                className={`absolute grid place-items-center rounded-full bg-black/50 text-white ${mainView === 'local' ? 'bottom-4 right-4 h-10 w-10' : 'bottom-1 right-1 h-7 w-7'} ${flipping ? 'opacity-50' : ''}`}
              >
                <Icon name="flip" size={mainView === 'local' ? 16 : 13} />
              </span>
            </button>
            <button
              onPointerDown={mainView === 'local' ? onPipPointerDown : undefined}
              onPointerMove={mainView === 'local' ? onPipPointerMove : undefined}
              onPointerUp={mainView === 'local' ? onPipPointerUp : undefined}
              onPointerCancel={mainView === 'local' ? onPipPointerUp : undefined}
              style={mainView === 'remote' ? undefined : { top: pipPos ? pipPos.y : 96, left: pipPos ? pipPos.x : undefined, right: pipPos ? undefined : 16, touchAction: 'none' }}
              className={mainView === 'remote'
                ? 'flex-1 relative w-full text-left'
                : 'absolute z-20 h-40 w-28 rounded-2xl overflow-hidden bg-black text-left cursor-grab active:cursor-grabbing'}
            >
              <div ref={remoteVideoRef} className="absolute inset-0 agora-video-fill" />
              {!remoteJoined && (
                <div className="absolute inset-0 grid place-items-center">
                  {rtcErr ? <p className="text-[13px] text-white/60 px-8 text-center">{rtcErr}</p> : <div className="h-56 w-56 rounded-full bg-white/5" />}
                </div>
              )}
            </button>
          </>
        )}
        <div className="w-full max-w-[480px] mx-auto pb-8 px-6 flex items-center justify-between">
          <button onClick={() => setMuted((m) => !m)} className={`h-12 w-12 grid place-items-center rounded-full ${muted ? 'bg-white text-ink-900' : 'bg-white/12'}`}><Icon name={muted ? 'mic-off' : 'mic'} size={20} /></button>
          {!isVoice && (
            <>
              <button onClick={() => setCam((c) => !c)} className={`h-12 w-12 grid place-items-center rounded-full ${cam ? 'bg-white/12' : 'bg-white text-ink-900'}`}><Icon name={cam ? 'video' : 'camera-off'} size={20} /></button>
              <button onClick={() => (beautyOpen ? closeBeauty() : openBeauty())} className={`h-12 w-12 grid place-items-center rounded-full ${beautyOpen ? 'bg-white text-ink-900' : 'bg-white/12'}`}><Icon name="sparkles" size={20} /></button>
            </>
          )}
          <button onClick={() => { if (beautyOpen) closeBeauty(); setChatOpen((o) => !o) }} className={`h-12 w-12 grid place-items-center rounded-full ${chatOpen ? 'bg-white text-ink-900' : 'bg-white/12'}`}><Icon name="chat" size={20} /></button>
          <button onClick={() => setGiftOpen(true)} className="h-12 w-12 grid place-items-center rounded-full bg-white/12"><Icon name="gift" size={20} /></button>
          <button onClick={endCall} disabled={ending} className="h-14 w-14 grid place-items-center rounded-full bg-rose-500"><Icon name="phone-off" size={22} /></button>
        </div>
        {/* Overlay, not a route — navigating away used to unmount this screen entirely and
            tear down the live Agora session just to ask for a gift. */}
        {giftOpen && <GiftRequestSheet userId={counterpartId} onClose={() => setGiftOpen(false)} />}
        {/* With the chat closed, new messages from the caller still float up over the video for
            a few seconds (Instagram-live style) instead of arriving unseen. Re-rendered every
            second by the call timer, which is what advances their fade-out. */}
        {!chatOpen && !beautyOpen && (
          <FloatingComments
            comments={recentComments(chatMessages.filter((m) => m.senderId === counterpartId).map((m) => ({ id: m.id, name: callerName, text: m.content, at: m.at })), 4)}
            className="absolute left-4 right-4 bottom-28 z-20 max-h-[35%] pointer-events-none"
          />
        )}
        {beautyOpen && <CallBeautySheet settings={beauty} onChange={updateBeauty} onClose={closeBeauty} />}
        {chatOpen && (
          <CallChatDrawer
            recipientId={counterpartId}
            recipientName={callerName}
            messages={chatMessages}
            onSend={(m) => setChatMessages((prev) => [...prev, m])}
            onClose={() => setChatOpen(false)}
          />
        )}
      </div>
    </ImmersiveLayout>
  )
}

/* 19 — Call summary */
export function CallSummary() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const callId = sp.get('callId')
  const [call, setCall] = useState(null)
  const [rate, setRate] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [err, setErr] = useState('')
  const [rateErr, setRateErr] = useState('')

  const load = () => {
    if (!callId) return
    setErr('')
    callsApi.get(callId).then(setCall).catch((e) => setErr(errorMessage(e, 'Could not load this call.')))
  }
  useEffect(load, [callId]) // eslint-disable-line react-hooks/exhaustive-deps

  const rateCall = async (n) => {
    setRate(n)
    setRateErr('')
    if (!callId || submitted) return
    setSubmitted(true)
    try { await callsApi.rate(callId, n) } catch (e) { setSubmitted(false); setRateErr(errorMessage(e, 'Could not submit your rating.')) }
  }

  const durationSec = call?.startedAt && call?.endedAt ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000) : 0
  const mins = Math.floor(durationSec / 60)
  const secs = durationSec % 60
  const callerName = call?.callerName || 'Caller'

  // Still fetching the call — skeleton instead of a placeholder "Caller · ₹0".
  if (callId && !call && !err) {
    return (
      <AppLayout tab="/calls" title="Call ended" maxW="lg" bg="white">
        <PlainHeader title="Call ended" />
        <SkelGroup className="pt-8 lg:pt-2 pb-4"><SkelResult /></SkelGroup>
      </AppLayout>
    )
  }

  return (
    <AppLayout tab="/calls" title="Call ended" maxW="lg" bg="white">
      <PlainHeader title="Call ended" />
      {/* Laptop: caller + earnings on the left, rating + actions on the right. */}
      <div className="px-5 lg:px-0 pt-8 lg:pt-2 pb-4 flex flex-col items-center lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
        <div className="w-full flex flex-col items-center lg:card lg:p-6">
        <Avatar name={callerName} size={92} className="ring-4 ring-brand-500/30" />
        <h2 className="mt-3 text-[22px] font-extrabold text-ink-900">{callerName}</h2>
        <p className="text-[13px] text-ink-400">{callKind(call) === 'voice' ? 'Voice call' : 'Video call'}{durationSec ? ` · ${mins} min ${secs} sec` : ''}</p>
        {QUALITY[call?.durationQuality] && <div className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-400">Call length <QualityPill q={call.durationQuality} size="lg" /></div>}
        <ErrorCard message={err} onRetry={load} compact className="w-full mt-3" />
        <div className="card w-full mt-5 p-4 lg:bg-gold-50/60 lg:shadow-none">
          <div className="flex items-center justify-between"><span className="text-[14px] text-ink-500">You earned</span><span className="text-[22px] font-extrabold text-gold-500">{rupees(call?.totalAmountPaise)}</span></div>
        </div>
        </div>
        <div className="w-full">
        <div className="card w-full mt-3 lg:mt-0 p-4 text-center">
          <p className="text-[14px] font-semibold text-ink-900">Rate this call</p>
          <div className="mt-2 flex justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => rateCall(n)}><Icon name="star" size={30} fill={n <= rate ? '#e0a92e' : 'none'} className={n <= rate ? 'text-gold-400' : 'text-ink-300'} /></button>
            ))}
          </div>
          {rateErr && <p className="text-[12px] text-rose-500 mt-2">{rateErr}</p>}
        </div>
        <div className="w-full mt-4 space-y-3">
          <button onClick={() => nav('/home')} className="btn-primary">Back to home</button>
          <button onClick={() => nav('/report', { state: { targetId: call?.userId, targetName: callerName } })} className="btn-danger-outline"><Icon name="flag" size={16} /> Report this user</button>
        </div>
        </div>
      </div>
    </AppLayout>
  )
}
