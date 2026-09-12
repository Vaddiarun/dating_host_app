import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { PlainHeader, ResultScreen, KV, IconBadge, ErrorCard } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { withdrawals as withdrawalsApi, earnings as earningsApi, profile as profileApi, config as configApi } from '../api/index.js'
import { rupees, rupeesRaw } from '../lib/format.js'
import { errorMessage } from '../lib/errors.js'

/* 29 — Withdraw */
export function Withdraw() {
  const nav = useNavigate()
  const [summary, setSummary] = useState(null)
  const [primary, setPrimary] = useState(null)
  const [paisePerBean, setPaisePerBean] = useState(1)
  const [amt, setAmt] = useState('')
  const [err, setErr] = useState('')
  const [loadErr, setLoadErr] = useState('')

  const load = () => {
    setLoadErr('')
    earningsApi.summary().then((s) => { setSummary(s); setAmt(String(rupeesRaw(s.availableBalancePaise))) }).catch((e) => setLoadErr(errorMessage(e, 'Could not load your balance.')))
    profileApi.listPayoutMethods().then((res) => setPrimary((res.methods || []).find((m) => m.isPrimary) || res.methods?.[0] || null)).catch((e) => setLoadErr(errorMessage(e, 'Could not load your payout methods.')))
    // The bean↔paise rate is admin-configurable and can move — always read it from /config
    // rather than inferring it from a balance snapshot. 1:1 is just the safe pre-load default.
    configApi.get().then((c) => { if (c?.paisePerBean) setPaisePerBean(c.paisePerBean) }).catch(() => {})
  }
  useEffect(load, [])

  const availablePaise = summary?.availableBalancePaise ?? 0
  const availableRupees = rupeesRaw(availablePaise)
  const amountRupees = Number(amt.replace(/[^\d]/g, '')) || 0
  const tooLow = amountRupees > 0 && amountRupees < 10
  const tooHigh = amountRupees > availableRupees

  const go = () => {
    if (amountRupees < 10) { setErr('Minimum withdrawal is ₹ 10'); return }
    if (tooHigh) { setErr('Amount exceeds your available balance'); return }
    if (!primary) { setErr('Add a payout method first'); return }
    const beans = Math.round((amountRupees * 100) / paisePerBean)
    nav('/withdraw/confirm', { state: { beans } })
  }

  return (
    <AppLayout tab="/earnings" title="Withdraw" maxW="md" bg="canvas">
      <PlainHeader title="Withdraw" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-4">
        <ErrorCard message={loadErr} onRetry={load} className="mb-3" />
        <div className="rounded-2xl bg-gold-50 px-4 py-3.5 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-gold-600">Available balance</span>
          <span className="text-[20px] font-extrabold text-gold-500">{rupees(availablePaise)}</span>
        </div>
        <div className="mt-4">
          <span className="label">Amount</span>
          <input value={`₹ ${amt}`} onChange={(e) => setAmt(e.target.value.replace(/[^\d]/g, ''))} className={`input text-[16px] ${tooLow || tooHigh ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`} />
          {tooLow && <p className="text-[12px] text-rose-500 mt-1">Minimum withdrawal is ₹ 10</p>}
          {tooHigh && <p className="text-[12px] text-rose-500 mt-1">Exceeds available balance</p>}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {['₹ 500', '₹ 1,000', 'Max'].map((q) => (
            <button key={q} onClick={() => setAmt(q === 'Max' ? String(availableRupees) : q.replace(/[₹, ]/g, ''))} className="rounded-xl border border-black/10 bg-white py-2.5 text-[13px] font-semibold text-ink-700">{q}</button>
          ))}
        </div>
        {primary ? (
          <div className="card mt-3 p-3.5 flex items-center gap-3">
            <IconBadge name="card" tone="brand" />
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-ink-900">{primary.type === 'upi' ? primary.details?.vpa : `${primary.details?.accountHolderName || 'Bank'} •••• ${String(primary.details?.accountNumber || '').slice(-4)}`}</p>
              <p className="text-[12px] text-ink-400">{primary.type === 'upi' ? 'UPI' : 'Bank transfer'}</p>
            </div>
            <span className="h-6 w-6 grid place-items-center rounded-full bg-emerald-500 text-white"><Icon name="check" size={13} /></span>
          </div>
        ) : (
          <button onClick={() => nav('/settings/payouts/add')} className="card mt-3 p-3.5 flex items-center gap-3 w-full text-left">
            <IconBadge name="card" tone="gold" />
            <div className="flex-1"><p className="text-[14px] font-semibold text-ink-900">Add a payout method</p><p className="text-[12px] text-ink-400">Required before withdrawing</p></div>
          </button>
        )}
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-black/[.04] px-3 py-2.5 text-[12px] text-ink-400">
          <Icon name="clock" size={14} className="mt-0.5 shrink-0" /> KYC must be approved before your first withdrawal.
        </div>
        <ErrorCard message={err} compact className="mt-2" />
        <button onClick={go} className={`btn-primary mt-4 ${tooLow || tooHigh ? 'opacity-60' : ''}`}>Continue</button>
      </div>
    </AppLayout>
  )
}

