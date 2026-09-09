import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { PlainHeader, ResultScreen, KV, IconBadge } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'

/* 29–33 — Withdraw */
export function Withdraw() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const variant = sp.get('v') || 'normal'
  const [amt, setAmt] = useState(variant === 'min' ? '200' : '10,000')
  const locked = variant === 'locked'
  const tooLow = variant === 'min'
  return (
    <AppLayout tab="/earnings" title="Withdraw" maxW="md" bg="canvas">
      <PlainHeader title="Withdraw" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-4">
        <div className="rounded-2xl bg-gold-50 px-4 py-3.5 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-gold-600">Available balance</span>
          <span className="text-[20px] font-extrabold text-gold-500">₹ 12,480</span>
        </div>
        {locked && (
          <div className="mt-3 rounded-2xl bg-gold-50 px-4 py-3">
            <p className="text-[14px] font-bold text-gold-600 flex items-center gap-2"><Icon name="clock" size={15} /> Weekly limit reached</p>
            <p className="text-[12px] text-gold-600/90 mt-1">You've used 2 of 2 withdrawals this week. Next available Monday, 9:00 AM.</p>
          </div>
        )}
        <div className="mt-4">
          <span className="label">Amount</span>
          <input value={`₹ ${amt}`} onChange={(e) => setAmt(e.target.value.replace(/[^\d,]/g, ''))} className={`input text-[16px] ${tooLow ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`} />
          {tooLow && <p className="text-[12px] text-rose-500 mt-1">Minimum withdrawal is ₹ 1,000</p>}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {['₹ 2,000', '₹ 5,000', 'Max'].map((q) => (
            <button key={q} onClick={() => setAmt(q === 'Max' ? '12,480' : q.replace('₹ ', ''))} className="rounded-xl border border-black/10 bg-white py-2.5 text-[13px] font-semibold text-ink-700">{q}</button>
          ))}
        </div>
        <div className="card mt-3 p-3.5 flex items-center gap-3">
          <IconBadge name="card" tone="brand" />
          <div className="flex-1"><p className="text-[14px] font-semibold text-ink-900">HDFC •••• 4821</p><p className="text-[12px] text-ink-400">Ayesha Khan · Verified</p></div>
          <span className="h-6 w-6 grid place-items-center rounded-full bg-emerald-500 text-white"><Icon name="check" size={13} /></span>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-black/[.04] px-3 py-2.5 text-[12px] text-ink-400">
          <Icon name="clock" size={14} className="mt-0.5 shrink-0" /> Minimum ₹ 1,000 · Max 2 withdrawals per week · Paid in 2–3 business days.
        </div>
        {locked ? (
          <button disabled className="btn-dark mt-4">Withdrawals locked until Monday</button>
        ) : (
          <button onClick={() => nav('/withdraw/confirm')} className={`btn-primary mt-4 ${tooLow ? 'opacity-60' : ''}`}>Continue</button>
        )}
      </div>
    </AppLayout>
  )
}

/* 34 — Confirm */
export function WithdrawConfirm() {
  const nav = useNavigate()
  return (
    <AppLayout tab="/earnings" title="Confirm withdrawal" back bottomNav={false} maxW="md" bg="canvas">
      <PlainHeader title="Confirm withdrawal" />
      <div className="px-5 lg:px-0 pt-8 lg:pt-2 pb-4">
        <div className="flex flex-col items-center text-center">
          <IconBadge name="wallet" tone="brand" size={56} />
          <p className="text-[13px] text-ink-400 mt-3">You will receive</p>
          <p className="text-[30px] font-extrabold text-gold-500">₹ 9,800</p>
        </div>
        <div className="card mt-5 p-4">
          <KV k="Requested" v="₹ 10,000" strong />
          <KV k="Processing fee" v="– ₹ 100" danger />
          <KV k="TDS (1%)" v="– ₹ 100" danger />
          <div className="border-t border-black/5 mt-1 pt-1"><KV k="Net payout" v={<span className="text-gold-500">₹ 9,800</span>} strong /></div>
        </div>
        <div className="card mt-3 p-3.5 flex items-center gap-3">
          <IconBadge name="card" tone="brand" />
          <div><p className="text-[14px] font-semibold text-ink-900">HDFC •••• 4821</p><p className="text-[12px] text-ink-400">2–3 business days</p></div>
        </div>
        <div className="mt-5 space-y-3">
          <button onClick={() => nav('/withdraw/status/submitted')} className="btn-primary"><Icon name="check" size={16} /> Confirm withdrawal</button>
          <button onClick={() => nav(-1)} className="btn-outline">Back</button>
        </div>
      </div>
    </AppLayout>
  )
}

