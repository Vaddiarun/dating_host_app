/**
 * Broadcasting live through Cloudflare's SFU — the backend's "cloudflare" live media provider,
 * the per-GB-billed alternative to Agora. This pushes the host's camera + mic to the SFU once;
 * each viewer's app pulls it from there. The SFU secret never reaches the app: our offer goes
 * to POST /live/broadcasts/:id/sfu/publish and the backend returns the SFU's answer.
 *
 * Returns a session shaped like lib/agora.js's joinAndPublish — `client.leave()`, local tracks
 * with play/stop/close/setEnabled/setDevice, and `beautyCamera` — so the broadcast screen's
 * preview, mic toggle, camera flip and leaveChannel() work unchanged.
 */
import { openBeautyCamera } from './beautyFilter.js'
import { localAudioTrack, localVideoTrack } from './p2p.js'

// Same 1280x720 @ 15fps the Agora path publishes ('720p_1'), and about the same bitrate.
const CAMERA_CONSTRAINTS = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15, max: 30 } }
const MAX_VIDEO_BITRATE = 1_200_000
// A dropped connection gets a fresh SFU session; viewers re-pull it via live:media-updated.
const MAX_REPUBLISHES = 3

/**
 * @param publish (sdp, tracks) => Promise<{ sdp }> — POST /live/broadcasts/:id/sfu/publish
 */
export async function publishToSfu({ iceServers, publish, beautySettings }) {
  // Mic and camera acquired independently, as in lib/agora.js.
  const audio = (await navigator.mediaDevices.getUserMedia({ audio: true })).getAudioTracks()[0]
  let video
  let beautyCamera = null
  try {
    if (beautySettings?.enabled) {
      beautyCamera = await openBeautyCamera({ settings: beautySettings, audio: false })
      video = beautyCamera.videoTrack
    } else {
      video = (await navigator.mediaDevices.getUserMedia({ video: { ...CAMERA_CONSTRAINTS, facingMode: 'user' } })).getVideoTracks()[0]
    }
  } catch (e) {
    audio.stop()
    throw e
  }

  let pc = null
  let videoSender = null
  let closed = false
  let republishes = 0

  const connect = async () => {
    pc?.close()
    // max-bundle: the SFU carries every track over one transport.
    const next = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' })
    pc = next
    const audioTransceiver = next.addTransceiver(audio, { direction: 'sendonly' })
    const videoTransceiver = next.addTransceiver(video, { direction: 'sendonly', sendEncodings: [{ maxBitrate: MAX_VIDEO_BITRATE }] })
    videoSender = videoTransceiver.sender
    next.onconnectionstatechange = () => {
      if (next.connectionState !== 'failed' || closed || pc !== next || republishes >= MAX_REPUBLISHES) return
      republishes += 1
      connect().catch((e) => console.error('Live republish failed:', e))
    }

    const offer = await next.createOffer()
    await next.setLocalDescription(offer)
    const { sdp } = await publish(offer.sdp, [
      { mid: videoTransceiver.mid, trackName: 'video' },
      { mid: audioTransceiver.mid, trackName: 'audio' },
    ])
    if (closed || pc !== next) return
    await next.setRemoteDescription({ type: 'answer', sdp })
  }

  try {
    await connect()
  } catch (e) {
    pc?.close()
    audio.stop()
    video.stop()
    beautyCamera?.stop()
    throw e
  }

  return {
    kind: 'sfu',
    client: {
      async leave() {
        closed = true
        pc?.close()
      },
    },
    localAudioTrack: localAudioTrack(audio),
    localVideoTrack: localVideoTrack(video, () => videoSender),
    beautyCamera,
  }
}
