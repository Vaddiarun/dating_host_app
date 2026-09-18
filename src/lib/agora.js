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
 */
export async function joinAndPublish({ channelName, token, uid, video = true, mode = 'rtc', role, beautySettings, onRemoteUser } = {}) {
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
    if (beautySettings?.enabled) {
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

/** Switches a published local camera track to the next available camera (front/back on
 * mobile, whatever's next in the list on desktop) without dropping the publish. Returns the
 * deviceId now in use, or null if there's only one camera to switch to.
 * `beautyCamera`, when the session was opened with a beauty filter, drives the swap instead —
 * a custom video track built from a canvas stream has no Agora-native `setDevice()` to call,
 * so the underlying camera is reopened directly and the published track's source is swapped
 * with `replaceTrack` instead. */
export async function switchToNextCamera(localVideoTrack, beautyCamera) {
  if (beautyCamera) {
    await beautyCamera.switchCamera()
    await localVideoTrack.replaceTrack(beautyCamera.videoTrack)
    return 'switched'
  }
  const RTC = await sdk()
  const cameras = await RTC.getCameras()
  if (cameras.length < 2) return null
  const currentLabel = localVideoTrack.getMediaStreamTrack?.()?.label
  const currentIndex = Math.max(0, cameras.findIndex((c) => c.label === currentLabel))
  const next = cameras[(currentIndex + 1) % cameras.length]
  await localVideoTrack.setDevice(next.deviceId)
  return next.deviceId
}
