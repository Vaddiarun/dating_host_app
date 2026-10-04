// Real-time Beauty Effects pipeline — WebGL2 renderer.
//
// Same public API as before (getBeautySettings / setBeautySettings / DEFAULT_* /
// filterForIntensity / openCameraFacing / openBeautyCamera), so nothing that imports this file
// needs to change. What changed is where the work runs: every per-pixel pass (edge-aware
// smoothing, tone, blush, eye enhance, Custom sliders, Filter grade, and the new face reshape
// warp) is a GLSL fragment shader on the GPU instead of a stack of Canvas2D composites. That is
// what makes the reshape warp possible at all (Canvas2D can't displace pixels per-pixel), and
// it gives real per-channel math for temperature/tint/highlights/shadows instead of blend-mode
// approximations.
//
// When WebGL2 isn't available (old Safari, some WebViews, blocklisted GPU drivers) or a shader
// fails to compile, openBeautyCamera() transparently falls back to the previous Canvas2D
// pipeline in beautyFilterCanvas2D.js. `camera.stats.renderer` says which one is running.
//
// Guardrail, unchanged: every adjustment reads only user-chosen slider values and face LANDMARK
// GEOMETRY (where the eyes/lips/cheeks/jaw are). Nothing here inspects, classifies, or branches
// on pixel color or skin tone. Tone adjustments move symmetrically around a neutral midpoint
// (0 = unchanged) identically for every face.

import {
  detectFaces, skinMaskPath, eyeMaskPath, faceOvalPath, faceWidthNorm, cheekCenters, eyeWidthNorm,
} from './faceMesh.js'
import { getPreset } from './beautyPresets.js'
import { getColorFilter } from './colorFilters.js'
import {
  openBeautyCamera as openCanvas2DCamera,
  openCameraFacing,
  filterForIntensity,
  setBeautySettings,
  DEFAULT_CUSTOM,
} from './beautyFilterCanvas2D.js'

export { openCameraFacing, filterForIntensity, setBeautySettings, DEFAULT_CUSTOM }

const SETTINGS_KEY = 'triloplan_host_beauty_settings'
const RENDERER_OVERRIDE_KEY = 'triloplan_beauty_renderer' // set to 'canvas2d' to force the fallback

/** Face reshape — 0..100 each, 0 = off. Applied as a geometric warp in the final pass. */
export const DEFAULT_RESHAPE = { faceSlim: 0, eyeEnlarge: 0 }

export const DEFAULT_BEAUTY_SETTINGS = {
  enabled: false,
  preset: { id: 'none', intensity: 35 }, // Beauty Effects — face-aware
  filterId: 'none',                       // Filter — whole-frame color grade
  custom: { ...DEFAULT_CUSTOM },          // Custom — whole-frame manual adjustments
  reshape: { ...DEFAULT_RESHAPE },        // Reshape — face-aware geometry
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
      reshape: { ...DEFAULT_RESHAPE, ...parsed.reshape },
    }
  } catch {
    return structuredClone(DEFAULT_BEAUTY_SETTINGS)
  }
}

// ---------------------------------------------------------------------------------------------
// Tunables (same values the Canvas2D pipeline uses, so the two renderers look alike)

const FACE_DETECT_INTERVAL_MS = 80
const FACE_HOLD_MS = 450
const PRESENCE_EASE = 0.15
// 1280 (not the Canvas2D pipeline's 960): this canvas is the video a call/broadcast sends, so
// at 960 the host went out at ~960x540 while the user sends full 1280x720 — visibly softer on
// the user's side. 1280x720 is still exactly Agora's HD billing ceiling, and the GPU handles it.
const MAX_PROCESS_DIM = 1280
const SCRATCH_SCALE = 0.5
const FRAME_INTERVAL_MS = 1000 / 31
const DETECT_BACKOFF_MAX_MS = 8000

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// A phone held upright gives the camera a portrait picture. Asking it for landscape 1280x720
// made the browser cut a wide strip out of the middle and scale it up, so the other person saw
// a zoomed-in, cropped face. Portrait on upright touch devices; laptops keep 1280x720.
const isUprightTouchDevice = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(orientation: portrait) and (pointer: coarse)').matches

function cameraConstraints(facingMode) {
  const [width, height] = isUprightTouchDevice() ? [720, 1280] : [1280, 720]
  return { facingMode, width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: 30, max: 30 } }
}

// ---------------------------------------------------------------------------------------------
// Shaders

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const COPY_FRAG = `#version 300 es
precision mediump float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex;
void main() { o = texture(uTex, vUv); }`

// 9-tap Gaussian using linear-filtered taps (5 fetches).
const BLUR_FRAG = `#version 300 es
precision mediump float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex;
uniform vec2 uDir;
void main() {
  vec4 c = texture(uTex, vUv) * 0.2270270270;
  c += (texture(uTex, vUv + uDir * 1.3846153846) + texture(uTex, vUv - uDir * 1.3846153846)) * 0.3162162162;
  c += (texture(uTex, vUv + uDir * 3.2307692308) + texture(uTex, vUv - uDir * 3.2307692308)) * 0.0702702703;
  o = c;
}`

