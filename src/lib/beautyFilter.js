// Real-time Beauty Effects pipeline — face-aware skin/eye/cheek processing (Beauty Effects),
// a separate whole-frame Custom adjustment pass, and a separate whole-frame color-grade Filter
// pass, composited together every frame. Built on Canvas2D (hardware-accelerated by the
// browser's own compositor) rather than hand-written WebGL/GLSL — see the chat message this
// shipped with for why that tradeoff was made deliberately, not by default.
//
// Deliberate, hard guardrail, unchanged from earlier versions of this file: every adjustment
// here reads only user-chosen slider values and face LANDMARK GEOMETRY (where the eyes/lips/
// cheeks/face boundary are). Nothing in this pipeline inspects, classifies, or branches on
// pixel color or skin tone — there is no "detected skin tone" value anywhere, so there is no
// way for it to treat different skin tones differently. Brightness/contrast/warmth/temperature
// all move symmetrically around a neutral midpoint (0 = unchanged) rather than toward any fixed
// target appearance, for every face, identically.

import { detectFaces, skinMaskPath, eyeMaskPath, cheekMaskPath } from './faceMesh.js'
import { getPreset } from './beautyPresets.js'
import { getColorFilter } from './colorFilters.js'

const SETTINGS_KEY = 'triloplan_host_beauty_settings'

export const DEFAULT_CUSTOM = {
  exposure: 0, brightness: 0, contrast: 0, saturation: 0, temperature: 0,
  tint: 0, highlights: 0, shadows: 0, sharpness: 0, vibrance: 0,
}

export const DEFAULT_BEAUTY_SETTINGS = {
  enabled: false,
  preset: { id: 'none', intensity: 35 }, // Beauty Effects — face-aware
  filterId: 'none',                       // Filter — whole-frame color grade
  custom: { ...DEFAULT_CUSTOM },          // Custom — whole-frame manual adjustments
}

export function getBeautySettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return structuredClone(DEFAULT_BEAUTY_SETTINGS)
    const parsed = JSON.parse(raw)
    return {
      ...structuredClone(DEFAULT_BEAUTY_SETTINGS),
      ...parsed,
      preset: { ...DEFAULT_BEAUTY_SETTINGS.preset, ...parsed.preset },
      custom: { ...DEFAULT_CUSTOM, ...parsed.custom },
    }
  } catch {
    return structuredClone(DEFAULT_BEAUTY_SETTINGS)
  }
}

export function setBeautySettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

/** CSS-filter approximation, for a plain preview `<video>` that isn't published or recorded
 * (GoLive's setup screen) — cheaper than running the full pipeline just to glance at yourself
 * before the real broadcast/call opens its own processed camera. Not face-aware. */
export function filterForIntensity(level) {
  const l = Math.max(0, Math.min(1, level))
  return `blur(${(l * 1.2).toFixed(2)}px) brightness(${(1 + l * 0.06).toFixed(3)}) contrast(${(1 - l * 0.03).toFixed(3)}) saturate(${(1 + l * 0.05).toFixed(3)})`
}

const FACE_DETECT_INTERVAL_MS = 120 // ~8/s face-landmark updates; the draw loop itself still
// runs at full rAF rate reusing whatever masks this last found — decoupling detection from
// rendering (per the "don't run landmarks at render frequency" requirement) is what keeps this
// affordable on a phone instead of a per-frame ML-inference bottleneck.
const FEATHER_PX = 5

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function drawFeatheredMask(ctx, canvas, paths, evenodd, featherPx) {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!paths.length) return
  ctx.save()
  ctx.filter = featherPx > 0 ? `blur(${featherPx}px)` : 'none'
  ctx.fillStyle = '#fff'
  for (const path of paths) ctx.fill(path, evenodd ? 'evenodd' : 'nonzero')
  ctx.restore()
}

/** Composites `layerCanvas` (a full-frame effect result) onto `destCtx`, masked by
 * `maskCanvas`'s (feathered) alpha — this is what makes the effect follow real face geometry
 * with soft edges instead of a visible boundary. */
