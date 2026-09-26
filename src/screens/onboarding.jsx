import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { StatusBar, TopBar, PlainHeader, IconBadge, ResultScreen, SectionTitle, ErrorCard, ReferenceRow } from '../ui/kit.jsx'
import { CenterLayout, ImmersiveLayout, AppLayout } from '../ui/layouts.jsx'
import { useAuth, resolveEntryRoute } from '../state/AuthContext.jsx'
import { profile as profileApi } from '../api/index.js'
import { errorMessage } from '../lib/errors.js'
import { referenceCode } from '../lib/format.js'
import { getBeautySettings, openBeautyCamera } from '../lib/beautyFilter.js'
import { uploadAvatar } from '../lib/avatar.js'

/* 1 — Splash */
export function Splash() {
  const nav = useNavigate()
  const { status, me } = useAuth()
  useEffect(() => {
    if (status === 'loading') return
    const t = setTimeout(() => {
      nav(status === 'authed' ? resolveEntryRoute(me) : '/login', { replace: true })
    }, 1200)
    return () => clearTimeout(t)
  }, [nav, status, me])
  return (
    <ImmersiveLayout>
      <div
        className="relative flex min-h-[100dvh] flex-col items-center overflow-hidden text-white bg-gradient-to-br from-brand-800 via-night-800 to-night-900 bg-[length:180%_180%] animate-bg-pan"
      >
        <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-brand-500/40 blur-3xl animate-glow-breathe" />
        <div className="pointer-events-none absolute bottom-10 right-0 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl animate-glow-breathe" style={{ animationDelay: '1.3s' }} />
        <StatusBar dark />

        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <div className="relative animate-logo-float">
            {/* halo */}
            <span className="pointer-events-none absolute -inset-6 rounded-[40px] bg-brand-400/30 blur-2xl animate-glow-breathe" />
            {/* pulsing rings */}
            <span className="pointer-events-none absolute inset-0 rounded-[26px] ring-1 ring-white/20 animate-pulse-ring" />
            <div className="relative h-24 w-24 rounded-[26px] bg-gradient-to-br from-brand-300 via-brand-500 to-brand-700 shadow-[0_20px_60px_-10px_rgba(109,59,230,.8)] animate-logo-in grid place-items-center">
              <Icon name="heart" size={34} className="text-white/90" fill="currentColor" />
            </div>
          </div>
          <h1 className="text-[30px] font-extrabold animate-word-in">Splash</h1>
        </div>

        <div className="pb-10 flex flex-col items-center gap-2 animate-fade-in" style={{ animationDelay: '.6s' }}>
          <div className="h-1 w-28 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-gold-300 to-gold-400 animate-loadbar" />
          </div>
          <span className="text-[11px] text-white/40">Loading your studio…</span>
        </div>
      </div>
    </ImmersiveLayout>
  )
}

