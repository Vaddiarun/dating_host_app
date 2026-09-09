import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { StatusBar, PlainHeader, Avatar, Segmented, SectionTitle } from '../ui/kit.jsx'
import { AppLayout, ImmersiveLayout } from '../ui/layouts.jsx'
import { callLog } from '../data.js'

/* 15 — Calls list */
export function CallsList() {
  const nav = useNavigate()
  const [f, setF] = useState('All')
  return (
    <AppLayout tab="/calls" title="Calls" maxW="lg" bg="canvas">
      <PlainHeader title="Calls" sub="Last 30 days" right={<button className="h-10 w-10 grid place-items-center rounded-xl border border-black/10 text-ink-700"><Icon name="search" size={18} /></button>} />
      <div className="px-5 lg:px-0 pt-3 lg:pt-0 pb-4">
        <Segmented options={['All', 'Video', 'Voice', 'Missed']} value={f} onChange={setF} />
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[['phone', '126', 'Calls'], ['clock', '28h', 'Talk time'], ['wallet', '₹ 42k', 'Earned']].map(([i, v, l]) => (
            <div key={l} className="card p-3.5"><Icon name={i} size={16} className="text-brand-600" /><p className="text-[18px] font-extrabold text-ink-900 mt-0.5">{v}</p><p className="text-[12px] text-ink-400">{l}</p></div>
          ))}
        </div>
        {callLog.map((g) => (
          <div key={g.day}>
            <SectionTitle className="mt-5 mb-1">{g.day}</SectionTitle>
            <div className="card px-4 lg:px-4 divide-y divide-black/5">
              {g.items.map((c, i) => (
                <button key={i} onClick={() => nav('/call/summary')} className="w-full flex items-center gap-3 py-3 text-left">
                  <Avatar name={c.name} size={40} />
                  <div className="flex-1"><p className="text-[15px] font-semibold text-ink-900">{c.name}</p><p className="text-[12px] text-ink-400">{c.kind}{c.dur ? ` · ${c.dur}` : ''}</p></div>
                  <div className="text-right">
                    {c.missed ? <span className="pill bg-rose-50 text-rose-500 text-[11px]">Missed</span> : <p className="text-[14px] font-bold text-emerald-600">+ ₹ {c.amount}</p>}
                    <p className="text-[11px] text-ink-300 mt-0.5">{c.time}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}

/* Shared shell for full-bleed call screens */
function CallStage({ children }) {
  return (
    <ImmersiveLayout>
      <div className="relative mx-auto flex min-h-[100dvh] max-w-[520px] flex-col overflow-hidden text-white bg-gradient-to-b from-night-700 via-night-800 to-night-900">
        <div className="absolute -top-20 left-1/4 h-56 w-56 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-gold-400/10 blur-3xl" />
        <StatusBar dark />
        {children}
      </div>
    </ImmersiveLayout>
  )
}

/* 16 — Incoming call */
export function IncomingCall() {
  const nav = useNavigate()
  return (
    <CallStage>
      <div className="flex-1 flex flex-col items-center pt-16 px-6">
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-brand-400/40 animate-pulse-ring" />
          <Avatar name="Rahul" size={150} className="ring-4 ring-white/20" />
        </div>
        <div className="mt-6 flex items-center gap-2"><h2 className="text-[28px] font-extrabold">Rahul</h2><span className="text-[13px]">level 👑</span></div>
        <p className="text-[14px] text-white/70 mt-1">Incoming video call</p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <span className="pill bg-white/10 text-white text-[13px]">Earn ₹ 24 / min</span>
          <span className="pill bg-white/10 text-white text-[13px]">👑 1</span>
        </div>
      </div>
      <div className="pb-14 px-10 flex items-end justify-between">
        <button onClick={() => nav('/calls')} className="flex flex-col items-center gap-2">
          <span className="h-16 w-16 grid place-items-center rounded-full bg-rose-500"><Icon name="phone-off" size={24} /></span>
          <span className="text-[12px] text-white/70">Decline</span>
        </button>
        <button onClick={() => nav('/call/connecting')} className="flex flex-col items-center gap-2">
          <span className="h-20 w-20 grid place-items-center rounded-full bg-emerald-500 shadow-[0_0_0_10px_rgba(16,185,129,.2)]"><Icon name="phone" size={28} /></span>
          <span className="text-[12px] text-white/70">Accept</span>
        </button>
      </div>
    </CallStage>
  )
}

/* 17 — Connecting */
export function Connecting() {
  const nav = useNavigate()
  useEffect(() => { const t = setTimeout(() => nav('/call/active'), 1800); return () => clearTimeout(t) }, [nav])
  return (
    <CallStage>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <Avatar name="Rahul" size={150} className="ring-4 ring-white/15" />
        <h2 className="mt-7 text-[24px] font-extrabold">Connecting…</h2>
        <p className="text-[14px] text-white/60 mt-1">Securing an encrypted line</p>
        <span className="pill bg-white/10 text-white text-[12px] mt-4"><Icon name="lock" size={13} /> End-to-end encrypted</span>
      </div>
      <div className="pb-16 flex justify-center">
        <button onClick={() => nav('/calls')} className="h-16 w-16 grid place-items-center rounded-full bg-rose-500"><Icon name="phone-off" size={24} /></button>
      </div>
    </CallStage>
  )
}

/* 18 — On call */
export function ActiveCall() {
  const nav = useNavigate()
  const [muted, setMuted] = useState(false)
  const [cam, setCam] = useState(true)
  return (
    <ImmersiveLayout>
      <div className="relative mx-auto flex min-h-[100dvh] max-w-[520px] flex-col overflow-hidden text-white bg-gradient-to-b from-night-700 to-night-900">
        <StatusBar dark />
        <div className="px-4">
          <div className="rounded-2xl bg-white/8 backdrop-blur px-3.5 py-2.5 flex items-center gap-3 border border-white/10">
            <Avatar name="Rahul" size={38} />
            <div className="flex-1"><p className="text-[15px] font-semibold">Rahul</p><p className="text-[12px] text-white/60">06:42 · HD</p></div>
            <span className="text-[13px] font-bold text-gold-300">164 Beans</span>
          </div>
        </div>
        <div className="absolute top-24 right-4 h-40 w-28 rounded-2xl bg-gradient-to-br from-brand-400 to-night-800 grid place-items-center"><Icon name="camera" size={22} className="text-white/50" /></div>
        <div className="flex-1 grid place-items-center"><div className="h-56 w-56 rounded-full bg-white/5" /></div>
        <div className="px-4 mb-3">
          <div className="rounded-2xl bg-white/10 backdrop-blur px-3.5 py-3 flex items-center gap-3 border border-white/10 animate-slide-up">
            <span className="text-2xl">🌹</span>
            <div className="flex-1"><p className="text-[14px] font-semibold">Neel sent Rose</p><p className="text-[12px] text-gold-300">+250 beans</p></div>
            <Avatar name="Neel" size={34} />
          </div>
        </div>
        <div className="pb-8 px-6 flex items-center justify-between">
          <button onClick={() => setMuted((m) => !m)} className={`h-12 w-12 grid place-items-center rounded-full ${muted ? 'bg-white text-ink-900' : 'bg-white/12'}`}><Icon name={muted ? 'mic-off' : 'mic'} size={20} /></button>
          <button onClick={() => setCam((c) => !c)} className={`h-12 w-12 grid place-items-center rounded-full ${cam ? 'bg-white/12' : 'bg-white text-ink-900'}`}><Icon name={cam ? 'video' : 'camera-off'} size={20} /></button>
          <button className="h-12 w-12 grid place-items-center rounded-full bg-white/12"><Icon name="flip" size={20} /></button>
          <button onClick={() => nav('/gift/ask/call')} className="h-12 w-12 grid place-items-center rounded-full bg-white/12"><Icon name="gift" size={20} /></button>
          <button onClick={() => nav('/call/summary')} className="h-14 w-14 grid place-items-center rounded-full bg-rose-500"><Icon name="phone-off" size={22} /></button>
        </div>
      </div>
    </ImmersiveLayout>
  )
}

/* 19 — Call summary */
export function CallSummary() {
  const nav = useNavigate()
  const [rate, setRate] = useState(4)
  return (
    <AppLayout tab="/calls" title="Call ended" maxW="md" bg="white">
      <PlainHeader title="Call ended" />
      <div className="px-5 lg:px-0 pt-8 lg:pt-2 pb-4 flex flex-col items-center">
        <Avatar name="Rahul" size={92} className="ring-4 ring-brand-500/30" />
        <h2 className="mt-3 text-[22px] font-extrabold text-ink-900">Rahul</h2>
        <p className="text-[13px] text-ink-400">Video call · 12 min 04 sec</p>
        <div className="card w-full mt-5 p-4">
          <div className="flex items-center justify-between"><span className="text-[14px] text-ink-500">You earned</span><span className="text-[22px] font-extrabold text-gold-500">₹ 320</span></div>
          <div className="border-t border-black/5 mt-2 pt-2 space-y-1.5 text-[13px]">
            <div className="flex justify-between"><span className="text-ink-400">Call time</span><span className="font-semibold">₹ 288</span></div>
            <div className="flex justify-between"><span className="text-ink-400">Gifts</span><span className="font-semibold">₹ 32</span></div>
          </div>
        </div>
        <div className="card w-full mt-3 p-4 text-center">
          <p className="text-[14px] font-semibold text-ink-900">Rate this call</p>
          <div className="mt-2 flex justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRate(n)}><Icon name="star" size={30} fill={n <= rate ? '#e0a92e' : 'none'} className={n <= rate ? 'text-gold-400' : 'text-ink-300'} /></button>
            ))}
          </div>
        </div>
        <div className="w-full mt-4 space-y-3">
          <button onClick={() => nav('/home')} className="btn-primary">Back to home</button>
          <button onClick={() => nav('/report')} className="btn-danger-outline"><Icon name="flag" size={16} /> Report this user</button>
        </div>
      </div>
    </AppLayout>
  )
}
