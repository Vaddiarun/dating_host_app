import { useState, useRef } from 'react'
import Icon from './Icon.jsx'
import { DEFAULT_CUSTOM, DEFAULT_BEAUTY_SETTINGS } from '../lib/beautyFilter.js'
import { BEAUTY_PRESETS } from '../lib/beautyPresets.js'
import { COLOR_FILTERS } from '../lib/colorFilters.js'
import { BEAUTY_LOOKS, matchLook } from '../lib/beautyLooks.js'

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
  ['looks', 'Looks'],
  ['effects', 'Effects'],
  ['filter', 'Filter'],
  ['custom', 'Custom'],
]

// Light theme for the Settings screen, dark for the in-call sheet — same controls, same
// behavior, only the colors differ.
const THEMES = {
  light: {
    tabStrip: 'bg-black/5',
    tabActive: 'bg-white text-ink-900 shadow-card',
    tabIdle: 'text-ink-400',
    label: 'text-ink-500',
    labelActive: 'text-brand-700',
    value: 'text-ink-900',
    accentValue: 'text-brand-600',
    muted: 'text-ink-400',
    ring: 'border-black/10',
    ringActive: 'border-brand-600',
    presetBg: 'bg-black/[.03]',
    presetBgActive: 'bg-brand-50',
    arrow: 'bg-white shadow-card border border-black/10 text-ink-600',
  },
  dark: {
    tabStrip: 'bg-white/10',
    tabActive: 'bg-white text-ink-900',
    tabIdle: 'text-white/60',
    label: 'text-white/70',
    labelActive: 'text-white',
    value: 'text-white',
    accentValue: 'text-brand-300',
    muted: 'text-white/50',
    ring: 'border-white/15',
    ringActive: 'border-brand-400',
    presetBg: 'bg-white/5',
    presetBgActive: 'bg-brand-600/30',
    arrow: 'bg-black/60 border border-white/15 text-white',
  },
}

/* The Beauty Effects / Filter / Custom editor, shared by the Settings screen and the in-call
 * sheet so both stay identical. Stateless about the settings themselves — `onChange(patch)`
 * receives a partial settings object, and the parent decides what to do with it (push it to a
 * live camera pipeline, persist it, both). */
