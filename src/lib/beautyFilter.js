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

import { detectFaces, skinMaskPath, eyeMaskPath, faceOvalPath, faceWidthNorm, cheekCenters, eyeWidthNorm } from './faceMesh.js'
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

const FACE_DETECT_INTERVAL_MS = 80 // ~12/s face-landmark updates; the draw loop itself still
// runs every video frame reusing (and easing toward) whatever landmarks this last found —
// decoupling detection from rendering is what keeps this affordable on a phone instead of a
// per-frame ML-inference bottleneck.
const FACE_HOLD_MS = 450 // keep using the last landmarks this long after a missed detection,
// so a single dropped detection (motion blur, a hand passing by) doesn't flash the effect off
const PRESENCE_EASE = 0.15 // per-frame ease of the whole effect's strength in/out
const MAX_PROCESS_DIM = 960 // longest side the pipeline renders at — plenty for a call feed,
// and a 1080p camera would otherwise cost ~2.3x the per-frame canvas work for no visible gain
const SCRATCH_SCALE = 0.5 // blurs and masks run on half-size canvases: they're low-frequency by
// nature, so upscaling them back loses nothing visible and each blur costs ~4x less
const FRAME_INTERVAL_MS = 1000 / 31 // don't redraw faster than the camera delivers frames

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

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
  ctx.filter = featherPx > 0 ? `blur(${featherPx.toFixed(1)}px)` : 'none'
  ctx.fillStyle = '#fff'
  for (const path of paths) ctx.fill(path, evenodd ? 'evenodd' : 'nonzero')
  ctx.restore()
}

/** Composites `layerCanvas` (a full-frame effect result) onto `destCtx`, masked by
 * `maskCanvas`'s (feathered, possibly smaller) alpha — this is what makes the effect follow real
 * face geometry with soft edges instead of a visible boundary. */
function applyMaskedLayer(destCtx, layerCanvas, maskCanvas) {
  const layerCtx = layerCanvas.getContext('2d')
  layerCtx.globalCompositeOperation = 'destination-in'
  layerCtx.drawImage(maskCanvas, 0, 0, layerCanvas.width, layerCanvas.height)
  layerCtx.globalCompositeOperation = 'source-over'
  destCtx.drawImage(layerCanvas, 0, 0)
}

function cameraConstraints(facingMode) {
  return { facingMode, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }
}

const BACK_LABEL = /back|rear|environment|world/i
const FRONT_LABEL = /front|user|face|selfie/i

/**
 * Opens the camera facing `facingMode` ('user' | 'environment'), video only. Plain
 * `facingMode: 'environment'` is only a preference — plenty of phones/WebViews quietly hand the
 * front camera back — so this asks for it as `exact` first, then falls back to picking a camera
 * by its label, and finally to any camera other than `avoidDeviceId` (the one being switched
 * away from). Throws if the only camera available is the one being avoided.
 *
 * The caller must release its current camera BEFORE calling this: most Android phones can't
 * have the front and back cameras open at the same time, and the second open fails with
 * NotReadableError — which was the "back camera never comes on" bug.
 */
export async function openCameraFacing(facingMode, avoidDeviceId) {
  const base = cameraConstraints(facingMode)
  const isNew = (stream) => {
    const id = stream.getVideoTracks()[0]?.getSettings?.().deviceId
    return !avoidDeviceId || !id || id !== avoidDeviceId
  }
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { ...base, facingMode: { exact: facingMode } }, audio: false })
    if (isNew(s)) return s
    s.getTracks().forEach((t) => t.stop())
  } catch {
    // OverconstrainedError (desktop webcams report no facingMode) — try by device below
  }
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput' && d.deviceId !== avoidDeviceId)
  const wanted = facingMode === 'environment' ? BACK_LABEL : FRONT_LABEL
  const pick = cams.find((d) => wanted.test(d.label)) || cams[0]
  if (!pick) throw new Error('Only one camera is available on this device.')
  const { facingMode: _ignored, ...rest } = base
  return navigator.mediaDevices.getUserMedia({ video: { ...rest, deviceId: { exact: pick.deviceId } }, audio: false })
}

