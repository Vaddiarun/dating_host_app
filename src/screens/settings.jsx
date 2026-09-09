import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { TopBar, Avatar, Toggle, Row, IconBadge, ResultScreen, SectionTitle } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { me } from '../data.js'

/* 39 / 40 — Settings + Profile */
export function Settings() {
  const nav = useNavigate()
  const [logout, setLogout] = useState(false)
  return (
    <AppLayout tab="/settings" title="Profile & settings" maxW="lg" bg="canvas" pad={false}>
      <div className="lg:max-w-2xl lg:mx-auto lg:py-8">
        <div className="relative bg-gradient-to-br from-brand-600 to-brand-800 px-5 lg:px-6 pt-3 lg:pt-6 pb-6 text-white lg:rounded-2xl">
          <div className="flex items-center gap-3">
            <Avatar name={me.name} size={56} className="ring-2 ring-white/40" />
            <div>
              <p className="text-[19px] font-bold flex items-center gap-1.5">{me.name} <Icon name="shield-check" size={16} className="text-gold-300" /></p>
              <p className="text-[12px] text-white/70">{me.username} · {me.languages}</p>
              <div className="mt-1.5 flex gap-2">
                <span className="pill bg-black/25 text-white text-[11px]">{me.rating} ★</span>
                <span className="pill bg-black/25 text-white text-[11px]">{me.calls} calls</span>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 lg:px-0 -mt-4 lg:mt-4 pb-4">
          <div className="grid grid-cols-3 gap-3">
            {[['eye', me.followers, 'Followers'], ['clock', me.talkTime, 'Talk time'], ['gift', me.gifts, 'Gifts']].map(([i, v, l]) => (
              <div key={l} className="card p-3.5"><Icon name={i} size={15} className="text-brand-600" /><p className="text-[16px] font-extrabold text-ink-900 mt-1">{v}</p><p className="text-[12px] text-ink-400">{l}</p></div>
            ))}
          </div>
          <SectionTitle className="mt-5 mb-1">Account</SectionTitle>
          <div className="card px-4 divide-y divide-black/5">
            <Row icon="settings" tone="brand" title="Edit profile" sub="Name, bio, languages" onClick={() => nav('/settings/edit-profile')} />
            <Row icon="image" tone="brand" title="Gallery" sub="12 photos · 4 videos" onClick={() => nav('/settings/gallery')} />
            <Row icon="wallet" tone="gold" title="Rate settings" sub="₹ 24/min video" onClick={() => nav('/settings/rates')} />
            <Row icon="shield-check" tone="green" title="KYC status" sub="Verified" right={<span className="pill bg-emerald-50 text-emerald-600 text-[11px]">Verified</span>} onClick={() => nav('/settings/kyc')} />
            <Row icon="card" tone="brand" title="Payout details" sub="HDFC •••• 4821" onClick={() => nav('/settings/payouts')} />
            <Row icon="bell" tone="brand" title="Notifications" sub="Calls, gifts, payouts" onClick={() => nav('/settings/notifications')} />
            <Row icon="help" tone="brand" title="Help & support" onClick={() => nav('/settings/help')} />
            <Row icon="logout" danger title="Logout" onClick={() => setLogout(true)} />
          </div>
        </div>
      </div>

      {logout && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end lg:justify-center lg:items-center" onClick={() => setLogout(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-3xl lg:rounded-2xl lg:max-w-sm w-full p-5 animate-sheet-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="grid place-items-center h-11 w-11 rounded-full border-2 border-dashed border-rose-300 text-rose-500 shrink-0"><Icon name="logout" size={18} /></span>
              <div><p className="text-[17px] font-bold text-ink-900">Logging out?</p><p className="text-[13px] text-ink-400 mt-0.5">You'll stop receiving calls and gifts until you sign back in. Your earnings stay safe.</p></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => setLogout(false)} className="btn-outline">Cancel</button>
              <button onClick={() => nav('/login')} className="btn-danger-outline"><Icon name="logout" size={16} /> Log out</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

/* 40 — KYC status */
export function KycStatus() {
  return (
    <AppLayout tab="/settings" title="KYC status" back bottomNav={false} maxW="md" bg="white">
      <TopBar title="KYC status" />
      <div className="py-8">
        <ResultScreen tone="brand" icon="shield-check" title="Identity verified" desc="Approved on 14 Aug 2026">
          <span className="mx-auto pill bg-emerald-50 text-emerald-600 text-[12px] -mt-3"><span className="h-1.5 w-1.5 rounded-full bg-current" /> Verified</span>
          <div className="card p-4 text-left mt-2">
            {[['Document', 'Aadhaar •••• 8842'], ['Selfie match', 'Passed'], ['Payout account', 'HDFC •••• 4821'], ['Next review', 'Not required']].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2 text-[14px]">
                <span className="text-ink-500">{k}</span>
                <span className="font-semibold text-ink-900 flex items-center gap-1.5">{v} <Icon name="check" size={14} className="text-emerald-500" /></span>
              </div>
            ))}
          </div>
        </ResultScreen>
      </div>
    </AppLayout>
  )
}

/* 40 — Edit profile */
export function EditProfile() {
  const nav = useNavigate()
  return (
    <AppLayout tab="/settings" title="Edit profile" back bottomNav={false} maxW="md" bg="white">
      <TopBar title="Edit profile" right={<button onClick={() => nav(-1)} className="rounded-xl bg-brand-600 text-white px-4 py-2 text-[14px] font-semibold">Save</button>} />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-6">
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar name={me.name} size={88} className="ring-4 ring-brand-500/30" />
            <span className="absolute bottom-0 right-0 h-7 w-7 grid place-items-center rounded-full bg-brand-600 text-white"><Icon name="camera" size={13} /></span>
          </div>
          <p className="text-[13px] font-semibold text-brand-600 mt-2">Change photo</p>
        </div>
        <div className="mt-4 space-y-3.5">
          <div><span className="label">Display name</span><input className="input" defaultValue="Ayesha" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><span className="label">Username</span><input className="input" defaultValue="@ayesha_live" /></div>
            <div><span className="label">E-mail</span><input className="input" defaultValue="host@email.com" /></div>
          </div>
          <div><span className="label">Bio</span><input className="input" defaultValue="Late night chats, music and good vibes 💜" /></div>
          <div><span className="label">Languages</span><button className="input flex items-center justify-between"><span>Hindi, English</span><Icon name="chevron-right" size={16} className="text-ink-300" /></button></div>
          <div><span className="label">Interests</span><button className="input flex items-center justify-between"><span>Music · Travel · Movies</span><Icon name="chevron-right" size={16} className="text-ink-300" /></button></div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-[12px] text-brand-700">
          <Icon name="sparkles" size={14} /> Profiles with a bio and 3+ photos get 40% more calls.
        </div>
        <button onClick={() => nav(-1)} className="btn-primary mt-4 lg:hidden">Save changes</button>
      </div>
    </AppLayout>
  )
}

/* 40 — Rate settings */
export function RateSettings() {
  const rates = [['Video call', 24, 0.6], ['Voice call', 12, 0.3], ['Private live', 30, 0.75]]
  const [auto, setAuto] = useState(true)
  const [night, setNight] = useState(false)
  return (
    <AppLayout tab="/settings" title="Rate settings" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Rate settings" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-4">
        <div className="rounded-2xl bg-gold-50 px-4 py-3.5 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-gold-600">Current video rate</span>
          <span className="text-[20px] font-extrabold text-gold-500">₹ 24 <span className="text-[13px] font-medium">/min</span></span>
        </div>
        <SectionTitle className="mt-5 mb-2">Per-minute rates</SectionTitle>
        <div className="card p-4 space-y-4">
          {rates.map(([l, v, w]) => (
            <div key={l}>
              <div className="flex justify-between text-[14px]"><span className="font-semibold text-ink-900">{l}</span><span className="font-bold text-gold-500">₹ {v}</span></div>
              <div className="h-1.5 rounded-full bg-black/5 mt-1.5"><div className="h-full rounded-full bg-gold-400" style={{ width: `${w * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <SectionTitle className="mt-5 mb-2">Availability</SectionTitle>
        <div className="card p-4 divide-y divide-black/5">
          <div className="flex items-center gap-3 pb-3"><span className="flex-1 text-[15px] font-semibold text-ink-900">Auto-accept calls</span><Toggle on={auto} onChange={setAuto} /></div>
          <div className="flex items-center gap-3 pt-3"><span className="flex-1 text-[15px] font-semibold text-ink-900">Voice calls only after 12 AM</span><Toggle on={night} onChange={setNight} /></div>
        </div>
        <button className="btn-primary mt-4">Save rates</button>
      </div>
    </AppLayout>
  )
}

/* 41 — Gallery */
export function Gallery() {
  const tiles = [{ add: true }, { v: '0:24' }, {}, {}, { v: '1:02' }, {}, {}, {}, { v: '0:48' }, {}, {}, { v: '0:16' }]
  const [f, setF] = useState('All')
  return (
    <AppLayout tab="/settings" title="Gallery" back bottomNav={false} maxW="lg" bg="white">
      <TopBar title="Gallery" sub="12 photos · 4 videos" />
      <div className="px-5 lg:px-0 pt-3 lg:pt-0 pb-4">
        <div className="flex gap-2">
          {['All', 'Photos', 'Videos'].map((c) => (
            <button key={c} onClick={() => setF(c)} className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${f === c ? 'bg-brand-600 text-white' : 'bg-black/5 text-ink-400'}`}>{c}</button>
          ))}
        </div>
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-2.5 mt-4">
          {tiles.map((t, i) =>
            t.add ? (
              <button key={i} className="aspect-square rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/60 grid place-items-center text-brand-500"><Icon name="plus" size={22} /></button>
            ) : (
              <div key={i} className="relative aspect-square rounded-2xl bg-gradient-to-br from-brand-300/60 to-gold-300/50 grid place-items-center">
                {t.v && <><span className="h-9 w-9 grid place-items-center rounded-full bg-black/30 text-white">▶</span><span className="absolute bottom-1.5 right-1.5 text-[10px] font-semibold text-white bg-black/40 rounded px-1">{t.v}</span></>}
              </div>
            ),
          )}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-gold-50 px-3 py-2.5 text-[12px] text-gold-600">
          <Icon name="shield" size={14} className="mt-0.5 shrink-0" /> All uploads are reviewed. Nudity or off-platform contact will be removed.
        </div>
      </div>
    </AppLayout>
  )
}

/* 41 — Payout details */
export function PayoutDetails() {
  const nav = useNavigate()
  return (
    <AppLayout tab="/settings" title="Payout details" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Payout details" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-4">
        <div className="card p-4 flex items-center gap-3">
          <IconBadge name="card" tone="brand" size={44} />
          <div className="flex-1"><p className="text-[15px] font-semibold text-ink-900">HDFC Bank •••• 4821</p><p className="text-[12px] text-ink-400">Ayesha Khan · Primary</p></div>
          <span className="pill bg-emerald-50 text-emerald-600 text-[11px]"><span className="h-1.5 w-1.5 rounded-full bg-current" /> Verified</span>
        </div>
        <div className="card p-4 flex items-center gap-3 mt-3">
          <IconBadge name="wallet" tone="brand" size={44} />
          <div className="flex-1"><p className="text-[15px] font-semibold text-ink-900">ayesha@upi</p><p className="text-[12px] text-ink-400">UPI · Backup</p></div>
          <button className="text-ink-400">⋮</button>
        </div>
        <SectionTitle className="mt-5 mb-1">Payout schedule</SectionTitle>
        <div className="card px-4 divide-y divide-black/5">
          <Row icon="clock" tone="brand" title="Frequency" sub="Up to 2 withdrawals per week" />
          <Row icon="wallet" tone="gold" title="Minimum amount" sub="₹ 1,000" />
        </div>
        <button onClick={() => nav('/settings/payouts/add')} className="btn-outline mt-4"><Icon name="plus" size={16} /> Add payout method</button>
      </div>
    </AppLayout>
  )
}

/* 42 — Notification settings */
export function NotificationSettings() {
  const groups = [
    ['Calls & chat', [['Incoming calls', true], ['Missed calls', true], ['New messages', true], ['Call reminders', false]]],
    ['Money', [['Gifts received', true], ['Withdrawal updates', true], ['Weekly earnings summary', false]]],
    ['Other', [['Promotions & tips', false], ['Do not disturb (1–7 AM)', true]]],
  ]
  const [st, setSt] = useState({})
  return (
    <AppLayout tab="/settings" title="Notification settings" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Notification settings" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-6 space-y-5">
        {groups.map(([g, rows]) => (
          <div key={g}>
            <SectionTitle className="mb-2">{g}</SectionTitle>
            <div className="card p-4 divide-y divide-black/5">
              {rows.map(([l, d]) => {
                const key = g + l
                const on = st[key] ?? d
                return (
                  <div key={l} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="flex-1 text-[15px] font-medium text-ink-900">{l}</span>
                    <Toggle on={on} onChange={(v) => setSt((s) => ({ ...s, [key]: v }))} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}

/* 43 — Help & support */
export function HelpSupport() {
  const topics = [
    ['wallet', 'gold', 'Why is my withdrawal pending?'],
    ['shield', 'green', 'KYC document guidelines'],
    ['phone', 'brand', 'Improving call quality'],
    ['flag', 'rose', 'Reporting an abusive user'],
  ]
  return (
    <AppLayout tab="/settings" title="Help & support" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Help & support" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-6">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center h-11 w-11 rounded-full border-2 border-dashed border-brand-300 text-brand-500"><Icon name="help" size={18} /></span>
            <div><p className="text-[15px] font-semibold text-ink-900">Talk to us</p><p className="text-[12px] text-ink-400">Average reply in 12 minutes</p></div>
          </div>
          <button className="btn-primary mt-3">Start a chat</button>
        </div>
        <SectionTitle className="mt-5 mb-1">Popular topics</SectionTitle>
        <div className="card px-4 divide-y divide-black/5">{topics.map(([i, t, l]) => <Row key={l} icon={i} tone={t} title={l} />)}</div>
        <SectionTitle className="mt-5 mb-1">Legal</SectionTitle>
        <div className="card px-4 divide-y divide-black/5">
          <Row icon="file-text" tone="brand" title="Terms of service" />
          <Row icon="file-text" tone="brand" title="Privacy policy" />
        </div>
      </div>
    </AppLayout>
  )
}
