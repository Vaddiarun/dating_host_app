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
export function FloatingComments({ comments, fadeOut = true, scrollable = false, endRef, onOpenImage, className = '' }) {
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
                <div className="text-[13px] leading-snug text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,.75)' }}>
                  <span className="block text-[12px] font-bold text-white/85">{c.name}</span>
                  {c.image
                    ? <ChatPhoto src={c.image} status={c.status} onOpen={onOpenImage} />
                    : isJumboEmoji(c.text) ? <span className="text-[30px] leading-tight">{c.text}</span> : c.text}
                </div>
              </div>
            </div>
          )
        })}
        {endRef && <div ref={endRef} />}
      </div>
    </div>
  )
}

/** A photo in the chat: thumbnail with a spinner while it uploads, a note if it failed. */
function ChatPhoto({ src, status, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => status !== 'sending' && onOpen?.(src)}
      className="relative mt-1 block overflow-hidden rounded-xl ring-1 ring-white/25"
      aria-label="Open photo"
    >
      <img src={src} alt="" className={`block max-h-52 max-w-[180px] object-cover ${status === 'sending' ? 'opacity-60' : ''}`} />
      {status === 'sending' && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        </span>
      )}
      {status === 'failed' && (
        <span className="absolute inset-x-0 bottom-0 bg-rose-600/90 px-2 py-1 text-center text-[11px] font-semibold">Not sent</span>
      )}
    </button>
  )
}

/** Full-screen photo viewer (tap anywhere to close). */
export function PhotoViewer({ src, onClose }) {
  if (!src) return null
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/95 p-4 animate-fade-in" onClick={onClose} role="dialog" aria-label="Photo">
      <img src={src} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
      <button onClick={onClose} className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid h-10 w-10 place-items-center rounded-full bg-white/15 text-[20px] text-white" aria-label="Close">×</button>
    </div>
  )
}

/** The comments still within their lifetime, newest last. */
export function recentComments(comments, max = 6) {
  const now = Date.now()
  return comments.filter((c) => now - c.at < COMMENT_LIFETIME_MS).slice(-max)
}
