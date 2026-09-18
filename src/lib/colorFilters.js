/**
 * The third, separate category from your spec: artistic/color grading ("Filter"), distinct
 * from Beauty Effects (face-aware) and Custom (manual sliders). These apply to the whole
 * frame — that's the point of a color-grade filter — via a composed CSS filter string plus an
 * optional tint overlay, same technique real camera apps use for a "look" pack.
 */
export const COLOR_FILTERS = [
  { id: 'none', name: 'Original', css: '', tint: null },
  { id: 'warm', name: 'Warm', css: 'saturate(1.08)', tint: 'rgba(255,170,90,0.10)' },
  { id: 'cool', name: 'Cool', css: 'saturate(1.05)', tint: 'rgba(100,160,255,0.10)' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(0.22) saturate(0.85) contrast(0.95)', tint: 'rgba(200,150,90,0.08)' },
  { id: 'cinematic', name: 'Cinematic', css: 'contrast(1.12) saturate(0.92) brightness(0.97)', tint: 'rgba(20,40,60,0.10)' },
  { id: 'bw', name: 'B&W', css: 'grayscale(1) contrast(1.08)', tint: null },
  { id: 'fade', name: 'Fade', css: 'contrast(0.85) saturate(0.8) brightness(1.05)', tint: 'rgba(255,255,255,0.08)' },
]

export function getColorFilter(id) {
  return COLOR_FILTERS.find((f) => f.id === id) || COLOR_FILTERS[0]
}