export function BeautyControls({ settings, onChange, dark = false, compact = false }) {
  const t = THEMES[dark ? 'dark' : 'light']
  const [tab, setTab] = useState('looks')
  const filterScrollRef = useRef(null)
  // Remembers each preset's own last-used intensity, keyed by preset id — the slider used to
  // be one shared value, so switching from e.g. Ruddy to Clarify kept showing whatever % Ruddy
  // was last left at instead of that preset's own setting.
  const presetIntensitiesRef = useRef({ [settings.preset.id]: settings.preset.intensity })

  // Picking anything switches beauty on — the controls used to be locked until the master
  // toggle was flipped first, which read as "tapping a filter does nothing".
  const apply = (patch) => onChange({ enabled: true, ...patch })

  const selectLook = (lookItem) => {
    if (lookItem.settings.preset) presetIntensitiesRef.current[lookItem.settings.preset.id] = lookItem.settings.preset.intensity
    onChange(lookItem.settings)
  }
  const selectPreset = (id) => {
    const intensity = presetIntensitiesRef.current[id] ?? DEFAULT_BEAUTY_SETTINGS.preset.intensity
    apply({ preset: { id, intensity } })
  }
  const setPresetIntensity = (intensity) => {
    presetIntensitiesRef.current[settings.preset.id] = intensity
    apply({ preset: { ...settings.preset, intensity } })
  }
  const setCustom = (key, value) => apply({ custom: { ...settings.custom, [key]: value } })
  const resetCustom = () => onChange({ custom: { ...DEFAULT_CUSTOM } })
  const activeLook = matchLook(settings)

  // Scrolls a carousel by roughly one row's width per tap — an explicit click target
  // alongside the swipe/drag that already works, for anyone who'd rather tap through.
  const scrollCarousel = (ref, dir) => {
    ref.current?.scrollBy({ left: dir * 200, behavior: 'smooth' })
  }

  // Dimmed (but still tappable) while beauty is off, so it's clear none of it is applied yet.
  const disabledCls = settings.enabled ? '' : 'opacity-50'
  const gap = compact ? 'mt-3' : 'mt-4'

  return (
    <>
      <div className={`flex gap-1.5 ${gap} rounded-2xl p-1 ${t.tabStrip}`}>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-xl py-2 text-[12.5px] font-bold transition ${tab === id ? t.tabActive : t.tabIdle}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'looks' && (
        <div className={`${gap} grid grid-cols-4 gap-x-2 gap-y-3`}>
          {BEAUTY_LOOKS.map((l) => {
            const active = activeLook === l.id
            return (
              <button key={l.id} onClick={() => selectLook(l)} className="flex flex-col items-center gap-1.5">
                <span className={`relative grid place-items-center h-14 w-14 rounded-2xl text-[22px] border-2 transition ${active ? `${t.ringActive} scale-105` : 'border-transparent'}`} style={{ background: l.swatch }}>
                  {l.icon}
                  {active && <span className="absolute -bottom-1 -right-1 h-5 w-5 grid place-items-center rounded-full bg-brand-600 text-white"><Icon name="check" size={11} /></span>}
                </span>
                <span className={`text-[11px] font-semibold text-center leading-tight ${active ? t.labelActive : t.label}`}>{l.name}</span>
              </button>
            )
          })}
        </div>
      )}

      {tab === 'effects' && (
        <div className={`${gap} ${disabledCls}`}>
          {settings.preset.id !== 'none' && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[12px] font-semibold ${t.label}`}>Intensity</span>
                <span className={`text-[12px] font-bold ${t.accentValue}`}>{settings.preset.intensity}%</span>
              </div>
              <input type="range" min="0" max="100" value={settings.preset.intensity} onChange={(e) => setPresetIntensity(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
          )}
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {BEAUTY_PRESETS.map((preset) => {
              const active = settings.preset.id === preset.id
              return (
                <button key={preset.id} onClick={() => selectPreset(preset.id)} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
                  <span className={`grid place-items-center h-14 w-14 rounded-full text-[22px] border-2 ${active ? `${t.ringActive} ${t.presetBgActive}` : `${t.ring} ${t.presetBg}`}`}>
                    {preset.icon}
                  </span>
                  <span className={`text-[11px] font-semibold text-center leading-tight ${active ? t.labelActive : t.label}`}>{preset.name}</span>
                </button>
              )
            })}
          </div>
          {settings.preset.id !== 'none' && !compact && (
            <p className={`text-[11.5px] mt-3 ${t.muted}`}>{BEAUTY_PRESETS.find((p) => p.id === settings.preset.id)?.description}</p>
          )}
        </div>
      )}

      {tab === 'filter' && (
        <div className={`${gap} ${disabledCls}`}>
          <div className="relative">
            <div ref={filterScrollRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-1 px-1 scroll-smooth">
              {COLOR_FILTERS.map((f) => {
                const active = settings.filterId === f.id
                return (
                  <button key={f.id} onClick={() => apply({ filterId: f.id })} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
                    <span className={`grid place-items-center h-14 w-14 rounded-full border-2 ${active ? t.ringActive : t.ring}`} style={{ background: f.tint || 'linear-gradient(135deg,#e5e7eb,#d1d5db)' }}>
                      {f.id === 'none' && <Icon name="x" size={16} className="text-ink-400" />}
                    </span>
                    <span className={`text-[11px] font-semibold text-center leading-tight ${active ? t.labelActive : t.label}`}>{f.name}</span>
                  </button>
                )
              })}
            </div>
            <button onClick={() => scrollCarousel(filterScrollRef, -1)} className={`absolute -left-1 top-1/2 -translate-y-1/2 -translate-x-1/2 h-7 w-7 grid place-items-center rounded-full ${t.arrow}`}>
              <Icon name="chevron-left" size={14} />
            </button>
            <button onClick={() => scrollCarousel(filterScrollRef, 1)} className={`absolute -right-1 top-1/2 -translate-y-1/2 translate-x-1/2 h-7 w-7 grid place-items-center rounded-full ${t.arrow}`}>
              <Icon name="chevron-right" size={14} />
            </button>
          </div>
        </div>
      )}

      {tab === 'custom' && (
        <div className={`${gap} space-y-4 ${disabledCls}`}>
          {CUSTOM_SLIDERS.map(([key, label]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[12px] font-semibold ${t.label}`}>{label}</span>
                <span className={`text-[12px] font-bold ${t.value}`}>{settings.custom[key] > 0 ? '+' : ''}{settings.custom[key]}</span>
              </div>
              <input type="range" min="-50" max="50" value={settings.custom[key]} onChange={(e) => setCustom(key, Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
          ))}
          <button onClick={resetCustom} className={`text-[12px] font-semibold ${t.muted}`}>Reset custom adjustments</button>
        </div>
      )}
    </>
  )
}