/**
 * Opens a camera (+ mic, optional) and returns a live-processed MediaStream running the full
 * Beauty Effects + Filter + Custom pipeline, plus controls to live-update settings, switch
 * camera, capture a still frame, and tear everything down. Used both for a real preview and as
 * the source for an Agora custom video track (calls/broadcast) — same implementation either way.
 *
 * Beauty Effects per frame, in order:
 *   1. detail pass (smoothing / blemish) — edge-aware, through a TIGHT skin mask (features cut
 *      out), so eyes, brows, lips and the face outline stay crisp;
 *   2. tone pass (brightness / contrast / warmth / shadow lift / glow / clarity) — through a
 *      WIDE, heavily feathered face mask, so the tone change fades out gradually across the jaw
 *      and hairline instead of leaving a pasted-on face that doesn't match the neck;
 *   3. cheek blush and eye enhance, each through its own soft mask.
 * Every radius and feather scales with the detected face's size, and the whole effect eases in
 * and out with face presence rather than popping.
 */
export async function openBeautyCamera({ facingMode = 'user', settings, audio = true } = {}) {
  let current = { ...structuredClone(DEFAULT_BEAUTY_SETTINGS), ...settings }
  let rawStream = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(facingMode), audio })
  let currentFacingMode = facingMode

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = rawStream
  await video.play().catch(() => {})

  // base = raw frame + Beauty Effects face passes; output = + Custom + Filter (the two
  // whole-frame passes). Kept separate so Beauty Effects never has to know about Custom/Filter
  // and vice versa, matching the "completely separate systems, composited at render time"
  // requirement.
  let w = 640, h = 480, sw = 320, sh = 240
  const full = () => { const c = makeCanvas(w, h); return [c, c.getContext('2d')] }
  const small = () => { const c = makeCanvas(sw, sh); return [c, c.getContext('2d')] }
  const [baseCanvas, baseCtx] = full()
  const [outputCanvas, outCtx] = full()
  const [layerCanvas, layerCtx] = full()
  const [snapCanvas, snapCtx] = full() // a copy of the current stage, since a canvas can't reliably be drawn onto itself
  const [sharpLayerCanvas, sharpLayerCtx] = full()
  const [edgeAwareCanvas, edgeAwareCtx] = full()
  const [accentCanvas, accentCtx] = full() // cheek / eye layers, one at a time
  const [preFilterCanvas, preFilterCtx] = full()
  const [srcSmallCanvas, srcSmallCtx] = small()
  const [blurSmallCanvas, blurSmallCtx] = small()
  const [diffSmallCanvas, diffSmallCtx] = small()
  const [boostSmallCanvas, boostSmallCtx] = small()
  const [alphaSmallCanvas, alphaSmallCtx] = small()
  const [glowSmallCanvas, glowSmallCtx] = small()
  const [skinMaskCanvas, skinMaskCtx] = small()
  const [toneMaskCanvas, toneMaskCtx] = small()
  const [accentMaskCanvas, accentMaskCtx] = small()
  const fullCanvases = [baseCanvas, outputCanvas, layerCanvas, snapCanvas, sharpLayerCanvas, edgeAwareCanvas, accentCanvas, preFilterCanvas]
  const smallCanvases = [srcSmallCanvas, blurSmallCanvas, diffSmallCanvas, boostSmallCanvas, alphaSmallCanvas, glowSmallCanvas, skinMaskCanvas, toneMaskCanvas, accentMaskCanvas]

  const resize = () => {
    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 480
    const scale = Math.min(1, MAX_PROCESS_DIM / Math.max(vw, vh))
    w = Math.round(vw * scale)
    h = Math.round(vh * scale)
    sw = Math.max(1, Math.round(w * SCRATCH_SCALE))
    sh = Math.max(1, Math.round(h * SCRATCH_SCALE))
    for (const c of fullCanvases) { c.width = w; c.height = h }
    for (const c of smallCanvases) { c.width = sw; c.height = sh }
  }
  video.addEventListener('loadedmetadata', resize)
  video.addEventListener('resize', resize) // camera switch / rotation changes the frame size
  resize()

  // Edge-aware smoothing needs to turn a "how much local detail is here" map into an alpha
  // channel, and clarity/sharpness need a real sharpening kernel — Canvas2D can only do either
  // via SVG filters referenced by `ctx.filter = 'url(#id)'`. A standards-defined capability,
  // but not something to assume works everywhere, hence the probe below. Unique ids per camera
  // instance avoid collisions if more than one is ever open at once.
  const uid = Math.random().toString(36).slice(2)
  const lumFilterId = `lum2alpha-${uid}`
  const sharpFilterId = `sharpen-${uid}`
  const svgNS = 'http://www.w3.org/2000/svg'
  const filterSvg = document.createElementNS(svgNS, 'svg')
  filterSvg.setAttribute('width', '0')
  filterSvg.setAttribute('height', '0')
  filterSvg.style.position = 'absolute'
  const lumFilter = document.createElementNS(svgNS, 'filter')
  lumFilter.setAttribute('id', lumFilterId)
  const feLum = document.createElementNS(svgNS, 'feColorMatrix')
  feLum.setAttribute('type', 'luminanceToAlpha')
  lumFilter.appendChild(feLum)
  const sharpFilter = document.createElementNS(svgNS, 'filter')
  sharpFilter.setAttribute('id', sharpFilterId)
  const feSharp = document.createElementNS(svgNS, 'feConvolveMatrix')
  feSharp.setAttribute('order', '3')
  feSharp.setAttribute('kernelMatrix', '0 -0.5 0 -0.5 3 -0.5 0 -0.5 0') // gentle — a full-strength kernel turned pores and freckles into harsh speckle
  feSharp.setAttribute('preserveAlpha', 'true')
  sharpFilter.appendChild(feSharp)
  filterSvg.append(lumFilter, sharpFilter)
  document.body.appendChild(filterSvg)

  // One-time capability probe: a mid-gray square run through a working luminanceToAlpha
  // filter comes out with alpha well below 255; if the browser silently ignores the filter
  // (drawImage still just copies the source through unfiltered), it stays fully opaque. Real
  // failure mode this catches: older Safari / unusual embedded WebViews where the SVG filter
  // reference is accepted but not actually applied.
  let edgeAwareSupported = true
  try {
    const probe = makeCanvas(4, 4)
    const probeCtx = probe.getContext('2d')
    probeCtx.fillStyle = 'rgb(60,60,60)'
    probeCtx.fillRect(0, 0, 4, 4)
    const out = makeCanvas(4, 4)
    const outCtxProbe = out.getContext('2d')
    outCtxProbe.filter = `url(#${lumFilterId})`
    outCtxProbe.drawImage(probe, 0, 0)
    outCtxProbe.filter = 'none'
    const alpha = outCtxProbe.getImageData(1, 1, 1, 1).data[3]
    edgeAwareSupported = alpha < 200
  } catch {
    edgeAwareSupported = false
  }

  /** Frequency-separation-style edge-aware smoothing: a blurred "low frequency" base (tone,
   * blotchiness) with the original sharp image re-composited on top in proportion to how much
   * real local detail there is — |original - blur|, amplified by `gain`, as alpha. Strong edges
   * (face outline, nostrils, hairline) come back fully sharp; fine skin texture comes back
   * partially, so skin looks smoothed rather than plastic. Higher `gain` = more texture kept.
   *
   * The previous version boosted that detail map with `contrast()`, which pivots at mid-gray
   * and so crushed every small difference to zero — all fine texture was discarded, which is
   * exactly the waxy "plastic skin" look. A plain linear gain keeps it proportional instead. */
  const buildEdgeAwareSmoothed = (blurPx, gain) => {
    blurSmallCtx.filter = `blur(${(blurPx * SCRATCH_SCALE).toFixed(1)}px)`
    blurSmallCtx.drawImage(srcSmallCanvas, 0, 0)
    blurSmallCtx.filter = 'none'

    edgeAwareCtx.clearRect(0, 0, w, h)
    edgeAwareCtx.drawImage(blurSmallCanvas, 0, 0, w, h)
    if (!edgeAwareSupported) return edgeAwareCanvas // flat blur only — still correct, just not detail-preserving

    diffSmallCtx.clearRect(0, 0, sw, sh)
    diffSmallCtx.drawImage(blurSmallCanvas, 0, 0)
    diffSmallCtx.globalCompositeOperation = 'difference'
    diffSmallCtx.drawImage(srcSmallCanvas, 0, 0)
    diffSmallCtx.globalCompositeOperation = 'source-over'

    boostSmallCtx.clearRect(0, 0, sw, sh)
    boostSmallCtx.filter = `brightness(${gain.toFixed(2)})`
    boostSmallCtx.drawImage(diffSmallCanvas, 0, 0)
    boostSmallCtx.filter = 'none'

    alphaSmallCtx.clearRect(0, 0, sw, sh)
    alphaSmallCtx.filter = `url(#${lumFilterId})`
    alphaSmallCtx.drawImage(boostSmallCanvas, 0, 0)
    alphaSmallCtx.filter = 'none'

    sharpLayerCtx.clearRect(0, 0, w, h)
    sharpLayerCtx.drawImage(video, 0, 0, w, h)
    sharpLayerCtx.globalCompositeOperation = 'destination-in'
    sharpLayerCtx.drawImage(alphaSmallCanvas, 0, 0, w, h)
    sharpLayerCtx.globalCompositeOperation = 'source-over'

    edgeAwareCtx.drawImage(sharpLayerCanvas, 0, 0)
    return edgeAwareCanvas
  }

  /** Draws `src` sharpened onto `ctx` at `alpha` — a real 3x3 sharpening kernel, blended by
   * alpha to control strength. No-op where SVG canvas filters don't work (see probe above). */
  const drawSharpened = (ctx, src, alpha) => {
    if (!edgeAwareSupported || alpha <= 0) return
    ctx.save()
    ctx.globalAlpha = Math.min(1, alpha)
    ctx.filter = `url(#${sharpFilterId})`
    ctx.drawImage(src, 0, 0, w, h)
    ctx.restore()
  }

  let running = true
  let raf = null
  let lastFrameAt = 0
  let faceDetectBroken = false
  let detecting = false
  let lastDetectAt = 0
  // Detection runs on its own slower interval, but rendering runs every frame — using the raw
  // detected landmarks directly made the mask visibly snap every detection. targetFaces holds
  // the latest raw detection; smoothedFaces eases toward it every rendered frame (faster the
  // further it has to go, so it tracks quick head turns without swimming during small ones).
  let targetFaces = []
  let smoothedFaces = []
  let lastSeenAt = 0
  let presence = 0 // 0..1 — the whole Beauty Effects pass is scaled by this

  const faceEffectsWanted = () => current.enabled && current.preset.id !== 'none'

  const maybeDetectFaces = (now) => {
    if (!faceEffectsWanted() || faceDetectBroken || detecting) return
    if (now - lastDetectAt < FACE_DETECT_INTERVAL_MS) return
    if (!video.videoWidth) return
    detecting = true
    lastDetectAt = now
    detectFaces(video, now)
      .then((faces) => {
        targetFaces = faces
        if (faces.length) lastSeenAt = performance.now()
      })
      .catch(() => {
        // Model failed to load (offline, blocked CDN, unsupported browser, ...) — Beauty
        // Effects simply won't have a face to target until this succeeds again; Custom/Filter
        // are unaffected since they never depended on face detection.
        faceDetectBroken = true
        targetFaces = []
      })
      .finally(() => { detecting = false })
  }

  const updateSmoothedFaces = (now) => {
    if (targetFaces.length) {
      if (smoothedFaces.length !== targetFaces.length) {
        // A face appeared/disappeared — nothing sensible to interpolate from, snap to the new set.
        smoothedFaces = targetFaces.map((face) => face.map((pt) => ({ x: pt.x, y: pt.y })))
      } else {
        for (let i = 0; i < targetFaces.length; i++) {
          const target = targetFaces[i]
          const smoothed = smoothedFaces[i]
          for (let j = 0; j < target.length; j++) {
            const s = smoothed[j]
            if (!s) { smoothed[j] = { x: target[j].x, y: target[j].y }; continue }
            const dx = target[j].x - s.x
            const dy = target[j].y - s.y
            const a = Math.min(1, 0.3 + Math.hypot(dx * w, dy * h) / 25)
            s.x += dx * a
            s.y += dy * a
          }
        }
      }
    }
    // No detection right now: hold the last landmarks briefly, then fade the effect out over
    // them instead of dropping it in one frame.
    const present = smoothedFaces.length > 0 && (targetFaces.length > 0 || now - lastSeenAt < FACE_HOLD_MS)
    presence += ((present ? 1 : 0) - presence) * PRESENCE_EASE
    if (!present && presence < 0.02) { presence = 0; smoothedFaces = [] }
  }

  const drawBeautyEffects = () => {
    const preset = getPreset(current.preset.id)
    // Concave curve: keeps 0% truly "Original" and 100% at full strength, but front-loads the
    // middle of the range so ~35% reads as a visible, natural enhancement.
    const k = Math.pow(current.preset.intensity / 100, 0.55) * presence
    const p = preset.parameters
    if (k <= 0.005 || !smoothedFaces.length) return

    const faceW = Math.max(...smoothedFaces.map(faceWidthNorm)) * w
    const featherSkin = clamp(faceW * 0.035, 2, 24)
    const featherTone = clamp(faceW * 0.14, 8, 90)
    const toSmall = (fn) => smoothedFaces.map((lm) => fn(lm, sw, sh))

    srcSmallCtx.drawImage(video, 0, 0, sw, sh)

    // 1) Detail — smoothing / blemish, through the tight skin mask.
    if (p.smoothing || p.blemish) {
      drawFeatheredMask(skinMaskCtx, skinMaskCanvas, toSmall(skinMaskPath), true, featherSkin * SCRATCH_SCALE)
      layerCtx.clearRect(0, 0, w, h)
      layerCtx.drawImage(baseCanvas, 0, 0)
      if (p.smoothing) {
        const texPres = p.texturePreservation ?? 0.8
        const blurPx = clamp(faceW * (0.012 + 0.016 * k), 2, 16)
        layerCtx.globalAlpha = Math.min(0.92, p.smoothing * k * 2.2)
        layerCtx.drawImage(buildEdgeAwareSmoothed(blurPx, 2.5 + 5 * texPres), 0, 0)
      }
      // "Acne Removal"/"Skin Texture" fine-detail pass — a smaller-radius edge-aware blur.
      // Honest limitation: this is texture-scale smoothing, not real blemish detection, so it
      // softens a mole as much as a spot rather than "removing" one precisely.
      if (p.blemish) {
        const blurPx = clamp(faceW * (0.01 + 0.01 * k), 2, 10)
        layerCtx.globalAlpha = Math.min(0.85, p.blemish * k * 1.6)
        layerCtx.drawImage(buildEdgeAwareSmoothed(blurPx, 3.5), 0, 0)
      }
      layerCtx.globalAlpha = 1
      applyMaskedLayer(baseCtx, layerCanvas, skinMaskCanvas)
    }

    // 2) Tone — through the wide, soft face mask.
    const hasTone = p.brightness || p.contrast || p.saturation || p.shadowLift || p.glow || p.warmth || p.clarity
    if (hasTone) {
      drawFeatheredMask(toneMaskCtx, toneMaskCanvas, toSmall(faceOvalPath), false, featherTone * SCRATCH_SCALE)
      snapCtx.drawImage(baseCanvas, 0, 0)
      if (p.clarity) drawSharpened(snapCtx, baseCanvas, p.clarity * k * 1.1)

      layerCtx.clearRect(0, 0, w, h)
      layerCtx.filter = `brightness(${1 + (p.brightness || 0) * k * 1.1}) contrast(${1 + (p.contrast || 0) * k}) saturate(${1 + (p.saturation || 0) * k * 1.2})`
      layerCtx.drawImage(snapCanvas, 0, 0)
      layerCtx.filter = 'none'

      // Shadow lift: screen-blending the image with itself follows a real lift curve
      // (1-(1-x)²) — darks rise, highlights barely move. The old flat white wash raised
      // everything equally, which is what read as grey fog.
      if (p.shadowLift) {
        layerCtx.globalCompositeOperation = 'screen'
        layerCtx.globalAlpha = Math.min(0.5, p.shadowLift * k * 1.6)
        layerCtx.drawImage(snapCanvas, 0, 0)
        layerCtx.globalAlpha = 1
        layerCtx.globalCompositeOperation = 'source-over'
      }
      // Glow: a soft bloom (blurred, slightly brightened copy screened on top) instead of a
      // flat white soft-light fill — luminous highlights, no loss of contrast.
      if (p.glow) {
        glowSmallCtx.filter = `blur(${(faceW * 0.03 * SCRATCH_SCALE).toFixed(1)}px) brightness(1.06)`
        glowSmallCtx.drawImage(layerCanvas, 0, 0, sw, sh)
        glowSmallCtx.filter = 'none'
        layerCtx.globalCompositeOperation = 'screen'
        layerCtx.globalAlpha = Math.min(0.38, p.glow * k * 0.75)
        layerCtx.drawImage(glowSmallCanvas, 0, 0, w, h)
        layerCtx.globalAlpha = 1
        layerCtx.globalCompositeOperation = 'source-over'
      }
      if (p.warmth) {
        layerCtx.globalCompositeOperation = 'soft-light'
        layerCtx.fillStyle = `rgba(255,170,100,${Math.min(0.28, p.warmth * k * 1.6)})`
        layerCtx.fillRect(0, 0, w, h)
        layerCtx.globalCompositeOperation = 'source-over'
      }
      applyMaskedLayer(baseCtx, layerCanvas, toneMaskCanvas)
    }

    // 3a) Ruddy — radial blush that falls off smoothly to nothing, instead of a feathered disc.
    if (p.ruddy) {
      accentMaskCtx.clearRect(0, 0, sw, sh)
      for (const lm of smoothedFaces) {
        const r = faceWidthNorm(lm) * sw * 0.2
        for (const c of cheekCenters(lm)) {
          const x = c.x * sw, y = c.y * sh
          const g = accentMaskCtx.createRadialGradient(x, y, 0, x, y, r)
          g.addColorStop(0, 'rgba(255,255,255,1)')
          g.addColorStop(0.5, 'rgba(255,255,255,.55)')
          g.addColorStop(1, 'rgba(255,255,255,0)')
          accentMaskCtx.fillStyle = g
          accentMaskCtx.fillRect(x - r, y - r, r * 2, r * 2)
        }
      }
      accentCtx.clearRect(0, 0, w, h)
      accentCtx.drawImage(baseCanvas, 0, 0)
      accentCtx.globalCompositeOperation = 'soft-light'
      accentCtx.fillStyle = `rgba(235,105,120,${Math.min(0.5, p.ruddy * k * 1.1)})`
      accentCtx.fillRect(0, 0, w, h)
      accentCtx.globalCompositeOperation = 'source-over'
      applyMaskedLayer(baseCtx, accentCanvas, accentMaskCanvas)
    }

    // 3b) Eye enhance — subtle brighten + sharpen inside a mask feathered to the eye's own size.
    if (p.eyeEnhance) {
      const eyeW = Math.max(...smoothedFaces.map(eyeWidthNorm)) * w
      drawFeatheredMask(accentMaskCtx, accentMaskCanvas, toSmall(eyeMaskPath), false, clamp(eyeW * 0.18, 1, 10) * SCRATCH_SCALE)
      const e = p.eyeEnhance * k
      accentCtx.clearRect(0, 0, w, h)
      accentCtx.filter = `brightness(${1 + e * 0.28}) contrast(${1 + e * 0.2}) saturate(${1 + e * 0.15})`
      accentCtx.drawImage(baseCanvas, 0, 0)
      accentCtx.filter = 'none'
      snapCtx.drawImage(accentCanvas, 0, 0)
      drawSharpened(accentCtx, snapCanvas, e * 0.9)
      applyMaskedLayer(baseCtx, accentCanvas, accentMaskCanvas)
    }
  }

  const draw = () => {
    if (!running) return
    raf = requestAnimationFrame(draw)
    const now = performance.now()
    if (now - lastFrameAt < FRAME_INTERVAL_MS) return // 60/120Hz screens: skip ticks with no new camera frame
    lastFrameAt = now
    if (!video.videoWidth) return

    maybeDetectFaces(now)
    updateSmoothedFaces(now)

    // 1) base frame
    baseCtx.drawImage(video, 0, 0, w, h)

    // 2) Beauty Effects — face-aware, only when a preset is chosen and faces are found
    if (current.enabled && current.preset.id !== 'none') drawBeautyEffects()

    // 3) Custom — whole-frame, independent of Beauty Effects. brightness/contrast/saturation/
    // vibrance/exposure are real filter adjustments; temperature/tint/highlights/shadows are
    // blend-mode approximations (a true per-channel tone curve needs per-pixel readback every
    // frame — the expensive CPU work this pipeline avoids). Sharpness is a real sharpening
    // kernel where supported (negative values soften).
    // The master toggle turns off every pass, not only Beauty Effects — a call's video always
    // runs through this pipeline (so beauty can be switched on mid-call), which means
    // "disabled" has to be a true pass-through rather than still applying Custom/Filter.
    const c = current.enabled ? current.custom : DEFAULT_CUSTOM
    const nb = 1 + (c.brightness / 50) * 0.2 + (c.exposure / 50) * 0.25
    const nc = 1 + (c.contrast / 50) * 0.18
    const ns = 1 + (c.saturation / 50) * 0.25 + (c.vibrance / 50) * 0.15
    outCtx.filter = `brightness(${nb}) contrast(${nc}) saturate(${ns})`
    outCtx.drawImage(baseCanvas, 0, 0)
    outCtx.filter = 'none'

    if (c.sharpness > 0) {
      snapCtx.drawImage(outputCanvas, 0, 0)
      drawSharpened(outCtx, snapCanvas, (c.sharpness / 50) * 0.8)
    } else if (c.sharpness < 0) {
      snapCtx.drawImage(outputCanvas, 0, 0)
      outCtx.save()
      outCtx.globalAlpha = (-c.sharpness / 50) * 0.8
      outCtx.filter = 'blur(1px)'
      outCtx.drawImage(snapCanvas, 0, 0)
      outCtx.restore()
    }
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
    const filter = getColorFilter(current.enabled ? current.filterId : 'none')
    if (filter.id !== 'none') {
      if (filter.css) {
        // Routed through a separate snapshot canvas — drawing a canvas onto itself in one call
        // can silently misbehave depending on the browser.
        preFilterCtx.drawImage(outputCanvas, 0, 0)
        outCtx.filter = filter.css
        outCtx.drawImage(preFilterCanvas, 0, 0)
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
    /** Flips front <-> back. The output track (what Agora publishes) never changes — only the
     * camera feeding the canvas does — so nothing downstream needs re-attaching. If the other
     * camera can't be opened, the original one is reopened so the stream doesn't go black. */
    async switchCamera() {
      const next = currentFacingMode === 'user' ? 'environment' : 'user'
      const oldTrack = rawStream.getVideoTracks()[0]
      const oldDeviceId = oldTrack?.getSettings?.().deviceId
      const oldAudio = getAudioTrack()
      const attach = (videoStream, facing) => {
        const vt = videoStream.getVideoTracks()[0]
        rawStream = oldAudio ? new MediaStream([vt, oldAudio]) : videoStream
        currentFacingMode = facing
        video.srcObject = rawStream
        return video.play().catch(() => {})
      }
      oldTrack?.stop() // release first — see openCameraFacing
      try {
        await attach(await openCameraFacing(next, oldDeviceId), next)
      } catch (e) {
        await attach(await openCameraFacing(currentFacingMode), currentFacingMode).catch(() => {})
        throw e
      }
      // Fresh camera, fresh geometry — don't ease the old face mask across to the new view.
      targetFaces = []
      smoothedFaces = []
      presence = 0
      return next
    },
    get facingMode() { return currentFacingMode },
    /** How many faces detection currently sees — 0 means Beauty Effects has nothing to apply
     * to yet (no faces found), separate from `enabled`/preset selection. Exposed so this can
     * be surfaced in the UI as a direct diagnostic instead of guessing whether "no visible
     * effect" means "no face found" vs. something else. */
    get faceCount() { return targetFaces.length },
    get edgeAwareSupported() { return edgeAwareSupported },
    stop() {
      running = false
      cancelAnimationFrame(raf)
      rawStream.getTracks().forEach((t) => t.stop())
      videoTrack.stop()
      video.srcObject = null
      filterSvg.remove()
    },
  }
}
