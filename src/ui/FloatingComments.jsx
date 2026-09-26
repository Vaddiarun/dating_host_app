import { Avatar } from './kit.jsx'
import { isJumboEmoji } from './EmojiPicker.jsx'

// How long a comment floats over the video before it's gone, and how long its fade-out takes
// at the end of that window.
export const COMMENT_LIFETIME_MS = 8000
const FADE_MS = 1200

/* Instagram/TikTok-live style comments: no panel behind them, just avatar + name + text over
 * the video, kept legible with a text shadow. The stack is masked so the oldest line fades
 * into the video at the top, and with `fadeOut` each comment also dissolves by itself near the
 * end of its lifetime. `comments` items: { id, name, text, at } — `at` is when it arrived
 * (ms). `scrollable` lets the viewer scroll back through older ones (an open chat) instead
 * of clipping them. The caller re-renders about once a second to advance the fades (a timer
 * it already has), so this component has no timer of its own. */
export function FloatingComments({ comments, fadeOut = true, scrollable = false, endRef, className = '' }) {
  const now = Date.now()
  const mask = 'linear-gradient(to bottom, transparent, #000 35%)'
  return (
    <div className={`${scrollable ? 'overflow-y-auto no-scrollbar' : 'overflow-hidden'} ${className}`} style={{ maskImage: mask, WebkitMaskImage: mask }}>
      <div className="flex min-h-full flex-col justify-end gap-2">
        {comments.map((c) => {
          const age = now - c.at
          const fading = fadeOut && age > COMMENT_LIFETIME_MS - FADE_MS
          return (
            // Fade on the outer node, slide-in on the inner — the slide-in animation's fill
            // mode holds opacity at 1, which would override the fade if both were on one node.
            <div key={c.id} className="transition-opacity" style={{ opacity: fading ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}>
              <div className="flex items-start gap-2 max-w-[86%] animate-slide-up">
                <Avatar name={c.name} size={26} className="ring-1 ring-white/30 mt-0.5" />
                <p className="text-[13px] leading-snug text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,.75)' }}>
                  <span className="block text-[12px] font-bold text-white/85">{c.name}</span>
                  {isJumboEmoji(c.text) ? <span className="text-[30px] leading-tight">{c.text}</span> : c.text}
                </p>
              </div>
            </div>
          )
        })}
        {endRef && <div ref={endRef} />}
      </div>
    </div>
  )
}

/** The comments still within their lifetime, newest last. */
export function recentComments(comments, max = 6) {
  const now = Date.now()
  return comments.filter((c) => now - c.at < COMMENT_LIFETIME_MS).slice(-max)
}
