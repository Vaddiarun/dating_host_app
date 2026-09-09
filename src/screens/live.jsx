import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { StatusBar, PlainHeader, Avatar, Toggle, SectionTitle } from '../ui/kit.jsx'
import { AppLayout, ImmersiveLayout } from '../ui/layouts.jsx'

/* 22 — Go live setup */
export function GoLive() {
  const nav = useNavigate()
  const [cat, setCat] = useState('Chat')
  const [mic, setMic] = useState(true)
  const [gifts, setGifts] = useState(true)
  return (
    <AppLayout tab="/live" title="Go live" maxW="md" bg="white">
      <PlainHeader title="Go live" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-4">
        <div className="relative aspect-[4/3] lg:aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-brand-400 to-brand-700">
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
            <span className="pill bg-black/40 text-white text-[12px]">Camera ready · HD</span>
            <button className="h-9 w-9 grid place-items-center rounded-full bg-black/40 text-white"><Icon name="flip" size={16} /></button>
          </div>
        </div>
        <div className="mt-4"><span className="label">Stream title</span><input className="input" defaultValue="Late night chill chat 💜" /></div>
        <div className="mt-3 flex gap-2">
          {['Chat', 'Music', 'Q&A'].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${cat === c ? 'bg-brand-50 text-brand-600' : 'bg-black/5 text-ink-400'}`}>{c}</button>
          ))}
        </div>
        <div className="card mt-4 p-4 divide-y divide-black/5">
          <div className="flex items-center gap-3 pb-3"><Icon name="mic" size={18} className="text-ink-500" /><span className="flex-1 text-[15px] font-semibold text-ink-900">Microphone</span><Toggle on={mic} onChange={setMic} /></div>
          <div className="flex items-center gap-3 pt-3"><Icon name="gift" size={18} className="text-ink-500" /><span className="flex-1 text-[15px] font-semibold text-ink-900">Allow gifts</span><Toggle on={gifts} onChange={setGifts} /></div>
        </div>
        <button onClick={() => nav('/live/broadcast')} className="btn-primary mt-4"><Icon name="video" size={17} /> Start broadcast</button>
      </div>
    </AppLayout>
  )
}

/* 23 — Live broadcast */
export function Broadcast() {
  const nav = useNavigate()
  const chat = [
    { n: 'Aman', t: 'joined the stream', j: true },
    { n: 'Karan', t: 'you look great tonight!' },
    { n: 'Dev', t: 'song request please 🎵' },
  ]
  return (
    <ImmersiveLayout>
      <div className="mx-auto flex min-h-[100dvh] max-w-[520px] flex-col text-white bg-gradient-to-b from-night-700 via-night-800 to-night-900">
        <StatusBar dark />
        <div className="px-4 flex items-center gap-2">
          <span className="pill bg-black/40 text-white text-[12px]"><Avatar name="Ayesha" size={22} /> Ayesha <span className="text-rose-400 font-bold">● LIVE</span></span>
          <span className="pill bg-black/40 text-white text-[12px]"><Icon name="eye" size={12} /> 1,204</span>
          <span className="ml-auto pill bg-black/40 text-gold-300 text-[12px] font-bold">8,420</span>
        </div>
        <div className="flex-1 grid place-items-center"><div className="h-56 w-56 rounded-full bg-white/5" /></div>
        <div className="px-4 pb-3 space-y-2">
          <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/10 px-3.5 py-3 flex items-center gap-3 animate-slide-up">
            <span className="text-2xl">👑</span>
            <div className="flex-1"><p className="text-[14px] font-semibold">Neel sent Crown</p><p className="text-[12px] text-gold-300">+2,100 beans</p></div>
            <Avatar name="Neel" size={32} />
          </div>
          {chat.map((c, i) => (
            <p key={i} className="text-[13px] w-fit rounded-2xl bg-black/30 px-3 py-1.5"><span className="font-bold">{c.n}</span> <span className={c.j ? 'text-white/50' : ''}>{c.t}</span></p>
          ))}
        </div>
        <div className="pb-6 px-4 flex items-center gap-2">
          <input placeholder="Say something…" className="flex-1 rounded-full bg-white/15 border border-white/10 px-4 py-2.5 text-[14px] text-white placeholder:text-white/60 outline-none" />
          <button className="h-11 w-11 grid place-items-center rounded-full bg-white/12"><Icon name="gift" size={19} /></button>
          <button className="h-11 w-11 grid place-items-center rounded-full bg-white/12"><Icon name="flip" size={19} /></button>
          <button onClick={() => nav('/live/summary')} className="h-11 w-11 grid place-items-center rounded-full bg-rose-500"><Icon name="x" size={20} /></button>
        </div>
      </div>
    </ImmersiveLayout>
  )
}

/* 24 — Live summary */
export function LiveSummary() {
  const nav = useNavigate()
  const bars = [['0-10m', 1200], ['10-20m', 2400], ['20-30m', 1800], ['30-48m', 3020]]
  const max = 3020
  return (
    <AppLayout tab="/live" title="Stream ended" maxW="md" bg="white">
      <PlainHeader title="Stream ended" />
      <div className="px-5 lg:px-0 pt-8 lg:pt-2 pb-4">
        <div className="flex flex-col items-center text-center">
          <span className="grid place-items-center h-16 w-16 rounded-full bg-emerald-500 text-white shadow-[0_0_0_8px_rgba(16,185,129,.12),0_0_0_16px_rgba(16,185,129,.07)]"><Icon name="check" size={28} /></span>
          <h2 className="mt-4 text-[22px] font-extrabold text-ink-900">Great session!</h2>
          <p className="text-[13px] text-ink-400">You streamed for 48 minutes</p>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[['eye', '1.2k', 'Viewers', 'text-brand-600'], ['gift', '64', 'Gifts', 'text-gold-400'], ['heart', '9.4k', 'Likes', 'text-rose-500']].map(([i, v, l, c]) => (
            <div key={l} className="card p-3.5"><Icon name={i} size={16} className={c} /><p className="text-[17px] font-extrabold text-ink-900 mt-0.5">{v}</p><p className="text-[12px] text-ink-400">{l}</p></div>
          ))}
        </div>
        <div className="card mt-3 p-4">
          <div className="flex items-center justify-between"><span className="text-[14px] text-ink-500">Beans earned</span><span className="text-[20px] font-extrabold text-gold-500">8,420 <span className="text-[13px] font-medium text-ink-400">≈ ₹ 4,210</span></span></div>
          <div className="mt-4 flex items-end justify-between gap-3 h-40">
            {bars.map(([l, v]) => (
              <div key={l} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] font-bold text-gold-500">{v}</span>
                <div className="w-full rounded-lg bg-gold-300 min-h-[4px]" style={{ height: `${(v / max) * 76}%` }} />
                <span className="text-[10px] text-ink-400 shrink-0">{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <button className="btn-primary"><Icon name="arrow-ur" size={16} /> Share highlights</button>
          <button onClick={() => nav('/home')} className="btn-outline">Back to home</button>
        </div>
      </div>
    </AppLayout>
  )
}