// Face-aware Beauty Effects, in unwarped image space.
//   uMask.r = tight skin mask (features cut out)  -> smoothing / blemish
//   uMask.g = wide, soft face-oval mask            -> tone
//   uMask.b = eye mask                             -> eye enhance
//   cheeks are analytic radial falloffs            -> ruddy
const BEAUTY_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uVideo, uBlur, uBlur2, uMask;
uniform vec2 uTexel, uRes;
uniform float uSmooth, uSmoothGain, uBlemish, uBlemishGain;
uniform float uBright, uContrast, uSat, uShadow, uGlow, uWarmth, uClarity, uRuddy, uEye;
uniform int uCheekN;
uniform vec3 uCheeks[4];

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 softLight(vec3 b, vec3 s) {
  vec3 d = mix(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, step(b, vec3(0.25)));
  return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(0.5, s));
}
vec3 screenB(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }

void main() {
  vec3 orig = texture(uVideo, vUv).rgb;
  vec4 m = texture(uMask, vUv);
  vec3 wide = texture(uBlur, vUv).rgb;
  vec3 avg4 = 0.25 * (texture(uVideo, vUv + vec2(uTexel.x, 0.0)).rgb + texture(uVideo, vUv - vec2(uTexel.x, 0.0)).rgb
                    + texture(uVideo, vUv + vec2(0.0, uTexel.y)).rgb + texture(uVideo, vUv - vec2(0.0, uTexel.y)).rgb);
  vec3 col = orig;

  // 1) Detail: frequency-separation style edge-aware smoothing. Local detail |orig - blur|
  // (times a gain) decides how much of the sharp original comes back, so edges stay crisp and
  // fine texture stays partially — smoothed, not plastic.
  if (uSmooth > 0.0 && m.r > 0.001) {
    float keep = clamp(luma(abs(orig - wide)) * uSmoothGain, 0.0, 1.0);
    col = mix(col, mix(wide, orig, keep), uSmooth * m.r);
  }
  if (uBlemish > 0.0 && m.r > 0.001) {
    vec3 fine = texture(uBlur2, vUv).rgb;
    float keep = clamp(luma(abs(orig - fine)) * uBlemishGain, 0.0, 1.0);
    col = mix(col, mix(fine, col, keep), uBlemish * m.r);
  }

  // 2) Tone, through the wide feathered face mask.
  if (m.g > 0.001) {
    vec3 t = col;
    t += 2.0 * uClarity * (orig - avg4);
    t *= 1.0 + uBright;
    t = (t - 0.5) * (1.0 + uContrast) + 0.5;
    t = mix(vec3(luma(t)), t, 1.0 + uSat);
    t = clamp(t, 0.0, 1.0);
    if (uShadow > 0.0) t = mix(t, 1.0 - (1.0 - t) * (1.0 - t), uShadow);
    if (uGlow > 0.0) t = mix(t, screenB(t, clamp(wide * 1.06, 0.0, 1.0)), uGlow);
    if (uWarmth > 0.0) t = mix(t, softLight(t, vec3(1.0, 0.667, 0.392)), uWarmth);
    col = mix(col, clamp(t, 0.0, 1.0), m.g);
  }

  // 3a) Ruddy: radial blush on each cheek.
  if (uRuddy > 0.0) {
    vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;
    float w = 0.0;
    for (int i = 0; i < 4; i++) {
      if (i >= uCheekN) break;
      float d = length(px - uCheeks[i].xy) / uCheeks[i].z;
      w = max(w, d < 0.5 ? mix(1.0, 0.55, d * 2.0) : mix(0.55, 0.0, clamp(d * 2.0 - 1.0, 0.0, 1.0)));
    }
    col = mix(col, softLight(col, vec3(0.922, 0.412, 0.471)), uRuddy * w);
  }

  // 3b) Eye enhance: slight brighten / contrast / saturation + sharpen, inside the eye mask.
  if (uEye > 0.0 && m.b > 0.001) {
    vec3 e = col * (1.0 + uEye * 0.28);
    e = (e - 0.5) * (1.0 + uEye * 0.2) + 0.5;
    e = mix(vec3(luma(e)), e, 1.0 + uEye * 0.15);
    e += 2.0 * 0.9 * uEye * (orig - avg4);
    col = mix(col, clamp(e, 0.0, 1.0), m.b);
  }
  o = vec4(col, 1.0);
}`

// Final pass: reshape warp -> Custom sliders -> Filter grade -> screen.
const FINAL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex;
uniform vec2 uRes, uTexel;
uniform int uSlimN;
uniform vec4 uSlim[16];     // xy = target point (px, y-down), zw = displacement (px)
uniform float uSlimR[16];
uniform int uEyeN;
uniform vec3 uEyes[4];      // xy = eye center (px, y-down), z = radius (px)
uniform float uEyeAmt;
uniform float uGain, uContrast, uSat, uVib, uSharp, uTemp, uTint, uHigh, uShad;
uniform vec3 uF0, uF1, uF2, uFOff;
uniform vec4 uFTint;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 overlayB(vec3 b, vec3 s) {
  return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b));
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 q = p;
  // Face slim: local translation warp — each control point pulls the jaw line toward the face
  // center with a smooth (1 - d^2)^2 falloff, so there is no visible seam.
  for (int i = 0; i < 16; i++) {
    if (i >= uSlimN) break;
    float d = length(p - uSlim[i].xy) / uSlimR[i];
    if (d < 1.0) { float w = 1.0 - d * d; q -= uSlim[i].zw * w * w; }
  }
  // Eye enlarge: radial magnification around each eye, identity at the edge of the radius.
  if (uEyeAmt > 0.0) {
    for (int i = 0; i < 4; i++) {
      if (i >= uEyeN) break;
      vec2 v = q - uEyes[i].xy;
      float d = length(v) / uEyes[i].z;
      if (d < 1.0) q = uEyes[i].xy + v * (1.0 - uEyeAmt * (1.0 - d * d));
    }
  }
  vec2 uv = vec2(q.x / uRes.x, 1.0 - q.y / uRes.y);

  vec3 c = texture(uTex, uv).rgb;
  if (uSharp != 0.0) {
    vec3 avg4 = 0.25 * (texture(uTex, uv + vec2(uTexel.x, 0.0)).rgb + texture(uTex, uv - vec2(uTexel.x, 0.0)).rgb
                      + texture(uTex, uv + vec2(0.0, uTexel.y)).rgb + texture(uTex, uv - vec2(0.0, uTexel.y)).rgb);
    c = uSharp > 0.0 ? c + 2.0 * uSharp * (c - avg4) : mix(c, avg4, -uSharp);
  }
  c *= uGain;
  c = (c - 0.5) * uContrast + 0.5;
  c = mix(vec3(luma(c)), c, uSat);
  if (uVib != 0.0) {
    float s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c = mix(vec3(luma(c)), c, 1.0 + uVib * (1.0 - clamp(s, 0.0, 1.0)));
  }
  c *= vec3(1.0 + 0.10 * uTemp + 0.04 * uTint, 1.0 + 0.02 * uTemp - 0.08 * uTint, 1.0 - 0.10 * uTemp + 0.04 * uTint);
  float l = clamp(luma(c), 0.0, 1.0);
  c += uHigh * 0.25 * smoothstep(0.45, 1.0, l);
  c += uShad * 0.25 * (1.0 - smoothstep(0.0, 0.55, l));
  c = clamp(c, 0.0, 1.0);
  c = clamp(vec3(dot(uF0, c), dot(uF1, c), dot(uF2, c)) + uFOff, 0.0, 1.0);
  if (uFTint.a > 0.0) c = mix(c, overlayB(c, uFTint.rgb), uFTint.a);
  o = vec4(c, 1.0);
}`

