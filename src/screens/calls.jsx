import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { StatusBar, PlainHeader, Avatar, Segmented, SectionTitle, ErrorCard } from '../ui/kit.jsx'
import { GiftRequestSheet } from './misc.jsx'
import { AppLayout, ImmersiveLayout } from '../ui/layouts.jsx'
import { calls as callsApi, earnings as earningsApi, chat as chatApi } from '../api/index.js'
import { rupees, clockTime, dayLabel } from '../lib/format.js'
import { joinAndPublish, leaveChannel, switchToNextCamera } from '../lib/agora.js'
import { getBeautySettings } from '../lib/beautyFilter.js'
import { useAuth } from '../state/AuthContext.jsx'
import { errorMessage } from '../lib/errors.js'
import { playRingtone } from '../lib/sound.js'
import { onSocketEvent } from '../lib/socket.js'

/* 15 — Calls list */
export function CallsList() {
  const nav = useNavigate()
  const [f, setF] = useState('All')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = () => {
    setLoading(true)
    setErr('')
    earningsApi.history('calls', 1, 50)
      .then((res) => setItems(res.items || []))
      .catch((e) => setErr(errorMessage(e, 'Could not load your calls.')))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const filtered = items.filter((c) => {
    if (f === 'All') return true
    if (f === 'Video') return c.callType === 'video'
    if (f === 'Voice') return c.callType === 'voice'
    if (f === 'Missed') return c.status === 'missed' || c.status === 'no_answer'
    return true
  })

  const groups = filtered.reduce((acc, c) => {
    const day = dayLabel(c.when)
    ;(acc[day] ||= []).push(c)
    return acc
  }, {})

  const totalEarned = items.reduce((sum, c) => sum + (c.amountPaise || 0), 0)

  return (
    <AppLayout tab="/calls" title="Calls" maxW="lg" bg="canvas">
      <PlainHeader title="Calls" sub="Recent calls" right={<button className="h-10 w-10 grid place-items-center rounded-xl border border-black/10 text-ink-700"><Icon name="search" size={18} /></button>} />
      <div className="px-5 lg:px-0 pt-3 lg:pt-0 pb-4">
        <Segmented options={['All', 'Video', 'Voice', 'Missed']} value={f} onChange={setF} />
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[['phone', String(items.length), 'Calls'], ['wallet', rupees(totalEarned), 'Earned']].map(([i, v, l]) => (
            <div key={l} className="card p-3.5"><Icon name={i} size={16} className="text-brand-600" /><p className="text-[18px] font-extrabold text-ink-900 mt-0.5">{v}</p><p className="text-[12px] text-ink-400">{l}</p></div>
          ))}
        </div>
        {loading && <p className="text-[13px] text-ink-400 mt-6 text-center">Loading…</p>}
        {!loading && err && <ErrorCard message={err} onRetry={load} className="mt-6" />}
        {!loading && !err && filtered.length === 0 && <p className="text-[13px] text-ink-400 mt-6 text-center">No calls yet.</p>}
        {!err && Object.entries(groups).map(([day, list]) => (
          <div key={day}>
            <SectionTitle className="mt-5 mb-1">{day}</SectionTitle>
            <div className="card px-4 lg:px-4 divide-y divide-black/5">
              {list.map((c) => (
                <button key={c.id} onClick={() => nav(`/call/summary?callId=${c.id}`)} className="w-full flex items-center gap-3 py-3 text-left">
                  <Avatar name="Caller" size={40} />
                  <div className="flex-1"><p className="text-[15px] font-semibold text-ink-900">{c.callType === 'voice' ? 'Voice call' : 'Video call'}</p><p className="text-[12px] text-ink-400 capitalize">{c.status}</p></div>
                  <div className="text-right">
                    {c.status === 'missed' || c.status === 'no_answer' ? <span className="pill bg-rose-50 text-rose-500 text-[11px]">Missed</span> : <p className="text-[14px] font-bold text-emerald-600">+ {rupees(c.amountPaise)}</p>}
                    <p className="text-[11px] text-ink-300 mt-0.5">{clockTime(c.when)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
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
      nav(`/call/connecting?callId=${callId}`, { state: { channelName: res.channelName, agoraToken: res.agoraToken, callerName: res.callerName || callerName } })
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
        <p className="text-[14px] text-white/70 mt-1">Incoming video call</p>
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
function CallChatDrawer({ recipientId, messages, onSend, onClose }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }) }, [messages])

  const send = async () => {
    const content = text.trim()
    if (!content || !recipientId || sending) return
    setSending(true)
    setErr('')
    setText('')
    try {
      const res = await chatApi.send(recipientId, content)
      onSend({ id: res.messageId, senderId: res.senderId, content: res.content, createdAt: res.createdAt })
    } catch (e) {
      setText(content)
      setErr(errorMessage(e, 'Could not send that message.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl bg-black/70 backdrop-blur-md max-h-[45%]">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-[13px] font-semibold text-white">Chat</span>
        <button onClick={onClose} className="h-7 w-7 grid place-items-center rounded-full bg-white/10 text-white"><Icon name="x" size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-1.5">
        {messages.length === 0 && <p className="text-[12px] text-white/50 pb-2">No messages yet — say hello!</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.senderId !== recipientId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[76%] rounded-2xl px-3 py-1.5 text-[13px] ${m.senderId !== recipientId ? 'bg-brand-600 text-white' : 'bg-white/15 text-white'}`}>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {err && <p className="px-4 pt-1 text-[11px] text-rose-300">{err}</p>}
      <div className="flex items-center gap-2 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Message…"
          className="flex-1 rounded-full bg-white/10 text-white placeholder-white/40 px-4 py-2 text-[13px] outline-none"
        />
        <button onClick={send} disabled={sending || !text.trim()} className="h-9 w-9 grid place-items-center rounded-full bg-brand-600 text-white disabled:opacity-50"><Icon name="send" size={16} /></button>
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
  const { channelName, agoraToken, callerName: navCallerName } = location.state || {}
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
    if (!callId) return
    callsApi.get(callId).then(setCall).catch((e) => setCallErr(errorMessage(e, 'Could not load call details.')))
  }, [callId])

  // In-call chat toggle (UX_SCREENS_AND_FLOWS.md's "Video call — ongoing" screen) — a live,
  // session-scoped log rather than loading the counterpart's full message history, since
  // that's not what this panel is for.
  useEffect(() => {
    const counterpartId = call?.userId
    if (!counterpartId) return
    return onSocketEvent('chat:message', (m) => {
      if (m.senderId !== counterpartId) return
      setChatMessages((prev) => [...prev, { id: m.messageId, senderId: m.senderId, content: m.content, createdAt: m.createdAt }])
    })
  }, [call?.userId])

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!channelName || !agoraToken) { setRtcErr('No call credentials — rejoin from Calls.'); return }
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
          beautySettings: getBeautySettings(),
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
  }, [channelName, agoraToken])

  useEffect(() => { sessionRef.current?.localAudioTrack?.setEnabled(!muted) }, [muted])
  useEffect(() => { sessionRef.current?.localVideoTrack?.setEnabled(cam) }, [cam])

  const flipCamera = async () => {
    if (!sessionRef.current?.localVideoTrack) return
    setFlipping(true)
    try {
      const switched = await switchToNextCamera(sessionRef.current.localVideoTrack, sessionRef.current.beautyCamera)
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
  const ratePaise = call?.ratePerMinutePaiseSnapshot ?? 0
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
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {mm}:{ss} · HD
              </p>
            </div>
            <span className="flex items-center gap-1.5 shrink-0 rounded-full bg-gold-400/15 border border-gold-400/25 px-2.5 py-1.5 text-[13px] font-bold text-gold-300">
              <Icon name="gift" size={13} /> {estBeans}
            </span>
          </div>
          {callErr && <p className="text-[12px] text-rose-300 px-1">{callErr}</p>}
        </div>
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
        <div className="w-full max-w-[480px] mx-auto pb-8 px-6 flex items-center justify-between">
          <button onClick={() => setMuted((m) => !m)} className={`h-12 w-12 grid place-items-center rounded-full ${muted ? 'bg-white text-ink-900' : 'bg-white/12'}`}><Icon name={muted ? 'mic-off' : 'mic'} size={20} /></button>
          <button onClick={() => setCam((c) => !c)} className={`h-12 w-12 grid place-items-center rounded-full ${cam ? 'bg-white/12' : 'bg-white text-ink-900'}`}><Icon name={cam ? 'video' : 'camera-off'} size={20} /></button>
          <button onClick={() => setChatOpen((o) => !o)} className={`h-12 w-12 grid place-items-center rounded-full ${chatOpen ? 'bg-white text-ink-900' : 'bg-white/12'}`}><Icon name="chat" size={20} /></button>
          <button onClick={() => setGiftOpen(true)} className="h-12 w-12 grid place-items-center rounded-full bg-white/12"><Icon name="gift" size={20} /></button>
          <button onClick={endCall} disabled={ending} className="h-14 w-14 grid place-items-center rounded-full bg-rose-500"><Icon name="phone-off" size={22} /></button>
        </div>
        {/* Overlay, not a route — navigating away used to unmount this screen entirely and
            tear down the live Agora session just to ask for a gift. */}
        {giftOpen && <GiftRequestSheet userId={call?.userId} onClose={() => setGiftOpen(false)} />}
        {chatOpen && (
          <CallChatDrawer
            recipientId={call?.userId}
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

  return (
    <AppLayout tab="/calls" title="Call ended" maxW="md" bg="white">
      <PlainHeader title="Call ended" />
      <div className="px-5 lg:px-0 pt-8 lg:pt-2 pb-4 flex flex-col items-center">
        <Avatar name={callerName} size={92} className="ring-4 ring-brand-500/30" />
        <h2 className="mt-3 text-[22px] font-extrabold text-ink-900">{callerName}</h2>
        <p className="text-[13px] text-ink-400">{call?.type === 'voice' ? 'Voice call' : 'Video call'}{durationSec ? ` · ${mins} min ${secs} sec` : ''}</p>
        <ErrorCard message={err} onRetry={load} compact className="w-full mt-3" />
        <div className="card w-full mt-5 p-4">
          <div className="flex items-center justify-between"><span className="text-[14px] text-ink-500">You earned</span><span className="text-[22px] font-extrabold text-gold-500">{rupees(call?.totalAmountPaise)}</span></div>
        </div>
        <div className="card w-full mt-3 p-4 text-center">
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
    </AppLayout>
  )
}
