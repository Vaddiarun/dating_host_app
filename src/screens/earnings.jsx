import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { PlainHeader, TopBar, Segmented, IconBadge, SectionTitle, ErrorCard } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { earnings as earningsApi } from '../api/index.js'
import { rupees, clockTime, dayLabel, beans as beansFmt } from '../lib/format.js'
import { errorMessage } from '../lib/errors.js'

/* 25 — Earnings */
export function Earnings() {
  const nav = useNavigate()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = () => {
    setLoading(true)
    setErr('')
    earningsApi.summary().then(setSummary).catch((e) => setErr(errorMessage(e, 'Could not load your earnings.'))).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const week = (summary?.last7Days || []).map((d) => {
    const dt = new Date(d.date)
    return { label: dt.toLocaleDateString('en-IN', { weekday: 'narrow' }), paise: d.amountPaise || 0 }
  })
  const maxPaise = Math.max(1, ...week.map((d) => d.paise))

  return (
    <AppLayout tab="/earnings" title="Earnings" maxW="xl" bg="canvas">
      <PlainHeader title="Earnings" right={<button onClick={() => nav('/earnings/statement')} className="h-10 w-10 grid place-items-center rounded-xl border border-black/10 text-ink-700"><Icon name="download" size={18} /></button>} />
      {loading ? (
        <div className="px-5 lg:px-0 pt-4 pb-4 animate-pulse space-y-4"><div className="h-32 rounded-2xl bg-black/[.06]" /></div>
      ) : err ? (
        <ErrorCard message={err} onRetry={load} className="px-5 lg:px-0" />
      ) : (
        <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-4 grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="space-y-4">
            <div className="rounded-2xl p-4 lg:p-5 text-white bg-gradient-to-br from-brand-600 to-brand-800 shadow-pop relative">
              <button onClick={() => nav('/settings/payouts')} className="absolute top-4 right-4 h-9 w-9 grid place-items-center rounded-xl bg-white/15"><Icon name="wallet" size={17} /></button>
              <p className="text-[11px] font-semibold tracking-wide text-white/70 uppercase">Available balance</p>
              <p className="text-[32px] font-extrabold mt-1">{rupees(summary?.availableBalancePaise)}</p>
              <p className="text-[12px] text-white/70">{beansFmt(summary?.beanBalance)} beans</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[['phone', summary?.bySource?.calls?.amountPaise, 'Calls', 'text-brand-600'], ['gift', summary?.bySource?.gifts?.amountPaise, 'Gifts', 'text-gold-400'], ['live', summary?.bySource?.live?.amountPaise, 'Live', 'text-rose-500']].map(([i, v, l, c]) => (
                <div key={l} className="card p-3.5"><Icon name={i} size={16} className={c} /><p className="text-[15px] font-extrabold text-ink-900 mt-0.5">{rupees(v)}</p><p className="text-[12px] text-ink-400">{l}</p></div>
              ))}
            </div>
            <div>
              <SectionTitle className="mb-2">Last 7 days</SectionTitle>
              <div className="card p-4">
                <div className="flex items-end justify-between gap-2 h-40 lg:h-52">
                  {week.map((d, i) => (
                    <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5">
                      <span className="text-[10px] font-bold text-brand-600">{rupees(d.paise)}</span>
                      <div className="w-full rounded-md bg-brand-500 min-h-[4px]" style={{ height: `${Math.max((d.paise / maxPaise) * 78, 2)}%` }} />
                      <span className="text-[10px] text-ink-400 shrink-0">{d.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button onClick={() => nav('/withdraw')} className="btn-gold"><Icon name="wallet" size={17} /> Withdraw {rupees(summary?.availableBalancePaise)}</button>
            <button onClick={() => nav('/earnings/breakdown')} className="btn-outline">Breakdown</button>
            <button onClick={() => nav('/earnings/history')} className="btn-outline">History</button>
            <button onClick={() => nav('/earnings/statement')} className="btn-outline">Statement</button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

/* 26 — Breakdown */
export function Breakdown() {
  const [b, setB] = useState(null)
  const [err, setErr] = useState('')
  const load = () => { setErr(''); earningsApi.breakdown().then(setB).catch((e) => setErr(errorMessage(e, 'Could not load your breakdown.'))) }
  useEffect(load, [])

  const sources = [
    ['Video calls', b?.bySource?.videoCalls, 'bg-brand-600'],
    ['Voice calls', b?.bySource?.voiceCalls, 'bg-blue-500'],
    ['Gifts', b?.bySource?.gifts, 'bg-gold-400'],
    ['Live streams', b?.bySource?.liveStreams, 'bg-rose-500'],
  ]
  const gross = b?.grossEarningsPaise || 1

  return (
    <AppLayout tab="/earnings" title="Breakdown" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Breakdown" sub="This month" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-6">
        <ErrorCard message={err} onRetry={load} className="mb-3" />
        <div className="card p-4 flex items-center justify-between"><span className="text-[14px] text-ink-500">Gross earnings</span><span className="text-[20px] font-extrabold text-gold-500">{rupees(b?.grossEarningsPaise)}</span></div>
        <SectionTitle className="mt-5 mb-2">By source</SectionTitle>
        <div className="card p-4 space-y-3.5">
          {sources.map(([l, v, c]) => (
            <div key={l}>
              <div className="flex justify-between text-[14px]"><span className="font-semibold text-ink-900">{l}</span><span className="font-bold text-gold-500">{rupees(v)}</span></div>
              <div className="h-1.5 rounded-full bg-black/5 mt-1.5"><div className={`h-full rounded-full ${c}`} style={{ width: `${Math.min(100, ((v || 0) / gross) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
        <SectionTitle className="mt-5 mb-2">Deductions</SectionTitle>
        <div className="card p-4 text-[14px]">
          <div className="flex justify-between py-1.5"><span className="text-ink-500">Platform commission</span><span className="font-semibold text-rose-500">– {rupees(b?.deductions?.platformCommissionPaise)}</span></div>
          <div className="flex justify-between py-1.5"><span className="text-ink-500">TDS</span><span className="font-semibold text-rose-500">– {rupees(b?.deductions?.tdsPaise)}</span></div>
          <div className="flex justify-between pt-2 mt-1 border-t border-black/5"><span className="font-bold text-ink-900">Net payable</span><span className="font-extrabold text-gold-500">{rupees(b?.netPayablePaise)}</span></div>
        </div>
      </div>
    </AppLayout>
  )
}

/* 27 — History */
export function EarningsHistory() {
  const [f, setF] = useState('All')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = () => {
    const type = { All: 'all', Calls: 'calls', Gifts: 'gifts', Live: 'live' }[f]
    setLoading(true)
    setErr('')
    earningsApi.history(type, 1, 50).then((res) => setItems(res.items || [])).catch((e) => setErr(errorMessage(e, 'Could not load your history.'))).finally(() => setLoading(false))
  }
  useEffect(load, [f]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = items.reduce((acc, it) => {
    const day = dayLabel(it.when)
    ;(acc[day] ||= []).push(it)
    return acc
  }, {})

  const iconFor = (t) => (t === 'gift' ? 'gift' : t === 'live' ? 'live' : 'phone')
  const titleFor = (it) => {
    if (it.type === 'gift') return `Gift · ${it.giftName || 'Gift'}`
    if (it.type === 'live') return 'Live stream'
    return `${it.callType === 'voice' ? 'Voice' : 'Video'} call`
  }

  return (
    <AppLayout tab="/earnings" title="History" back bottomNav={false} maxW="lg" bg="canvas">
      <TopBar title="History" right={<button className="h-9 w-9 grid place-items-center rounded-xl border border-black/10 text-ink-700"><Icon name="search" size={17} /></button>} />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-6">
        <Segmented options={['All', 'Calls', 'Gifts', 'Live']} value={f} onChange={setF} />
        {loading && <p className="text-[13px] text-ink-400 mt-6 text-center">Loading…</p>}
        {!loading && err && <ErrorCard message={err} onRetry={load} className="mt-6" />}
        {!loading && !err && items.length === 0 && <p className="text-[13px] text-ink-400 mt-6 text-center">Nothing here yet.</p>}
        {!err && Object.entries(groups).map(([day, list]) => (
          <div key={day}>
            <SectionTitle className="mt-5 mb-1">{day}</SectionTitle>
            <div className="card px-4 divide-y divide-black/5">
              {list.map((it, i) => (
                <div key={it.id || i} className="flex items-center gap-3 py-3">
                  <IconBadge name={iconFor(it.type)} tone={it.type === 'gift' ? 'gold' : it.type === 'live' ? 'rose' : 'brand'} />
                  <div className="flex-1"><p className="text-[14px] font-semibold text-ink-900">{titleFor(it)}</p><p className="text-[12px] text-ink-400">{clockTime(it.when)}</p></div>
                  <span className="text-[14px] font-bold text-emerald-600">+ {rupees(it.amountPaise)}</span>
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
// yyyy-mm-dd in local time (not toISOString, which shifts to UTC and can land on the wrong day)
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function Statement() {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const [from, setFrom] = useState(isoDate(monthStart))
  const [to, setTo] = useState(isoDate(today))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const download = async () => {
    setBusy(true)
    setErr('')
    try {
      await earningsApi.downloadStatement(from, to)
    } catch (e) {
      setErr(errorMessage(e, 'Could not generate your statement.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout tab="/earnings" title="Statement" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Statement" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-4">
        <div className="card p-4 flex items-center gap-3">
          <IconBadge name="file-text" tone="brand" />
          <div><p className="text-[15px] font-semibold text-ink-900">Earnings statement</p><p className="text-[12px] text-ink-400">Exported as a CSV file</p></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div><span className="label">From</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} max={to} /></div>
          <div><span className="label">To</span><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} min={from} max={isoDate(today)} /></div>
        </div>
        <ErrorCard message={err} onRetry={download} compact className="mt-3" />
        <button onClick={download} disabled={busy} className="btn-primary mt-4 disabled:opacity-60"><Icon name="download" size={16} /> {busy ? 'Preparing…' : 'Download CSV'}</button>
      </div>
    </AppLayout>
  )
}
