import { useState } from 'react'

// Plain Unicode emoji — no picker library or image sprites, so they send as ordinary message
// text and render natively on the recipient's device.
const CATEGORIES = [
  ['😊', 'Smileys', '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 😐 😶 😏 😒 🙄 😬 😴 😷 🤒 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😲 😳 🥺 😢 😭 😱 😤 😡 🤯 😈'],
  ['❤️', 'Love', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💌 💋 😻 💑 💏 🌹 🥀 💐'],
  ['👋', 'Gestures', '👋 🤚 ✋ 🖐️ 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 👍 👎 ✊ 👊 👏 🙌 👐 🤲 🙏 💪 🫶 🤝 💅'],
  ['🎉', 'Fun', '🎉 🎊 🎁 🎈 🎂 🍰 🥂 🍾 🍷 🍹 ☕ 🍕 🍔 🍟 🍫 🍭 🍓 🍒 🍑 🎵 🎶 🎤 🎧 🎮 🏆 ⭐ 🌟 ✨ 🔥 💯 💎 👑 💰'],
  ['🌸', 'Nature', '🌸 🌺 🌻 🌼 🌷 🍀 🌈 ☀️ 🌙 ⭐ ⚡ ❄️ 🌊 🐶 🐱 🐰 🦊 🐻 🐼 🐨 🦁 🐵 🦋 🐝 🦄'],
].map(([icon, name, list]) => ({ icon, name, emojis: list.split(' ') }))

const RECENT_KEY = 'host_recent_emojis'
const RECENT_MAX = 24

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || [] } catch { return [] }
}
function saveRecent(list) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)) } catch { /* storage unavailable — recents just won't persist */ }
}

/* Emoji grid with category tabs plus a "Recent" row. `onPick(emoji)` gets the emoji string;
 * the caller inserts it into its own input. `dark` for the in-call chat overlay. */
export function EmojiPicker({ onPick, dark = false }) {
  const [recent, setRecent] = useState(loadRecent)
  const [cat, setCat] = useState(recent.length ? 'recent' : CATEGORIES[0].name)

  const pick = (emoji) => {
    const next = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, RECENT_MAX)
    setRecent(next)
    saveRecent(next)
    onPick(emoji)
  }

  const tabs = [...(recent.length ? [{ icon: '🕘', name: 'recent' }] : []), ...CATEGORIES]
  const emojis = cat === 'recent' ? recent : CATEGORIES.find((c) => c.name === cat)?.emojis || []

  return (
    <div className={dark ? 'bg-black/40' : 'bg-white border-t border-black/5'}>
      <div className={`flex gap-1 px-2 pt-2 ${dark ? '' : 'border-b border-black/5'}`}>
        {tabs.map((t) => (
          <button
            key={t.name}
            onClick={() => setCat(t.name)}
            aria-label={t.name}
            className={`h-9 flex-1 rounded-xl text-[18px] ${cat === t.name ? (dark ? 'bg-white/15' : 'bg-black/5') : 'opacity-60'}`}
          >
            {t.icon}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-48 overflow-y-auto no-scrollbar">
        {emojis.map((e, i) => (
          <button
            key={`${e}-${i}`}
            onClick={() => pick(e)}
            className={`h-10 grid place-items-center rounded-lg text-[24px] ${dark ? 'active:bg-white/15' : 'active:bg-black/5 hover:bg-black/5'}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Inserts `emoji` at the input's caret (or appends if it isn't focused) and returns the new
 * text, moving the caret to just after the inserted emoji. */
export function insertAtCaret(inputEl, text, emoji) {
  const start = inputEl?.selectionStart ?? text.length
  const end = inputEl?.selectionEnd ?? text.length
  const next = text.slice(0, start) + emoji + text.slice(end)
  requestAnimationFrame(() => {
    if (!inputEl) return
    const pos = start + emoji.length
    inputEl.setSelectionRange(pos, pos)
  })
  return next
}

// A message made up only of 1–3 emoji (no other text) is shown large, like most chat apps.
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*\s*){1,3}$/u
export function isJumboEmoji(content) {
  return typeof content === 'string' && EMOJI_ONLY.test(content.trim())
}
