/* Skeleton loading placeholders — shimmering shapes that mirror a screen's real layout while its
 * data loads, instead of a bare "Loading…" line. Purely presentational: every screen keeps its
 * own loading state; these only replace what is drawn during it. The shimmer is defined in
 * index.css (.skel) and stops for anyone with reduced motion set. */

/** Base block. Size and shape come from className (h-*, w-*, rounded-*). */
export function Skel({ className = '', dark = false, style }) {
  return <span aria-hidden className={`block ${dark ? 'skel-dark' : 'skel'} ${className}`} style={style} />
}

/** Wrapper that announces the loading state once to screen readers. */
export function SkelGroup({ children, className = '', label = 'Loading…' }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

/** Text line(s) — last line shorter, like a real paragraph. */
export function SkelLines({ lines = 2, className = '', dark }) {
  return (
    <span className={`block space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skel key={i} dark={dark} className={`h-3 rounded-md ${i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </span>
  )
}

/** A card of list rows: leading avatar/icon, two text lines, trailing value. */
export function SkelList({ rows = 5, avatar = 'circle', trailing = true, className = '', title = false, plain = false }) {
  return (
    <div className={className}>
      {title && <Skel className="h-3 w-20 rounded-md mb-2 mt-5" />}
      <div className={plain ? 'divide-y divide-black/5' : 'card px-4 divide-y divide-black/5'}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            {avatar && <Skel className={`h-10 w-10 shrink-0 ${avatar === 'circle' ? 'rounded-full' : 'rounded-xl'}`} />}
            <div className="flex-1 min-w-0 space-y-2">
              <Skel className="h-3.5 rounded-md" style={{ width: `${55 + ((i * 17) % 30)}%` }} />
              <Skel className="h-2.5 w-1/3 rounded-md" />
            </div>
            {trailing && (
              <div className="flex flex-col items-end gap-2">
                <Skel className="h-3.5 w-14 rounded-md" />
                <Skel className="h-2.5 w-10 rounded-md" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Row of small stat tiles (icon, value, label). */
export function SkelStats({ count = 3, className = '' }) {
  return (
    <div className={`grid gap-3 ${className}`} style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card p-3.5 space-y-2">
          <Skel className="h-4 w-4 rounded-md" />
          <Skel className="h-5 w-16 rounded-md" />
          <Skel className="h-2.5 w-12 rounded-md" />
        </div>
      ))}
    </div>
  )
}

/** Gradient hero card (balance / level / report) as a dark shimmer block. */
export function SkelHero({ className = '', height = 'h-36' }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600/70 to-brand-800/70 p-5 ${height} ${className}`}>
      <Skel dark className="h-2.5 w-24 rounded-md" />
      <Skel dark className="mt-3 h-8 w-40 rounded-lg" />
      <Skel dark className="mt-3 h-2.5 w-28 rounded-md" />
    </div>
  )
}

/** Plain card with a few text lines. */
export function SkelCard({ lines = 3, className = '', header = true }) {
  return (
    <div className={`card p-4 ${className}`}>
      {header && <Skel className="h-4 w-1/3 rounded-md mb-3.5" />}
      <SkelLines lines={lines} />
    </div>
  )
}

/** Settings-style card: icon + title/sub + chevron rows. */
export function SkelRows({ rows = 6, className = '' }) {
  return (
    <div className={`card px-4 divide-y divide-black/5 ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3.5 py-3.5">
          <Skel className="h-10 w-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skel className="h-3.5 rounded-md" style={{ width: `${40 + ((i * 13) % 30)}%` }} />
            <Skel className="h-2.5 w-1/2 rounded-md" />
          </div>
          <Skel className="h-3 w-3 rounded-sm" />
        </div>
      ))}
    </div>
  )
}

/** Card of label + toggle rows. */
export function SkelToggles({ rows = 4, className = '' }) {
  return (
    <div className={`card p-4 divide-y divide-black/5 ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <Skel className="h-3.5 rounded-md flex-1" style={{ maxWidth: `${45 + ((i * 19) % 35)}%` }} />
          <span className="flex-1" />
          <Skel className="h-7 w-12 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** Chat bubbles alternating sides. */
export function SkelBubbles({ count = 6 }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }, (_, i) => {
        const mine = i % 3 === 1
        return (
          <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <Skel className={`h-10 rounded-2xl ${mine ? 'rounded-br-md' : 'rounded-bl-md'}`} style={{ width: `${38 + ((i * 23) % 34)}%` }} />
          </div>
        )
      })}
    </div>
  )
}

/** Centered status screen: icon circle, title, pill, detail card. */
export function SkelResult({ className = '' }) {
  return (
    <div className={`flex flex-col items-center px-5 ${className}`}>
      <Skel className="h-20 w-20 rounded-full" />
      <Skel className="mt-5 h-5 w-44 rounded-md" />
      <Skel className="mt-3 h-5 w-24 rounded-full" />
      <SkelCard className="w-full mt-6" lines={2} header={false} />
    </div>
  )
}
