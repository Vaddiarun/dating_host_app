import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { StatusBar, PlainHeader, Avatar, Toggle } from '../ui/kit.jsx'
import { AppLayout, ImmersiveLayout } from '../ui/layouts.jsx'
import { live as liveApi } from '../api/index.js'
import { joinAndPublish, leaveChannel, switchToNextCamera } from '../lib/agora.js'
import { getBeautySettings, openBeautyCamera } from '../lib/beautyFilter.js'
import { useAuth } from '../state/AuthContext.jsx'
import { ErrorCard } from '../ui/kit.jsx'
import { errorMessage } from '../lib/errors.js'
import { onSocketEventWhenReady } from '../lib/socket.js'

/* 22 — Go live setup */
export function GoLive() {
  const nav = useNavigate()
  const [title, setTitle] = useState('Late night chill chat 💜')
  const [mic, setMic] = useState(true)
  const [gifts, setGifts] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const beautyCamRef = useRef(null) // set only when the beauty pipeline is actually in use
  const [camReady, setCamReady] = useState(false)
  const [camErr, setCamErr] = useState('')
  const [facingMode, setFacingMode] = useState('user')
  const [flipping, setFlipping] = useState(false)
  const beauty = getBeautySettings()
  const useBeautyCam = beauty.enabled

  // This used to be a raw getUserMedia preview with a flat CSS blur standing in for the real
  // filter — a whole-frame blur (background, everything) rather than the actual face-only
  // processing, which looked like a bug (blurry background) even though it was "by design."
  // Running the real pipeline here instead means this setup screen shows exactly what the
  // broadcast will actually look like, camera-flip included, not an approximation of it.
  const openCamera = async (mode) => {
    if (useBeautyCam) {
      const cam = await openBeautyCamera({ facingMode: mode, settings: beauty, audio: true })
      beautyCamRef.current = cam
      cam.audioTrack && (cam.audioTrack.enabled = mic)
      if (videoRef.current) {
        videoRef.current.srcObject = cam.stream
        videoRef.current.play().catch(() => {})
      }
      setCamReady(true)
      setCamErr('')
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: true })
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = stream
    stream.getAudioTracks().forEach((t) => { t.enabled = mic })
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
    setCamReady(true)
    setCamErr('')
  }

  const stopCamera = () => {
    beautyCamRef.current?.stop()
    beautyCamRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    let cancelled = false
    openCamera('user').catch((e) => !cancelled && setCamErr(errorMessage(e, 'Camera unavailable — check permissions.')))
    return () => {
      cancelled = true
      stopCamera()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (beautyCamRef.current) { beautyCamRef.current.audioTrack && (beautyCamRef.current.audioTrack.enabled = mic); return }
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = mic })
  }, [mic])

  const flipCamera = async () => {
    setFlipping(true)
    const next = facingMode === 'user' ? 'environment' : 'user'
    try {
      if (beautyCamRef.current) {
        await beautyCamRef.current.switchCamera() // same track object, canvas keeps streaming — no re-attach needed
      } else {
        await openCamera(next)
      }
      setFacingMode(next)
    } catch (e) {
      setCamErr(errorMessage(e, 'Could not switch cameras.'))
    } finally {
      setFlipping(false)
    }
  }

  const start = async () => {
    setBusy(true)
    setErr('')
    try {
      const res = await liveApi.start(title.trim() || 'Live stream')
      stopCamera() // release the preview camera; Broadcast opens its own (Agora-published) one
      nav(`/live/broadcast?broadcastId=${res.broadcastId}`, { state: { channelName: res.channelName, agoraToken: res.agoraToken, micOn: mic, giftsOn: gifts } })
    } catch (e) {
      setErr(errorMessage(e, 'Could not start the broadcast.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout tab="/live" title="Go live" maxW="md" bg="white">
      <PlainHeader title="Go live" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-4">
        <div className="relative aspect-[4/3] lg:aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-brand-400 to-brand-700">
          {camReady && (
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
          )}
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
            <span className="pill bg-black/40 text-white text-[12px]">{camErr ? camErr : camReady ? 'Camera ready · HD' : 'Starting camera…'}</span>
            <button onClick={flipCamera} disabled={flipping || !camReady} className="h-9 w-9 grid place-items-center rounded-full bg-black/40 text-white disabled:opacity-50"><Icon name="flip" size={16} /></button>
          </div>
        </div>
        <div className="mt-4"><span className="label">Stream title</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="card mt-4 p-4 divide-y divide-black/5">
          <div className="flex items-center gap-3 pb-3"><Icon name="mic" size={18} className="text-ink-500" /><span className="flex-1 text-[15px] font-semibold text-ink-900">Microphone</span><Toggle on={mic} onChange={setMic} /></div>
          <div className="flex items-center gap-3 pt-3"><Icon name="gift" size={18} className="text-ink-500" /><span className="flex-1 text-[15px] font-semibold text-ink-900">Allow gifts</span><Toggle on={gifts} onChange={setGifts} /></div>
        </div>
        <ErrorCard message={err} compact className="mt-3" />
        <button onClick={start} disabled={busy} className="btn-primary mt-4 disabled:opacity-60"><Icon name="video" size={17} /> {busy ? 'Starting…' : 'Start broadcast'}</button>
      </div>
    </AppLayout>
  )
}

/* 23 — Live broadcast */
export function Broadcast() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const location = useLocation()
  const { me } = useAuth()
  const broadcastId = sp.get('broadcastId')
  const { channelName, agoraToken, micOn = true } = location.state || {}
  const [chat, setChat] = useState([])
  const [text, setText] = useState('')
  const [ending, setEnding] = useState(false)
  const [mic, setMic] = useState(micOn)
  const [rtcErr, setRtcErr] = useState('')
  const [flipping, setFlipping] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [agoraPeers, setAgoraPeers] = useState(0)
  const [, tick] = useState(0)
  const videoContainerRef = useRef(null)
  const sessionRef = useRef(null)
  const joinRef = useRef(null) // { key, promise } — see the join effect below
  const leaveTimerRef = useRef(null)
  const msgIdRef = useRef(0)
  const endedRef = useRef(false)
  const endTimerRef = useRef(null)

  // Comments should float over the video and fade away like Instagram/TikTok live —
  // ticking once a second re-derives which ones are still within their visible window
  // (see `visibleChat` below) so old ones drop off instead of piling up in a panel.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Viewers' chat messages arrive here now that the host is actually joined to the
  // broadcast's socket room (previously only viewers were — host got nothing).
  useEffect(() => {
    if (!broadcastId) return
    return onSocketEventWhenReady('live:chat', (msg) => {
      if (msg?.broadcastId && msg.broadcastId !== broadcastId) return
      setChat((c) => [...c, { id: ++msgIdRef.current, n: msg.senderName || 'Viewer', t: msg.content, at: Date.now() }])
    })
  }, [broadcastId])

  // No push event for viewer count yet — poll the broadcast for the live figure.
  useEffect(() => {
    if (!broadcastId) return
    let cancelled = false
    const tick = () => liveApi.get(broadcastId).then((b) => !cancelled && setViewerCount(b.viewerCount ?? 0)).catch(() => {})
    tick()
    const t = setInterval(tick, 8000)
    return () => { cancelled = true; clearInterval(t) }
  }, [broadcastId])

  useEffect(() => {
    if (!channelName || !agoraToken) { setRtcErr('No stream credentials — rejoin from Go live.'); return }
    const key = `${channelName}|${agoraToken}`
    clearTimeout(leaveTimerRef.current)
    let cancelled = false

    // React 18 Strict Mode (dev only) mounts this component, synchronously unmounts it, then
    // remounts the same instance — all before the first `client.join()` network round-trip to
    // Agora has any chance to resolve. Checking only the *resolved* session (as a previous
    // version of this fix did) was too late: by the time the remount's effect ran, nothing had
    // resolved yet, so it started a second real `joinAndPublish()` call with the same uid —
    // Agora's server sees two simultaneous joins and throws UID_CONFLICT. Caching the *promise*
    // itself (refs survive the synthetic remount) closes that gap: the remount attaches its own
    // .then() to the SAME in-flight join instead of starting another one.
    if (!(joinRef.current && joinRef.current.key === key)) {
      joinRef.current = {
        key,
        // The token is bound to the joining user's own id — Agora rejects a mismatched uid.
        // 'live' mode + 'host' role: this is a one-to-many broadcast, and the backend already
        // issues a PUBLISHER-role token for the host (live.routes.ts) — that only actually
        // grants publish rights under Agora's Live Broadcasting profile, which plain 'rtc'
        // mode ignores.
        promise: joinAndPublish({ channelName, token: agoraToken, uid: me?.id, mode: 'live', role: 'host', beautySettings: getBeautySettings() }),
      }
    }

    joinRef.current.promise
      .then((session) => {
        if (cancelled) return // a still-mounted invocation (if any) owns this session now
        sessionRef.current = session
        session.localVideoTrack?.play(videoContainerRef.current, { fit: 'cover' })
        session.localAudioTrack?.setEnabled(mic)

        // Diagnostic only — separate from the backend's own DB-tracked viewerCount below.
        // 'user-joined'/'user-left' fire for ANY client that joins this Agora channel, audience
        // included, whether or not they publish anything — this is the one signal that proves
        // a viewer's *Agora* client actually connected, as opposed to just being recorded as
        // "in the room" by the backend. If this stays 0 while the backend viewerCount is >0,
        // the break is on the viewer app's Agora join, not anything in this broadcast screen.
        session.client.on('user-joined', () => setAgoraPeers(session.client.remoteUsers.length))
        session.client.on('user-left', () => setAgoraPeers(session.client.remoteUsers.length))
        setAgoraPeers(session.client.remoteUsers.length)
      })
      .catch((e) => {
        if (cancelled) return
        console.error('Agora join failed:', e)
        setRtcErr(errorMessage(e, 'Could not start the camera/mic for this broadcast.'))
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
  }, [channelName, agoraToken]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { sessionRef.current?.localAudioTrack?.setEnabled(mic) }, [mic])

  // Leaving this screen any way other than the red "end" button (back button/gesture,
  // navigating elsewhere, closing the tab) used to only tear down the local Agora session —
  // the backend broadcast record was never told to end, so it stayed "live" forever and kept
  // showing as broadcasting everywhere that reads it. Ending it here on unmount too, guarded
  // by endedRef so it isn't double-sent when the explicit end button already did it.
  //
  // This must NOT fire immediately: in dev, React 18 StrictMode mounts this component,
  // synchronously unmounts it, then remounts the same instance to surface effect bugs — an
  // immediate end() call here was ending the just-started broadcast within the same second
  // (visible as startedAt/endedAt ~1s apart, then the real mount's camera join racing the
  // StrictMode-remount's, producing the NOT_READABLE "device in use" error). Refs survive
  // that synthetic remount, so deferring the call and cancelling it if this effect re-runs
  // right after tells a real unmount apart from StrictMode's fake one. Production builds
  // (npm run preview) don't double-invoke at all, so this delay is a no-op there.
  useEffect(() => {
    clearTimeout(endTimerRef.current)
    return () => {
      if (endedRef.current || !broadcastId) return
      endTimerRef.current = setTimeout(() => {
        if (!endedRef.current) {
          endedRef.current = true
          liveApi.end(broadcastId).catch(() => {})
        }
      }, 400)
    }
  }, [broadcastId])

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

  const sendChat = async () => {
    const content = text.trim()
    if (!content) return
    setText('')
    setChat((c) => [...c, { id: ++msgIdRef.current, n: 'You', t: content, at: Date.now() }])
    if (broadcastId) {
      try { await liveApi.sendChat(broadcastId, content) } catch { /* best-effort */ }
    }
  }

  // Keep only the last ~8s of comments, newest last — old ones age out on their own each tick.
  const visibleChat = chat.filter((c) => Date.now() - c.at < 8000).slice(-8)

  const end = async () => {
    setEnding(true)
    endedRef.current = true
    if (sessionRef.current) {
      await leaveChannel(sessionRef.current)
      sessionRef.current = null
      joinRef.current = null
    }
    try {
      if (broadcastId) await liveApi.end(broadcastId)
    } finally {
      nav(broadcastId ? `/live/summary?broadcastId=${broadcastId}` : '/live/summary')
    }
  }

  return (
    <ImmersiveLayout>
      <div className="flex min-h-[100dvh] w-full flex-col text-white bg-gradient-to-b from-night-700 via-night-800 to-night-900">
        <StatusBar dark />
        <div className="w-full max-w-[480px] mx-auto px-4 flex items-center gap-2">
          <span className="pill bg-black/40 text-white text-[12px]"><Avatar name="You" size={22} /> You <span className="text-rose-400 font-bold">● LIVE</span></span>
          <span className="pill bg-black/40 text-white text-[12px]"><Icon name="eye" size={12} /> {viewerCount}</span>
          {/* Diagnostic: how many of those viewers Agora itself sees as actually connected.
              If this is 0 while the count above isn't, the viewer app never joined the Agora
              channel — the problem is on their side, not in this broadcast. */}
          <span className={`pill text-[12px] ${agoraPeers > 0 ? 'bg-emerald-500/30 text-emerald-200' : 'bg-black/40 text-white/60'}`} title="Viewers Agora itself sees as connected"><Icon name="live" size={12} /> RTC {agoraPeers}</span>
          <button onClick={flipCamera} disabled={flipping} className="ml-auto h-9 w-9 grid place-items-center rounded-full bg-black/40 text-white disabled:opacity-50"><Icon name="flip" size={16} /></button>
        </div>
        <div className="flex-1 relative overflow-hidden">
          <div ref={videoContainerRef} className="absolute inset-0 agora-video-fill" />
          {rtcErr && (
            <div className="absolute inset-0 grid place-items-center px-8 text-center">
              <div className="rounded-2xl bg-black/40 border border-white/10 px-4 py-3.5 max-w-xs">
                <Icon name="alert" size={18} className="text-rose-400 mx-auto" />
                <p className="text-[13px] text-white/80 mt-1.5">{rtcErr}</p>
              </div>
            </div>
          )}
          {/* Floating comments, Instagram/TikTok-live style — they sit over the video and
              age out on their own (see visibleChat) instead of stacking in a permanent
              panel that pushes the composer down the screen. */}
          <div className="absolute inset-x-0 bottom-0 pt-12 pb-2 flex justify-center pointer-events-none bg-gradient-to-t from-black/55 via-black/10 to-transparent">
            <div className="w-full max-w-[480px] px-4 flex flex-col justify-end gap-1.5">
              {visibleChat.map((c) => (
                <p key={c.id} className="text-[13px] w-fit max-w-[86%] rounded-2xl bg-black/35 px-3 py-1.5 animate-fade-in">
                  <span className="font-bold">{c.n}</span> {c.t}
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="w-full max-w-[480px] mx-auto pb-6 px-4 flex items-center gap-2">
          <button onClick={() => setMic((m) => !m)} className={`h-11 w-11 grid place-items-center rounded-full ${mic ? 'bg-white/12' : 'bg-white text-ink-900'}`}><Icon name={mic ? 'mic' : 'mic-off'} size={18} /></button>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat()} placeholder="Say something…" className="flex-1 rounded-full bg-white/15 border border-white/10 px-4 py-2.5 text-[14px] text-white placeholder:text-white/60 outline-none" />
          <button onClick={sendChat} className="h-11 w-11 grid place-items-center rounded-full bg-white/12"><Icon name="send" size={19} /></button>
          <button onClick={end} disabled={ending} className="h-11 w-11 grid place-items-center rounded-full bg-rose-500"><Icon name="x" size={20} /></button>
        </div>
      </div>
    </ImmersiveLayout>
  )
}

/* 24 — Live summary */
export function LiveSummary() {
  const nav = useNavigate()
  return (
    <AppLayout tab="/live" title="Stream ended" maxW="md" bg="white">
      <PlainHeader title="Stream ended" />
      <div className="px-5 lg:px-0 pt-8 lg:pt-2 pb-4">
        <div className="flex flex-col items-center text-center">
          <span className="grid place-items-center h-16 w-16 rounded-full bg-emerald-500 text-white shadow-[0_0_0_8px_rgba(16,185,129,.12),0_0_0_16px_rgba(16,185,129,.07)]"><Icon name="check" size={28} /></span>
          <h2 className="mt-4 text-[22px] font-extrabold text-ink-900">Broadcast ended</h2>
          <p className="text-[13px] text-ink-400">Check Earnings for the beans this stream brought in</p>
        </div>
        <div className="mt-4 space-y-3">
          <button onClick={() => nav('/earnings')} className="btn-primary">View earnings</button>
          <button onClick={() => nav('/home')} className="btn-outline">Back to home</button>
        </div>
      </div>
    </AppLayout>
  )
}
