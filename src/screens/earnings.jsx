import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { PlainHeader, TopBar, Segmented, IconBadge, SectionTitle } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { earningsHistory } from '../data.js'

/* 25 — Earnings */
export function Earnings() {
  const nav = useNavigate()
  const week = [['M', 1.2], ['T', 1.8], ['W', 0.98], ['T', 2.4], ['F', 3.1], ['S', 2.0], ['S', 0.9]]
  const max = 3.1
  return (
    <AppLayout tab="/earnings" title="Earnings" maxW="xl" bg="canvas">
      <PlainHeader title="Earnings" sub="August 2026" right={<button onClick={() => nav('/earnings/statement')} className="h-10 w-10 grid place-items-center rounded-xl border border-black/10 text-ink-700"><Icon name="download" size={18} /></button>} />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-4 grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-4">
          <div className="rounded-2xl p-4 lg:p-5 text-white bg-gradient-to-br from-brand-600 to-brand-800 shadow-pop relative">
            <button onClick={() => nav('/settings/payouts')} className="absolute top-4 right-4 h-9 w-9 grid place-items-center rounded-xl bg-white/15"><Icon name="wallet" size={17} /></button>
            <p className="text-[11px] font-semibold tracking-wide text-white/70 uppercase">Available balance</p>
            <p className="text-[32px] font-extrabold mt-1">₹ 12,480</p>
            <p className="text-[12px] text-white/70">62,400 beans</p>
            <svg viewBox="0 0 300 50" className="mt-2 w-full h-10"><polyline points="0,40 60,34 110,20 160,26 210,12 260,22 300,16" fill="none" stroke="#e9c46a" strokeWidth="2.5" /></svg>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['phone', '₹ 8,120', 'Calls', 'text-brand-600'], ['gift', '₹ 3,240', 'Gifts', 'text-gold-400'], ['live', '₹ 1,120', 'Live', 'text-rose-500']].map(([i, v, l, c]) => (
              <div key={l} className="card p-3.5"><Icon name={i} size={16} className={c} /><p className="text-[15px] font-extrabold text-ink-900 mt-0.5">{v}</p><p className="text-[12px] text-ink-400">{l}</p></div>
            ))}
          </div>
          <div>
            <SectionTitle className="mb-2">Last 7 days</SectionTitle>
            <div className="card p-4">
              <div className="flex items-end justify-between gap-2 h-40 lg:h-52">
                {week.map(([d, v], i) => (
                  <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5">
                    <span className="text-[10px] font-bold text-brand-600">{v >= 1 ? `${v}k` : Math.round(v * 1000)}</span>
                    <div className="w-full rounded-md bg-brand-500 min-h-[4px]" style={{ height: `${(v / max) * 78}%` }} />
                    <span className="text-[10px] text-ink-400 shrink-0">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button onClick={() => nav('/withdraw')} className="btn-gold"><Icon name="wallet" size={17} /> Withdraw ₹ 12,480</button>
          <button onClick={() => nav('/earnings/breakdown')} className="btn-outline">Breakdown</button>
          <button onClick={() => nav('/earnings/history')} className="btn-outline">History</button>
          <button onClick={() => nav('/earnings/statement')} className="btn-outline">Statement</button>
          <div className="card p-3.5 flex items-center gap-3">
            <span className="grid place-items-center h-10 w-10 rounded-full border-2 border-dashed border-brand-300 text-brand-500 shrink-0"><Icon name="trending-up" size={16} /></span>
            <div><p className="text-[13px] font-semibold text-ink-900">Peak hours at 8 PM</p><p className="text-[12px] text-ink-400">Earn 2.4× more on average.</p></div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

/* 26 — Breakdown */
export function Breakdown() {
  const sources = [
    ['Video calls', 10220, 'bg-brand-600', 1],
    ['Voice calls', 2960, 'bg-blue-500', 0.29],
    ['Gifts', 2180, 'bg-gold-400', 0.21],
    ['Live streams', 1120, 'bg-rose-500', 0.11],
  ]
  return (
    <AppLayout tab="/earnings" title="Breakdown" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Breakdown" sub="1–31 August" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-6">
        <div className="card p-4 flex items-center justify-between"><span className="text-[14px] text-ink-500">Gross earnings</span><span className="text-[20px] font-extrabold text-gold-500">₹ 16,480</span></div>
        <SectionTitle className="mt-5 mb-2">By source</SectionTitle>
        <div className="card p-4 space-y-3.5">
          {sources.map(([l, v, c, w]) => (
            <div key={l}>
              <div className="flex justify-between text-[14px]"><span className="font-semibold text-ink-900">{l}</span><span className="font-bold text-gold-500">₹ {v.toLocaleString()}</span></div>
              <div className="h-1.5 rounded-full bg-black/5 mt-1.5"><div className={`h-full rounded-full ${c}`} style={{ width: `${w * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <SectionTitle className="mt-5 mb-2">Deductions</SectionTitle>
        <div className="card p-4 text-[14px]">
          <div className="flex justify-between py-1.5"><span className="text-ink-500">Platform commission (20%)</span><span className="font-semibold text-rose-500">– ₹ 3,296</span></div>
          <div className="flex justify-between py-1.5"><span className="text-ink-500">TDS (1%)</span><span className="font-semibold text-rose-500">– ₹ 165</span></div>
          <div className="flex justify-between pt-2 mt-1 border-t border-black/5"><span className="font-bold text-ink-900">Net payable</span><span className="font-extrabold text-gold-500">₹ 13,019</span></div>
        </div>
      </div>
    </AppLayout>
  )
}

/* 27 — History */
export function EarningsHistory() {
  const [f, setF] = useState('All')
  return (
    <AppLayout tab="/earnings" title="History" back bottomNav={false} maxW="lg" bg="canvas">
      <TopBar title="History" right={<button className="h-9 w-9 grid place-items-center rounded-xl border border-black/10 text-ink-700"><Icon name="search" size={17} /></button>} />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-6">
        <Segmented options={['All', 'Calls', 'Gifts', 'Live']} value={f} onChange={setF} />
        {earningsHistory.map((g) => (
          <div key={g.day}>
            <SectionTitle className="mt-5 mb-1">{g.day}</SectionTitle>
            <div className="card px-4 divide-y divide-black/5">
              {g.items.map((it, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <IconBadge name={it.icon} tone={it.icon === 'gift' ? 'gold' : it.icon === 'live' ? 'rose' : 'brand'} />
                  <div className="flex-1"><p className="text-[14px] font-semibold text-ink-900">{it.title}</p><p className="text-[12px] text-ink-400">{it.sub}</p></div>
                  <span className="text-[14px] font-bold text-emerald-600">+ ₹ {it.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}

/* 28 — Statement */
export function Statement() {
  return (
    <AppLayout tab="/earnings" title="Statement" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Statement" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-4">
        <div className="card p-4 flex items-center gap-3">
          <IconBadge name="file-text" tone="brand" />
          <div><p className="text-[15px] font-semibold text-ink-900">Monthly statement</p><p className="text-[12px] text-ink-400">PDF or CSV, emailed to you</p></div>
        </div>
        <div className="mt-4 space-y-3">
          <div><span className="label">Period</span><button className="input flex items-center justify-between"><span>1 Aug – 31 Aug 2026</span><Icon name="chevron-right" size={16} className="text-ink-300" /></button></div>
          <div><span className="label">Format</span><button className="input flex items-center justify-between"><span>PDF</span><Icon name="chevron-right" size={16} className="text-ink-300" /></button></div>
          <div><span className="label">Email to</span><input className="input" defaultValue="ayesha@example.com" /></div>
        </div>
        <SectionTitle className="mt-5 mb-1">Previous statements</SectionTitle>
        <div className="card px-4 divide-y divide-black/5">
          {[['July 2026', 'PDF · 214 KB'], ['June 2026', 'PDF · 198 KB']].map(([m, s]) => (
            <div key={m} className="flex items-center gap-3 py-3">
              <IconBadge name="file-text" tone="brand" />
              <div className="flex-1"><p className="text-[14px] font-semibold text-ink-900">{m}</p><p className="text-[12px] text-ink-400">{s}</p></div>
              <button className="h-9 w-9 grid place-items-center rounded-xl text-ink-500"><Icon name="download" size={18} /></button>
            </div>
          ))}
        </div>
        <button className="btn-primary mt-5"><Icon name="download" size={16} /> Generate statement</button>
      </div>
    </AppLayout>
  )
}