/* 34 — Confirm (this is where the withdrawal is actually requested) */
export function WithdrawConfirm() {
  const nav = useNavigate()
  const location = useLocation()
  const beans = location.state?.beans
  const [wd, setWd] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(!!beans)

  useEffect(() => {
    if (!beans) { nav('/withdraw', { replace: true }); return }
    withdrawalsApi.request(beans)
      .then(setWd)
      .catch((e) => setErr(errorMessage(e, 'Could not submit withdrawal request.')))
      .finally(() => setBusy(false))
  }, [beans, nav])

  if (busy) {
    return (
      <AppLayout tab="/earnings" title="Confirm withdrawal" back bottomNav={false} maxW="md" bg="canvas">
        <PlainHeader title="Confirm withdrawal" />
        <p className="px-5 pt-10 text-center text-[14px] text-ink-400">Submitting your request…</p>
      </AppLayout>
    )
  }

  if (err) {
    return (
      <AppLayout tab="/earnings" title="Confirm withdrawal" back bottomNav={false} maxW="md" bg="canvas">
        <PlainHeader title="Confirm withdrawal" />
        <ErrorCard message={err} onRetry={() => nav('/withdraw')} className="px-5" />
      </AppLayout>
    )
  }

  return (
    <AppLayout tab="/earnings" title="Confirm withdrawal" back bottomNav={false} maxW="md" bg="canvas">
      <PlainHeader title="Confirm withdrawal" />
      <div className="px-5 lg:px-0 pt-8 lg:pt-2 pb-4">
        <div className="flex flex-col items-center text-center">
          <IconBadge name="wallet" tone="brand" size={56} />
          <p className="text-[13px] text-ink-400 mt-3">You will receive</p>
          <p className="text-[30px] font-extrabold text-gold-500">{rupees(wd?.netPayoutPaise)}</p>
        </div>
        <div className="card mt-5 p-4">
          <KV k="Requested" v={rupees(wd?.convertedAmountPaise)} strong />
          <KV k="Processing fee" v={`– ${rupees(wd?.processingFeePaise)}`} danger />
          <KV k="TDS" v={`– ${rupees(wd?.tdsPaise)}`} danger />
          <div className="border-t border-black/5 mt-1 pt-1"><KV k="Net payout" v={<span className="text-gold-500">{rupees(wd?.netPayoutPaise)}</span>} strong /></div>
        </div>
        <div className="card mt-3 p-3.5 flex items-center gap-3">
          <IconBadge name="card" tone="brand" />
          <div><p className="text-[14px] font-semibold text-ink-900 capitalize">{wd?.status}</p><p className="text-[12px] text-ink-400">2–3 business days</p></div>
        </div>
        <div className="mt-5 space-y-3">
          <button onClick={() => nav(`/withdraw/status/${wd.id}`)} className="btn-primary"><Icon name="check" size={16} /> Done</button>
        </div>
      </div>
    </AppLayout>
  )
}

