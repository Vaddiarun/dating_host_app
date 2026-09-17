import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { StatusBar, PlainHeader, Avatar, Segmented, SectionTitle, ErrorCard } from '../ui/kit.jsx'
import { AppLayout, ImmersiveLayout } from '../ui/layouts.jsx'
import { calls as callsApi, earnings as earningsApi } from '../api/index.js'
import { rupees, clockTime, dayLabel } from '../lib/format.js'
import { joinAndPublish, leaveChannel, switchToNextCamera } from '../lib/agora.js'
import { useAuth } from '../state/AuthContext.jsx'
import { errorMessage } from '../lib/errors.js'

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

/* Shared shell for full-bleed call screens */
function CallStage({ children }) {
  return (
    <ImmersiveLayout>
      <div className="relative mx-auto flex min-h-[100dvh] max-w-[520px] flex-col overflow-hidden text-white bg-gradient-to-b from-night-700 via-night-800 to-night-900">
        <div className="pointer-events-none absolute -top-20 left-1/4 h-56 w-56 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-gold-400/10 blur-3xl" />
        <StatusBar dark />
        {children}
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
  const remoteVideoRef = useRef(null)
  const localVideoRef = useRef(null)
  const sessionRef = useRef(null)

  useEffect(() => {
    if (!callId) return
    callsApi.get(callId).then(setCall).catch((e) => setCallErr(errorMessage(e, 'Could not load call details.')))
  }, [callId])

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!channelName || !agoraToken) { setRtcErr('No call credentials — rejoin from Calls.'); return }
    let cancelled = false
    joinAndPublish({
      channelName,
      token: agoraToken,
      uid: me?.id,
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
    })
      .then((session) => {
        if (cancelled) { leaveChannel(session); return }
        sessionRef.current = session
        session.localVideoTrack?.play(localVideoRef.current, { fit: 'cover' })
      })
      .catch((e) => { console.error('Agora join failed:', e); setRtcErr(errorMessage(e, 'Could not start the camera/mic for this call.')) })
    return () => {
      cancelled = true
      if (sessionRef.current) leaveChannel(sessionRef.current)
    }
  }, [channelName, agoraToken])

  useEffect(() => { sessionRef.current?.localAudioTrack?.setEnabled(!muted) }, [muted])
  useEffect(() => { sessionRef.current?.localVideoTrack?.setEnabled(cam) }, [cam])

  const flipCamera = async () => {
    if (!sessionRef.current?.localVideoTrack) return
    setFlipping(true)
    try {
      const switched = await switchToNextCamera(sessionRef.current.localVideoTrack)
      if (switched === null) setRtcErr('Only one camera is available on this device.')
    } catch (e) {
      setRtcErr(errorMessage(e, 'Could not switch cameras.'))
    } finally {
      setFlipping(false)
    }
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  const callerName = call?.callerName || navCallerName || 'Caller'
  const ratePaise = call?.ratePerMinutePaiseSnapshot ?? 0
  const estBeans = Math.round((ratePaise * elapsed) / 60)

  const endCall = async () => {
    if (sessionRef.current) await leaveChannel(sessionRef.current)
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
      <div className="relative mx-auto flex min-h-[100dvh] max-w-[520px] flex-col overflow-hidden text-white bg-gradient-to-b from-night-700 to-night-900">
        <StatusBar dark />
        <div className="px-4 space-y-2">
          <div className="rounded-2xl bg-white/8 backdrop-blur px-3.5 py-2.5 flex items-center gap-3 border border-white/10">
            <Avatar name={callerName} size={38} />
            <div className="flex-1"><p className="text-[15px] font-semibold">{callerName}</p><p className="text-[12px] text-white/60">{mm}:{ss} · HD</p></div>
            <span className="text-[13px] font-bold text-gold-300">{estBeans} Beans</span>
          </div>
          {callErr && <p className="text-[12px] text-rose-300 px-1">{callErr}</p>}
        </div>
        {/* z-20: both this and the remote container below are positioned elements with no
            explicit stacking order, so without it the remote container — later in DOM order —
            paints over this PIP once its video fills the full area, hiding the local preview
            entirely (same class of bug as the CallStage blur-div click-through fix). */}
        <div className="absolute top-24 right-4 z-20 h-40 w-28 rounded-2xl overflow-hidden bg-gradient-to-br from-brand-400 to-night-800">
          <div ref={localVideoRef} className="absolute inset-0" />
          <button onClick={flipCamera} disabled={flipping} className="absolute bottom-1 right-1 h-7 w-7 grid place-items-center rounded-full bg-black/50 text-white disabled:opacity-50"><Icon name="flip" size={13} /></button>
        </div>
        <div className="flex-1 relative">
          <div ref={remoteVideoRef} className="absolute inset-0" />
          {!remoteJoined && (
            <div className="absolute inset-0 grid place-items-center">
              {rtcErr ? <p className="text-[13px] text-white/60 px-8 text-center">{rtcErr}</p> : <div className="h-56 w-56 rounded-full bg-white/5" />}
            </div>
          )}
        </div>
        <div className="pb-8 px-6 flex items-center justify-between">
          <button onClick={() => setMuted((m) => !m)} className={`h-12 w-12 grid place-items-center rounded-full ${muted ? 'bg-white text-ink-900' : 'bg-white/12'}`}><Icon name={muted ? 'mic-off' : 'mic'} size={20} /></button>
          <button onClick={() => setCam((c) => !c)} className={`h-12 w-12 grid place-items-center rounded-full ${cam ? 'bg-white/12' : 'bg-white text-ink-900'}`}><Icon name={cam ? 'video' : 'camera-off'} size={20} /></button>
          <button onClick={() => nav('/gift/ask/call', { state: { userId: call?.userId } })} className="h-12 w-12 grid place-items-center rounded-full bg-white/12"><Icon name="gift" size={20} /></button>
          <button onClick={endCall} disabled={ending} className="h-14 w-14 grid place-items-center rounded-full bg-rose-500"><Icon name="phone-off" size={22} /></button>
        </div>
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
