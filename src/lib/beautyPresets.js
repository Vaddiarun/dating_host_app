/**
 * Data-driven Beauty Effects presets — each is a config object, not hardcoded UI/pipeline
 * logic, so a new preset is just a new entry here. `parameters` are the effect's strength at
 * 100% intensity (0..1 each); the pipeline (beautyFilter.js) scales them by the user's chosen
 * intensity slider (0-100%) and composites them with the separate Custom sliders.
 *
 * Every parameter here is either a face-region *strength* (how much smoothing/glow/etc.) or a
 * brightness/contrast/warmth *offset that is symmetric around zero* — none of them encode a
 * fixed skin-tone target. See beautyFilter.js's header for the full guardrail this was built
 * around.
 */
export const BEAUTY_PRESETS = [
  {
    id: 'none',
    name: 'Original',
    icon: '⭕',
    description: 'No preset applied',
    parameters: {},
  },
  {
    id: 'recover',
    name: 'Recover',
    icon: '🌤️',
    description: 'Balances harsh shadows/highlights, restores natural exposure',
    parameters: { brightness: 0.12, shadowLift: 0.18, contrast: -0.04 },
  },
  {
    id: 'fine_smooth',
    name: 'Fine Smooth',
    icon: '🧴',
    description: 'Subtle skin smoothing that keeps natural texture',
    parameters: { smoothing: 0.32, texturePreservation: 0.82 },
  },
  {
    id: 'acne_removal',
    name: 'Acne Removal',
    icon: '🩹',
    description: 'Fine-detail smoothing tuned for small blemish-scale marks',
    parameters: { blemish: 0.55, smoothing: 0.12, texturePreservation: 0.78 },
  },
  {
    id: 'complexion_enhance',
    name: 'Complexion Enhance',
    icon: '💡',
    description: 'Evens out lighting, adds a healthy glow, keeps your own skin tone',
    parameters: { glow: 0.42, brightness: 0.08, saturation: 0.04, smoothing: 0.14 },
  },
  {
    id: 'ruddy',
    name: 'Ruddy',
    icon: '🌸',
    description: 'A natural warmth/blush on the cheeks',
    parameters: { ruddy: 0.45, warmth: 0.08 },
  },
  {
    id: 'clarify',
    name: 'Clarify',
    icon: '🔍',
    description: 'Local contrast and detail, without losing natural texture',
    parameters: { clarity: 0.4, contrast: 0.06 },
  },
  {
    id: 'natural_glow',
    name: 'Natural Glow',
    icon: '🌟',
    description: 'Soft highlight/luminance lift',
    parameters: { glow: 0.5, brightness: 0.05 },
  },
  {
    id: 'brightness',
    name: 'Brightness',
    icon: '☀️',
    description: 'Face-only brightness lift — background is untouched',
    parameters: { brightness: 0.22 },
  },
  {
    id: 'skin_texture',
    name: 'Skin Texture',
    icon: '🧵',
    description: 'Edge-aware smoothing with adjustable detail retention',
    parameters: { smoothing: 0.26, texturePreservation: 0.9, blemish: 0.15 },
  },
  {
    id: 'eye_enhance',
    name: 'Eye Enhance',
    icon: '👁️',
    description: 'Slightly brighter, clearer eyes — shape is never altered',
    parameters: { eyeEnhance: 0.45 },
  },
]

export function getPreset(id) {
  return BEAUTY_PRESETS.find((p) => p.id === id) || BEAUTY_PRESETS[0]
}
