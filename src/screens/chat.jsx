import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { PlainHeader, TopBar, Avatar, Segmented } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { conversations, messages } from '../data.js'

function ConversationList({ activeId, onPick, filter, setFilter }) {
  const list = filter === 'Unread' ? conversations.filter((c) => c.unread) : conversations
  return (
    <div className="lg:h-full lg:overflow-y-auto no-scrollbar">
      <div className="px-5 lg:px-4 pt-3 lg:pt-4">
        <Segmented options={['All', 'Unread', 'Top fans']} value={filter} onChange={setFilter} />
      </div>
      <p className="section-title px-5 lg:px-4 mt-4 mb-1 text-[12px] font-semibold tracking-wide text-ink-400 uppercase">Recent</p>
      <div className="px-5 lg:px-2 divide-y divide-black/5 lg:divide-y-0">
        {list.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            className={`w-full flex items-center gap-3 py-3 lg:px-3 lg:rounded-xl text-left ${activeId === c.id ? 'lg:bg-brand-50' : 'lg:hover:bg-black/[.03]'}`}
          >
            <Avatar name={c.name} size={46} ring={c.unread ? '#6d3be6' : undefined} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-ink-900">{c.name}</p>
              <p className="text-[13px] text-ink-400 truncate">{c.last}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[12px] text-ink-300">{c.time}</p>
              {c.unread && <span className="pill bg-brand-50 text-brand-600 text-[11px] mt-1">New</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function Thread({ conv }) {
  const nav = useNavigate()
  const [sheet, setSheet] = useState(false)
  const thread = messages[conv.id] || messages.rahul
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center gap-3 px-4 lg:px-5 py-3 border-b border-black/5 bg-white">
        <button onClick={() => nav('/chat')} className="lg:hidden h-9 w-9 grid place-items-center rounded-xl border border-black/10"><Icon name="chevron-left" size={18} /></button>
        <Avatar name={conv.name} size={38} />
        <div className="flex-1">
          <p className="text-[15px] font-bold text-ink-900 flex items-center gap-2">{conv.name}<span className="pill bg-gold-50 text-gold-600 text-[11px]"><Icon name="star" size={11} fill="#e0a92e" /> LV {conv.level}</span></p>
          <p className="text-[12px] text-emerald-600">Online now</p>
        </div>
        <button onClick={() => setSheet((s) => !s)} className="h-9 w-9 grid place-items-center rounded-xl border border-black/10 text-ink-700">⋮</button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 lg:px-6 py-4 space-y-2.5 bg-canvas">
        <p className="text-center text-[12px] text-ink-300">Today</p>
        {thread.map((m, i) =>
          m.gift ? (
            <div key={i} className="mx-auto w-fit rounded-full bg-gold-50 px-3 py-1.5 text-[12px] font-semibold text-gold-600 flex items-center gap-1.5">
              <span>{m.gift.toLowerCase().includes('rose') ? '🌹' : '❤️'}</span> {m.gift}
            </div>
          ) : (
            <div key={i} className={`flex ${m.me ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[76%] rounded-2xl px-3.5 py-2.5 text-[14px] ${m.me ? 'bg-brand-600 text-white rounded-br-md' : 'bg-white text-ink-900 border border-black/5 rounded-bl-md'}`}>
                {m.t}<span className={`block text-[10px] mt-1 ${m.me ? 'text-white/60' : 'text-ink-300'}`}>{m.at}</span>
              </div>
            </div>
          ),
        )}
      </div>

      <div className="shrink-0 p-3 border-t border-black/5 flex items-center gap-2 bg-white">
        <button className="h-10 w-10 grid place-items-center rounded-full bg-black/5 text-ink-500"><Icon name="smile" size={20} /></button>
        <input placeholder="Message…" className="input flex-1 rounded-full" />
        <button className="h-10 w-10 grid place-items-center rounded-full bg-brand-600 text-white"><Icon name="send" size={18} /></button>
      </div>

      {sheet && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end" onClick={() => setSheet(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-t-3xl lg:rounded-2xl lg:m-auto lg:max-w-sm p-5 animate-sheet-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[17px] font-bold text-ink-900 mb-1">More options</h3>
            <button onClick={() => nav('/report')} className="w-full flex items-center gap-3.5 py-3.5 text-left">
              <span className="grid place-items-center h-10 w-10 rounded-xl bg-gold-50 text-gold-500"><Icon name="flag" size={18} /></span>
              <span><span className="block text-[15px] font-semibold text-ink-900">Report User</span><span className="block text-[13px] text-ink-400">Report inappropriate behaviour</span></span>
            </button>
            <button onClick={() => nav(`/block/${conv.name}`)} className="w-full flex items-center gap-3.5 py-3.5 text-left">
              <span className="grid place-items-center h-10 w-10 rounded-xl bg-rose-50 text-rose-500"><Icon name="ban" size={18} /></span>
              <span><span className="block text-[15px] font-semibold text-ink-900">Block User</span><span className="block text-[13px] text-ink-400">You will no longer be matched</span></span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function Chat() {
  const { id } = useParams()
  const nav = useNavigate()
  const conv = conversations.find((c) => c.id === id)
  const [filter, setFilter] = useState('All')

  return (
    <AppLayout tab="/chat" title="Messages" maxW="full" bg="white" pad={false} bottomNav={!conv}>
      {/* MOBILE: list or thread */}
      <div className={`lg:hidden flex flex-col ${conv ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'}`}>
        {conv ? (
          <div className="relative flex-1 min-h-0 flex flex-col">
            <Thread conv={conv} />
          </div>
        ) : (
          <>
            <PlainHeader title="Messages" sub="3 unread" right={<button className="h-10 w-10 grid place-items-center rounded-xl border border-black/10 text-ink-700"><Icon name="search" size={18} /></button>} />
            <ConversationList activeId={id} onPick={(cid) => nav(`/chat/${cid}`)} filter={filter} setFilter={setFilter} />
          </>
        )}
      </div>

      {/* DESKTOP: two panes */}
      <div className="hidden lg:grid grid-cols-[340px_1fr] h-[calc(100dvh-4rem)] border-l border-black/5">
        <div className="border-r border-black/5">
          <div className="px-4 pt-4"><h1 className="text-[20px] font-extrabold text-ink-900">Messages</h1><p className="text-[12px] text-ink-400">3 unread</p></div>
          <ConversationList activeId={id} onPick={(cid) => nav(`/chat/${cid}`)} filter={filter} setFilter={setFilter} />
        </div>
        <div className="relative">
          {conv ? <Thread conv={conv} /> : (
            <div className="h-full grid place-items-center text-center px-8">
              <div><Icon name="chat" size={40} className="mx-auto text-ink-300" /><p className="mt-3 text-[15px] font-semibold text-ink-500">Select a conversation</p></div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

export const ChatList = Chat
export const ChatConvo = Chat