// ---------------------------------------------------------------------------------------------
// Filter CSS -> color matrix. Every CSS filter function used in colorFilters.js is defined by the
// spec as a linear color matrix, so the whole chain composes into one 3x3 + offset.

function cssFilterToMatrix(css) {
  let M = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  let off = [0, 0, 0]
  const apply = (A, b = [0, 0, 0]) => {
    const R = new Array(9)
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      R[r * 3 + c] = A[r * 3] * M[c] + A[r * 3 + 1] * M[3 + c] + A[r * 3 + 2] * M[6 + c]
    }
    const o2 = [0, 1, 2].map((r) => A[r * 3] * off[0] + A[r * 3 + 1] * off[1] + A[r * 3 + 2] * off[2] + b[r])
    M = R
    off = o2
  }
  const re = /([a-z-]+)\(\s*([-\d.]+)(%?)\s*\)/g
  let m
  while ((m = re.exec(css || ''))) {
    let v = parseFloat(m[2])
    if (m[3] === '%') v /= 100
    const i = 1 - v
    switch (m[1]) {
      case 'brightness': apply([v, 0, 0, 0, v, 0, 0, 0, v]); break
      case 'contrast': apply([v, 0, 0, 0, v, 0, 0, 0, v], [0.5 - 0.5 * v, 0.5 - 0.5 * v, 0.5 - 0.5 * v]); break
      case 'saturate': apply([
        0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v,
        0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v,
        0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v]); break
      case 'grayscale': apply([
        0.2126 + 0.7874 * i, 0.7152 - 0.7152 * i, 0.0722 - 0.0722 * i,
        0.2126 - 0.2126 * i, 0.7152 + 0.2848 * i, 0.0722 - 0.0722 * i,
        0.2126 - 0.2126 * i, 0.7152 - 0.7152 * i, 0.0722 + 0.9278 * i]); break
      case 'sepia': apply([
        0.393 + 0.607 * i, 0.769 - 0.769 * i, 0.189 - 0.189 * i,
        0.349 - 0.349 * i, 0.686 + 0.314 * i, 0.168 - 0.168 * i,
        0.272 - 0.272 * i, 0.534 - 0.534 * i, 0.131 + 0.869 * i]); break
      default: break // unknown function: ignored rather than breaking the grade
    }
  }
  return { rows: [M.slice(0, 3), M.slice(3, 6), M.slice(6, 9)], off }
}

