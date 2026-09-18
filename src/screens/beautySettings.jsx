import { useState, useEffect, useRef } from 'react'
import Icon from '../ui/Icon.jsx'
import { StatusBar, TopBar, Toggle, ErrorCard } from '../ui/kit.jsx'
import { CenterLayout } from '../ui/layouts.jsx'
import { getBeautySettings, setBeautySettings, openBeautyCamera, DEFAULT_CUSTOM, DEFAULT_BEAUTY_SETTINGS } from '../lib/beautyFilter.js'
import { BEAUTY_PRESETS } from '../lib/beautyPresets.js'
import { COLOR_FILTERS } from '../lib/colorFilters.js'
import { profile as profileApi } from '../api/index.js'
import { errorMessage } from '../lib/errors.js'

const CUSTOM_SLIDERS = [
  ['exposure', 'Exposure'],
  ['brightness', 'Brightness'],
  ['contrast', 'Contrast'],
  ['saturation', 'Saturation'],
  ['temperature', 'Temperature'],
  ['tint', 'Tint'],
  ['highlights', 'Highlights'],
  ['shadows', 'Shadows'],
  ['sharpness', 'Sharpness'],
  ['vibrance', 'Vibrance'],
]

const TABS = [
  ['effects', 'Beauty Effects'],
  ['filter', 'Filter'],
  ['custom', 'Custom'],
]

/* Three independent, composited systems (see lib/beautyFilter.js for the actual pipeline and
 * the guardrail around skin-tone-neutral, symmetric adjustments):
 *   Beauty Effects — face-aware one-tap presets, each with its own intensity
 *   Filter         — whole-frame color grade, independent of Beauty Effects
 *   Custom         — whole-frame manual sliders, independent of both
 * All three persist together and apply together everywhere the camera opens. */
export function BeautySettings() {
  const initial = getBeautySettings()
  const [settings, setSettings] = useState(initial)
  const [tab, setTab] = useState('effects')
  const [saved, setSaved] = useState(false) // false | 'synced' | 'local'
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [camErr, setCamErr] = useState('')
  const [ready, setReady] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [capturedUrl, setCapturedUrl] = useState('')
  const beforeRef = useRef(null)
  const afterRef = useRef(null)
  const camRef = useRef(null)
  const filterScrollRef = useRef(null)
  // Remembers each preset's own last-used intensity, keyed by preset id — the slider used to
  // be one shared value, so switching from e.g. Ruddy to Clarify kept showing whatever % Ruddy
  // was last left at instead of that preset's own setting.
  const presetIntensitiesRef = useRef({ [initial.preset.id]: initial.preset.intensity })

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
    return () => {
      cancelled = true
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

  const selectPreset = (id) => {
    const intensity = presetIntensitiesRef.current[id] ?? DEFAULT_BEAUTY_SETTINGS.preset.intensity
    update({ preset: { id, intensity } })
  }
  const setPresetIntensity = (intensity) => {
    presetIntensitiesRef.current[settings.preset.id] = intensity
    update({ preset: { ...settings.preset, intensity } })
  }
  const selectFilter = (filterId) => update({ filterId })
  const setCustom = (key, value) => update({ custom: { ...settings.custom, [key]: value } })

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

  const resetCustom = () => update({ custom: { ...DEFAULT_CUSTOM } })

  // Scrolls a carousel by roughly one row's width per tap — an explicit click target
  // alongside the swipe/drag that already works, for anyone who'd rather tap through.
  const scrollCarousel = (ref, dir) => {
    ref.current?.scrollBy({ left: dir * 200, behavior: 'smooth' })
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

        {/* tab strip */}
        <div className="flex gap-1.5 mt-4 rounded-2xl bg-black/5 p-1">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-xl py-2 text-[12.5px] font-bold transition ${tab === id ? 'bg-white text-ink-900 shadow-card' : 'text-ink-400'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'effects' && (
          <div className={`mt-4 ${settings.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
            {settings.preset.id !== 'none' && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-semibold text-ink-500">Intensity</span>
                  <span className="text-[12px] font-bold text-brand-600">{settings.preset.intensity}%</span>
                </div>
                <input type="range" min="0" max="100" value={settings.preset.intensity} onChange={(e) => setPresetIntensity(Number(e.target.value))} className="w-full accent-brand-600" />
              </div>
            )}
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
              {BEAUTY_PRESETS.map((preset) => {
                const active = settings.preset.id === preset.id
                return (
                  <button key={preset.id} onClick={() => selectPreset(preset.id)} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
                    <span className={`grid place-items-center h-14 w-14 rounded-full text-[22px] border-2 ${active ? 'border-brand-600 bg-brand-50' : 'border-black/10 bg-black/[.03]'}`}>
                      {preset.icon}
                    </span>
                    <span className={`text-[11px] font-semibold text-center leading-tight ${active ? 'text-brand-700' : 'text-ink-500'}`}>{preset.name}</span>
                  </button>
                )
              })}
            </div>
            {settings.preset.id !== 'none' && (
              <p className="text-[11.5px] text-ink-400 mt-3">{BEAUTY_PRESETS.find((p) => p.id === settings.preset.id)?.description}</p>
            )}
          </div>
        )}

        {tab === 'filter' && (
          <div className={`mt-4 ${settings.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
            <div className="relative">
              <div ref={filterScrollRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-1 px-1 scroll-smooth">
                {COLOR_FILTERS.map((f) => {
                  const active = settings.filterId === f.id
                  return (
                    <button key={f.id} onClick={() => selectFilter(f.id)} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
                      <span className={`grid place-items-center h-14 w-14 rounded-full border-2 ${active ? 'border-brand-600' : 'border-black/10'}`} style={{ background: f.tint || 'linear-gradient(135deg,#e5e7eb,#d1d5db)' }}>
                        {f.id === 'none' && <Icon name="x" size={16} className="text-ink-400" />}
                      </span>
                      <span className={`text-[11px] font-semibold text-center leading-tight ${active ? 'text-brand-700' : 'text-ink-500'}`}>{f.name}</span>
                    </button>
                  )
                })}
              </div>
              <button onClick={() => scrollCarousel(filterScrollRef, -1)} className="absolute -left-1 top-1/2 -translate-y-1/2 -translate-x-1/2 h-7 w-7 grid place-items-center rounded-full bg-white shadow-card border border-black/10 text-ink-600">
                <Icon name="chevron-left" size={14} />
              </button>
              <button onClick={() => scrollCarousel(filterScrollRef, 1)} className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-1/2 h-7 w-7 grid place-items-center rounded-full bg-white shadow-card border border-black/10 text-ink-600">
                <Icon name="chevron-right" size={14} />
              </button>
            </div>
          </div>
        )}

        {tab === 'custom' && (
          <div className={`mt-4 space-y-4 ${settings.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
            {CUSTOM_SLIDERS.map(([key, label]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-semibold text-ink-500">{label}</span>
                  <span className="text-[12px] font-bold text-ink-900">{settings.custom[key] > 0 ? '+' : ''}{settings.custom[key]}</span>
                </div>
                <input type="range" min="-50" max="50" value={settings.custom[key]} onChange={(e) => setCustom(key, Number(e.target.value))} className="w-full accent-brand-600" />
              </div>
            ))}
            <button onClick={resetCustom} className="text-[12px] font-semibold text-ink-400">Reset custom adjustments</button>
          </div>
        )}

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