/* 35–38 — status states */
const STATES = {
  submitted: { tone: 'gold', icon: 'clock', title: 'Request submitted', desc: 'Awaiting admin approval', note: ['gold', 'clock', 'Typically reviewed within 12 hours'], cta: { label: 'Back to earnings', to: '/earnings' }, next: '/withdraw/status/approved' },
  approved: { tone: 'green', icon: 'check', title: 'Approved', desc: 'Approved by admin on 22 Aug', note: ['green', 'check', 'Queued for bank transfer'], cta: { label: 'Track payout', to: '/withdraw/status/processing' } },
  processing: { tone: 'gold', icon: 'clock', title: 'Processing', desc: 'Sent to your bank', progress: 'Step 2 of 3 · bank processing', cta: { label: 'Back to earnings', to: '/earnings' }, next: '/withdraw/status/paid' },
  paid: { tone: 'green', icon: 'check', title: 'Paid out', desc: 'Credited on 24 Aug, 11:02 AM', note: ['green', 'shield-check', 'UTR 4471HDFC2608 · ₹ 9,800 credited'], cta: { label: 'Download receipt', to: '/earnings', primary: true, icon: 'download' } },
  rejected: { tone: 'rose', icon: 'x', title: 'Request rejected', desc: 'Declined by admin on 22 Aug', err: ['Payout name mismatch', 'Bank account name must match your verified KYC name. Update your payout details and request again.'], cta: { label: 'Update payout details', to: '/settings/payouts/add', danger: true, icon: 'card' }, cta2: { label: 'Contact support', to: '/settings/help', icon: 'help' } },
  failed: { tone: 'brand', icon: 'alert', title: 'Transfer failed', desc: 'Bank returned the transfer on 24 Aug', note: ['slate', 'refresh', '₹ 10,000 returned to your balance'], noteSub: 'Nothing was lost. The bank could not process the transfer — you can retry any time.', cta: { label: 'Retry withdrawal', to: '/withdraw', dark: true, icon: 'refresh' }, cta2: { label: 'Back to earnings', to: '/earnings' } },
}

export function WithdrawStatus() {
  const { state } = useParams()
  const nav = useNavigate()
  const s = STATES[state] || STATES.submitted
  const noteTone = { gold: 'bg-gold-50 text-gold-600', green: 'bg-emerald-50 text-emerald-700', slate: 'bg-black/[.04] text-ink-500', rose: 'bg-rose-50 text-rose-500' }
  return (
    <AppLayout tab="/earnings" title={s.title} back bottomNav={false} maxW="md" bg="white">
      <PlainHeader title={s.title} />
      <div className="py-6">
        <ResultScreen tone={s.tone} icon={s.icon} title={s.title} desc={s.desc}>
          {s.note && (
            <div className={`rounded-xl px-3.5 py-3 text-left text-[13px] font-semibold flex items-start gap-2 ${noteTone[s.note[0]]}`}>
              <Icon name={s.note[1]} size={15} className="mt-0.5 shrink-0" />
              <span>{s.note[2]}{s.noteSub && <span className="block font-normal opacity-80 mt-1">{s.noteSub}</span>}</span>
            </div>
          )}
          {s.progress && (
            <div className="rounded-xl bg-brand-50 px-3.5 py-3 text-left">
              <p className="text-[13px] font-semibold text-brand-700 flex items-center gap-2"><Icon name="refresh" size={14} className="animate-spinslow" /> {s.progress}</p>
              <div className="h-1.5 rounded-full bg-brand-100 mt-2"><div className="h-full w-2/3 rounded-full bg-brand-600" /></div>
            </div>
          )}
          {s.err && (
            <div className="rounded-xl bg-rose-50 px-3.5 py-3 text-left">
              <p className="text-[14px] font-semibold text-rose-500 flex items-center gap-2"><Icon name="ban" size={15} /> {s.err[0]}</p>
              <p className="text-[12px] text-rose-400 mt-1">{s.err[1]}</p>
            </div>
          )}
          <div className="card p-4 text-left">
            <KV k="Reference" v="WD-20826-4471" strong />
            <KV k="Amount" v={<span className="text-gold-500">₹ 10,000</span>} strong />
            <KV k="Account" v="HDFC •••• 4821" strong />
          </div>
          <button onClick={() => nav(s.cta.to)} className={s.cta.danger ? 'btn-danger-outline' : s.cta.dark ? 'btn-dark' : s.cta.primary ? 'btn-primary' : 'btn-outline'}>
            {s.cta.icon && <Icon name={s.cta.icon} size={16} />} {s.cta.label}
          </button>
          {s.cta2 && <button onClick={() => nav(s.cta2.to)} className="btn-outline">{s.cta2.icon && <Icon name={s.cta2.icon} size={16} />} {s.cta2.label}</button>}
        </ResultScreen>
      </div>
    </AppLayout>
  )
}