function parseRgba(str) {
  const m = /rgba?\(([^)]+)\)/.exec(str || '')
  if (!m) return [0, 0, 0, 0]
  const [r, g, b, a = 1] = m[1].split(',').map((s) => parseFloat(s))
  return [r / 255, g / 255, b / 255, a]
}

const filterCache = new Map()
function filterUniforms(id) {
  if (!filterCache.has(id)) {
    const f = getColorFilter(id)
    filterCache.set(id, { ...cssFilterToMatrix(f.css), tint: f.tint ? parseRgba(f.tint) : [0, 0, 0, 0] })
  }
  return filterCache.get(id)
}

// ---------------------------------------------------------------------------------------------
// WebGL2 plumbing

function compile(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s)
    gl.deleteShader(s)
    throw new Error(`Shader compile failed: ${log}`)
  }
  return s
}

function makeProgram(gl, fragSrc) {
  const p = gl.createProgram()
  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc)
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Program link failed: ${gl.getProgramInfoLog(p)}`)
  const loc = new Map()
  return {
    program: p,
    u(name) {
      if (!loc.has(name)) loc.set(name, gl.getUniformLocation(p, name))
      return loc.get(name)
    },
  }
}

function makeTexture(gl, w, h) {
  const t = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  if (w && h) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  return t
}

function makeTarget(gl, w, h) {
  const tex = makeTexture(gl, w, h)
  const fb = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return { tex, fb, w, h }
}

/** Builds every GL resource. Throws if WebGL2 or any shader is unusable. */
function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false, premultipliedAlpha: false, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: true, // captureBlob()/toBlob and captureStream read the last frame
    powerPreference: 'high-performance',
  })
  if (!gl) throw new Error('WebGL2 is not available')
  const programs = {
    copy: makeProgram(gl, COPY_FRAG),
    blur: makeProgram(gl, BLUR_FRAG),
    beauty: makeProgram(gl, BEAUTY_FRAG),
    final: makeProgram(gl, FINAL_FRAG),
  }
  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  gl.disable(gl.DEPTH_TEST)
  gl.disable(gl.BLEND)
  const videoTex = makeTexture(gl)
  const maskTex = makeTexture(gl)
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  const gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
  return { gl, programs, vao, videoTex, maskTex, targets: null, gpu }
}

// ---------------------------------------------------------------------------------------------

function webgl2Wanted(renderer) {
  if (renderer === 'canvas2d') return false
  try { if (localStorage.getItem(RENDERER_OVERRIDE_KEY) === 'canvas2d') return false } catch { /* ignore */ }
  return typeof WebGL2RenderingContext !== 'undefined'
}

/** Wraps the Canvas2D pipeline so it exposes the same `stats`/`renderer` surface. */
async function openFallback(opts, reason) {
  const cam = await openCanvas2DCamera(opts)
  Object.defineProperty(cam, 'renderer', { get: () => 'canvas2d' })
  Object.defineProperty(cam, 'stats', {
    get: () => ({ renderer: 'canvas2d', fallbackReason: reason, faceCount: cam.faceCount, edgeAwareSupported: cam.edgeAwareSupported }),
  })
  if (reason) console.info('[beauty] using Canvas2D renderer:', reason)
  return cam
}

/**
 * Opens a camera (+ mic, optional) and returns a live-processed MediaStream running the full
 * Beauty Effects + Reshape + Custom + Filter pipeline, plus controls to live-update settings,
 * switch camera, capture a still frame, and tear everything down. Used both for previews and as
 * the source for an Agora custom video track (calls/broadcast).
 *
 * Options beyond the original API:
 *   alwaysDetect — run face detection even when no face-aware effect is on (the settings
 *                  screen uses this so its "face found" badge is meaningful at all times)
 *   renderer     — 'canvas2d' forces the fallback renderer
 */
export async function openBeautyCamera(opts = {}) {
  const { facingMode = 'user', settings, audio = true, alwaysDetect = false, renderer } = opts
  if (!webgl2Wanted(renderer)) return openFallback(opts, renderer === 'canvas2d' ? 'forced' : 'WebGL2 not supported')

  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  let R
  try {
    R = createRenderer(canvas)
  } catch (e) {
    return openFallback(opts, e?.message || 'WebGL2 init failed')
  }

  let current = mergeSettings(structuredClone(DEFAULT_BEAUTY_SETTINGS), settings || {})
  let rawStream = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(facingMode), audio })
  let currentFacingMode = facingMode

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = rawStream
  await video.play().catch(() => {})

  // Face masks are rasterized with Canvas2D (Path2D + a Gaussian blur feather — exactly the
  // shapes the old pipeline used) at half resolution, packed into one RGB texture.
  const maskCanvas = document.createElement('canvas')
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: false })

  let w = 640, h = 480, sw = 320, sh = 240
  const resize = () => {
    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 480
    const scale = Math.min(1, MAX_PROCESS_DIM / Math.max(vw, vh))
    const nw = Math.round(vw * scale), nh = Math.round(vh * scale)
    if (nw === w && nh === h && R.targets) return
    w = nw; h = nh
    sw = Math.max(1, Math.round(w * SCRATCH_SCALE))
    sh = Math.max(1, Math.round(h * SCRATCH_SCALE))
    canvas.width = w
    canvas.height = h
    maskCanvas.width = sw
    maskCanvas.height = sh
    buildTargets()
  }
  const buildTargets = () => {
    const { gl } = R
    if (R.targets) for (const t of Object.values(R.targets)) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb) }
    R.targets = {
      down: makeTarget(gl, sw, sh),
      tmp: makeTarget(gl, sw, sh),
      wide: makeTarget(gl, sw, sh),
      fine: makeTarget(gl, sw, sh),
      beauty: makeTarget(gl, w, h),
    }
  }
  video.addEventListener('loadedmetadata', resize)
  video.addEventListener('resize', resize)
  resize()

  // --- GPU context loss: stop drawing, rebuild everything when the browser gives it back.
  let contextLost = false
  const onLost = (e) => { e.preventDefault(); contextLost = true }
  const onRestored = () => {
    try {
      const fresh = createRenderer(canvas)
      Object.assign(R, fresh, { targets: null })
      buildTargets()
      contextLost = false
    } catch { /* stays lost; output freezes on last frame rather than crashing */ }
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  // --- Face tracking (same smoothing/presence model as the Canvas2D pipeline)
  let running = true
  let raf = null
  let lastFrameAt = 0
  let detecting = false
  let lastDetectAt = 0
  let detectErrors = 0
  let detectRetryAt = 0
  let lastDetectError = null
  let detectMs = 0
  let detectState = 'idle' // idle | loading | ok | error
  let targetFaces = []
  let smoothedFaces = []
  let lastSeenAt = 0
  let presence = 0

  const reshapeWanted = () => current.enabled && ((current.reshape?.faceSlim || 0) > 0 || (current.reshape?.eyeEnlarge || 0) > 0)
  const faceEffectsWanted = () => current.enabled && current.preset.id !== 'none'
  const detectionWanted = () => alwaysDetect || faceEffectsWanted() || reshapeWanted()

  const maybeDetectFaces = (now) => {
    if (!detectionWanted() || detecting) return
    if (now < detectRetryAt) return
    if (now - lastDetectAt < FACE_DETECT_INTERVAL_MS) return
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return
    detecting = true
    lastDetectAt = now
    if (detectState === 'idle') detectState = 'loading'
    const t0 = performance.now()
    detectFaces(video, now)
      .then((faces) => {
        detectMs = performance.now() - t0
        detectState = 'ok'
        detectErrors = 0
        targetFaces = faces
        if (faces.length) lastSeenAt = performance.now()
      })
      .catch((e) => {
        // Never permanently disabled: faceMesh.js already reset the landmarker, so back off
        // (0.5s, 1s, 2s … 8s) and try again. Custom/Filter keep working meanwhile.
        detectErrors++
        detectState = 'error'
        lastDetectError = e?.message || String(e)
        detectRetryAt = performance.now() + Math.min(DETECT_BACKOFF_MAX_MS, 250 * 2 ** detectErrors)
        targetFaces = []
        if (detectErrors <= 3) console.warn('[beauty] face detection failed, retrying:', lastDetectError)
      })
      .finally(() => { detecting = false })
  }

  const updateSmoothedFaces = (now) => {
    if (targetFaces.length) {
      if (smoothedFaces.length !== targetFaces.length) {
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
    const present = smoothedFaces.length > 0 && (targetFaces.length > 0 || now - lastSeenAt < FACE_HOLD_MS)
    presence += ((present ? 1 : 0) - presence) * PRESENCE_EASE
    if (!present && presence < 0.02) { presence = 0; smoothedFaces = [] }
  }

  // --- GL helpers
  const drawTo = (target, prog) => {
    const { gl } = R
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null)
    gl.viewport(0, 0, target ? target.w : w, target ? target.h : h)
    gl.useProgram(prog.program)
  }
  const bindTex = (unit, tex, prog, name) => {
    const { gl } = R
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(prog.u(name), unit)
  }
  const tri = () => R.gl.drawArrays(R.gl.TRIANGLES, 0, 3)

  /** Separable Gaussian of `down` into `out`, sigma in full-res px. */
  const blurInto = (out, sigmaFull) => {
    const { gl, programs, targets } = R
    const sigma = Math.max(0.5, sigmaFull * SCRATCH_SCALE)
    let step = (sigma * 2) / 3.23
    const iters = step > 1.6 ? 2 : 1
    step /= Math.sqrt(iters)
    let src = targets.down
    for (let i = 0; i < iters; i++) {
      drawTo(targets.tmp, programs.blur)
      bindTex(0, src.tex, programs.blur, 'uTex')
      gl.uniform2f(programs.blur.u('uDir'), step / sw, 0)
      tri()
      drawTo(out, programs.blur)
      bindTex(0, targets.tmp.tex, programs.blur, 'uTex')
      gl.uniform2f(programs.blur.u('uDir'), 0, step / sh)
      tri()
      src = out
    }
  }

  const drawMasks = (faceW, wantsSkin, wantsTone, wantsEye) => {
    const ctx = maskCtx
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.filter = 'none'
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, sw, sh)
    ctx.globalCompositeOperation = 'lighter' // channels add independently: R skin, G tone, B eyes
    const paths = (fn) => smoothedFaces.map((lm) => fn(lm, sw, sh))
    if (wantsSkin) {
      ctx.filter = `blur(${(clamp(faceW * 0.035, 2, 24) * SCRATCH_SCALE).toFixed(1)}px)`
      ctx.fillStyle = '#f00'
      for (const p of paths(skinMaskPath)) ctx.fill(p, 'evenodd')
    }
    if (wantsTone) {
      ctx.filter = `blur(${(clamp(faceW * 0.14, 8, 90) * SCRATCH_SCALE).toFixed(1)}px)`
      ctx.fillStyle = '#0f0'
      for (const p of paths(faceOvalPath)) ctx.fill(p)
    }
    if (wantsEye) {
      const eyeW = Math.max(...smoothedFaces.map(eyeWidthNorm)) * w
      ctx.filter = `blur(${(clamp(eyeW * 0.18, 1, 10) * SCRATCH_SCALE).toFixed(1)}px)`
      ctx.fillStyle = '#00f'
      for (const p of paths(eyeMaskPath)) ctx.fill(p)
    }
    ctx.restore()
    const { gl } = R
    gl.bindTexture(gl.TEXTURE_2D, R.maskTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas)
  }

  /** Runs the face-aware passes; returns the texture the final pass should read. */
  const renderBeauty = () => {
    if (!faceEffectsWanted() || !smoothedFaces.length) return R.videoTex
    const preset = getPreset(current.preset.id)
    const k = Math.pow(current.preset.intensity / 100, 0.55) * presence
    const p = preset.parameters
    if (k <= 0.005) return R.videoTex
    const { gl, programs, targets } = R

    const faceW = Math.max(...smoothedFaces.map(faceWidthNorm)) * w
    const hasTone = !!(p.brightness || p.contrast || p.saturation || p.shadowLift || p.glow || p.warmth || p.clarity)
    drawMasks(faceW, !!(p.smoothing || p.blemish), hasTone, !!p.eyeEnhance)

    // Downsample, then blur.
    drawTo(targets.down, programs.copy)
    bindTex(0, R.videoTex, programs.copy, 'uTex')
    tri()
    const wideSigma = p.smoothing ? clamp(faceW * (0.012 + 0.016 * k), 2, 16) : clamp(faceW * 0.03, 2, 24)
    blurInto(targets.wide, wideSigma)
    if (p.blemish) blurInto(targets.fine, clamp(faceW * (0.01 + 0.01 * k), 2, 10))

    const b = programs.beauty
    drawTo(targets.beauty, b)
    bindTex(0, R.videoTex, b, 'uVideo')
    bindTex(1, targets.wide.tex, b, 'uBlur')
    bindTex(2, (p.blemish ? targets.fine : targets.wide).tex, b, 'uBlur2')
    bindTex(3, R.maskTex, b, 'uMask')
    gl.uniform2f(b.u('uTexel'), 1 / w, 1 / h)
    gl.uniform2f(b.u('uRes'), w, h)
    gl.uniform1f(b.u('uSmooth'), p.smoothing ? Math.min(0.92, p.smoothing * k * 2.2) : 0)
    gl.uniform1f(b.u('uSmoothGain'), 2.5 + 5 * (p.texturePreservation ?? 0.8))
    gl.uniform1f(b.u('uBlemish'), p.blemish ? Math.min(0.85, p.blemish * k * 1.6) : 0)
    gl.uniform1f(b.u('uBlemishGain'), 3.5)
    gl.uniform1f(b.u('uBright'), (p.brightness || 0) * k * 1.1)
    gl.uniform1f(b.u('uContrast'), (p.contrast || 0) * k)
    gl.uniform1f(b.u('uSat'), (p.saturation || 0) * k * 1.2)
    gl.uniform1f(b.u('uShadow'), p.shadowLift ? Math.min(0.5, p.shadowLift * k * 1.6) : 0)
    gl.uniform1f(b.u('uGlow'), p.glow ? Math.min(0.38, p.glow * k * 0.75) : 0)
    gl.uniform1f(b.u('uWarmth'), p.warmth ? Math.min(0.28, p.warmth * k * 1.6) : 0)
    gl.uniform1f(b.u('uClarity'), (p.clarity || 0) * k * 1.1)
    gl.uniform1f(b.u('uEye'), (p.eyeEnhance || 0) * k)
    gl.uniform1f(b.u('uRuddy'), p.ruddy ? Math.min(0.5, p.ruddy * k * 1.1) : 0)
    const cheeks = []
    if (p.ruddy) {
      for (const lm of smoothedFaces) {
        const r = faceWidthNorm(lm) * w * 0.2
        for (const c of cheekCenters(lm)) cheeks.push(c.x * w, c.y * h, r)
      }
    }
    const nCheeks = Math.min(4, cheeks.length / 3)
    gl.uniform1i(b.u('uCheekN'), nCheeks)
    if (nCheeks) gl.uniform3fv(b.u('uCheeks'), new Float32Array(cheeks.slice(0, 12).concat(new Array(12 - Math.min(12, cheeks.length)).fill(0))))
    tri()
    return targets.beauty.tex
  }

  // Jaw control points for Face Slim: [landmark, weight]. Pulled horizontally toward the face's
  // vertical center line; strongest at the lower jaw, fading up toward the cheekbones.
  const SLIM_POINTS = [[234, 0.35], [454, 0.35], [93, 0.55], [323, 0.55], [58, 0.85], [288, 0.85], [172, 1], [397, 1], [136, 0.8], [365, 0.8]]
  const slimData = new Float32Array(16 * 4)
  const slimRadii = new Float32Array(16)
  const eyeData = new Float32Array(4 * 3)

  const setReshapeUniforms = (prog) => {
    const { gl } = R
    const slim = current.enabled ? clamp((current.reshape?.faceSlim || 0) / 100, 0, 1) * presence : 0
    const eyeAmt = current.enabled ? clamp((current.reshape?.eyeEnlarge || 0) / 100, 0, 1) * presence : 0
    let n = 0
    let ne = 0
    if (smoothedFaces.length && (slim > 0.001 || eyeAmt > 0.001)) {
      for (const lm of smoothedFaces) {
        const fw = faceWidthNorm(lm) * w
        const nose = lm[1] || lm[4]
        if (slim > 0.001 && nose) {
          const cx = nose.x * w
          for (const [idx, wt] of SLIM_POINTS) {
            const pt = lm[idx]
            if (!pt || n >= 16) continue
            const sx = pt.x * w, sy = pt.y * h
            const dx = (cx - sx) * 0.13 * slim * wt
            // e = where the jaw point ends up; the shader samples back toward its origin.
            slimData.set([sx + dx, sy, dx, 0], n * 4)
            slimRadii[n] = fw * 0.3
            n++
          }
        }
        if (eyeAmt > 0.001) {
          const eyeW = eyeWidthNorm(lm) * w
          const centers = lm[468] && lm[473]
            ? [lm[468], lm[473]] // iris centers (478-point model)
            : [[33, 133], [263, 362]].map(([a, b2]) => lm[a] && lm[b2] && { x: (lm[a].x + lm[b2].x) / 2, y: (lm[a].y + lm[b2].y) / 2 })
          for (const c of centers) {
            if (!c || ne >= 4) continue
            eyeData.set([c.x * w, c.y * h, Math.max(4, eyeW * 1.15)], ne * 3)
            ne++
          }
        }
      }
    }
    gl.uniform1i(prog.u('uSlimN'), n)
    gl.uniform4fv(prog.u('uSlim'), slimData)
    gl.uniform1fv(prog.u('uSlimR'), slimRadii)
    gl.uniform1i(prog.u('uEyeN'), ne)
    gl.uniform3fv(prog.u('uEyes'), eyeData)
    gl.uniform1f(prog.u('uEyeAmt'), eyeAmt * 0.28)
  }

  const setCustomAndFilterUniforms = (prog) => {
    const { gl } = R
    const c = current.enabled ? { ...DEFAULT_CUSTOM, ...current.custom } : DEFAULT_CUSTOM
    const n = (v) => (v || 0) / 50
    gl.uniform1f(prog.u('uGain'), (1 + n(c.brightness) * 0.2) * Math.pow(2, n(c.exposure) * 0.5))
    gl.uniform1f(prog.u('uContrast'), 1 + n(c.contrast) * 0.18)
    gl.uniform1f(prog.u('uSat'), 1 + n(c.saturation) * 0.25)
    gl.uniform1f(prog.u('uVib'), n(c.vibrance) * 0.5)
    gl.uniform1f(prog.u('uSharp'), n(c.sharpness) * 0.8)
    gl.uniform1f(prog.u('uTemp'), n(c.temperature))
    gl.uniform1f(prog.u('uTint'), n(c.tint))
    gl.uniform1f(prog.u('uHigh'), n(c.highlights))
    gl.uniform1f(prog.u('uShad'), n(c.shadows))
    const f = filterUniforms(current.enabled ? current.filterId : 'none')
    gl.uniform3fv(prog.u('uF0'), f.rows[0])
    gl.uniform3fv(prog.u('uF1'), f.rows[1])
    gl.uniform3fv(prog.u('uF2'), f.rows[2])
    gl.uniform3fv(prog.u('uFOff'), f.off)
    gl.uniform4fv(prog.u('uFTint'), f.tint)
  }

  // --- stats
  let frames = 0
  let fps = 0
  let fpsWindowStart = performance.now()
  let frameMs = 0
  let lastError = null

  const draw = () => {
    if (!running) return
    const now = performance.now()
    if (now - lastFrameAt < FRAME_INTERVAL_MS) return
    lastFrameAt = now
    if (contextLost || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return
    if (canvas.width !== Math.round(video.videoWidth * Math.min(1, MAX_PROCESS_DIM / Math.max(video.videoWidth, video.videoHeight)))) resize()

    try {
      maybeDetectFaces(now)
      updateSmoothedFaces(now)

      const { gl, programs } = R
      gl.bindVertexArray(R.vao)
      gl.bindTexture(gl.TEXTURE_2D, R.videoTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)

      const src = current.enabled ? renderBeauty() : R.videoTex

      const f = programs.final
      drawTo(null, f)
      bindTex(0, src, f, 'uTex')
      gl.uniform2f(f.u('uRes'), w, h)
      gl.uniform2f(f.u('uTexel'), 1 / w, 1 / h)
      setReshapeUniforms(f)
      setCustomAndFilterUniforms(f)
      tri()
      lastError = null
    } catch (e) {
      // A single bad frame must not kill the loop — log once per distinct error, keep going.
      const msg = e?.message || String(e)
      if (msg !== lastError) console.error('[beauty] frame render failed:', e)
      lastError = msg
    }

    frameMs = performance.now() - now
    frames++
    if (now - fpsWindowStart >= 1000) {
      fps = (frames * 1000) / (now - fpsWindowStart)
      frames = 0
      fpsWindowStart = now
    }
  }
  // The browser pauses requestAnimationFrame while the page is hidden (minimized window,
  // another tab, app switched away). This canvas IS the video a call/broadcast sends, so with
  // rAF alone the other side saw a frozen frame while audio carried on. While hidden, a Web
  // Worker's timer (not paused or throttled the way page timers are) drives the frames instead.
  const loop = () => {
    if (!running) return
    raf = requestAnimationFrame(loop)
    draw()
  }
  const hiddenTicker = new Worker(URL.createObjectURL(new Blob(
    ['let t = null; onmessage = (e) => { clearInterval(t); if (e.data > 0) t = setInterval(() => postMessage(0), e.data) }'],
    { type: 'text/javascript' },
  )))
  hiddenTicker.onmessage = draw
  const onVisibility = () => hiddenTicker.postMessage(document.hidden ? FRAME_INTERVAL_MS : 0)
  document.addEventListener('visibilitychange', onVisibility)
  onVisibility()
  loop()

  const canvasStream = canvas.captureStream(30)
  const videoTrack = canvasStream.getVideoTracks()[0]
  const getAudioTrack = () => rawStream.getAudioTracks()[0] || null

  return {
    get renderer() { return 'webgl2' },
    get videoTrack() { return videoTrack },
    get audioTrack() { return getAudioTrack() },
    get stream() {
      const s = new MediaStream([videoTrack])
      const at = getAudioTrack()
      if (at) s.addTrack(at)
      return s
    },
    get rawStream() { return rawStream },
    updateSettings(next) {
      current = mergeSettings(current, next || {})
    },
    captureBlob(type = 'image/jpeg', quality = 0.92) {
      return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
    },
    async switchCamera() {
      const nextFacing = currentFacingMode === 'user' ? 'environment' : 'user'
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
      oldTrack?.stop()
      try {
        await attach(await openCameraFacing(nextFacing, oldDeviceId), nextFacing)
      } catch (e) {
        await attach(await openCameraFacing(currentFacingMode), currentFacingMode).catch(() => {})
        throw e
      }
      targetFaces = []
      smoothedFaces = []
      presence = 0
      return nextFacing
    },
    get facingMode() { return currentFacingMode },
    get faceCount() { return targetFaces.length },
    get edgeAwareSupported() { return true },
    /** Live diagnostics — renderer in use, frame rate/cost, and face-detection health. */
    get stats() {
      return {
        renderer: 'webgl2',
        gpu: R.gpu,
        width: w,
        height: h,
        fps: Math.round(fps * 10) / 10,
        frameMs: Math.round(frameMs * 100) / 100,
        faceCount: targetFaces.length,
        detect: detectState,
        detectMs: Math.round(detectMs * 10) / 10,
        detectErrors,
        lastDetectError,
        lastRenderError: lastError,
        contextLost,
      }
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      hiddenTicker.terminate()
      rawStream.getTracks().forEach((t) => t.stop())
      videoTrack.stop()
      video.srcObject = null
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      try { R.gl.getExtension('WEBGL_lose_context')?.loseContext() } catch { /* ignore */ }
    },
  }
}

function mergeSettings(base, next) {
  return {
    ...base,
    ...next,
    preset: { ...base.preset, ...next.preset },
    custom: { ...base.custom, ...next.custom },
    reshape: { ...DEFAULT_RESHAPE, ...base.reshape, ...next.reshape },
  }
}