/* 2 — Login */
export function Login() {
  const nav = useNavigate()
  const { requestOtp } = useAuth()
  const [num, setNum] = useState('98765 43210')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    const digits = num.replace(/\D/g, '')
    if (digits.length < 10) { setErr('Enter a valid 10-digit number'); return }
    const phone = `+91${digits}`
    setBusy(true)
    setErr('')
    try {
      await requestOtp(phone)
      nav('/otp', { state: { phone } })
    } catch (e) {
      setErr(errorMessage(e, 'Could not send code. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <CenterLayout>
      <StatusBar />
      <div className="flex-1 px-6 pt-6 lg:pt-10 pb-8">
        <div className="mx-auto h-28 w-28 rounded-[28px] bg-gradient-to-br from-brand-50 to-gold-50 grid place-items-center">
          <div className="h-16 w-14 rounded-2xl border-2 border-brand-500/60 grid place-items-center"><Icon name="heart" size={26} className="text-gold-400" /></div>
        </div>
        <h1 className="mt-7 text-[26px] font-extrabold text-ink-900">Your number</h1>
        <p className="text-[14px] text-ink-400 mt-1">We'll text a 6-digit code to verify it's you.</p>
        <div className="mt-6 flex gap-2">
          <div className="input w-[86px] flex items-center justify-center gap-1 font-semibold">🇮🇳 +91</div>
          <input value={num} onChange={(e) => setNum(e.target.value)} className="input flex-1" inputMode="numeric" />
        </div>
        <ErrorCard message={err} compact className="mt-2" />
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-black/[.03] px-3 py-2.5 text-[12px] text-ink-400">
          <Icon name="shield" size={15} className="mt-0.5 shrink-0" /> By continuing you agree to the Terms and Privacy Policy.
        </div>
        <button onClick={submit} disabled={busy} className="btn-primary mt-4 disabled:opacity-60">
          <Icon name="chevron-right" size={18} /> {busy ? 'Sending…' : 'Send code'}
        </button>
      </div>
    </CenterLayout>
  )
}

/* 3 — OTP */
export function Otp() {
  const nav = useNavigate()
  const location = useLocation()
  const { verifyOtp, requestOtp, pendingPhone } = useAuth()
  const phone = location.state?.phone || pendingPhone
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [seconds, setSeconds] = useState(30)
  const inputsRef = useRef([])

  useEffect(() => {
    if (!phone) { nav('/login', { replace: true }); return }
  }, [phone, nav])

  useEffect(() => {
    if (seconds <= 0) return
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds])

  const set = (i, v) => {
    const d = v.replace(/\D/g, '').slice(-1)
    setCode((c) => c.map((x, j) => (j === i ? d : x)))
    if (d && i < 5) inputsRef.current[i + 1]?.focus()
  }

  const submit = async () => {
    const joined = code.join('')
    if (joined.length !== 6) { setErr('Enter the full 6-digit code'); return }
    setBusy(true)
    setErr('')
    try {
      const me = await verifyOtp(phone, joined)
      nav(resolveEntryRoute(me), { replace: true })
    } catch (e) {
      setErr(errorMessage(e, 'Invalid code. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (seconds > 0 || !phone) return
    setErr('')
    try {
      await requestOtp(phone)
      setSeconds(30)
    } catch (e) {
      setErr(errorMessage(e, 'Could not resend code.'))
    }
  }

  const mmss = `00:${String(seconds).padStart(2, '0')}`

  return (
    <CenterLayout>
      <StatusBar />
      <TopBar title="Verify number" />
      <div className="flex-1 px-6 pt-5 pb-8">
        <h1 className="text-[24px] font-extrabold text-ink-900 lg:mt-4">Enter the code</h1>
        <p className="text-[14px] text-ink-400 mt-1">Sent to {phone}</p>
        <div className="mt-5 flex gap-2.5">
          {code.map((d, i) => (
            <input key={i} ref={(el) => (inputsRef.current[i] = el)} value={d} onChange={(e) => set(i, e.target.value)} inputMode="numeric"
              className={`h-16 flex-1 rounded-2xl border text-center text-[22px] font-bold outline-none ${d ? 'border-brand-500 text-ink-900' : 'border-black/10'} focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20`} />
          ))}
        </div>
        <ErrorCard message={err} compact className="mt-2" />
        <button onClick={resend} disabled={seconds > 0} className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-400 disabled:opacity-100 enabled:text-brand-600 enabled:font-semibold">
          <Icon name="clock" size={14} /> {seconds > 0 ? `Resend in ${mmss}` : 'Resend code'}
        </button>
        <button onClick={submit} disabled={busy} className="btn-primary mt-5 disabled:opacity-60">{busy ? 'Verifying…' : 'Verify'}</button>
      </div>
    </CenterLayout>
  )
}

const ONBOARDING_STEPS = ['Profile', 'Gallery', 'Audition', 'KYC', 'Payout']
function Steps({ active }) {
  const last = ONBOARDING_STEPS.length - 1
  return (
    <div className="flex items-center px-2 py-4">
      {ONBOARDING_STEPS.map((label, i) => (
        <div key={label} className={`flex items-center ${i < last ? 'flex-1' : ''}`}>
          <div className="flex flex-col items-center gap-1">
            <span className={`h-7 w-7 grid place-items-center rounded-full text-[12px] font-bold ${i <= active ? 'bg-brand-600 text-white' : 'bg-black/10 text-ink-400'}`}>
              {i < active ? <Icon name="check" size={14} /> : i + 1}
            </span>
            <span className={`text-[11px] font-semibold ${i <= active ? 'text-ink-900' : 'text-ink-400'}`}>{label}</span>
          </div>
          {i < last && <div className={`h-0.5 flex-1 mx-1 -mt-4 ${i < active ? 'bg-brand-600' : 'bg-black/10'}`} />}
        </div>
      ))}
    </div>
  )
}

/* 4 — Profile setup */
export function ProfileSetup() {
  const nav = useNavigate()
  const { me, setMe } = useAuth()
  const [name, setName] = useState(me?.name || '')
  const [email, setEmail] = useState(me?.email || '')
  const [languages, setLanguages] = useState((me?.languages || []).join(', ') || 'Hindi, English')
  const [bio, setBio] = useState(me?.hostProfile?.bio || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const avatarInputRef = useRef(null)

  const pickAvatar = (file) => {
    if (!file) return
    setAvatarFile(file)
    setAvatarPreviewUrl(URL.createObjectURL(file))
  }

  const submit = async () => {
    if (!name.trim()) { setErr('Display name is required'); return }
    setBusy(true)
    setErr('')
    try {
      const langs = languages.split(',').map((s) => s.trim()).filter(Boolean)
      const avatarUrl = avatarFile ? await uploadAvatar(avatarFile) : undefined
      const updated = await profileApi.updateMe({ name: name.trim(), email: email.trim() || undefined, avatarUrl, languages: langs })
      await profileApi.updateHostProfile({ bio: bio.trim() || undefined, languages: langs })
      setMe({ ...updated, hostProfile: { ...me?.hostProfile, bio, languages: langs } })
      nav('/onboarding/gallery')
    } catch (e) {
      setErr(errorMessage(e, 'Could not save your profile.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <CenterLayout>
      <StatusBar />
      <PlainHeader title="Set up profile" />
      <div className="flex-1 overflow-y-auto px-5 lg:px-6 no-scrollbar">
        <p className="hidden lg:block text-[22px] font-extrabold text-ink-900 pt-6">Set up profile</p>
        <Steps active={0} />
        <div className="flex flex-col items-center">
          <button type="button" onClick={() => avatarInputRef.current?.click()} className="relative">
            {avatarPreviewUrl ? (
              <img src={avatarPreviewUrl} alt="Your photo" className="h-24 w-24 rounded-full object-cover ring-4 ring-brand-500/40" />
            ) : (
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-gold-300 to-emerald-300 ring-4 ring-brand-500/40" />
            )}
            <span className="absolute bottom-0 right-0 h-8 w-8 grid place-items-center rounded-full bg-brand-600 text-white"><Icon name="camera" size={15} /></span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png"
            capture="user"
            hidden
            onChange={(e) => pickAvatar(e.target.files?.[0] || null)}
          />
          <p className="text-[12px] text-ink-400 mt-2">Add a clear, well-lit photo</p>
        </div>
        <div className="mt-5 space-y-3.5 pb-5">
          <div><span className="label">Display name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><span className="label">E-mail</span><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><span className="label">Languages</span><input className="input" value={languages} onChange={(e) => setLanguages(e.target.value)} /></div>
          <div><span className="label">About you</span><textarea rows={2} className="input" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell viewers what you love talking about" /></div>
          <ErrorCard message={err} compact />
        </div>
      </div>
      <div className="p-4 border-t border-black/5"><button onClick={submit} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? 'Saving…' : 'Continue'}</button></div>
    </CenterLayout>
  )
}

const GALLERY_RECOMMENDED = 3

/* 4a — Add gallery photos */
export function GallerySetup() {
  const nav = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)

  const load = () => { profileApi.listGallery().then((res) => setItems(res.items || [])).catch(() => {}).finally(() => setLoading(false)) }
  useEffect(load, [])

  const uploadFile = async (file) => {
    setUploading(true)
    setErr('')
    try {
      const mediaType = file.type.startsWith('video') ? 'video' : 'photo'
      const { uploadUrl, url: publicUrl } = await profileApi.getGalleryUploadUrl(file.type || 'application/octet-stream')
      await profileApi.uploadGalleryFile(uploadUrl, file)
      await profileApi.addGalleryItem(mediaType, publicUrl)
      await load()
    } catch (e) {
      setErr(errorMessage(e, 'Could not upload that photo.'))
    } finally {
      setUploading(false)
    }
  }

  const remove = async (id) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
    profileApi.deleteGalleryItem(id).catch(() => load()) // put it back if the delete didn't actually take
  }

  const photoCount = items.length
  const complete = photoCount >= GALLERY_RECOMMENDED

  return (
    <CenterLayout>
      <StatusBar />
      <PlainHeader title="Add photos" />
      <div className="flex-1 overflow-y-auto px-5 lg:px-6 no-scrollbar">
        <p className="hidden lg:block text-[22px] font-extrabold text-ink-900 pt-6">Add photos</p>
        <Steps active={1} />
        <div className="flex flex-col items-center text-center mt-2">
          <IconBadge name="image" tone="brand" size={56} />
          <h2 className="mt-3 text-[20px] font-extrabold text-ink-900">Build your gallery</h2>
          <p className="text-[13px] text-ink-400 mt-1 max-w-xs">Hosts who add 3+ gallery photos get <span className="font-semibold text-ink-700">40% more calls</span>. Add a few of your best shots.</p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) uploadFile(file) }}
        />

        <div className="mt-5 grid grid-cols-3 gap-2.5 pb-5">
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="aspect-square rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/60 grid place-items-center text-brand-500 disabled:opacity-60">
            {uploading ? <Icon name="refresh" size={20} className="animate-spinslow" /> : <Icon name="plus" size={22} />}
          </button>
          {!loading && items.map((t) => (
            <div key={t.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-black/5">
              {t.mediaType === 'video' ? (
                <span className="absolute inset-0 grid place-items-center text-ink-400 bg-black/5"><Icon name="video" size={20} /></span>
              ) : (
                <img src={t.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <button onClick={() => remove(t.id)} className="absolute top-1.5 right-1.5 h-6 w-6 grid place-items-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"><Icon name="x" size={12} /></button>
            </div>
          ))}
        </div>

        <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] ${complete ? 'bg-emerald-50 text-emerald-700' : 'bg-gold-50 text-gold-600'}`}>
          <Icon name={complete ? 'check' : 'alert'} size={14} className="shrink-0" />
          {complete ? 'Nice — your gallery looks great.' : `Add ${GALLERY_RECOMMENDED - photoCount} more photo${GALLERY_RECOMMENDED - photoCount === 1 ? '' : 's'} for the best results.`}
        </div>
        <ErrorCard message={err} compact className="mt-2" />
      </div>
      <div className="p-4 border-t border-black/5">
        <button onClick={() => nav('/onboarding/audition')} className="btn-primary">{photoCount > 0 ? 'Continue' : 'Skip for now'}</button>
      </div>
    </CenterLayout>
  )
}

/* 5 — KYC intro */
export function KycIntro() {
  const nav = useNavigate()
  const items = [
    { icon: 'id-card', title: 'Government ID', sub: 'Aadhaar, PAN or Passport' },
    { icon: 'camera', title: 'Selfie check', sub: 'Live photo to match your ID' },
    { icon: 'card', title: 'Payout account', sub: 'Bank or UPI for withdrawals' },
  ]
  return (
    <CenterLayout>
      <StatusBar />
      <TopBar title="Verification" />
      <div className="flex-1 px-5 lg:px-6">
        <Steps active={3} />
        <div className="flex flex-col items-center text-center mt-2">
          <IconBadge name="shield-check" tone="brand" size={56} />
          <h2 className="mt-3 text-[22px] font-extrabold text-ink-900">Verify to start earning</h2>
          <p className="text-[13px] text-ink-400 mt-1">Takes about 3 minutes. Payouts unlock once approved.</p>
        </div>
        <div className="mt-5 space-y-3">
          {items.map((it) => (
            <div key={it.title} className="card p-3.5 flex items-center gap-3">
              <IconBadge name={it.icon} tone="brand" />
              <div><p className="text-[15px] font-semibold text-ink-900">{it.title}</p><p className="text-[12px] text-ink-400">{it.sub}</p></div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4"><button onClick={() => nav('/onboarding/documents')} className="btn-primary">Start verification</button></div>
    </CenterLayout>
  )
}

const AUDITION_MAX_SECONDS = 60
// Bridges the recorded video's S3 key from this step to DocumentUpload's final submit,
// since the two are separate onboarding screens/routes with no shared state otherwise.
const AUDITION_VIDEO_KEY_STORAGE_KEY = 'triloplan_host_audition_video_key'

/* 4b — Live audition video */
export function LiveAudition() {
  const nav = useNavigate()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const beautyRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const [phase, setPhase] = useState('opening') // opening | live | recording | recorded
  const [elapsed, setElapsed] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState(null)
  const [recordedUrl, setRecordedUrl] = useState('')
  const [camErr, setCamErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    beautyRef.current?.stop()
    beautyRef.current = null
  }

  const startCamera = async () => {
    setPhase('opening')
    setCamErr('')
    try {
      const beauty = getBeautySettings()
      if (beauty.enabled) {
        // Recorded (not just previewed) — so this needs the real processed track, not a
        // CSS-only preview filter, or the submitted video wouldn't actually show the effect.
        const cam = await openBeautyCamera({ settings: beauty, audio: true })
        beautyRef.current = cam
        streamRef.current = cam.stream
      } else {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
      }
      setPhase('live')
    } catch (e) {
      setCamErr(errorMessage(e, 'Camera unavailable — check permissions.'))
    }
  }

  useEffect(() => { startCamera(); return () => { stopStream(); clearInterval(timerRef.current) } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The <video> element only exists once `phase` leaves "opening" — attach the stream
  // here, after that render has committed, same pattern as SelfieCamera above.
  useEffect(() => {
    if (phase === 'live' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [phase])

  const stopRecording = () => {
    clearInterval(timerRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
  }

  const startRecording = () => {
    if (!streamRef.current || !window.MediaRecorder) return
    chunksRef.current = []
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      .find((t) => MediaRecorder.isTypeSupported?.(t)) || ''
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined)
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
      setRecordedBlob(blob)
      setRecordedUrl(URL.createObjectURL(blob))
      setPhase('recorded')
      stopStream()
    }
    recorderRef.current = recorder
    recorder.start()
    setElapsed(0)
    setPhase('recording')
    timerRef.current = setInterval(() => {
      setElapsed((s) => {
        if (s + 1 >= AUDITION_MAX_SECONDS) { stopRecording(); return AUDITION_MAX_SECONDS }
        return s + 1
      })
    }, 1000)
  }

  const reRecord = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    setRecordedBlob(null)
    setRecordedUrl('')
    setElapsed(0)
    setErr('')
    startCamera()
  }

  const submit = async () => {
    if (!recordedBlob) return
    setBusy(true)
    setErr('')
    try {
      // Uploaded via the same presigned-KYC-upload mechanism as the id/selfie documents
      // (backend documentType "audition_video"), but not submitted yet — DocumentUpload's
      // submit() below reads AUDITION_VIDEO_KEY_STORAGE_KEY back out of sessionStorage and
      // includes it in the same POST /me/kyc call as the rest of the submission, since this
      // screen is a separate step from the final "Submit for review" action.
      const { uploadUrl, key } = await profileApi.getKycUploadUrl(recordedBlob.type || 'video/webm')
      await profileApi.uploadKycFile(uploadUrl, recordedBlob)
      sessionStorage.setItem(AUDITION_VIDEO_KEY_STORAGE_KEY, key)
      nav('/onboarding/kyc')
    } catch (e) {
      setErr(errorMessage(e, 'Could not submit your video. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  const recording = phase === 'recording'
  const recorded = phase === 'recorded'

  return (
    <CenterLayout>
      <StatusBar />
      <TopBar title="Live audition video" />
      <div className="flex-1 overflow-y-auto px-5 lg:px-6 no-scrollbar">
        <Steps active={2} />
        <div className="rounded-xl bg-brand-50 px-3.5 py-3 flex items-start gap-2 text-[12px] text-brand-700">
          <Icon name="video" size={15} className="mt-0.5 shrink-0" /> Record a short video introducing yourself. Please state where you're from.
        </div>

        <div className="relative mt-4 aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-brand-500 to-night-800">
          {recorded ? (
            <>
              <video src={recordedUrl} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid place-items-center h-14 w-14 rounded-full bg-emerald-500 text-white"><Icon name="check" size={26} /></span>
              </span>
              <span className="absolute bottom-3 left-3 pill bg-black/50 text-white text-[12px]">Recorded · {mm}:{ss} / 01:00</span>
            </>
          ) : (
            <>
              {phase !== 'opening' && (
                <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
              )}
              <span className="absolute top-3 left-3 pill bg-black/50 text-white text-[12px]">{recording ? 'REC' : 'LIVE CAMERA'}</span>
              <span className="absolute top-3 right-3 pill bg-black/50 text-white text-[12px]">{mm}:{ss} / 01:00</span>
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={phase !== 'live' && !recording}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 h-12 w-12 rounded-full bg-white grid place-items-center disabled:opacity-40"
                aria-label={recording ? 'Stop recording' : 'Start recording'}
              >
                <span className={recording ? 'bg-rose-500 h-4 w-4 rounded-sm' : 'bg-rose-500 h-9 w-9 rounded-full'} />
              </button>
            </>
          )}
        </div>
        {camErr && <p className="text-[12px] text-rose-500 mt-2">{camErr}</p>}

        {!recorded && <p className="text-[11px] text-ink-400 text-center mt-2">Recording stops automatically after 1 minute.</p>}

        {recorded && (
          <div className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[12px] text-emerald-700 flex items-center gap-2">
            <Icon name="check" size={14} /> Your live recording is ready to submit.
          </div>
        )}

        <ErrorCard message={err} compact className="mt-3" />
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        <button onClick={reRecord} disabled={phase === 'opening'} className="btn-outline disabled:opacity-40"><Icon name="refresh" size={16} /> Re-record</button>
        <button onClick={submit} disabled={!recorded || busy} className="btn-primary disabled:opacity-40">{busy ? 'Submitting…' : <><Icon name="chevron-right" size={16} /> Submit video</>}</button>
      </div>
    </CenterLayout>
  )
}

/* helper: upload a File via presigned URL, return the S3 key */
async function uploadDocument(file) {
  const { uploadUrl, key } = await profileApi.getKycUploadUrl(file.type || 'application/octet-stream')
  await profileApi.uploadKycFile(uploadUrl, file)
  return key
}

/* Live selfie capture — real camera, not a file picker. Falls back to file-upload
 * when getUserMedia is unavailable or permission is denied (older devices, desktop
 * without a webcam, a user who says no to the prompt). */
function SelfieCamera({ photo, onCapture, onClear }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)
  const [live, setLive] = useState(false)
  const [camErr, setCamErr] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')

  useEffect(() => {
    if (!photo) { setPhotoUrl(''); return }
    const url = URL.createObjectURL(photo)
    setPhotoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const startCamera = async () => {
    setCamErr('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamErr('Camera not available on this device — upload a photo instead.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 } }, audio: false })
      streamRef.current = stream
      setLive(true) // mounts the <video> element; the stream attaches once it exists (effect below)
    } catch (e) {
      setCamErr(errorMessage(e, 'Camera permission denied — upload a photo instead.'))
    }
  }

  // The <video> element only exists in the DOM once `live` is true, so the stream can't be
  // attached inside startCamera() itself — attach it here, after that render has committed.
  useEffect(() => {
    if (live && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [live])

  useEffect(() => () => stopStream(), [])

  const capture = async () => {
    const video = videoRef.current
    if (!video) return
    if (!video.videoWidth) {
      await new Promise((resolve) => {
        video.addEventListener('loadeddata', resolve, { once: true })
        setTimeout(resolve, 2000) // don't hang forever if the stream never loads
      })
    }
    if (!video.videoWidth) { setCamErr('Camera feed not ready yet — try again.'); return }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      onCapture(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }))
      stopStream()
      setLive(false)
    }, 'image/jpeg', 0.92)
  }

  const retake = () => {
    onClear()
    startCamera()
  }

  if (photo) {
    return (
      <div className="mt-2 aspect-[3/2] w-full rounded-2xl overflow-hidden relative bg-black">
        {photoUrl && <img src={photoUrl} alt="Selfie" className="absolute inset-0 h-full w-full object-cover" />}
        <button onClick={retake} className="absolute bottom-3 right-3 pill bg-black/50 text-white text-[12px]"><Icon name="refresh" size={13} /> Retake</button>
      </div>
    )
  }

  if (live) {
    return (
      <div className="mt-2 aspect-[3/2] w-full rounded-2xl overflow-hidden relative bg-black">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="h-40 w-52 rounded-[50%] border-2 border-dashed border-white/60" />
        </div>
        <button onClick={capture} className="absolute bottom-3 left-1/2 -translate-x-1/2 h-14 w-14 rounded-full bg-white ring-4 ring-white/30 active:scale-95" aria-label="Capture selfie" />
      </div>
    )
  }

  return (
    <div className="mt-2 aspect-[3/2] w-full rounded-2xl bg-gradient-to-br from-brand-400 to-night-800 grid place-items-center relative overflow-hidden">
      <button onClick={startCamera} className="flex flex-col items-center gap-2 text-white">
        <div className="h-40 w-52 rounded-[50%] border-2 border-dashed border-white/50 grid place-items-center"><Icon name="camera" size={30} className="text-white/70" /></div>
        <span className="text-[13px] font-semibold">Tap to open camera</span>
      </button>
      {camErr && (
        <div className="absolute bottom-3 inset-x-3 text-center">
          <span className="text-[11px] text-white/90 bg-black/40 rounded-lg px-2.5 py-1.5 inline-block">{camErr}</span>
        </div>
      )}
      <button onClick={() => fileRef.current?.click()} className="absolute top-3 right-3 pill bg-black/40 text-white text-[11px]"><Icon name="upload" size={12} /> Upload instead</button>
      <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => e.target.files?.[0] && onCapture(e.target.files[0])} />
    </div>
  )
}

/* 6 — Document upload */
export function DocumentUpload() {
  const nav = useNavigate()
  const [front, setFront] = useState(null)
  const [back, setBack] = useState(null)
  const [selfie, setSelfie] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const frontRef = useRef(null)
  const backRef = useRef(null)

  const submit = async () => {
    if (!front) { setErr('Front of your ID is required'); return }
    setBusy(true)
    setErr('')
    try {
      const documents = []
      const frontKey = await uploadDocument(front)
      documents.push({ documentType: 'id_front', key: frontKey })
      if (back) documents.push({ documentType: 'id_back', key: await uploadDocument(back) })
      if (selfie) documents.push({ documentType: 'selfie', key: await uploadDocument(selfie) })
      const auditionVideoKey = sessionStorage.getItem(AUDITION_VIDEO_KEY_STORAGE_KEY)
      if (auditionVideoKey) documents.push({ documentType: 'audition_video', key: auditionVideoKey })
      await profileApi.submitKyc(documents)
      sessionStorage.removeItem(AUDITION_VIDEO_KEY_STORAGE_KEY)
      nav('/onboarding/payout')
    } catch (e) {
      setErr(errorMessage(e, 'Could not submit documents.'))
    } finally {
      setBusy(false)
    }
  }

  const Tile = ({ file, label, onPick, dashed }) => (
    <button
      onClick={onPick}
      className={`relative aspect-[3/2] rounded-2xl grid place-items-center ${file ? 'bg-black/[.06] border border-black/10' : `border-2 border-dashed ${dashed} bg-brand-50/60`}`}
    >
      {file ? (
        <>
          <span className="absolute top-2 right-2 h-5 w-5 grid place-items-center rounded-full bg-emerald-500 text-white"><Icon name="check" size={12} /></span>
          <span className="absolute bottom-2 left-2 text-[11px] font-semibold text-ink-500 truncate max-w-[80%]">{file.name}</span>
        </>
      ) : (
        <span className="flex flex-col items-center gap-1 text-[12px] font-semibold text-brand-600"><Icon name="upload" size={18} /> {label}</span>
      )}
    </button>
  )

  return (
    <CenterLayout>
      <StatusBar />
      <TopBar title="Upload documents" />
      <div className="flex-1 overflow-y-auto px-5 lg:px-6 no-scrollbar">
        <div className="h-1.5 rounded-full bg-black/10 my-3 overflow-hidden"><div className="h-full w-2/5 bg-brand-600" /></div>
        <SectionTitle className="mt-2">Government ID</SectionTitle>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Tile file={front} label="Front" onPick={() => frontRef.current?.click()} dashed="border-brand-400" />
          <Tile file={back} label="Back side" onPick={() => backRef.current?.click()} dashed="border-brand-400" />
        </div>
        <input ref={frontRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setFront(e.target.files?.[0] || null)} />
        <input ref={backRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setBack(e.target.files?.[0] || null)} />
        <SectionTitle className="mt-5">Selfie check</SectionTitle>
        <SelfieCamera photo={selfie} onCapture={setSelfie} onClear={() => setSelfie(null)} />
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-gold-50 px-3 py-2.5 text-[12px] text-gold-600">
          <Icon name="alert" size={15} className="mt-0.5 shrink-0" /> Make sure all four corners are visible and text is readable.
        </div>
        <ErrorCard message={err} compact className="mt-2" />
      </div>
      <div className="p-4"><button onClick={submit} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? 'Uploading…' : 'Submit for review'}</button></div>
    </CenterLayout>
  )
}

/* 7 — Payout account (onboarding + standalone) */
const ACCOUNT_MIN = 9
const ACCOUNT_MAX = 18
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/

function accountNumberError(v) {
  if (!v) return ''
  if (v.length > ACCOUNT_MAX) return `Account number exceeds the ${ACCOUNT_MAX}-digit limit`
  if (v.length < ACCOUNT_MIN) return `Account number must be at least ${ACCOUNT_MIN} digits`
  return ''
}

function ifscError(v) {
  if (!v) return ''
  if (v.length > 11) return 'IFSC exceeds the 11-character limit'
  if (v.length < 11) return 'IFSC must be exactly 11 characters'
  if (!IFSC_RE.test(v)) return 'Invalid IFSC format — expected e.g. HDFC0001234'
  return ''
}

function vpaError(v) {
  if (!v) return ''
  if (!/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(v)) return 'Enter a valid UPI ID, e.g. name@bank'
  return ''
}

export function PayoutAccount({ standalone }) {
  const nav = useNavigate()
  const [tab, setTab] = useState('Bank transfer')
  const [holder, setHolder] = useState('Ayesha Khan')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [vpa, setVpa] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const holderErr = holder.trim() === '' ? '' : (holder.trim().length < 2 ? 'Enter the full account holder name' : '')
  const acctErr = accountNumberError(accountNumber)
  const ifscErr = ifscError(ifsc)
  const upiErr = vpaError(vpa)
  const bankValid = holder.trim().length >= 2 && accountNumber.length >= ACCOUNT_MIN && accountNumber.length <= ACCOUNT_MAX && !acctErr && IFSC_RE.test(ifsc)
  const upiValid = vpa.trim() !== '' && !upiErr

  const submit = async () => {
    setErr('')
    if (tab === 'Bank transfer' && !bankValid) { setErr('Fix the highlighted fields before saving'); return }
    if (tab === 'UPI' && !upiValid) { setErr('Enter a valid UPI ID'); return }
    setBusy(true)
    try {
      if (tab === 'Bank transfer') {
        await profileApi.addPayoutMethod({ type: 'bank', accountHolderName: holder.trim(), accountNumber: accountNumber.trim(), ifsc: ifsc.trim().toUpperCase() })
      } else {
        await profileApi.addPayoutMethod({ type: 'upi', vpa: vpa.trim() })
      }
      nav(standalone ? '/settings/payouts' : '/onboarding/review')
    } catch (e) {
      setErr(errorMessage(e, 'Could not save payout account.'))
    } finally {
      setBusy(false)
    }
  }

  const body = (
    <>
      <div className="flex gap-2 my-3">
        {['Bank transfer', 'UPI'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-[13px] font-semibold border ${tab === t ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-ink-500 border-black/10'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Bank transfer' ? (
        <div className="space-y-3.5">
          <div>
            <span className="label">Account holder</span>
            <input className={`input ${holderErr ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`} value={holder} onChange={(e) => setHolder(e.target.value)} />
            {holderErr && <p className="text-[12px] text-rose-500 mt-1">{holderErr}</p>}
          </div>
          <div>
            <span className="label">Account number</span>
            <input
              className={`input ${acctErr ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
              value={accountNumber}
              inputMode="numeric"
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="1234567894821"
            />
            <div className="flex items-center justify-between mt-1">
              {acctErr ? <p className="text-[12px] text-rose-500">{acctErr}</p> : <span />}
              <span className={`text-[11px] ${accountNumber.length > ACCOUNT_MAX ? 'text-rose-500 font-semibold' : 'text-ink-300'}`}>{accountNumber.length}/{ACCOUNT_MAX}</span>
            </div>
          </div>
          <div>
            <span className="label">IFSC code</span>
            <input
              className={`input uppercase ${ifscErr ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="HDFC0001234"
            />
            <div className="flex items-center justify-between mt-1">
              {ifscErr ? <p className="text-[12px] text-rose-500">{ifscErr}</p> : <span />}
              <span className={`text-[11px] ${ifsc.length > 11 ? 'text-rose-500 font-semibold' : 'text-ink-300'}`}>{ifsc.length}/11</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div>
            <span className="label">UPI ID</span>
            <input className={`input ${upiErr ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`} value={vpa} onChange={(e) => setVpa(e.target.value)} placeholder="ayesha@upi" />
            {upiErr && <p className="text-[12px] text-rose-500 mt-1">{upiErr}</p>}
          </div>
        </div>
      )}
      <ErrorCard message={err} compact className="mt-2" />
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-[12px] text-brand-700">
        <Icon name="shield" size={15} className="mt-0.5 shrink-0" /> Payout details are encrypted and only used for withdrawals.
      </div>
    </>
  )
  const formValid = tab === 'Bank transfer' ? bankValid : upiValid
  if (standalone) {
    return (
      <AppLayout title="Add payout account" back bottomNav={false} maxW="md" bg="white">
        <TopBar title="Add payout account" />
        <div className="p-4 lg:p-0">
          {body}
          <button onClick={submit} disabled={busy || !formValid} className="btn-primary mt-4 disabled:opacity-60">{busy ? 'Saving…' : 'Save account'}</button>
        </div>
      </AppLayout>
    )
  }
  return (
    <CenterLayout>
      <StatusBar />
      <TopBar title="Payout account" />
      <div className="flex-1 overflow-y-auto px-5 lg:px-6 no-scrollbar">
        <Steps active={4} />
        {body}
      </div>
      <div className="p-4"><button onClick={submit} disabled={busy || !formValid} className="btn-primary disabled:opacity-60">{busy ? 'Saving…' : 'Save account'}</button></div>
    </CenterLayout>
  )
}

/* 8 — Under review */
export function UnderReview() {
  const nav = useNavigate()
  const { me, refreshMe } = useAuth()
  const [checking, setChecking] = useState(false)
  const [kyc, setKyc] = useState(null)
  const [err, setErr] = useState('')
  const ref = referenceCode(kyc, me?.id)

  const check = async () => {
    setChecking(true)
    setErr('')
    try {
      const status = await profileApi.getKycStatus()
      setKyc(status)
      const me = await refreshMe()
      if (me.kycStatus === 'approved') nav('/onboarding/verified', { replace: true })
      else if (me.kycStatus === 'rejected') nav('/onboarding/rejected', { replace: true })
    } catch (e) {
      setErr(errorMessage(e, 'Could not check your status.'))
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { check() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = [
    { t: 'Documents received', done: true },
    { t: 'Identity check', done: (kyc?.documents?.length || 0) > 0 },
    { t: 'Final approval', done: false },
  ]
  return (
    <CenterLayout>
      <StatusBar />
      <div className="flex-1 flex flex-col items-center px-6 pt-16 lg:pt-10 pb-8 text-center">
        <span className="grid place-items-center h-20 w-20 rounded-full bg-gold-400 text-white shadow-[0_0_0_10px_rgba(224,169,46,.16),0_0_0_20px_rgba(224,169,46,.08)]"><Icon name="clock" size={34} /></span>
        <h2 className="mt-6 text-[24px] font-extrabold text-ink-900">Under review</h2>
        <p className="mt-1 text-[13px] text-ink-400">Usually approved within 24 hours.</p>
        <ReferenceRow value={ref} label="Application ID" className="w-full max-w-sm mt-4" />
        <div className="card w-full max-w-sm mt-4 p-4 divide-y divide-black/5">
          {rows.map((r) => (
            <div key={r.t} className="flex items-center gap-3 py-3">
              <span className={`h-6 w-6 grid place-items-center rounded-full ${r.done ? 'bg-emerald-500' : 'bg-gold-400'} text-white`}><Icon name={r.done ? 'check' : 'clock'} size={13} /></span>
              <span className={`text-[14px] font-medium ${r.done ? 'text-ink-900' : 'text-ink-400'}`}>{r.t}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-black/[.04] px-3 py-2.5 text-[12px] text-ink-400"><Icon name="bell" size={14} /> We'll notify you the moment a decision is made.</div>
        <ErrorCard message={err} compact className="w-full max-w-sm mt-3" />
        <button onClick={check} disabled={checking} className="btn-primary w-full max-w-sm mt-4 disabled:opacity-60">{checking ? 'Checking…' : 'Check status'}</button>
      </div>
    </CenterLayout>
  )
}

/* 9 — Verified */
export function Verified() {
  const nav = useNavigate()
  return (
    <CenterLayout>
      <StatusBar />
      <div className="flex-1 py-10">
        <ResultScreen tone="green" icon="check" title="You're verified" desc="Calls, live streams and payouts are unlocked.">
          <div className="grid grid-cols-2 gap-3">
            {[['shield-check', 'Verified', 'Status'], ['card', 'Enabled', 'Payouts']].map(([i, a, b]) => (
              <div key={b} className="card p-3.5 text-left"><Icon name={i} size={18} className="text-emerald-600" /><p className="text-[15px] font-bold text-ink-900 mt-1">{a}</p><p className="text-[12px] text-ink-400">{b}</p></div>
            ))}
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700 flex items-center gap-2"><Icon name="sparkles" size={14} /> New hosts get boosted visibility for 48 hours.</div>
          <button onClick={() => nav('/home')} className="btn-primary">Go to dashboard</button>
        </ResultScreen>
      </div>
    </CenterLayout>
  )
}

/* 10 — Rejected */
export function Rejected() {
  const nav = useNavigate()
  const [reason, setReason] = useState('')
  const [reviewedAt, setReviewedAt] = useState('')
  useEffect(() => {
    profileApi.getKycStatus().then((k) => {
      setReason(k.rejectionReason || '')
      setReviewedAt(k.reviewedAt || k.updatedAt || '')
    }).catch(() => {})
  }, [])
  const reviewedLabel = reviewedAt
    ? new Date(reviewedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
    : ''
  return (
    <CenterLayout>
      <StatusBar />
      <div className="flex-1 py-10">
        <ResultScreen tone="rose" icon="x" title="Verification rejected" desc={reviewedLabel ? `Reviewed on ${reviewedLabel}` : undefined}>
          <div className="rounded-xl bg-rose-50 px-3.5 py-3 text-left">
            <p className="text-[14px] font-semibold text-rose-500 flex items-center gap-2"><Icon name="alert" size={15} /> {reason || 'Documents did not pass review'}</p>
            <p className="text-[12px] text-rose-400 mt-1">Retake in bright light with the full document in frame.</p>
          </div>
          <button onClick={() => nav('/onboarding/documents')} className="btn-primary">Resubmit documents</button>
          <button onClick={() => nav('/settings/help')} className="btn-outline"><Icon name="help" size={16} /> Contact support</button>
        </ResultScreen>
      </div>
    </CenterLayout>
  )
}
