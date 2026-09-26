// Real-time face landmark detection (MediaPipe Face Landmarker) — used purely to locate face
// GEOMETRY (where the eyes/lips/cheeks/face boundary are) so beauty processing can target or
// avoid specific regions. This never inspects or classifies pixel color/skin tone — it only
// ever returns point coordinates, so there is no code path here that could treat different
// skin tones differently.
//
// The model + WASM runtime are loaded from Google's own CDN on first use (same lazy-load
// pattern as the Agora SDK in lib/agora.js) rather than bundled, since the model file alone is
// several MB and most sessions never touch a face-aware filter.
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const MAX_FACES = 2 // calls/broadcasts are one person on camera; each extra face costs inference time

let landmarkerPromise = null
async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: MAX_FACES,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      })
    })().catch((e) => { landmarkerPromise = null; throw e })
  }
  return landmarkerPromise
}

// Standard MediaPipe FaceMesh point-index groups (stable across the ecosystem) — geometry
// only, used to build the various region masks below.
export const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
export const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
export const RIGHT_EYE = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]
export const LEFT_EYEBROW = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107]
export const RIGHT_EYEBROW = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336]
export const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
// Single reference points, not full loops — used as circle centers (cheeks for "Ruddy") or to
// size regions relative to the face (eye enhance falls back to LEFT_EYE/RIGHT_EYE loops).
const LEFT_CHEEK_CENTER = 425
const RIGHT_CHEEK_CENTER = 205
const LEFT_EYE_CORNERS = [33, 133]
const RIGHT_EYE_CORNERS = [263, 362]

/** Detects up to a few faces in the given video element for the given timestamp (ms).
 * Returns an array of landmark sets (each 468/478 normalized x/y points), possibly empty. */
export async function detectFaces(video, timestampMs) {
  const landmarker = await getLandmarker()
  const result = landmarker.detectForVideo(video, timestampMs)
  return result?.faceLandmarks || []
}

function loopToPath(path, landmarks, indices, width, height) {
  indices.forEach((idx, i) => {
    const p = landmarks[idx]
    if (!p) return
    const x = p.x * width, y = p.y * height
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  })
  path.closePath()
}

/** Skin region (face oval minus eyes/eyebrows/lips) for one face, in pixel space. Fill with
 * 'evenodd' so the inner loops (eyes/brows/lips) become holes — that's what keeps those
 * features untouched by smoothing/glow/etc. */
export function skinMaskPath(landmarks, width, height) {
  const path = new Path2D()
  loopToPath(path, landmarks, FACE_OVAL, width, height)
  loopToPath(path, landmarks, LEFT_EYE, width, height)
  loopToPath(path, landmarks, RIGHT_EYE, width, height)
  loopToPath(path, landmarks, LEFT_EYEBROW, width, height)
  loopToPath(path, landmarks, RIGHT_EYEBROW, width, height)
  loopToPath(path, landmarks, LIPS_OUTER, width, height)
  return path
}

/** Both eyes only, for the Eye Enhance pass. */
export function eyeMaskPath(landmarks, width, height) {
  const path = new Path2D()
  loopToPath(path, landmarks, LEFT_EYE, width, height)
  loopToPath(path, landmarks, RIGHT_EYE, width, height)
  return path
}

/** Face oval only (no feature holes) — the wide, softly feathered region tone adjustments
 * (brightness/warmth/glow) are blended through, so the face never ends up a visibly different
 * tone from the neck and ears. */
export function faceOvalPath(landmarks, width, height) {
  const path = new Path2D()
  loopToPath(path, landmarks, FACE_OVAL, width, height)
  return path
}

/** Face width as a fraction of frame width — every radius/feather in the pipeline is scaled
 * off this, so effects look the same whether the face is close to the camera or far away. */
export function faceWidthNorm(landmarks) {
  const xs = FACE_OVAL.map((i) => landmarks[i]?.x).filter((v) => v != null)
  return xs.length ? Math.max(...xs) - Math.min(...xs) : 0
}

/** Cheek centers (normalized), for the Ruddy pass's radial blush. */
export function cheekCenters(landmarks) {
  return [LEFT_CHEEK_CENTER, RIGHT_CHEEK_CENTER].map((i) => landmarks[i]).filter(Boolean)
}

/** Average eye width (normalized), to size the eye mask's feather. */
export function eyeWidthNorm(landmarks) {
  const width = ([a, b]) => (landmarks[a] && landmarks[b] ? Math.hypot(landmarks[a].x - landmarks[b].x, landmarks[a].y - landmarks[b].y) : 0)
  return (width(LEFT_EYE_CORNERS) + width(RIGHT_EYE_CORNERS)) / 2
}
