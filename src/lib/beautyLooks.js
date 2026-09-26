import { DEFAULT_CUSTOM } from './beautyFilter.js'

/**
 * Ready-made one-tap looks — each is just a combination of the three existing systems (a Beauty
 * Effects preset + intensity, a Filter, and Custom slider offsets), so picking one sets all
 * three at once and the host can still fine-tune any of them afterwards. Adding a look is just
 * adding an entry; nothing here touches the pipeline itself, so every look inherits the same
 * skin-tone-neutral guardrail described in beautyFilter.js.
 */
const look = (id, name, icon, swatch, preset, intensity, filterId = 'none', custom = {}) => ({
  id, name, icon, swatch,
  settings: { enabled: true, preset: { id: preset, intensity }, filterId, custom: { ...DEFAULT_CUSTOM, ...custom } },
})

export const BEAUTY_LOOKS = [
  { id: 'off', name: 'Off', icon: '⭕', swatch: 'linear-gradient(135deg,#e5e7eb,#9ca3af)', settings: { enabled: false } },
  look('natural', 'Natural', '🌿', 'linear-gradient(135deg,#fde2c8,#e7b98f)', 'fine_smooth', 40),
  look('glow', 'Glow', '✨', 'linear-gradient(135deg,#ffe9a8,#ffb86b)', 'natural_glow', 55, 'warm'),
  look('soft_glam', 'Soft Glam', '💄', 'linear-gradient(135deg,#ffd1dc,#e89ab0)', 'complexion_enhance', 65, 'none', { brightness: 3, vibrance: 6 }),
  look('blush', 'Blush', '🌸', 'linear-gradient(135deg,#ffc2c7,#f28b9b)', 'ruddy', 55, 'warm'),
  look('fresh', 'Fresh', '💧', 'linear-gradient(135deg,#cdefff,#7cc4f0)', 'recover', 50, 'cool', { vibrance: 8 }),
  look('clear_skin', 'Clear Skin', '🩹', 'linear-gradient(135deg,#f5e6da,#d9b8a0)', 'acne_removal', 60),
  look('bright_eyes', 'Bright Eyes', '👁️', 'linear-gradient(135deg,#d9f2ff,#9fb8ff)', 'eye_enhance', 55, 'none', { contrast: 6 }),
  look('low_light', 'Low Light', '🌙', 'linear-gradient(135deg,#5b4b8a,#2b2156)', 'brightness', 70, 'none', { exposure: 14, shadows: 16 }),
  look('cinematic', 'Cinematic', '🎬', 'linear-gradient(135deg,#3d5a73,#1b2a38)', 'clarify', 40, 'cinematic'),
  look('vintage', 'Vintage', '📷', 'linear-gradient(135deg,#e8cfa4,#b08a5a)', 'fine_smooth', 30, 'vintage'),
  look('mono', 'Mono', '🖤', 'linear-gradient(135deg,#d4d4d4,#404040)', 'skin_texture', 35, 'bw'),
]

/** The look the current settings exactly match, if any — so the matching tile shows as active,
 * and stops showing as active as soon as the host tweaks something away from it. */
export function matchLook(settings) {
  if (!settings.enabled) return 'off'
  return BEAUTY_LOOKS.find((l) => {
    const s = l.settings
    if (!s.enabled) return false
    return s.preset.id === settings.preset.id
      && s.preset.intensity === settings.preset.intensity
      && s.filterId === settings.filterId
      && Object.keys(s.custom).every((k) => s.custom[k] === settings.custom[k])
  })?.id ?? null
}
