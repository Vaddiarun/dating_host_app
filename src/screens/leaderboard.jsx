import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { Avatar, Segmented, FloatingGoLive } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { compactBeans } from '../lib/format.js'

/* No leaderboard endpoint exists on the backend yet — these are placeholder rankings so the
 * screen can be built and reviewed now; swap for a real /leaderboard fetch once it exists. */
const SPENDERS = {
  'This Week': [
    { name: 'MiraStone', level: 'Lv22', beans: 8210 },
    { name: 'AaravLive', level: 'Lv19', beans: 6910 },
    { name: 'NoraWave', level: 'Lv17', beans: 5410 },
    { name: 'RohanTalks', level: 'Lv16', beans: 4810 },
    { name: 'ZoyaCreates', level: 'Lv15', beans: 3710 },
    { name: 'KianWorld', level: 'Lv12', beans: 2910 },
  ],
  'Last Week': [
    { name: 'RohanTalks', level: 'Lv16', beans: 9040 },
    { name: 'MiraStone', level: 'Lv22', beans: 7620 },
    { name: 'ZoyaCreates', level: 'Lv15', beans: 6110 },
    { name: 'AaravLive', level: 'Lv19', beans: 4430 },
    { name: 'KianWorld', level: 'Lv12', beans: 3280 },
    { name: 'NoraWave', level: 'Lv17', beans: 2050 },
  ],
}

const PERFORMERS = {
  'This Week': [
    { name: 'MiraStone', level: 'Lv22', beans: 8310 },
    { name: 'AaravLive', level: 'Lv19', beans: 6610 },
    { name: 'NoraWave', level: 'Lv17', beans: 5410 },
    { name: 'RohanTalks', level: 'Lv16', beans: 4810 },
    { name: 'ZoyaCreates', level: 'Lv15', beans: 3710 },
    { name: 'KianWorld', level: 'Lv12', beans: 2910 },
  ],
  'Last Week': [
    { name: 'AaravLive', level: 'Lv19', beans: 8840 },
    { name: 'NoraWave', level: 'Lv17', beans: 7120 },
    { name: 'MiraStone', level: 'Lv22', beans: 5990 },
    { name: 'ZoyaCreates', level: 'Lv15', beans: 4150 },
    { name: 'RohanTalks', level: 'Lv16', beans: 3070 },
    { name: 'KianWorld', level: 'Lv12', beans: 1980 },
  ],
}

function Header({ title }) {
  const nav = useNavigate()
  return (
    <div className="lg:hidden relative flex items-center justify-center px-4 pt-4 pb-1 text-white">
      <button onClick={() => nav(-1)} className="absolute left-4 h-9 w-9 grid place-items-center rounded-full bg-white/10"><Icon name="chevron-left" size={19} /></button>
      <h1 className="text-[17px] font-extrabold">{title}</h1>
    </div>
  )
}

/* Unified pill track (one bg housing both tabs, active tab gets its own white capsule) —
 * distinct from the shared <Segmented> (which renders two separate bordered pills) because
 * the design here calls for the two to visually share one enclosing track. */
function WeekToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-full bg-white/15 p-1">
      {['This Week', 'Last Week'].map((label) => (
        <button
          key={label}
          onClick={() => onChange(label)}
          className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition ${value === label ? 'bg-white text-brand-700' : 'text-white/70'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Podium({ top3 }) {
  const order = [top3[1], top3[0], top3[2]] // silver, gold, bronze
  return (
    <div className="flex items-end justify-center gap-5 pt-3 pb-6">
      {order.map((p) => {
        const first = p === top3[0]
        return (
          <div key={p.name} className={`flex flex-col items-center ${first ? '-mt-4' : ''}`}>
            <div className="relative">
              {first && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[22px] leading-none">👑</span>}
              <Avatar name={p.name} size={first ? 68 : 52} ring="rgba(255,255,255,.8)" />
            </div>
            <p className="text-[12px] font-bold text-white mt-1.5 truncate max-w-[76px]">{p.name}</p>
            <span className="pill bg-white/15 text-white text-[10px] mt-0.5">{p.level}</span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-gold-300 mt-1"><Icon name="gift" size={11} /> {compactBeans(p.beans)} beans</span>
          </div>
        )
      })}
    </div>
  )
}

function Row({ rank, p }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="w-5 shrink-0 text-[13px] font-bold text-ink-400 text-center">{rank}</span>
      <Avatar name={p.name} size={40} />
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <p className="text-[14px] font-semibold text-ink-900 truncate">{p.name}</p>
        <span className="pill bg-black/5 text-ink-400 text-[10px] shrink-0">{p.level}</span>
      </div>
      <span className="flex items-center gap-1 text-[13px] font-bold text-ink-900 shrink-0"><Icon name="gift" size={13} className="text-gold-500" /> {compactBeans(p.beans)} beans</span>
    </div>
  )
}

function Leaderboard({ title, data }) {
  const [week, setWeek] = useState('This Week')
  const list = data[week]
  const top3 = list.slice(0, 3)
  const rest = list.slice(3)

  return (
    <AppLayout title={title} back maxW="lg" bg="white" pad={false}>
      <div className="lg:hidden bg-gradient-to-br from-brand-700 via-brand-800 to-night-900 rounded-b-3xl">
        <Header title={title} />
        <div className="flex justify-center px-5 pt-3">
          <WeekToggle value={week} onChange={setWeek} />
        </div>
        <Podium top3={top3} />
      </div>

      <div className="lg:hidden px-5 pb-24 pt-3 divide-y divide-black/5">
        {rest.map((p, i) => <Row key={p.name} rank={i + 4} p={p} />)}
      </div>
      <FloatingGoLive />

      {/* desktop */}
      <div className="hidden lg:block px-8 py-8">
        <div className="flex items-center justify-between mb-4">
          <Segmented options={['This Week', 'Last Week']} value={week} onChange={setWeek} />
        </div>
        <div className="card p-4 divide-y divide-black/5">
          {list.map((p, i) => <Row key={p.name} rank={i + 1} p={p} />)}
        </div>
      </div>
    </AppLayout>
  )
}

export function TopSpenders() {
  return <Leaderboard title="Top Spenders" data={SPENDERS} altTo="/leaderboard/performers" altLabel="Top Performers" />
}

export function TopPerformers() {
  return <Leaderboard title="Top Performers" data={PERFORMERS} altTo="/leaderboard/spenders" altLabel="Top Spenders" />
}
