import { inflate } from 'pako'
import { openBeautyCamera } from './beautyFilter.js'

// Loaded on demand — the SDK is a big chunk (~500KB) that only calls and live
// broadcasts need, not every page in the app.
let AgoraRTC
async function sdk() {
  if (!AgoraRTC) AgoraRTC = (await import('agora-rtc-sdk-ng')).default
  return AgoraRTC
}

/**
 * The backend hands us a per-session Agora token (channelName + agoraToken) but never the
 * Agora App ID itself, and there's no /config endpoint that exposes it either. The App ID is
 * not a secret — it's meant to be embedded in client apps — and it's actually encoded inside
 * every token the backend issues (Agora's "007" token format: 3-byte version, then a
 * zlib-deflated, length-prefixed field list starting with signature, then appId). So rather
 * than hardcode a value that could drift from whatever Agora project the backend is actually
 * using, we decode it straight out of the token we already have.
 */
export function appIdFromToken(token) {
  const raw = Uint8Array.from(atob(token.slice(3)), (c) => c.charCodeAt(0))
  const bytes = inflate(raw)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let o = 0
  const sigLen = view.getUint16(o, true); o += 2 + sigLen
  const appIdLen = view.getUint16(o, true); o += 2
  return new TextDecoder().decode(bytes.slice(o, o + appIdLen))
}

/**
 * Joins an Agora channel, publishes the local mic + camera, and returns everything needed
 * to render/control the session. `onRemoteUser(user, mediaType)` fires whenever a remote
 * participant's audio/video becomes available, already subscribed.
 *
 * `mode`/`role`: 1:1 calls use the default 'rtc' (Communication) profile, where every
 * participant can freely publish/subscribe — there's no host/audience distinction to make.
 * A live broadcast is one-to-many, so it should use the 'live' (Live Broadcasting) profile
 * with an explicit role — that's the only channel profile Agora actually enforces
 * publisher/subscriber privileges under; the backend's tokens already encode PUBLISHER vs
 * SUBSCRIBER per role (live.routes.ts), but that encoding does nothing under plain 'rtc'
 * mode, which is what every join used to request regardless of call vs. broadcast.
 *
 * `alwaysBeautyPipeline`: route the camera through the beauty pipeline even when beauty is
 * currently disabled (it passes frames through untouched then). Needed wherever settings can be
 * edited mid-session — a plain camera track has no pipeline to push updated settings into, so
 * turning beauty on during the call would otherwise do nothing.
 */
export async function joinAndPublish({ channelName, token, uid, video = true, mode = 'rtc', role, beautySettings, alwaysBeautyPipeline = false, onRemoteUser } = {}) {
  const RTC = await sdk()
  RTC.setLogLevel(4) // errors only — the SDK is chatty at its default level
  const appId = appIdFromToken(token)
  const client = RTC.createClient({ mode, codec: 'vp8' })
  if (mode === 'live' && role) await client.setClientRole(role)

  if (onRemoteUser) {
    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType)
      onRemoteUser(user, mediaType)
    })
    client.on('user-unpublished', (user, mediaType) => onRemoteUser(user, mediaType, true))
  }

  await client.join(appId, channelName, token, uid ?? null)

  const localAudioTrack = await RTC.createMicrophoneAudioTrack()
  let localVideoTrack = null
  let beautyCamera = null
  if (video) {
    if (beautySettings && (beautySettings.enabled || alwaysBeautyPipeline)) {
      // audio: false — the mic is already handled by createMicrophoneAudioTrack above;
      // opening it a second time here would race two getUserMedia calls for the same
      // device, which is exactly the class of NOT_READABLE bug fixed earlier for the
      // camera itself.
      beautyCamera = await openBeautyCamera({ settings: beautySettings, audio: false })
      localVideoTrack = RTC.createCustomVideoTrack({ mediaStreamTrack: beautyCamera.videoTrack })
    } else {
      localVideoTrack = await RTC.createCameraVideoTrack()
    }
  }
  await client.publish([localAudioTrack, localVideoTrack].filter(Boolean))

  return { client, localAudioTrack, localVideoTrack, beautyCamera }
}

export async function leaveChannel({ client, localAudioTrack, localVideoTrack, beautyCamera } = {}) {
  try {
    if (localAudioTrack) { localAudioTrack.stop(); localAudioTrack.close() }
    if (localVideoTrack) { localVideoTrack.stop(); localVideoTrack.close() }
    beautyCamera?.stop()
    await client?.leave()
  } catch {
    // best-effort — we're tearing down regardless
  }
}

// Which way each plain (non-beauty) camera track is facing — Agora doesn't report it.
const trackFacing = new WeakMap()

/** Flips a published local camera track front <-> back without dropping the publish. Returns
 * the facing mode now in use ('user' | 'environment'), or null if there's only one camera.
 * `beautyCamera`, when the session was opened with the beauty pipeline, drives the swap — the
 * published track is its canvas output, which stays the same track while the camera behind it
 * changes, so there is nothing to replace on the Agora side.
 * Also re-plays the local preview un-mirrored for the back camera (pass `previewEl`): a
 * mirrored self-view is right for the front camera but makes the back camera look backwards. */
export async function switchToNextCamera(localVideoTrack, beautyCamera, previewEl) {
  let facing
  if (beautyCamera) {
    try {
      facing = await beautyCamera.switchCamera()
    } catch (e) {
      if (/only one camera/i.test(e?.message || '')) return null
      throw e
    }
  } else {
    const current = trackFacing.get(localVideoTrack) || 'user'
    const next = current === 'user' ? 'environment' : 'user'
    try {
      // Agora 4.x on mobile accepts a facing mode here — picks the main back lens, rather than
      // stepping through every camera (phones list ultra-wide/tele lenses too).
      await localVideoTrack.setDevice({ facingMode: next })
    } catch {
      // Desktop / older SDK path: fall back to the next listed camera.
      const RTC = await sdk()
      const cameras = await RTC.getCameras()
      if (cameras.length < 2) return null
      const currentLabel = localVideoTrack.getMediaStreamTrack?.()?.label
      const currentIndex = Math.max(0, cameras.findIndex((c) => c.label === currentLabel))
      await localVideoTrack.setDevice(cameras[(currentIndex + 1) % cameras.length].deviceId)
    }
    trackFacing.set(localVideoTrack, next)
    facing = next
  }
  if (previewEl) {
    localVideoTrack.stop()
    localVideoTrack.play(previewEl, { fit: 'cover', mirror: facing === 'user' })
  }
  return facing
}
