import { useMemo, useState, useEffect, useRef } from 'react'

// Brand confetti — gold, purple, pink, aqua, plus a light cream for sparkle.
const CONFETTI = ['#e0a92e', '#f5c65b', '#6d3be6', '#a884fb', '#e87ba4', '#1baf7a', '#fff3cf']
const FLOATERS = ['✨', '💛', '🎉', '✨', '💜', '⭐']

/** Spinning golden light rays — sits behind the gift icon. */
export function GiftRays({ size = 260, className = '' }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute left-1/2 top-1/2 gift-rays ${className}`}
      style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
    />
  )
}

/** One-shot confetti burst from the centre of its (relative) parent, then falling away.
 * Pass a new `seed` (e.g. the gift's timestamp) to replay it. */
export function ConfettiBurst({ count = 30, spread = 170, seed = 0 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6
    const dist = spread * (0.55 + Math.random() * 0.45)
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 30, // bias upward, like a pop
      rot: (Math.random() * 2 - 1) * 540,
      color: CONFETTI[i % CONFETTI.length],
      w: 5 + Math.random() * 5,
      h: Math.random() > 0.5 ? 4 + Math.random() * 3 : 9 + Math.random() * 5,
      round: Math.random() > 0.65,
      delay: Math.random() * 120,
      dur: 1100 + Math.random() * 600,
    }
  }), [count, spread, seed]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
      {pieces.map((p, i) => (
        <span
          key={`${seed}-${i}`}
          className="absolute gift-confetti"
          style={{
            width: p.w, height: p.h, marginLeft: -p.w / 2, marginTop: -p.h / 2,
            background: p.color, borderRadius: p.round ? 999 : 2,
            '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`,
            animationDelay: `${p.delay}ms`, animationDuration: `${p.dur}ms`,
          }}
        />
      ))}
    </span>
  )
}

/** A few emoji sparkles drifting up and fading — spread across the parent's width. */
export function FloatingSparkles({ seed = 0 }) {
  const items = useMemo(() => FLOATERS.map((e, i) => ({
    e, left: 8 + (84 / (FLOATERS.length - 1)) * i + (Math.random() * 8 - 4),
    delay: 250 + Math.random() * 900, dur: 1800 + Math.random() * 900, size: 14 + Math.random() * 8,
  })), [seed]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-0">
      {items.map((it, i) => (
        <span key={`${seed}-${i}`} className="absolute bottom-0 gift-float" style={{ left: `${it.left}%`, fontSize: it.size, animationDelay: `${it.delay}ms`, animationDuration: `${it.dur}ms` }}>{it.e}</span>
      ))}
    </span>
  )
}

/** Counts from 0 up to `value` (ease-out), starting after `delay` ms. */
export function useCountUpFrom0(value, { duration = 900, delay = 350 } = {}) {
  const [n, setN] = useState(0)
  const raf = useRef()
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(value); return }
    setN(0)
    let start
    const t = setTimeout(() => {
      const step = (now) => {
        start ??= now
        const k = Math.min(1, (now - start) / duration)
        setN(Math.round(value * (1 - Math.pow(1 - k, 3))))
        if (k < 1) raf.current = requestAnimationFrame(step)
      }
      raf.current = requestAnimationFrame(step)
    }, delay)
    return () => { clearTimeout(t); cancelAnimationFrame(raf.current) }
  }, [value, duration, delay])
  return n
}
