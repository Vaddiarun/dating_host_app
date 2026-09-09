import { useSearchParams, useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { Avatar, Toggle, SectionTitle } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { queue } from '../data.js'

function MobileHead({ label, tone }) {
  const nav = useNavigate()
  const t = { offline: 'bg-black/5 text-ink-500', online: 'bg-emerald-50 text-emerald-600', call: 'bg-gold-50 text-gold-600', live: 'bg-rose-50 text-rose-500' }[tone]
  return (
    <div className="lg:hidden px-5 pt-2 pb-3 flex items-center gap-2 bg-white">
      <Avatar name="Ayesha" size={42} ring="#6d3be6" />
      <div className="flex-1 min-w-0">
        <p className="text-[16px] font-bold text-ink-900 leading-tight truncate">Hi, Ayesha</p>
        <span className={`pill ${t} mt-0.5`}><span className="h-1.5 w-1.5 rounded-full bg-current" /> {label}</span>
      </div>
      {[['bell', '/notifications', 4], ['wallet', '/earnings'], ['settings', '/settings']].map(([i, to, b]) => (
        <button key={i} onClick={() => nav(to)} className="relative h-9 w-9 grid place-items-center rounded-xl border border-black/10 text-ink-700 shrink-0">
          <Icon name={i} size={17} />
          {b && <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-brand-600 text-white text-[10px]">{b}</span>}
        </button>
      ))}
    </div>
  )
}

function Stat({ icon, tone, value, label }) {
  return (
    <div className="card p-3.5">
      <Icon name={icon} size={17} className={tone} />
      <p className="text-[18px] font-extrabold text-ink-900 leading-none mt-1.5">{value}</p>
      <p className="text-[12px] text-ink-400 mt-1">{label}</p>
    </div>
  )
}

function Balance() {
  return (
    <div className="rounded-2xl p-4 lg:p-5 text-white bg-gradient-to-br from-brand-600 to-brand-800 shadow-pop relative overflow-hidden">
      <div className="lg:flex lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-white/70 uppercase">Available balance</p>
          <p className="font-extrabold mt-1 text-[30px] lg:text-[36px]">₹ 1,840</p>
          <p className="text-[12px] text-white/70">62,400 beans</p>
        </div>
        <div className="hidden lg:flex gap-6 pb-1">
          {[['This week', '₹ 6,200'], ['Pending', '₹ 480']].map(([k, v]) => (
            <div key={k}><p className="text-[11px] text-white/60 uppercase tracking-wide">{k}</p><p className="text-[16px] font-bold">{v}</p></div>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 300 60" preserveAspectRatio="none" className="mt-3 w-full h-12 lg:h-16"><polyline points="0,48 50,42 90,50 140,20 190,34 240,12 300,26" fill="none" stroke="#e9c46a" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
    </div>
  )
}

const RECENT = [
  ['Rahul', 'Video call · 12 min', '9:12 PM', 320],
  ['Neel', 'Gift · Crown', '9:02 PM', 210],
  ['Vikram', 'Voice call · 4 min', '8:40 PM', 96],
]
function RecentCard() {
  return (
    <div>
      <SectionTitle className="mb-2">Recent activity</SectionTitle>
      <div className="card px-4 divide-y divide-black/5">
        {RECENT.map(([n, s, time, a]) => (
          <div key={n} className="flex items-center gap-3 py-3">
            <Avatar name={n} size={40} />
            <div className="flex-1 min-w-0"><p className="text-[15px] font-semibold text-ink-900 truncate">{n}</p><p className="text-[12px] text-ink-400 truncate">{s}</p></div>
            <div className="text-right"><p className="text-[14px] font-bold text-emerald-600">+ ₹ {a}</p><p className="text-[11px] text-ink-300">{time}</p></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function QueueCard({ title, items }) {
  return (
    <div>
      <SectionTitle className="mb-2">{title}</SectionTitle>
      <div className="card divide-y divide-black/5 px-4">
        {items.map((q, i) => (
          <div key={q.name} className="flex items-center gap-3 py-3">
            <Avatar name={q.name} size={40} />
            <div className="flex-1"><p className="text-[15px] font-semibold text-ink-900">{q.name}</p><p className="text-[12px] text-ink-400">{title === 'Queue' ? 'Waiting' : 'Queued'} · {q.kind}</p></div>
            <span className={`pill ${i === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-gold-50 text-gold-600'}`}>{q.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const state = sp.get('state') || 'offline'
  const go = (s) => setSp(s === 'offline' ? {} : { state: s })
  const label = { offline: 'Offline', online: 'Online', call: 'In call', live: 'Broadcasting' }[state]

  /* --- status / hero block (varies by state) --- */
  const hero = {
    offline: (
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center h-11 w-11 rounded-xl bg-black/5 text-ink-400"><Icon name="video" size={18} /></span>
          <div className="flex-1"><p className="text-[15px] font-bold text-ink-900">You're offline</p><p className="text-[12px] text-ink-400">Viewers can't call you right now</p></div>
          <Toggle on={false} onChange={() => go('online')} />
        </div>
        <button onClick={() => go('online')} className="btn-primary mt-3"><Icon name="phone" size={17} /> Go online</button>
      </div>
    ),
    online: (
      <div className="card p-4 flex items-center gap-3">
        <span className="grid place-items-center h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600"><Icon name="video" size={18} /></span>
        <div className="flex-1"><p className="text-[15px] font-bold text-ink-900">You're online</p><p className="text-[12px] text-ink-400">Waiting for calls · 42 viewers nearby</p></div>
        <Toggle on onChange={() => go('offline')} />
      </div>
    ),
    call: (
      <div className="rounded-2xl p-4 bg-gradient-to-br from-gold-400 to-gold-500 text-white">
        <div className="flex items-center gap-3">
          <Avatar name="Rahul" size={44} />
          <div className="flex-1"><p className="text-[15px] font-bold">In call with Rahul</p><p className="text-[12px] text-white/80">Video · 06:42 elapsed</p></div>
          <span className="pill bg-black/20 text-white">₹ 24/min</span>
        </div>
        <button onClick={() => nav('/call/active')} className="btn-dark mt-3"><Icon name="arrow-ur" size={16} /> Return to call</button>
      </div>
    ),
    live: (
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-night-700 to-night-900 text-white p-4 min-h-[150px] flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <span className="pill bg-rose-500 text-white text-[11px]"><span className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE</span>
          <span className="pill bg-white/15 text-white text-[11px]"><Icon name="eye" size={12} /> 1,204</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-white/80">Streaming · 24:18</span>
          <span className="text-[14px] font-bold text-gold-300">+8,420 beans</span>
        </div>
      </div>
    ),
  }[state]

  const stats = {
    offline: [['wallet', 'text-gold-500', '₹ 0', 'Today'], ['phone', 'text-brand-600', '0', 'Calls'], ['star', 'text-gold-400', '4.8', 'Rating']],
    online: [['phone', 'text-brand-600', '7', 'Calls today'], ['clock', 'text-brand-600', '1h 12m', 'Talk time'], ['gift', 'text-gold-400', '18', 'Gifts']],
    call: [['wallet', 'text-gold-500', '₹ 164', 'This call'], ['phone', 'text-brand-600', '8', 'Calls today'], ['star', 'text-gold-400', '4.8', 'Rating']],
    live: [['eye', 'text-brand-600', '1.2k', 'Viewers'], ['gift', 'text-gold-400', '64', 'Gifts'], ['heart', 'text-rose-500', '9.4k', 'Likes']],
  }[state]

  const showBalance = state === 'online'
  const q1 = state === 'call'
    ? { title: 'Waiting', items: [{ name: 'Dev', kind: 'Voice', status: 'Waiting' }, { name: 'Imran', kind: 'Video', status: '2nd' }] }
    : { title: 'Queue', items: queue }

  return (
    <AppLayout tab="/home" title={`Dashboard · ${label}`} maxW="xl" bg="canvas">
      <MobileHead label={label} tone={state} />

      {/* desktop greeting */}
      <div className="hidden lg:flex items-center gap-3 mb-6">
        <Avatar name="Ayesha" size={48} ring="#6d3be6" />
        <div>
          <p className="text-[20px] font-extrabold text-ink-900">Hi, Ayesha</p>
          <p className="text-[13px] text-ink-400">{state === 'offline' ? "You're offline — viewers can't reach you" : `You're ${label.toLowerCase()}`}</p>
        </div>
      </div>

      <div className="px-5 lg:px-0 pt-3 lg:pt-0 pb-4 grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        {/* main column */}
        <div className="space-y-4">
          {hero}
          {showBalance && <div className="lg:hidden"><Balance /></div>}
          <div className="hidden lg:block"><Balance /></div>
          <div className={`grid grid-cols-3 gap-3 ${state === 'live' ? 'lg:hidden' : ''}`}>
            {stats.map(([i, t, v, l]) => <Stat key={l} icon={i} tone={t} value={v} label={l} />)}
          </div>
          {state === 'call' && (
            <div className="flex items-center gap-2 rounded-xl bg-gold-50 px-3 py-2.5 text-[12px] text-gold-600"><Icon name="alert" size={14} /> New call requests are paused while you're busy.</div>
          )}
          {state === 'live' && (
            <>
              <button onClick={() => nav('/live/summary')} className="btn-danger-outline"><Icon name="x" size={16} /> End broadcast</button>
              <div>
                <SectionTitle className="mb-2">Top gifters</SectionTitle>
                <div className="card px-4 divide-y divide-black/5">
                  {[['Neel', 'Crown ×2', '4,200'], ['Aman', 'Rocket ×1', '2,100']].map(([n, g, b]) => (
                    <div key={n} className="flex items-center gap-3 py-3">
                      <Avatar name={n} size={40} />
                      <div className="flex-1"><p className="text-[15px] font-semibold text-ink-900">{n}</p><p className="text-[12px] text-ink-400">{g}</p></div>
                      <span className="text-[13px] font-bold text-ink-900">{b} <span className="text-ink-400 font-medium">beans</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="card p-3.5 flex items-center gap-3">
            <span className="grid place-items-center h-10 w-10 rounded-full border-2 border-dashed border-brand-300 text-brand-500 shrink-0"><Icon name="trending-up" size={16} /></span>
            <div><p className="text-[14px] font-semibold text-ink-900">Peak hours start at 8 PM</p><p className="text-[12px] text-ink-400">Hosts online at peak earn 2.4× more on average.</p></div>
          </div>
          {(state === 'offline' || state === 'online') && <RecentCard />}
        </div>

        {/* right rail */}
        <div className="space-y-4">
          {(state === 'online' || state === 'call') && <QueueCard {...q1} />}
          {state === 'online' && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => nav('/call/incoming')} className="btn-outline text-[13px]">Preview call</button>
              <button onClick={() => go('live')} className="btn-outline text-[13px]">Go live</button>
            </div>
          )}
          {state === 'offline' && (
            <div className="hidden lg:block card p-4">
              <SectionTitle className="mb-2">Today's tip</SectionTitle>
              <p className="text-[13px] text-ink-500">Hosts who add a short bio and 3+ gallery photos get <span className="font-semibold text-ink-900">40% more calls</span>. Complete your profile before going online.</p>
              <button onClick={() => nav('/settings/edit-profile')} className="btn-outline mt-3 text-[13px]">Edit profile</button>
            </div>
          )}
          {state === 'live' && (
            <div className="hidden lg:grid grid-cols-1 gap-3">
              <Stat icon="eye" tone="text-brand-600" value="1.2k" label="Viewers" />
              <Stat icon="gift" tone="text-gold-400" value="64" label="Gifts" />
              <Stat icon="heart" tone="text-rose-500" value="9.4k" label="Likes" />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
