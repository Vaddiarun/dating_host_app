import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { StatusBar, TopBar, PlainHeader, IconBadge, ResultScreen, SectionTitle } from '../ui/kit.jsx'
import { CenterLayout, ImmersiveLayout, AppLayout } from '../ui/layouts.jsx'

/* 1 — Splash */
export function Splash() {
  const nav = useNavigate()
  useEffect(() => { const t = setTimeout(() => nav('/login'), 1600); return () => clearTimeout(t) }, [nav])
  return (
    <ImmersiveLayout>
      <div className="relative flex min-h-full flex-col overflow-hidden bg-gradient-to-b from-brand-800 via-night-800 to-night-900 text-white">
        <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-brand-500/40 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
        <StatusBar dark />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="h-24 w-24 rounded-[26px] bg-gradient-to-br from-brand-400 to-brand-600 shadow-[0_20px_60px_-10px_rgba(109,59,230,.7)]" />
          <h1 className="text-[30px] font-extrabold tracking-tight">Splash</h1>
        </div>
        <div className="pb-8 flex justify-center">
          <div className="h-1 w-24 rounded-full bg-white/15 overflow-hidden"><div className="h-full w-1/2 bg-gold-400 animate-pulse" /></div>
        </div>
      </div>
    </ImmersiveLayout>
  )
}

/* 2 — Login */
export function Login() {
  const nav = useNavigate()
  const [num, setNum] = useState('98765 43210')
  return (
    <CenterLayout>
      <StatusBar />
      <div className="flex-1 px-6 pt-6 lg:pt-10 pb-8">
        <div className="mx-auto h-28 w-28 rounded-[28px] bg-gradient-to-br from-brand-50 to-gold-50 grid place-items-center">
          <div className="h-16 w-14 rounded-2xl border-2 border-brand-500/60 grid place-items-center"><Icon name="heart" size={26} className="text-gold-400" /></div>
        </div>
        <h1 className="mt-7 text-[26px] font-extrabold text-ink-900">Your number</h1>
        <p className="text-[14px] text-ink-400 mt-1">We'll text a 6-digit code to verify it's you.</p>
        <div className="mt-6 flex gap-2">
          <div className="input w-[86px] flex items-center justify-center gap-1 font-semibold">🇮🇳 +91</div>
          <input value={num} onChange={(e) => setNum(e.target.value)} className="input flex-1" inputMode="numeric" />
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-black/[.03] px-3 py-2.5 text-[12px] text-ink-400">
          <Icon name="shield" size={15} className="mt-0.5 shrink-0" /> By continuing you agree to the Terms and Privacy Policy.
        </div>
        <button onClick={() => nav('/otp')} className="btn-primary mt-4"><Icon name="chevron-right" size={18} /> Send code</button>
      </div>
    </CenterLayout>
  )
}