/* 35–38 — status states (design-review presets, used when :state isn't a real withdrawal id) */
const DEMO_STATES = {
  submitted: { tone: 'gold', icon: 'clock', title: 'Request submitted', desc: 'Awaiting processing' },
  approved: { tone: 'green', icon: 'check', title: 'Approved', desc: 'Queued for bank transfer' },
  processing: { tone: 'gold', icon: 'clock', title: 'Processing', desc: 'Sent to your bank' },
  paid: { tone: 'green', icon: 'check', title: 'Paid out', desc: 'Credited to your account' },
  rejected: { tone: 'rose', icon: 'x', title: 'Request rejected', desc: 'Declined — update payout details and try again' },
  failed: { tone: 'brand', icon: 'alert', title: 'Transfer failed', desc: 'Bank returned the transfer' },
}

const STATUS_TONE = {
  processing: { tone: 'gold', icon: 'clock', title: 'Processing' },
  paid: { tone: 'green', icon: 'check', title: 'Paid out' },
  failed: { tone: 'brand', icon: 'alert', title: 'Transfer failed' },
  rejected: { tone: 'rose', icon: 'x', title: 'Request rejected' },
  submitted: { tone: 'gold', icon: 'clock', title: 'Request submitted' },
}

export function WithdrawStatus() {
  const { state } = useParams()
  const nav = useNavigate()
  const isDemo = Object.prototype.hasOwnProperty.call(DEMO_STATES, state)
  const [wd, setWd] = useState(null)
  const [loading, setLoading] = useState(!isDemo)
  const [loadErr, setLoadErr] = useState('')

  const load = () => {
    if (isDemo) return
    setLoadErr('')
    withdrawalsApi.get(state).then(setWd).catch((e) => setLoadErr(errorMessage(e, 'Could not load this withdrawal.'))).finally(() => setLoading(false))
  }
  useEffect(load, [state, isDemo]) // eslint-disable-line react-hooks/exhaustive-deps

  const preset = isDemo ? DEMO_STATES[state] : (STATUS_TONE[wd?.status] || STATUS_TONE.processing)
  const noteTone = { gold: 'bg-gold-50 text-gold-600', green: 'bg-emerald-50 text-emerald-700', rose: 'bg-rose-50 text-rose-500' }

  if (loading) {
    return (
      <AppLayout tab="/earnings" title="Withdrawal" back bottomNav={false} maxW="md" bg="white">
        <PlainHeader title="Withdrawal" />
        <p className="px-5 pt-10 text-center text-[14px] text-ink-400">Loading…</p>
      </AppLayout>
    )
  }

  return (
    <AppLayout tab="/earnings" title={preset.title} back bottomNav={false} maxW="md" bg="white">
      <PlainHeader title={preset.title} />
      <div className="py-6">
        <ErrorCard message={loadErr} onRetry={load} className="px-5 mb-4" />
        <ResultScreen tone={preset.tone} icon={preset.icon} title={preset.title} desc={isDemo ? preset.desc : undefined}>
          {!isDemo && wd && (
            <div className={`rounded-xl px-3.5 py-3 text-left text-[13px] font-semibold flex items-start gap-2 ${noteTone[preset.tone] || noteTone.gold}`}>
              <Icon name={preset.icon} size={15} className="mt-0.5 shrink-0" />
              <span>{wd.failureReason || `Payout status: ${wd.status}`}</span>
            </div>
          )}
          {!isDemo && wd && (
            <div className="card p-4 text-left">
              <KV k="Reference" v={wd.id.slice(0, 8).toUpperCase()} strong />
              <KV k="Amount" v={<span className="text-gold-500">{rupees(wd.convertedAmountPaise)}</span>} strong />
              <KV k="Net payout" v={rupees(wd.netPayoutPaise)} strong />
            </div>
          )}
          {wd?.status === 'rejected' ? (
            <button onClick={() => nav('/settings/payouts/add')} className="btn-danger-outline"><Icon name="card" size={16} /> Update payout details</button>
          ) : (
            <button onClick={() => nav('/earnings')} className="btn-outline">Back to earnings</button>
          )}
        </ResultScreen>
      </div>
    </AppLayout>
  )
}
