import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { PlainHeader, Avatar, Segmented, ErrorCard } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { chat as chatApi } from '../api/index.js'
import { timeAgo, clockTime } from '../lib/format.js'
import { onSocketEvent } from '../lib/socket.js'
import { errorMessage } from '../lib/errors.js'

function ConversationList({ list, activeId, onPick, filter, setFilter, loading, err, onRetry }) {
  return (
    <div className="lg:h-full lg:overflow-y-auto no-scrollbar">
      <div className="px-5 lg:px-4 pt-3 lg:pt-4">
        <Segmented options={['All', 'Unread']} value={filter} onChange={setFilter} />
      </div>
      <p className="section-title px-5 lg:px-4 mt-4 mb-1 text-[12px] font-semibold tracking-wide text-ink-400 uppercase">Recent</p>
      {loading && <p className="px-5 lg:px-4 text-[13px] text-ink-400">Loading…</p>}
      {!loading && err && <ErrorCard message={err} onRetry={onRetry} className="mx-5 lg:mx-4" />}
      {!loading && !err && list.length === 0 && <p className="px-5 lg:px-4 text-[13px] text-ink-400">No conversations yet.</p>}
      <div className="px-5 lg:px-2 divide-y divide-black/5 lg:divide-y-0">
        {list.map((c) => {
          const name = c.otherParticipant?.name || c.otherParticipant?.phone || 'User'
          return (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className={`w-full flex items-center gap-3 py-3 lg:px-3 lg:rounded-xl text-left ${activeId === c.id ? 'lg:bg-brand-50' : 'lg:hover:bg-black/[.03]'}`}
            >
              <Avatar name={name} size={46} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-ink-900">{name}</p>
                <p className="text-[13px] text-ink-400 truncate">Tap to view conversation</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[12px] text-ink-300">{timeAgo(c.lastMessageAt)}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Thread({ conv }) {
  const nav = useNavigate()
  const [sheet, setSheet] = useState(false)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [sendErr, setSendErr] = useState('')
  const recipientId = conv.otherParticipant?.id
  const name = conv.otherParticipant?.name || conv.otherParticipant?.phone || 'User'

  const load = useCallback(() => {
    setErr('')
    chatApi.getMessages(conv.id).then((res) => {
      setMessages([...(res.messages || [])].reverse())
    }).catch((e) => setErr(errorMessage(e, 'Could not load this conversation.'))).finally(() => setLoading(false))
  }, [conv.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!recipientId) return
    return onSocketEvent('chat:message', (m) => {
      if (m.conversationId !== conv.id && m.senderId !== recipientId) return
      setMessages((prev) => (prev.some((x) => x.id === m.messageId) ? prev : [...prev, { id: m.messageId, senderId: m.senderId, content: m.content, createdAt: m.createdAt }]))
    })
  }, [conv.id, recipientId])

  const send = async () => {
    const content = text.trim()
    if (!content || !recipientId || sending) return
    setSending(true)
    setSendErr('')
    setText('')
    try {
      const res = await chatApi.send(recipientId, content)
      setMessages((m) => [...m, { id: res.messageId, senderId: res.senderId, content: res.content, createdAt: res.createdAt }])
    } catch (e) {
      setText(content)
      setSendErr(errorMessage(e, 'Could not send that message.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center gap-3 px-4 lg:px-5 py-3 border-b border-black/5 bg-white">
        <button onClick={() => nav('/chat')} className="lg:hidden h-9 w-9 grid place-items-center rounded-xl border border-black/10"><Icon name="chevron-left" size={18} /></button>
        <Avatar name={name} size={38} />
        <div className="flex-1">
          <p className="text-[15px] font-bold text-ink-900">{name}</p>
        </div>
        <button onClick={() => setSheet((s) => !s)} className="h-9 w-9 grid place-items-center rounded-xl border border-black/10 text-ink-700">⋮</button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 lg:px-6 py-4 space-y-2.5 bg-canvas">
        {loading && <p className="text-center text-[12px] text-ink-300">Loading…</p>}
        {!loading && err && <ErrorCard message={err} onRetry={load} />}
        {!loading && !err && messages.length === 0 && <p className="text-center text-[12px] text-ink-300">No messages yet — say hello!</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.senderId !== recipientId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[76%] rounded-2xl px-3.5 py-2.5 text-[14px] ${m.senderId !== recipientId ? 'bg-brand-600 text-white rounded-br-md' : 'bg-white text-ink-900 border border-black/5 rounded-bl-md'}`}>
              {m.content}<span className={`block text-[10px] mt-1 ${m.senderId !== recipientId ? 'text-white/60' : 'text-ink-300'}`}>{clockTime(m.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {sendErr && <p className="shrink-0 px-4 pb-1 text-[12px] text-rose-500 bg-white">{sendErr}</p>}
      <div className="shrink-0 p-3 border-t border-black/5 flex items-center gap-2 bg-white">
        <button className="h-10 w-10 grid place-items-center rounded-full bg-black/5 text-ink-500"><Icon name="smile" size={20} /></button>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Message…" className="input flex-1 rounded-full" />
        <button onClick={send} disabled={sending || !text.trim()} className="h-10 w-10 grid place-items-center rounded-full bg-brand-600 text-white disabled:opacity-50"><Icon name="send" size={18} /></button>
      </div>

      {sheet && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end" onClick={() => setSheet(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-t-3xl lg:rounded-2xl lg:m-auto lg:max-w-sm p-5 animate-sheet-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[17px] font-bold text-ink-900 mb-1">More options</h3>
            <button onClick={() => nav('/report', { state: { targetId: recipientId, targetName: name } })} className="w-full flex items-center gap-3.5 py-3.5 text-left">
              <span className="grid place-items-center h-10 w-10 rounded-xl bg-gold-50 text-gold-500"><Icon name="flag" size={18} /></span>
              <span><span className="block text-[15px] font-semibold text-ink-900">Report User</span><span className="block text-[13px] text-ink-400">Report inappropriate behaviour</span></span>
            </button>
            <button onClick={() => nav(`/block/${recipientId}`, { state: { name } })} className="w-full flex items-center gap-3.5 py-3.5 text-left">
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
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [err, setErr] = useState('')

  const reloadConversations = useCallback(() => {
    setErr('')
    chatApi.listConversations().then((res) => setConversations(res.conversations || [])).catch((e) => setErr(errorMessage(e, 'Could not load your conversations.'))).finally(() => setLoading(false))
  }, [])

  useEffect(() => { reloadConversations() }, [reloadConversations])
  useEffect(() => onSocketEvent('chat:message', reloadConversations), [reloadConversations])

  const conv = conversations.find((c) => c.id === id)
  const list = filter === 'Unread' ? [] : conversations

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
            <PlainHeader title="Messages" sub={`${conversations.length} conversations`} right={<button className="h-10 w-10 grid place-items-center rounded-xl border border-black/10 text-ink-700"><Icon name="search" size={18} /></button>} />
            <ConversationList list={list} loading={loading} err={err} onRetry={reloadConversations} activeId={id} onPick={(cid) => nav(`/chat/${cid}`)} filter={filter} setFilter={setFilter} />
          </>
        )}
      </div>

      {/* DESKTOP: two panes */}
      <div className="hidden lg:grid grid-cols-[340px_1fr] h-[calc(100dvh-4rem)] border-l border-black/5">
        <div className="border-r border-black/5">
          <div className="px-4 pt-4"><h1 className="text-[20px] font-extrabold text-ink-900">Messages</h1><p className="text-[12px] text-ink-400">{conversations.length} conversations</p></div>
          <ConversationList list={list} loading={loading} err={err} onRetry={reloadConversations} activeId={id} onPick={(cid) => nav(`/chat/${cid}`)} filter={filter} setFilter={setFilter} />
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
