import { useState, useEffect, useRef } from 'react'
import Icon from '../ui/Icon.jsx'
import { StatusBar, TopBar, Toggle, ErrorCard } from '../ui/kit.jsx'
import { CenterLayout } from '../ui/layouts.jsx'
import { BeautyControls } from '../ui/BeautyControls.jsx'
import { getBeautySettings, setBeautySettings, openBeautyCamera } from '../lib/beautyFilter.js'
import { profile as profileApi } from '../api/index.js'
import { errorMessage } from '../lib/errors.js'

/* Three independent, composited systems (see lib/beautyFilter.js for the actual pipeline and
 * the guardrail around skin-tone-neutral, symmetric adjustments):
 *   Beauty Effects — face-aware one-tap presets, each with its own intensity
 *   Filter         — whole-frame color grade, independent of Beauty Effects
 *   Custom         — whole-frame manual sliders, independent of both
 * All three persist together and apply together everywhere the camera opens. */
export function BeautySettings() {
  const initial = getBeautySettings()
  const [settings, setSettings] = useState(initial)
  const [saved, setSaved] = useState(false) // false | 'synced' | 'local'
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [camErr, setCamErr] = useState('')
  const [ready, setReady] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [capturedUrl, setCapturedUrl] = useState('')
  const [faceCount, setFaceCount] = useState(null) // null = not known yet
  const beforeRef = useRef(null)
  const afterRef = useRef(null)
  const camRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    openBeautyCamera({ settings: initial, audio: false })
      .then((cam) => {
        if (cancelled) { cam.stop(); return }
        camRef.current = cam
        if (beforeRef.current) { beforeRef.current.srcObject = cam.rawStream; beforeRef.current.play().catch(() => {}) }
        if (afterRef.current) { afterRef.current.srcObject = cam.stream; afterRef.current.play().catch(() => {}) }
        setReady(true)
      })
      .catch((e) => setCamErr(errorMessage(e, 'Camera unavailable — check permissions.')))
    // Direct diagnostic, not a guess — polls whether face detection is actually finding a
    // face right now, separate from whether a preset is applying visibly.
    const poll = setInterval(() => { if (camRef.current) setFaceCount(camRef.current.faceCount) }, 400)
    return () => {
      cancelled = true
      clearInterval(poll)
      camRef.current?.stop()
      if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch) => {
    setSettings((s) => {
      const next = { ...s, ...patch }
      camRef.current?.updateSettings(patch)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setSaveErr('')
    // Cache locally first — every camera pipeline (calls/live/audition) reads this
    // synchronously, so the new settings apply immediately regardless of whether the sync
    // below succeeds.
    setBeautySettings(settings)
    try {
      await profileApi.updateBeautySettings(settings)
      setSaved('synced')
    } catch (e) {
      // Saved locally either way (see above) — this is a real backend endpoint now, so a
      // failure here means it genuinely didn't reach the server (offline, expired session,
      // etc.), not that nothing happened.
      setSaveErr(errorMessage(e, 'Saved on this device, but could not sync to your account.'))
      setSaved('local')
    } finally {
      setSaving(false)
      setTimeout(() => setSaved(false), 2200)
    }
  }

  const capture = async () => {
    if (!camRef.current) return
    setCapturing(true)
    try {
      const blob = await camRef.current.captureBlob()
      if (capturedUrl) URL.revokeObjectURL(capturedUrl)
      setCapturedUrl(URL.createObjectURL(blob))
    } finally {
      setCapturing(false)
    }
  }

  return (
    <CenterLayout>
      <StatusBar />
      <TopBar title="Beauty filter" />
      <div className="flex-1 overflow-y-auto px-5 lg:px-6 no-scrollbar">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-ink-400 flex-1">Real-time, face-aware processing — detects your face so eyes, lips and hair stay untouched.</p>
          <Toggle on={settings.enabled} onChange={(v) => update({ enabled: v })} />
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-black">
            <video ref={beforeRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            <span className="absolute top-2 left-2 pill bg-black/50 text-white text-[11px]">Before</span>
          </div>
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-black">
            <video ref={afterRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            <span className="absolute top-2 left-2 pill bg-brand-600 text-white text-[11px]">After</span>
            {ready && (
              <span className={`absolute top-2 right-2 pill text-[11px] ${faceCount > 0 ? 'bg-emerald-500/85 text-white' : 'bg-rose-500/85 text-white'}`}>
                {faceCount > 0 ? `${faceCount} face${faceCount > 1 ? 's' : ''} found` : 'No face found'}
              </span>
            )}
            {!ready && !camErr && <div className="absolute inset-0 grid place-items-center bg-black/40"><p className="text-[12px] text-white/80">Starting camera…</p></div>}
            {ready && (
              <button onClick={capture} disabled={capturing} className="absolute bottom-2 right-2 h-8 w-8 grid place-items-center rounded-full bg-white/90 text-ink-900 disabled:opacity-50">
                <Icon name="camera" size={14} />
              </button>
            )}
          </div>
        </div>
        <ErrorCard message={camErr} compact className="mt-2.5" />

        {capturedUrl && (
          <div className="mt-2.5 flex items-center gap-2.5">
            <img src={capturedUrl} alt="Captured preview" className="h-14 w-14 rounded-xl object-cover" style={{ transform: 'scaleX(-1)' }} />
            <p className="text-[11px] text-ink-400 flex-1">Captured with the exact look above — Beauty Effects + Custom + Filter baked in.</p>
          </div>
        )}

        <BeautyControls settings={settings} onChange={update} />

        {saved === 'synced' && (
          <div className="mt-4 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[12px] text-emerald-700 flex items-center gap-2">
            <Icon name="check" size={14} /> Saved to your account — applies everywhere you use the camera, on any device.
          </div>
        )}
        {saved === 'local' && (
          <div className="mt-4 rounded-xl bg-gold-50 px-3.5 py-2.5 text-[12px] text-gold-700 flex items-center gap-2">
            <Icon name="alert" size={14} /> {saveErr}
          </div>
        )}
      </div>

      <div className="p-4"><button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60"><Icon name="check" size={16} /> {saving ? 'Saving…' : 'Save'}</button></div>
    </CenterLayout>
  )
}
