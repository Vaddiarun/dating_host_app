import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { StatusBar, PlainHeader, Avatar, Toggle } from '../ui/kit.jsx'
import { AppLayout, ImmersiveLayout } from '../ui/layouts.jsx'
import { live as liveApi } from '../api/index.js'
import { joinAndPublish, leaveChannel, switchToNextCamera } from '../lib/agora.js'
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
  const [camReady, setCamReady] = useState(false)
  const [camErr, setCamErr] = useState('')
  const [facingMode, setFacingMode] = useState('user')
  const [flipping, setFlipping] = useState(false)

  const openCamera = (mode) => {
    return navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: mode }, audio: true })
      .then((stream) => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        stream.getAudioTracks().forEach((t) => { t.enabled = mic })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setCamReady(true)
        setCamErr('')
      })
  }

  useEffect(() => {
    let cancelled = false
    openCamera('user').catch((e) => !cancelled && setCamErr(errorMessage(e, 'Camera unavailable — check permissions.')))
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = mic })
  }, [mic])

  const flipCamera = async () => {
    setFlipping(true)
    const next = facingMode === 'user' ? 'environment' : 'user'
    try {
      await openCamera(next)
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
      streamRef.current?.getTracks().forEach((t) => t.stop()) // release the preview camera; Broadcast opens its own Agora tracks
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
          {camReady && <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />}
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
  const [, tick] = useState(0)
  const videoContainerRef = useRef(null)
  const sessionRef = useRef(null)
  const msgIdRef = useRef(0)

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
    let cancelled = false
    // The token is bound to the joining user's own id — Agora rejects a mismatched uid.
    joinAndPublish({ channelName, token: agoraToken, uid: me?.id })
      .then((session) => {
        if (cancelled) { leaveChannel(session); return }
        sessionRef.current = session
        session.localVideoTrack?.play(videoContainerRef.current, { fit: 'cover' })
        session.localAudioTrack?.setEnabled(mic)
      })
      .catch((e) => { console.error('Agora join failed:', e); setRtcErr(errorMessage(e, 'Could not start the camera/mic for this broadcast.')) })
    return () => {
      cancelled = true
      if (sessionRef.current) leaveChannel(sessionRef.current)
    }
  }, [channelName, agoraToken]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { sessionRef.current?.localAudioTrack?.setEnabled(mic) }, [mic])

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
    if (sessionRef.current) await leaveChannel(sessionRef.current)
    try {
      if (broadcastId) await liveApi.end(broadcastId)
    } finally {
      nav(broadcastId ? `/live/summary?broadcastId=${broadcastId}` : '/live/summary')
    }
  }

  return (
    <ImmersiveLayout>
      <div className="mx-auto flex min-h-[100dvh] max-w-[520px] flex-col text-white bg-gradient-to-b from-night-700 via-night-800 to-night-900">
        <StatusBar dark />
        <div className="px-4 flex items-center gap-2">
          <span className="pill bg-black/40 text-white text-[12px]"><Avatar name="You" size={22} /> You <span className="text-rose-400 font-bold">● LIVE</span></span>
          <span className="pill bg-black/40 text-white text-[12px]"><Icon name="eye" size={12} /> {viewerCount}</span>
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
          <div className="absolute inset-x-0 bottom-0 pt-12 pb-2 px-4 flex flex-col justify-end gap-1.5 pointer-events-none bg-gradient-to-t from-black/55 via-black/10 to-transparent">
            {visibleChat.map((c) => (
              <p key={c.id} className="text-[13px] w-fit max-w-[86%] rounded-2xl bg-black/35 px-3 py-1.5 animate-fade-in">
                <span className="font-bold">{c.n}</span> {c.t}
              </p>
            ))}
          </div>
        </div>
        <div className="pb-6 px-4 flex items-center gap-2">
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