function applyMaskedLayer(destCtx, layerCanvas, maskCanvas) {
  const layerCtx = layerCanvas.getContext('2d')
  layerCtx.globalCompositeOperation = 'destination-in'
  layerCtx.drawImage(maskCanvas, 0, 0)
  layerCtx.globalCompositeOperation = 'source-over'
  destCtx.drawImage(layerCanvas, 0, 0)
}

/**
 * Opens a camera (+ mic, optional) and returns a live-processed MediaStream running the full
 * Beauty Effects + Filter + Custom pipeline, plus controls to live-update settings, switch
 * camera, capture a still frame, and tear everything down. Used both for a real preview and as
 * the source for an Agora custom video track (calls/broadcast) — same implementation either way.
 */
export async function openBeautyCamera({ facingMode = 'user', settings, audio = true } = {}) {
  let current = { ...structuredClone(DEFAULT_BEAUTY_SETTINGS), ...settings }
  let rawStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio })
  let currentFacingMode = facingMode

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = rawStream
  await video.play().catch(() => {})

  // base = raw frame + Beauty Effects face pass; output = + Custom + Filter (the two
  // whole-frame passes). Kept separate so Beauty Effects never has to know about Custom/Filter
  // and vice versa, matching the "completely separate systems, composited at render time"
  // requirement.
  let w = video.videoWidth || 640
  let h = video.videoHeight || 480
  const baseCanvas = makeCanvas(w, h)
  const baseCtx = baseCanvas.getContext('2d')
  const outputCanvas = makeCanvas(w, h)
  const outCtx = outputCanvas.getContext('2d')
  const blurCanvas = makeCanvas(w, h)
  const blurCtx = blurCanvas.getContext('2d')
  const fineBlurCanvas = makeCanvas(w, h)
  const fineBlurCtx = fineBlurCanvas.getContext('2d')
  const layerCanvas = makeCanvas(w, h)
  const layerCtx = layerCanvas.getContext('2d')
  const maskCanvas = makeCanvas(w, h)
  const maskCtx = maskCanvas.getContext('2d')
  const eyeLayerCanvas = makeCanvas(w, h)
  const eyeLayerCtx = eyeLayerCanvas.getContext('2d')
  const eyeMaskCanvas = makeCanvas(w, h)
  const eyeMaskCtx = eyeMaskCanvas.getContext('2d')
  const cheekLayerCanvas = makeCanvas(w, h)
  const cheekLayerCtx = cheekLayerCanvas.getContext('2d')
  const cheekMaskCanvas = makeCanvas(w, h)
  const cheekMaskCtx = cheekMaskCanvas.getContext('2d')

  const resize = () => {
    w = video.videoWidth || 640
    h = video.videoHeight || 480
    for (const c of [baseCanvas, outputCanvas, blurCanvas, fineBlurCanvas, layerCanvas, maskCanvas, eyeLayerCanvas, eyeMaskCanvas, cheekLayerCanvas, cheekMaskCanvas]) {
      c.width = w
      c.height = h
    }
  }
  video.addEventListener('loadedmetadata', resize)
  resize()

  let running = true
  let raf = null
  let faceDetectBroken = false
  let detecting = false
  let lastDetectAt = 0
  let skinPaths = []
  let eyePaths = []
  let cheekPaths = []

  const maybeDetectFaces = () => {
    if (!current.enabled || faceDetectBroken || detecting) return
    const now = performance.now()
    if (now - lastDetectAt < FACE_DETECT_INTERVAL_MS) return
    if (!video.videoWidth) return
    detecting = true
    lastDetectAt = now
    detectFaces(video, now)
      .then((faces) => {
        skinPaths = faces.map((lm) => skinMaskPath(lm, w, h))
        eyePaths = faces.map((lm) => eyeMaskPath(lm, w, h))
        cheekPaths = faces.map((lm) => cheekMaskPath(lm, w, h))
      })
      .catch(() => {
        // Model failed to load (offline, blocked CDN, unsupported browser, ...) — Beauty
        // Effects simply won't have a face to target until this succeeds again; Custom/Filter
        // are unaffected since they never depended on face detection.
        faceDetectBroken = true
        skinPaths = []
        eyePaths = []
        cheekPaths = []
      })
      .finally(() => { detecting = false })
  }

  const draw = () => {
    if (!running) return
    if (video.videoWidth) {
      maybeDetectFaces()

      // 1) base frame
      baseCtx.filter = 'none'
      baseCtx.drawImage(video, 0, 0, w, h)

      // 2) Beauty Effects — face-aware, only when a preset is chosen and faces are found
      const preset = getPreset(current.preset.id)
      const rawK = current.preset.intensity / 100
      // A straight linear ramp made 30-40% (the default range) look nearly identical to 0% —
      // per-effect multipliers below were also stacked on top of already-modest preset base
      // values, so the *real* strength at default intensity was closer to 3-8% opacity, not
      // visible on real video at all. A concave curve keeps 0% truly "Original image" (as
      // specified) and 100% at full strength, but front-loads the middle of the range so 35%
      // reads as a real, visible "natural enhancement" instead of nothing.
      const pk = Math.pow(rawK, 0.55)
      const p = preset.parameters
      if (current.enabled && preset.id !== 'none' && pk > 0 && skinPaths.length) {
        drawFeatheredMask(maskCtx, maskCanvas, skinPaths, true, FEATHER_PX)

        layerCtx.clearRect(0, 0, w, h)
        const bAdj = 1 + (p.brightness || 0) * pk * 1.6
        const cAdj = 1 + (p.contrast || 0) * pk * 1.4
        const sAdj = 1 + (p.saturation || 0) * pk * 1.6
        layerCtx.filter = `brightness(${bAdj}) contrast(${cAdj}) saturate(${sAdj})`
        layerCtx.drawImage(video, 0, 0, w, h)
        layerCtx.filter = 'none'

        if (p.shadowLift) {
          layerCtx.globalCompositeOperation = 'screen'
          layerCtx.fillStyle = `rgba(255,255,255,${Math.min(0.55, p.shadowLift * pk * 0.8)})`
          layerCtx.fillRect(0, 0, w, h)
          layerCtx.globalCompositeOperation = 'source-over'
        }

        // Smoothing — a softly blurred copy blended back over the skin mask only. This is the
        // browser-friendly stand-in for an edge-preserving/bilateral blur: cheap, and the
        // texture-preservation slider controls how much survives. Blur radius and blend alpha
        // both scale with intensity now (previously only alpha did, capping out far too subtle).
        if (p.smoothing) {
          const texPres = p.texturePreservation ?? 0.8
          const blurPx = (4 + 6 * pk) * (1 - texPres * 0.25)
          blurCtx.filter = `blur(${blurPx.toFixed(2)}px)`
          blurCtx.drawImage(video, 0, 0, w, h)
          layerCtx.globalAlpha = Math.min(1, p.smoothing * pk * 2.2)
          layerCtx.drawImage(blurCanvas, 0, 0)
          layerCtx.globalAlpha = 1
        }
        // "Acne Removal"/"Skin Texture" fine-detail pass — a smaller-radius blur blended at
        // low strength. Honest limitation: this is texture-scale smoothing, not real blemish
        // detection/classification, so it can't specifically distinguish a blemish from a mole
        // the way a dedicated inpainting model would — it treats all small-scale detail the
        // same, which in practice softens both a little rather than "removing" one precisely.
        if (p.blemish) {
          fineBlurCtx.filter = `blur(${(2 + 2.5 * pk).toFixed(2)}px)`
          fineBlurCtx.drawImage(video, 0, 0, w, h)
          layerCtx.globalAlpha = Math.min(1, p.blemish * pk * 2)
          layerCtx.drawImage(fineBlurCanvas, 0, 0)
          layerCtx.globalAlpha = 1
        }
        if (p.glow) {
          layerCtx.globalCompositeOperation = 'soft-light'
          layerCtx.fillStyle = `rgba(255,255,255,${Math.min(0.85, p.glow * pk * 1.6)})`
          layerCtx.fillRect(0, 0, w, h)
          layerCtx.globalCompositeOperation = 'source-over'
        }
        if (p.warmth) {
          layerCtx.globalCompositeOperation = 'overlay'
          layerCtx.fillStyle = `rgba(255,176,90,${Math.min(0.6, p.warmth * pk * 0.9)})`
          layerCtx.fillRect(0, 0, w, h)
          layerCtx.globalCompositeOperation = 'source-over'
        }
        if (p.clarity) {
          layerCtx.globalCompositeOperation = 'overlay'
          layerCtx.globalAlpha = Math.min(0.7, p.clarity * pk * 1.1)
          layerCtx.drawImage(video, 0, 0, w, h)
          layerCtx.globalAlpha = 1
          layerCtx.globalCompositeOperation = 'source-over'
        }

        applyMaskedLayer(baseCtx, layerCanvas, maskCanvas)

        if (p.ruddy && cheekPaths.length) {
          drawFeatheredMask(cheekMaskCtx, cheekMaskCanvas, cheekPaths, false, FEATHER_PX)
          cheekLayerCtx.clearRect(0, 0, w, h)
          cheekLayerCtx.globalCompositeOperation = 'soft-light'
          cheekLayerCtx.fillStyle = `rgba(230,90,90,${Math.min(0.75, p.ruddy * pk * 1.4)})`
          cheekLayerCtx.fillRect(0, 0, w, h)
          cheekLayerCtx.globalCompositeOperation = 'source-over'
          applyMaskedLayer(baseCtx, cheekLayerCanvas, cheekMaskCanvas)
        }

        if (p.eyeEnhance && eyePaths.length) {
          drawFeatheredMask(eyeMaskCtx, eyeMaskCanvas, eyePaths, false, FEATHER_PX * 0.6)
          eyeLayerCtx.clearRect(0, 0, w, h)
          eyeLayerCtx.filter = `brightness(${1 + p.eyeEnhance * pk * 0.5}) contrast(${1 + p.eyeEnhance * pk * 0.35}) saturate(${1 + p.eyeEnhance * pk * 0.3})`
          eyeLayerCtx.drawImage(video, 0, 0, w, h)
          eyeLayerCtx.filter = 'none'
          applyMaskedLayer(baseCtx, eyeLayerCanvas, eyeMaskCanvas)
        }
      }

      // 3) Custom — whole-frame, independent of Beauty Effects. brightness/contrast/
      // saturation/vibrance/exposure are true per-draw filter adjustments; temperature/tint/
      // highlights/shadows are blend-mode overlay approximations (a real per-channel tone
      // curve needs per-pixel access, which would mean reading back ImageData every frame —
      // exactly the "expensive CPU work per frame" the brief asked to avoid). sharpness is
      // folded into a small extra contrast lift for the same reason: a true unsharp mask is a
      // per-pixel convolution.
      const c = current.custom
      const nb = 1 + (c.brightness / 50) * 0.2 + (c.exposure / 50) * 0.25
      const nc = 1 + (c.contrast / 50) * 0.18 + (c.sharpness / 50) * 0.06
      const ns = 1 + (c.saturation / 50) * 0.25 + (c.vibrance / 50) * 0.15
      outCtx.filter = `brightness(${nb}) contrast(${nc}) saturate(${ns})`
      outCtx.drawImage(baseCanvas, 0, 0)
      outCtx.filter = 'none'

      if (c.temperature !== 0) {
        outCtx.globalCompositeOperation = 'overlay'
        const a = (Math.abs(c.temperature) / 50) * 0.2
        outCtx.fillStyle = c.temperature > 0 ? `rgba(255,176,90,${a})` : `rgba(90,150,255,${a})`
        outCtx.fillRect(0, 0, w, h)
        outCtx.globalCompositeOperation = 'source-over'
      }
      if (c.tint !== 0) {
        outCtx.globalCompositeOperation = 'overlay'
        const a = (Math.abs(c.tint) / 50) * 0.16
        outCtx.fillStyle = c.tint > 0 ? `rgba(230,120,220,${a})` : `rgba(120,200,140,${a})`
        outCtx.fillRect(0, 0, w, h)
        outCtx.globalCompositeOperation = 'source-over'
      }
      if (c.highlights !== 0) {
        outCtx.globalCompositeOperation = c.highlights > 0 ? 'screen' : 'multiply'
        const a = (Math.abs(c.highlights) / 50) * 0.16
        outCtx.fillStyle = c.highlights > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`
        outCtx.fillRect(0, 0, w, h)
        outCtx.globalCompositeOperation = 'source-over'
      }
      if (c.shadows !== 0) {
        outCtx.globalCompositeOperation = c.shadows > 0 ? 'screen' : 'multiply'
        const a = (Math.abs(c.shadows) / 50) * 0.14
        outCtx.fillStyle = c.shadows > 0 ? `rgba(180,180,180,${a})` : `rgba(40,40,40,${a})`
        outCtx.fillRect(0, 0, w, h)
        outCtx.globalCompositeOperation = 'source-over'
      }

      // 4) Filter — whole-frame color grade, applied last, independent of Beauty Effects/Custom
      const filter = getColorFilter(current.filterId)
      if (filter.id !== 'none') {
        if (filter.css) {
          outCtx.filter = filter.css
          outCtx.drawImage(outputCanvas, 0, 0)
          outCtx.filter = 'none'
        }
        if (filter.tint) {
          outCtx.globalCompositeOperation = 'overlay'
          outCtx.fillStyle = filter.tint
          outCtx.fillRect(0, 0, w, h)
          outCtx.globalCompositeOperation = 'source-over'
        }
      }
    }
    raf = requestAnimationFrame(draw)
  }
  draw()

  const canvasStream = outputCanvas.captureStream(30)
  const videoTrack = canvasStream.getVideoTracks()[0]

  const getAudioTrack = () => rawStream.getAudioTracks()[0] || null

  return {
    get videoTrack() { return videoTrack },
    get audioTrack() { return getAudioTrack() },
    get stream() {
      const s = new MediaStream([videoTrack])
      const at = getAudioTrack()
      if (at) s.addTrack(at)
      return s
    },
    /** The unprocessed camera feed this pipeline is built from — exposed so a before/after
     * preview can show both sides without opening the camera a second time (which risks the
     * same NOT_READABLE device-conflict class of bug fixed elsewhere in this app). */
    get rawStream() { return rawStream },
    /** Live-updates any subset of settings (called on every slider move in the settings
     * screen) — takes effect on the very next drawn frame. */
    updateSettings(next) {
      current = {
        ...current,
        ...next,
        preset: { ...current.preset, ...next.preset },
        custom: { ...current.custom, ...next.custom },
      }
    },
    /** Captures the fully processed frame — Beauty Effects + Custom + Filter exactly as
     * previewed, never the raw camera — as a Blob. */
    captureBlob(type = 'image/jpeg', quality = 0.92) {
      return new Promise((resolve) => outputCanvas.toBlob(resolve, type, quality))
    },
    async switchCamera() {
      const next = currentFacingMode === 'user' ? 'environment' : 'user'
      const newRaw = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: false })
      rawStream.getVideoTracks().forEach((t) => t.stop())
      const oldAudio = getAudioTrack()
      rawStream = oldAudio ? new MediaStream([newRaw.getVideoTracks()[0], oldAudio]) : newRaw
      currentFacingMode = next
      video.srcObject = rawStream
      await video.play().catch(() => {})
      return next
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
      rawStream.getTracks().forEach((t) => t.stop())
      videoTrack.stop()
      video.srcObject = null
    },
  }
}