/* 3 — OTP */
export function Otp() {
  const nav = useNavigate()
  const [code, setCode] = useState(['1', '2', '3', '', '', ''])
  const set = (i, v) => setCode((c) => c.map((x, j) => (j === i ? v.slice(-1) : x)))
  return (
    <CenterLayout>
      <StatusBar />
      <TopBar title="Verify number" />
      <div className="flex-1 px-6 pt-5 pb-8">
        <h1 className="text-[24px] font-extrabold text-ink-900 lg:mt-4">Enter the code</h1>
        <p className="text-[14px] text-ink-400 mt-1">Sent to +91 98765 43210</p>
        <div className="mt-5 flex gap-2.5">
          {code.map((d, i) => (
            <input key={i} value={d} onChange={(e) => set(i, e.target.value)} inputMode="numeric"
              className={`h-16 flex-1 rounded-2xl border text-center text-[22px] font-bold outline-none ${d ? 'border-brand-500 text-ink-900' : 'border-black/10'} focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20`} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-400"><Icon name="clock" size={14} /> Resend in 00:24</div>
        <button onClick={() => nav('/onboarding/profile')} className="btn-primary mt-5">Verify</button>
      </div>
    </CenterLayout>
  )
}

function Steps({ active }) {
  const s = ['Profile', 'KYC', 'Payout']
  return (
    <div className="flex items-center px-2 py-4">
      {s.map((label, i) => (
        <div key={label} className={`flex items-center ${i < 2 ? 'flex-1' : ''}`}>
          <div className="flex flex-col items-center gap-1">
            <span className={`h-7 w-7 grid place-items-center rounded-full text-[12px] font-bold ${i <= active ? 'bg-brand-600 text-white' : 'bg-black/10 text-ink-400'}`}>
              {i < active ? <Icon name="check" size={14} /> : i + 1}
            </span>
            <span className={`text-[11px] font-semibold ${i <= active ? 'text-ink-900' : 'text-ink-400'}`}>{label}</span>
          </div>
          {i < 2 && <div className={`h-0.5 flex-1 mx-1 -mt-4 ${i < active ? 'bg-brand-600' : 'bg-black/10'}`} />}
        </div>
      ))}
    </div>
  )
}

/* 4 — Profile setup */
export function ProfileSetup() {
  const nav = useNavigate()
  return (
    <CenterLayout>
      <StatusBar />
      <PlainHeader title="Set up profile" />
      <div className="flex-1 overflow-y-auto px-5 lg:px-6 no-scrollbar">
        <p className="hidden lg:block text-[22px] font-extrabold text-ink-900 pt-6">Set up profile</p>
        <Steps active={0} />
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-gold-300 to-emerald-300 ring-4 ring-brand-500/40" />
            <span className="absolute bottom-0 right-0 h-8 w-8 grid place-items-center rounded-full bg-brand-600 text-white"><Icon name="camera" size={15} /></span>
          </div>
          <p className="text-[12px] text-ink-400 mt-2">Add a clear, well-lit photo</p>
        </div>
        <div className="mt-5 space-y-3.5 pb-5">
          <div><span className="label">Display name</span><input className="input" defaultValue="Ayesha" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><span className="label">Age</span><input className="input" defaultValue="24" /></div>
            <div><span className="label">E-mail</span><input className="input" defaultValue="host@mail.com" /></div>
          </div>
          <div><span className="label">Languages</span><input className="input" defaultValue="Hindi, English" /></div>
          <div><span className="label">About you</span><textarea rows={2} className="input" placeholder="Tell viewers what you love talking about" /></div>
        </div>
      </div>
      <div className="p-4 border-t border-black/5"><button onClick={() => nav('/onboarding/kyc')} className="btn-primary">Continue</button></div>
    </CenterLayout>
  )
}

/* 5 — KYC intro */
export function KycIntro() {
  const nav = useNavigate()
  const items = [
    { icon: 'id-card', title: 'Government ID', sub: 'Aadhaar, PAN or Passport' },
    { icon: 'camera', title: 'Selfie check', sub: 'Live photo to match your ID' },
    { icon: 'card', title: 'Payout account', sub: 'Bank or UPI for withdrawals' },
  ]
  return (
    <CenterLayout>
      <StatusBar />
      <TopBar title="Verification" />
      <div className="flex-1 px-5 lg:px-6">
        <Steps active={1} />
        <div className="flex flex-col items-center text-center mt-2">
          <IconBadge name="shield-check" tone="brand" size={56} />
          <h2 className="mt-3 text-[22px] font-extrabold text-ink-900">Verify to start earning</h2>
          <p className="text-[13px] text-ink-400 mt-1">Takes about 3 minutes. Payouts unlock once approved.</p>
        </div>
        <div className="mt-5 space-y-3">
          {items.map((it) => (
            <div key={it.title} className="card p-3.5 flex items-center gap-3">
              <IconBadge name={it.icon} tone="brand" />
              <div><p className="text-[15px] font-semibold text-ink-900">{it.title}</p><p className="text-[12px] text-ink-400">{it.sub}</p></div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4"><button onClick={() => nav('/onboarding/documents')} className="btn-primary">Start verification</button></div>
    </CenterLayout>
  )
}

/* 6 — Document upload */
export function DocumentUpload() {
  const nav = useNavigate()
  return (
    <CenterLayout>
      <StatusBar />
      <TopBar title="Upload documents" />
      <div className="flex-1 overflow-y-auto px-5 lg:px-6 no-scrollbar">
        <div className="h-1.5 rounded-full bg-black/10 my-3 overflow-hidden"><div className="h-full w-2/5 bg-brand-600" /></div>
        <SectionTitle className="mt-2">Government ID</SectionTitle>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="relative aspect-[3/2] rounded-2xl bg-black/[.06] border border-black/10 grid place-items-center">
            <span className="absolute top-2 right-2 h-5 w-5 grid place-items-center rounded-full bg-emerald-500 text-white"><Icon name="check" size={12} /></span>
            <span className="absolute bottom-2 left-2 text-[11px] font-semibold text-ink-400">Front</span>
          </div>
          <div className="aspect-[3/2] rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/60 grid place-items-center text-brand-600">
            <span className="flex flex-col items-center gap-1 text-[12px] font-semibold"><Icon name="upload" size={18} /> Back side</span>
          </div>
        </div>
        <SectionTitle className="mt-5">Selfie check</SectionTitle>
        <div className="mt-2 aspect-[3/2] rounded-2xl bg-gradient-to-br from-brand-400 to-night-800 grid place-items-center">
          <div className="h-40 w-52 rounded-[50%] border-2 border-dashed border-white/50 grid place-items-center"><Icon name="camera" size={30} className="text-white/70" /></div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-gold-50 px-3 py-2.5 text-[12px] text-gold-600">
          <Icon name="alert" size={15} className="mt-0.5 shrink-0" /> Make sure all four corners are visible and text is readable.
        </div>
      </div>
      <div className="p-4"><button onClick={() => nav('/onboarding/payout')} className="btn-primary">Submit for review</button></div>
    </CenterLayout>
  )
}

/* 7 — Payout account (onboarding + standalone) */
export function PayoutAccount({ standalone }) {
  const nav = useNavigate()
  const [tab, setTab] = useState('Bank transfer')
  const body = (
    <>
      <div className="flex gap-2 my-3">
        {['Bank transfer', 'UPI'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-[13px] font-semibold border ${tab === t ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-ink-500 border-black/10'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Bank transfer' ? (
        <div className="space-y-3.5">
          <div><span className="label">Account holder</span><input className="input" defaultValue="Ayesha Khan" /></div>
          <div><span className="label">Account number</span><input className="input" defaultValue="•••• •••• 4821" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><span className="label">IFSC code</span><input className="input" defaultValue="HDFC0001234" /></div>
            <div><span className="label">Bank</span><input className="input" defaultValue="HDFC Bank" /></div>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div><span className="label">UPI ID</span><input className="input" defaultValue="ayesha@upi" /></div>
          <div><span className="label">Name on UPI</span><input className="input" defaultValue="Ayesha Khan" /></div>
        </div>
      )}
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-[12px] text-brand-700">
        <Icon name="shield" size={15} className="mt-0.5 shrink-0" /> Payout details are encrypted and only used for withdrawals.
      </div>
    </>
  )
  if (standalone) {
    return (
      <AppLayout title="Add payout account" back bottomNav={false} maxW="md" bg="white">
        <TopBar title="Add payout account" />
        <div className="p-4 lg:p-0">
          {body}
          <button onClick={() => nav('/settings/payouts')} className="btn-primary mt-4">Save account</button>
        </div>
      </AppLayout>
    )
  }
  return (
    <CenterLayout>
      <StatusBar />
      <TopBar title="Payout account" />
      <div className="flex-1 overflow-y-auto px-5 lg:px-6 no-scrollbar">
        <Steps active={2} />
        {body}
      </div>
      <div className="p-4"><button onClick={() => nav('/onboarding/review')} className="btn-primary">Save account</button></div>
    </CenterLayout>
  )
}

/* 8 — Under review */
export function UnderReview() {
  const rows = [
    { t: 'Documents received', done: true }, { t: 'Identity check', done: true }, { t: 'Final approval', done: false },
  ]
  return (
    <CenterLayout>
      <StatusBar />
      <div className="flex-1 flex flex-col items-center px-6 pt-16 lg:pt-10 pb-8 text-center">
        <span className="grid place-items-center h-20 w-20 rounded-full bg-gold-400 text-white shadow-[0_0_0_10px_rgba(224,169,46,.16),0_0_0_20px_rgba(224,169,46,.08)]"><Icon name="clock" size={34} /></span>
        <h2 className="mt-6 text-[24px] font-extrabold text-ink-900">Under review</h2>
        <p className="mt-1 text-[13px] text-ink-400">Usually approved within 24 hours.</p>
        <div className="card w-full max-w-sm mt-6 p-4 divide-y divide-black/5">
          {rows.map((r) => (
            <div key={r.t} className="flex items-center gap-3 py-3">
              <span className={`h-6 w-6 grid place-items-center rounded-full ${r.done ? 'bg-emerald-500' : 'bg-gold-400'} text-white`}><Icon name={r.done ? 'check' : 'clock'} size={13} /></span>
              <span className={`text-[14px] font-medium ${r.done ? 'text-ink-900' : 'text-ink-400'}`}>{r.t}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-black/[.04] px-3 py-2.5 text-[12px] text-ink-400"><Icon name="bell" size={14} /> We'll notify you the moment a decision is made.</div>
      </div>
    </CenterLayout>
  )
}

/* 9 — Verified */
export function Verified() {
  const nav = useNavigate()
  return (
    <CenterLayout>
      <StatusBar />
      <div className="flex-1 py-10">
        <ResultScreen tone="green" icon="check" title="You're verified" desc="Calls, live streams and payouts are unlocked.">
          <div className="grid grid-cols-2 gap-3">
            {[['shield-check', 'Verified', 'Status'], ['card', 'Enabled', 'Payouts']].map(([i, a, b]) => (
              <div key={b} className="card p-3.5 text-left"><Icon name={i} size={18} className="text-emerald-600" /><p className="text-[15px] font-bold text-ink-900 mt-1">{a}</p><p className="text-[12px] text-ink-400">{b}</p></div>
            ))}
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700 flex items-center gap-2"><Icon name="sparkles" size={14} /> New hosts get boosted visibility for 48 hours.</div>
          <button onClick={() => nav('/home')} className="btn-primary">Go to dashboard</button>
        </ResultScreen>
      </div>
    </CenterLayout>
  )
}

/* 10 — Rejected */
export function Rejected() {
  const nav = useNavigate()
  return (
    <CenterLayout>
      <StatusBar />
      <div className="flex-1 py-10">
        <ResultScreen tone="rose" icon="x" title="Verification rejected" desc="Reviewed on 12 Aug, 4:20 PM">
          <div className="rounded-xl bg-rose-50 px-3.5 py-3 text-left">
            <p className="text-[14px] font-semibold text-rose-500 flex items-center gap-2"><Icon name="alert" size={15} /> ID photo was blurred</p>
            <p className="text-[12px] text-rose-400 mt-1">Retake in bright light with the full document in frame.</p>
          </div>
          <button onClick={() => nav('/onboarding/documents')} className="btn-primary">Resubmit documents</button>
          <button className="btn-outline"><Icon name="help" size={16} /> Contact support</button>
        </ResultScreen>
      </div>
    </CenterLayout>
  )
}
