// No audio asset shipped/fetched for the ringtone — synthesized with the Web Audio API
// instead, so there's nothing to download and no file to keep in sync with the repo.
let ctx
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

/**
 * Browsers create every AudioContext in a "suspended" state until it's resumed from inside
 * a real user gesture (click/tap/key) — resuming it from an async event handler (like a
 * socket push for an incoming call, which is exactly when the ringtone needs to fire) is
 * silently ignored, so the ring never actually plays even though nothing throws. Call this
 * once from any real tap/click anywhere in the app (see RealtimeBridge, mounted at the root)
 * so the context is already running long before a real call arrives.
 */
export function unlockAudio() {
  getCtx().resume?.().catch(() => {})
}

/**
 * Classic two-tone ring, repeating every ~2s, until stopped. Call the returned function to
 * silence it (call answered/declined, or the incoming-call screen was left another way).
 * Browsers block audio until the page has had some user interaction — if this is the very
 * first thing to touch audio in the session, it may stay silent until the host taps
 * anywhere; there's no reliable way around that from inside the page.
 */
export function playRingtone() {
  const audioCtx = getCtx()
  audioCtx.resume?.().catch(() => {})
  let stopped = false
  let timer = null

  const beep = (freq, start, duration) => {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.28, start + 0.02)
    gain.gain.linearRampToValueAtTime(0, start + duration - 0.02)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start(start)
    osc.stop(start + duration)
  }

  const ring = () => {
    if (stopped) return
    const now = audioCtx.currentTime
    beep(880, now, 0.4)
    beep(660, now + 0.45, 0.4)
    timer = setTimeout(ring, 2000)
  }
  ring()

  return () => {
    stopped = true
    clearTimeout(timer)
  }
}

/** Short single chirp — for a lighter-weight notification (new chat message, gift, etc.) */
export function playChime() {
  const audioCtx = getCtx()
  audioCtx.resume?.().catch(() => {})
  const now = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(740, now)
  osc.frequency.exponentialRampToValueAtTime(1040, now + 0.12)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.22, now + 0.02)
  gain.gain.linearRampToValueAtTime(0, now + 0.22)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(now)
  osc.stop(now + 0.24)
}
