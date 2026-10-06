import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { TopBar, Avatar, Toggle, Row, IconBadge, ResultScreen, SectionTitle, ErrorCard, ReferenceRow } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { useAuth } from '../state/AuthContext.jsx'
import { profile as profileApi, earnings as earningsApi, calls as callsApi, config as configApi, presence as presenceApi, moderation as moderationApi } from '../api/index.js'
import { rupees, beans, referenceCode, duration } from '../lib/format.js'
import logoUrl from '../assets/logo.png'
import { errorMessage } from '../lib/errors.js'
import { uploadAvatar } from '../lib/avatar.js'
import SupportFab from '../ui/SupportFab.jsx'
import { Skel, SkelGroup, SkelHero, SkelRows, SkelToggles, SkelList, SkelResult } from '../ui/Skeleton.jsx'

/* 39 / 40 — Settings + Profile */
const compactNum = (n) => (n == null ? '—' : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n))

export function Settings() {
  const nav = useNavigate()
  const { me, logout } = useAuth()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [level, setLevel] = useState(null)
  const [dash, setDash] = useState(null)
  const [callsTotal, setCallsTotal] = useState(null)
  const [primary, setPrimary] = useState(undefined)

  useEffect(() => {
    profileApi.getLevel().then(setLevel).catch(() => {})
    earningsApi.dashboard().then(setDash).catch(() => {})
    callsApi.list('all', 1, 1).then((r) => setCallsTotal(r.total ?? null)).catch(() => {})
    profileApi.listPayoutMethods().then((res) => setPrimary((res.methods || []).find((m) => m.isPrimary) || res.methods?.[0] || null)).catch(() => setPrimary(null))
  }, [])

  const doLogout = async () => {
    setBusy(true)
    // logout() clears the local session even if the server-side call fails, so there's
    // nothing left to recover into — always land back on /login.
    try { await logout() } finally { nav('/login', { replace: true }) }
  }

  const name = me?.name || 'Host'
  const hp = me?.hostProfile || {}
  const rating = hp.rating || dash?.rating
  const videoRate = level?.currentPrices?.videoRatePerMinutePaise
  const handle = me?.username ? `@${String(me.username).replace(/^@/, '')}` : me?.phone
  const hostingId = me?.hostingId || (me?.id ? `HST-${String(me.id).replace(/-/g, '').slice(0, 4).toUpperCase()}` : '—')
  const verified = me?.kycStatus === 'approved'
  // Lifetime profile stats — read when the backend sends them (requested), "—" until then.
  const stats = hp.stats || dash?.lifetime || {}
  const talkSecs = stats.talkTimeSeconds ?? hp.totalTalkTimeSeconds
  const payoutSub = primary === undefined ? '' : !primary ? 'Add a payout method' : primary.type === 'upi' ? primary.details?.vpa : `${primary.details?.bankName || 'Bank'} •••• ${String(primary.details?.accountNumber || '').slice(-4)}`
  const kycLabel = (me?.kycStatus || 'not submitted').replace('_', ' ')

  return (
    <AppLayout tab="/settings" title="Profile & settings" maxW="xl" bg="canvas" pad={false}>
      <div className="lg:max-w-5xl lg:mx-auto lg:px-8 lg:py-8 lg:grid lg:grid-cols-[340px_1fr] lg:gap-6 lg:items-start">
        <div className="lg:sticky lg:top-6">
          {/* Profile header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 px-5 pt-5 pb-5 text-white lg:rounded-3xl">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <Avatar name={name} size={84} src={me?.avatarUrl} className="ring-[3px] ring-white shrink-0" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[22px] font-bold leading-tight">
                  <span className="truncate">{name}</span>
                  {verified && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold-400 text-white"><Icon name="check" size={12} strokeWidth={3} /></span>}
                </p>
                <p className="truncate text-[13px] text-white/80">{[handle, (me?.languages || []).join(', ')].filter(Boolean).join(' · ')}</p>
                <div className="mt-2 flex gap-2">
                  <span className="pill bg-black/30 text-[12px] font-bold text-white">{rating?.average != null ? rating.average.toFixed(1) : '—'} ★</span>
                  <span className="pill bg-black/30 text-[12px] font-bold text-white">{callsTotal != null ? `${compactNum(callsTotal)} calls` : `${rating?.count ?? 0} ratings`}</span>
                </div>
              </div>
            </div>
            <div className="relative mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-white/85">
              <span>Hosting ID · <span className="font-bold text-white">{hostingId}</span></span>
              <span>·</span>
              <span className={`font-semibold ${verified ? 'text-emerald-300' : 'text-gold-300'}`}>{verified ? 'Verified' : 'Not verified'}</span>
              {level && <><span>·</span><span className="pill bg-black/30 text-[12px] font-extrabold text-white"><span aria-hidden>👑</span> LVL {level.level}</span></>}
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3 px-5 pt-4 lg:px-0">
            {[
              ['users', 'brand', compactNum(stats.followersCount ?? hp.followersCount), 'Followers'],
              ['clock', 'brand', talkSecs != null ? duration(talkSecs) : '—', 'Talk time'],
              ['gift', 'gold', compactNum(stats.giftsReceivedCount ?? hp.giftsReceivedCount), 'Gifts'],
            ].map(([icon, tone, value, label]) => (
              <div key={label} className="rounded-2xl border border-black/[.08] bg-white p-3.5 shadow-sm">
                <IconBadge name={icon} tone={tone} size={32} />
                <p className="mt-3 text-[20px] font-extrabold text-ink-900">{value}</p>
                <p className="text-[12px] text-ink-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 lg:px-0 pb-24 lg:pb-6">
          <div className="divide-y divide-black/5">
            <Row icon="user" tone="brand" title="My Profile & Gallery" sub="Name, bio, languages" onClick={() => nav('/settings/edit-profile')} />
            <Row icon="card" tone="gold" title="Rate settings" sub={videoRate ? `${rupees(videoRate)}/min video` : 'Set your rates'} onClick={() => nav('/settings/rates')} />
            <Row icon="info" tone="brand" title="KYC Details" sub={<span className="capitalize">{kycLabel}</span>} onClick={() => nav('/settings/kyc')} />
            <Row icon="wallet" tone="brand" title="Payout details" sub={payoutSub} onClick={() => nav('/settings/payouts')} />
            <Row icon="receipt" tone="brand" title="My Withdrawals" onClick={() => nav('/settings/withdrawals')} />
            <Row icon="trending-up" tone="brand" title="My Earnings" onClick={() => nav('/settings/earnings')} />
            <Row icon="gift" tone="brand" title="Refer and Earn" onClick={() => nav('/settings/refer')} />
            <Row icon="ban" tone="brand" title="Blocked Users" onClick={() => nav('/settings/blocked')} />
            <Row icon="globe" tone="brand" title="Languages" sub={(me?.languages || []).join(', ')} onClick={() => nav('/settings/languages')} />
          </div>

          <SectionTitle className="mt-6 mb-1">Communication</SectionTitle>
          <div className="divide-y divide-black/5">
            <Row icon="bell" tone="brand" title="Notifications" sub="Calls, gifts, payouts" onClick={() => nav('/settings/notifications')} />
            <Row icon="live" tone="brand" title="Availability" sub="Auto-accept, voice-only hours" onClick={() => nav('/settings/availability')} />
          </div>

          <SectionTitle className="mt-6 mb-1">Growth</SectionTitle>
          <div className="divide-y divide-black/5">
            <Row icon="trending-up" tone="brand" title="Performance" sub="Meter, livestream score & leaderboards" onClick={() => nav('/settings/performance')} />
            <Row icon="crown" tone="gold" title="Host level" sub={level ? `Level ${level.level}${level.beansToNextLevel != null ? ` · ${beans(level.beansToNextLevel)} beans to next` : ' · Max level'}` : 'Your level & prices'} onClick={() => nav('/settings/level')} />
            <Row icon="sparkles" tone="gold" title="Beauty filter" sub="Smooth your camera in calls & live" onClick={() => nav('/settings/beauty-filter')} />
          </div>

          <SectionTitle className="mt-6 mb-1">Support</SectionTitle>
          <div className="divide-y divide-black/5">
            <Row icon="chat" tone="brand" title="Chat Bot" sub="Get help instantly" onClick={() => nav('/settings/help/chat')} />
            <Row icon="info" tone="brand" title="About Us" onClick={() => nav('/settings/about')} />
            <Row icon="file-text" tone="brand" title="Terms & Policies" onClick={() => nav('/settings/terms')} />
            <Row icon="lifebuoy" tone="brand" title="Help & Support" onClick={() => nav('/settings/help')} />
            <Row icon="logout" danger title="Logout" onClick={() => setLogoutOpen(true)} />
          </div>
        </div>
      </div>

      <SupportFab />

      {logoutOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end lg:justify-center lg:items-center" onClick={() => setLogoutOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-3xl lg:rounded-2xl lg:max-w-sm w-full p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-sheet-up" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-black/10 lg:hidden" />
            <p className="text-[18px] font-bold text-ink-900">Logging Out ?</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid place-items-center h-14 w-14 rounded-full bg-rose-50 shrink-0">
                <span className="grid place-items-center h-10 w-10 rounded-full border-2 border-dashed border-rose-300 text-rose-500"><Icon name="logout" size={18} /></span>
              </span>
              <p className="text-[13px] text-ink-500">You'll stop receiving calls and gifts until you sign back in. Your earnings stay safe.</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setLogoutOpen(false)} className="btn-outline">Cancel</button>
              <button onClick={doLogout} disabled={busy} className="btn-danger-outline disabled:opacity-60"><Icon name="logout" size={16} /> {busy ? 'Logging out…' : 'Log out'}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

/* 40 — KYC details */
export function KycStatus() {
  const nav = useNavigate()
  const { me } = useAuth()
  const [kyc, setKyc] = useState(null)
  const [summary, setSummary] = useState(null)
  const [minBeans, setMinBeans] = useState(null)
  const [err, setErr] = useState('')
  const load = () => {
    setErr('')
    profileApi.getKycStatus().then(setKyc).catch((e) => setErr(errorMessage(e, 'Could not load your KYC status.')))
    earningsApi.summary().then(setSummary).catch(() => {})
    // Bean threshold for withdrawing / submitting KYC — admin-configurable, read from /config when the backend sends it.
    configApi.get().then((c) => setMinBeans(c?.minWithdrawalBeans ?? c?.kycMinBeans ?? null)).catch(() => {})
  }
  useEffect(load, [])
  const status = kyc?.kycStatus || me?.kycStatus || 'not_submitted'
  const ref = referenceCode(kyc, me?.id)
  const lowBalance = minBeans != null && summary?.beanBalance != null && summary.beanBalance < minBeans
  const canUpdate = status === 'not_submitted' || status === 'rejected'
  const look = {
    approved: ['shield-check', 'text-emerald-600 bg-emerald-50', 'Identity verified', 'Your KYC is approved. You can withdraw your earnings.'],
    pending: ['clock', 'text-gold-600 bg-gold-50', 'Under review', 'We are checking your documents. This usually takes 1–2 business days.'],
    rejected: ['alert', 'text-rose-500 bg-rose-50', 'Verification rejected', kyc?.rejectionReason || 'Please submit your documents again.'],
    not_submitted: ['shield-check', 'text-brand-700 bg-brand-50', 'KYC not submitted', 'Submit your ID and payout details to start withdrawing.'],
  }[status] || ['shield-check', 'text-brand-700 bg-brand-50', status.replace('_', ' '), '']

  return (
    <AppLayout tab="/settings" title="KYC details" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="KYC Details" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-8 space-y-3">
        <ErrorCard message={err} onRetry={load} />
        {lowBalance && (
          <div className="flex gap-3 rounded-2xl border border-rose-300 bg-rose-50/60 px-4 py-3.5">
            <Icon name="info" size={22} className="shrink-0 text-rose-600" />
            <div>
              <p className="text-[13px] font-bold uppercase text-rose-600">Note</p>
              <p className="text-[13px] text-rose-600">Your balance is lower than the withdrawal limit of {beans(minBeans)} beans. Please submit your KYC when you have sufficient balance to withdraw.</p>
            </div>
          </div>
        )}
        {!kyc && !err ? <SkelGroup><SkelResult /></SkelGroup> : (
          <div className="flex flex-col items-center rounded-2xl border border-black/[.08] bg-white px-5 py-7 text-center">
            <span className={`grid h-16 w-16 place-items-center rounded-full ${look[1]}`}><Icon name={look[0]} size={30} /></span>
            <p className="mt-3 text-[18px] font-semibold capitalize text-ink-900">{look[2]}</p>
            {look[3] && <p className="mt-1 max-w-xs text-[13px] text-ink-500">{look[3]}</p>}
            {status !== 'not_submitted' && <div className="mt-3 w-full"><ReferenceRow value={ref} label="Application ID" /></div>}
            {(kyc?.documents || []).length > 0 && (
              <div className="mt-3 w-full divide-y divide-black/5 text-left">
                {kyc.documents.map((d) => (
                  <div key={d.documentType} className="flex items-center justify-between py-2 text-[14px]">
                    <span className="capitalize text-ink-500">{d.documentType.replace('_', ' ')}</span>
                    <span className="flex items-center gap-1.5 font-semibold text-ink-900">Uploaded <Icon name="check" size={14} className="text-emerald-500" /></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {canUpdate && <button onClick={() => nav('/onboarding/kyc')} className="btn-primary !mt-6">Update KYC</button>}
      </div>
    </AppLayout>
  )
}

/* 40 — Edit profile: Profile (photo, details, interest chips) + My gallery tabs */
const INTEREST_GROUPS = [
  ['interests', 'Interests', ['Pets', 'Self-Improvement', 'Life & Emotions', 'Mental Wellness', 'Movies & Celebs', 'Fashion', 'Fitness', 'Spirituality']],
  ['hobbies', 'Hobbies', ['Cooking', 'Binge watching', 'Dancing', 'Singing', 'Reading', 'Gaming', 'Photography', 'Art']],
  ['sports', 'Sports', ['Badminton', 'Cricket', 'Football', 'Yoga', 'Gym', 'Running', 'Swimming']],
  ['film', 'Film', ['Thriller', 'Bollywood', 'Romance', 'Comedy', 'Horror', 'Action', 'K-Drama']],
  ['music', 'Music', ['Rock', 'Classical', 'Bollywood', 'Pop', 'Hip-hop', 'Devotional', 'Indie']],
  ['traveling', 'Traveling', ['Beaches', 'Luxury', 'National Parks', 'Islands', 'Mountains', 'Road trips', 'Heritage']],
  ['food', 'Food', ['Biryani', 'Burger', 'Dosa', 'Pav Bhaji', 'Pizza', 'Chinese', 'Desserts']],
]

function Chip({ label, on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${on ? 'bg-brand-100 text-brand-700' : 'border border-black/10 bg-white text-ink-400'}`}
    >
      {label}
    </button>
  )
}

export function EditProfile() {
  const { me, setMe } = useAuth()
  const hp = me?.hostProfile || {}
  const [tab, setTab] = useState('profile')
  const [name, setName] = useState(me?.name || '')
  const [email, setEmail] = useState(me?.email || '')
  const [bio, setBio] = useState(hp.bio || '')
  const [languages] = useState(me?.languages || [])
  const [picks, setPicks] = useState(() => {
    const src = hp.interests && typeof hp.interests === 'object' && !Array.isArray(hp.interests) ? hp.interests : {}
    return Object.fromEntries(INTEREST_GROUPS.map(([key]) => [key, new Set(src[key] || [])]))
  })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)
  const avatarInputRef = useRef(null)
  const nav = useNavigate()

  const pickAvatar = (file) => {
    if (!file) return
    setAvatarFile(file)
    setAvatarPreviewUrl(URL.createObjectURL(file))
  }
  const toggle = (key, label) => setPicks((p) => {
    const next = new Set(p[key])
    next.has(label) ? next.delete(label) : next.add(label)
    return { ...p, [key]: next }
  })

  const save = async () => {
    setBusy(true)
    setErr('')
    setSaved(false)
    try {
      const avatarUrl = avatarFile ? await uploadAvatar(avatarFile) : undefined
      const updated = await profileApi.updateMe({ name: name.trim(), email: email.trim() || undefined, avatarUrl })
      const interests = Object.fromEntries(Object.entries(picks).map(([k, s]) => [k, [...s]]))
      const updatedHp = await profileApi.updateHostProfile({ bio: bio.trim() || undefined, interests })
      setMe({ ...me, ...updated, hostProfile: { ...me?.hostProfile, ...updatedHp, interests } })
      setAvatarFile(null)
      setSaved(true)
    } catch (e) {
      setErr(errorMessage(e, 'Could not save profile.'))
    } finally {
      setBusy(false)
    }
  }

  const handle = me?.username ? `@${String(me.username).replace(/^@/, '')}` : me?.phone
  const dob = me?.dateOfBirth || me?.dob
  const saveBtn = <button onClick={save} disabled={busy} className="rounded-xl bg-brand-600 px-4 py-2 text-[14px] font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>

  return (
    <AppLayout tab="/settings" title="Edit profile" back bottomNav={false} maxW="lg" bg="white">
      <TopBar title="Edit profile" right={tab === 'profile' ? saveBtn : null} />
      <div className="px-5 lg:px-0 pt-5 lg:pt-0 pb-8">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => avatarInputRef.current?.click()} className="relative shrink-0" aria-label="Change photo">
            <Avatar name={name || 'Host'} size={84} src={avatarPreviewUrl || me?.avatarUrl} />
            <span className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-brand-600 text-white"><Icon name="camera" size={13} /></span>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png" hidden onChange={(e) => pickAvatar(e.target.files?.[0] || null)} />
          <div className="min-w-0">
            <p className="truncate text-[22px] font-bold text-ink-900">{name || 'Host'}</p>
            <p className="text-[13px] text-ink-400">{[handle, dob ? new Date(dob).toLocaleDateString('en-GB') : null].filter(Boolean).join(' · ')}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 border-b border-black/10">
          {[['profile', 'Profile'], ['gallery', 'My Gallery']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`py-3 text-[13px] font-semibold ${tab === k ? 'border-b-2 border-brand-600 bg-brand-50 text-brand-700' : 'text-ink-900'}`}>{l}</button>
          ))}
        </div>

        {tab === 'gallery' ? <div className="pt-4"><GalleryPanel /></div> : (
          <div className="pt-4 space-y-4">
            <div className="grid gap-3 lg:grid-cols-2">
              <div><span className="label">Display name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><span className="label">E-mail</span><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="lg:col-span-2"><span className="label">Bio</span><textarea className="input min-h-[80px] py-2.5" value={bio} maxLength={300} onChange={(e) => setBio(e.target.value)} placeholder="A few words about you" /></div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] text-ink-500">Languages</p>
                <button onClick={() => nav('/settings/languages')} className="text-[12px] font-semibold text-brand-600">Edit</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {languages.length ? languages.map((l) => <Chip key={l} label={l} on onClick={() => nav('/settings/languages')} />) : <Chip label="Add languages" on={false} onClick={() => nav('/settings/languages')} />}
              </div>
            </div>

            {INTEREST_GROUPS.map(([key, label, options]) => (
              <div key={key}>
                <p className="mb-2 text-[13px] text-ink-500">{label}</p>
                <div className="flex flex-wrap gap-2">
                  {options.map((o) => <Chip key={o} label={o} on={picks[key].has(o)} onClick={() => toggle(key, o)} />)}
                </div>
              </div>
            ))}

            <ErrorCard message={err} compact />
            {saved && <p className="text-[13px] font-semibold text-emerald-600">Profile saved</p>}
            <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

/* Host level — level, progress to the next one, and what each level lets the host charge.
 * Levels are driven entirely by lifetime earnings on the backend; nothing here edits them. */
export function HostLevel() {
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const load = () => { setErr(''); profileApi.getLevel().then(setData).catch((e) => setErr(errorMessage(e, 'Could not load your level.'))) }
  useEffect(load, [])

  const isMax = data && data.beansToNextLevel == null
  // Progress within the current level only (0–1,00,000), not lifetime total.
  const intoLevel = data ? data.lifetimeEarnedBeans - (data.level - 1) * data.beansPerLevel : 0
  const pct = isMax ? 100 : Math.min(100, Math.round((intoLevel / (data?.beansPerLevel || 1)) * 100))

  return (
    <AppLayout tab="/settings" title="Host level" back bottomNav={false} maxW="xl" bg="canvas">
      <TopBar title="Host level" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-6">
        <ErrorCard message={err} onRetry={load} />
        {!data && !err && (
          <SkelGroup className="flex flex-col gap-4 lg:grid lg:grid-cols-[380px_1fr] lg:gap-6 lg:items-start">
            <div className="space-y-4"><SkelHero height="h-40" /><SkelRows rows={3} /></div>
            <SkelList rows={8} avatar={false} />
          </SkelGroup>
        )}
        {data && (
          // Phone: one column in the order-* sequence. Laptop: level, prices and "how it works"
          // in a sticky left column, the full levels table on the right. Wrappers are
          // `display: contents` on phone so each block is rendered once.
          <div className="flex flex-col lg:grid lg:grid-cols-[380px_1fr] lg:gap-6 lg:items-start">
          <div className="contents lg:block lg:sticky lg:top-6">
            <div className="order-1 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center h-14 w-14 rounded-2xl bg-gold-400/20 text-gold-300"><Icon name="crown" size={28} /></span>
                <div>
                  <p className="text-[13px] text-white/70">Your level</p>
                  <p className="text-[28px] font-extrabold leading-tight">Level {data.level}<span className="text-[15px] font-semibold text-white/60"> / {data.maxLevel ?? data.levels?.length ?? 20}</span></p>
                </div>
              </div>
              <div className="mt-4 h-2.5 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full rounded-full bg-gold-400" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-[13px] text-white/80">
                {isMax ? "You've reached the top level." : `${beans(data.beansToNextLevel)} more beans to reach Level ${data.level + 1}`}
              </p>
              <p className="text-[12px] text-white/60">Lifetime earned: {beans(data.lifetimeEarnedBeans)} beans · withdrawals never lower your level</p>
            </div>

            <div className="order-2">
            <SectionTitle className="mt-5 mb-2">Your prices now</SectionTitle>
            <div className="card px-4 divide-y divide-black/5">
              <PriceRow label="Video call" unit="/min" current={data.currentPrices.videoRatePerMinutePaise} max={data.maxPrices.videoRatePerMinutePaise} />
              <PriceRow label="Voice call" unit="/min" current={data.currentPrices.voiceRatePerMinutePaise} max={data.maxPrices.voiceRatePerMinutePaise} />
              <PriceRow label="Message" unit="/msg" current={data.currentPrices.messageRatePaise} max={data.maxPrices.messageRatePaise} />
            </div>
            <button onClick={() => nav('/settings/rates')} className="btn-outline mt-3">Change my rates</button>

            </div>
            {data.nextLevelMaxPrices && (
              <p className="order-3 mt-4 text-[13px] text-ink-500">
                At Level {data.level + 1} you can charge up to {rupees(data.nextLevelMaxPrices.videoRatePerMinutePaise)}/min video, {rupees(data.nextLevelMaxPrices.voiceRatePerMinutePaise)}/min voice and {rupees(data.nextLevelMaxPrices.messageRatePaise)} per message.
              </p>
            )}

            <div className="order-5">
            <SectionTitle className="mt-5 mb-2">How levels work</SectionTitle>
            <div className="card p-4 space-y-2.5 text-[13px] text-ink-600">
              <p>• Everyone starts at <span className="font-semibold text-ink-900">Level 1</span>: ₹30/min video, ₹20/min voice and ₹5 per message.</p>
              <p>• You move up one level for every <span className="font-semibold text-ink-900">{beans(data.beansPerLevel)} beans</span> you earn from calls, gifts and messages — automatically, no action needed.</p>
              <p>• Each level raises your maximum video, voice and message price by <span className="font-semibold text-ink-900">₹20</span>. Level {data.maxLevel ?? data.levels?.length ?? 20} is the top.</p>
              <p>• You can charge less than your maximum in Rate settings. Leave a rate empty to always charge your level's price — it goes up by itself when you level up.</p>
              <p>• Withdrawing your beans never lowers your level — it's based on everything you've ever earned.</p>
            </div>
            </div>
          </div>

          <div className="order-4 lg:order-none">
            <SectionTitle className="mt-5 lg:mt-0 mb-2">All levels & prices</SectionTitle>
            <p className="-mt-1 mb-2 text-[12px] text-ink-400">Maximum prices you can charge at each level. Prices are in ₹.</p>
            {/* A real <table> so columns stay aligned; scrolls sideways on narrow phones
                instead of squashing six columns into the screen width. */}
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <thead>
                  <tr className="bg-black/[.03] text-[11px] font-bold uppercase tracking-wide text-ink-400">
                    <th className="px-3 py-2.5">Level</th>
                    <th className="px-3 py-2.5">Unlocks at</th>
                    <th className="px-3 py-2.5 text-right">Video / min</th>
                    <th className="px-3 py-2.5 text-right">Voice / min</th>
                    <th className="px-3 py-2.5 text-right">Per message</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.levels.map((l) => {
                    const current = l.level === data.level
                    const unlocked = l.level < data.level
                    return (
                      <tr key={l.level} className={`border-t border-black/5 ${current ? 'bg-gold-50 font-bold text-ink-900' : unlocked ? 'text-ink-500' : 'text-ink-700'}`}>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">{current && <Icon name="crown" size={12} className="text-gold-500" />}Level {l.level}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{l.requiredLifetimeBeans === 0 ? 'Start' : `${beans(l.requiredLifetimeBeans)} beans`}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">{rupees(l.videoRatePerMinutePaise)}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">{rupees(l.voiceRatePerMinutePaise)}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">{rupees(l.messageRatePaise)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {current ? (
                            <span className="pill bg-gold-400/20 text-gold-600 text-[11px]">Current</span>
                          ) : unlocked ? (
                            <span className="pill bg-emerald-50 text-emerald-600 text-[11px]"><Icon name="check" size={11} /> Unlocked</span>
                          ) : (
                            <span className="pill bg-black/5 text-ink-400 text-[11px]"><Icon name="lock" size={11} /> {beans(l.requiredLifetimeBeans - data.lifetimeEarnedBeans)} to go</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

          </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function PriceRow({ label, unit, current, max }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[15px] font-semibold text-ink-900">{label}</span>
      <span className="text-right">
        <span className="block text-[15px] font-bold text-ink-900">{rupees(current)}{unit}</span>
        <span className="block text-[12px] text-ink-400">{current === max ? 'Level price' : `Max ${rupees(max)}${unit}`}</span>
      </span>
    </div>
  )
}

/* 40 — Rate settings */
export function RateSettings() {
  const { me, setMe } = useAuth()
  const hp = me?.hostProfile
  const [video, setVideo] = useState(hp?.ratePerMinutePaise != null ? String(hp.ratePerMinutePaise / 100) : '')
  const [voice, setVoice] = useState(hp?.voiceRatePerMinutePaise != null ? String(hp.voiceRatePerMinutePaise / 100) : '')
  const [message, setMessage] = useState(hp?.messageRatePaise != null ? String(hp.messageRatePaise / 100) : '')
  const [priv, setPriv] = useState(hp?.privateLiveRatePerMinutePaise != null ? String(hp.privateLiveRatePerMinutePaise / 100) : '')
  const [auto, setAuto] = useState(hp?.autoAcceptCalls ?? true)
  const [night, setNight] = useState(hp?.voiceCallsOnlyAfterMidnight ?? false)
  const [level, setLevel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => { profileApi.getLevel().then(setLevel).catch(() => {}) }, [])
  const max = level?.maxPrices

  // Empty = "charge my level's price" (sent as null), which then rises by itself on every
  // level-up. A typed value must stay at or under the level maximum — the backend enforces
  // this too (400); checking here just gives a clearer message before the round-trip.
  const toPaise = (v) => (v === '' ? null : Math.round(Number(v) * 100))
  const capped = [
    [toPaise(video), max?.videoRatePerMinutePaise, 'Video call'],
    [toPaise(voice), max?.voiceRatePerMinutePaise, 'Voice call'],
    [toPaise(message), max?.messageRatePaise, 'Message'],
  ]

  const save = async () => {
    setErr('')
    setSaved(false)
    for (const [value, cap, label] of capped) {
      if (value != null && cap != null && value > cap) {
        setErr(`${label} can't be more than ${rupees(cap)} at Level ${level.level}.`)
        return
      }
    }
    setBusy(true)
    try {
      const updated = await profileApi.updateHostProfile({
        ratePerMinutePaise: toPaise(video),
        voiceRatePerMinutePaise: toPaise(voice),
        messageRatePaise: toPaise(message),
        privateLiveRatePerMinutePaise: priv ? Math.round(Number(priv) * 100) : undefined,
        autoAcceptCalls: auto,
        voiceCallsOnlyAfterMidnight: night,
      })
      setMe({ ...me, hostProfile: { ...me?.hostProfile, ...updated } })
      setSaved(true)
      setEditing(false)
      profileApi.getLevel().then(setLevel).catch(() => {}) // refresh the rates shown on the level card
    } catch (e) {
      setErr(errorMessage(e, 'Could not save rates.'))
    } finally {
      setBusy(false)
    }
  }

  const hint = (cap) => (cap != null ? `Up to ${rupees(cap)} at Level ${level.level} · leave empty to use ${rupees(cap)}` : '')

  // What callers pay right now: the host's own rate if set, otherwise the level price.
  const videoNow = level?.currentPrices?.videoRatePerMinutePaise ?? hp?.ratePerMinutePaise
  const voiceNow = level?.currentPrices?.voiceRatePerMinutePaise ?? hp?.voiceRatePerMinutePaise

  return (
    <AppLayout tab="/settings" title="Rate settings" back bottomNav={false} maxW="lg" bg="canvas">
      <TopBar title="Rate settings" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-8 lg:grid lg:grid-cols-[380px_1fr] lg:gap-6 lg:items-start">
        {/* My level card */}
        <div className="lg:sticky lg:top-6">
          {!level ? (
            <SkelGroup><SkelHero height="h-56" /></SkelGroup>
          ) : (
            <div className="relative overflow-hidden rounded-[28px] bg-[#120a24] p-5 text-white shadow-lg">
              <div className="pointer-events-none absolute -left-10 -top-16 h-56 w-56 rounded-full bg-brand-600/50 blur-3xl" />
              <div className="pointer-events-none absolute -right-12 bottom-0 h-40 w-40 rounded-full bg-fuchsia-600/30 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2.5">
                  <p className="text-[20px] font-semibold">My Level —</p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] font-extrabold ring-1 ring-white/10">
                    <span aria-hidden>👑</span> LVL {level.level}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[['Video Call Rate', videoNow], ['Audio Call Rate', voiceNow]].map(([label, v]) => (
                    <div key={label} className="rounded-2xl border border-white/15 bg-white/[.04] px-3 py-3.5 text-center">
                      <p className="text-[12px] text-white/70">{label}</p>
                      <p className="mt-1 text-[18px] font-extrabold text-gold-400">{v != null ? `${rupees(v)}/min` : '—'}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setSaved(false); setErr(''); setEditing(true) }} className="mt-4 h-12 w-full rounded-xl bg-brand-600 text-[15px] font-bold text-white transition hover:bg-brand-500 active:scale-[.99]">
                  Change call rate
                </button>
                {saved && <p className="mt-2 text-center text-[12px] font-semibold text-emerald-300">Rates saved</p>}
              </div>
            </div>
          )}
        </div>

        {/* Level table — current level ticked, higher levels faded */}
        <div className="mt-5 lg:mt-0">
          {!level ? (
            <SkelGroup><SkelList rows={8} avatar={false} /></SkelGroup>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-black/[.07] bg-white">
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_44px] items-center bg-black/[.03] px-4 py-3 text-[12px] text-ink-400">
                <span>Level</span><span>Video</span><span>Voice</span><span>Message</span><span />
              </div>
              {level.levels?.map((l) => {
                const current = l.level === level.level
                const locked = l.level > level.level
                return (
                  <div
                    key={l.level}
                    className={`grid grid-cols-[1fr_1fr_1fr_1fr_44px] items-center border-t border-black/[.06] px-4 py-3.5 text-[13px] ${current ? 'bg-brand-100/70 font-bold text-ink-900' : locked ? 'text-ink-300' : 'font-semibold text-ink-900'}`}
                  >
                    <span>Lv {l.level}</span>
                    <span>{rupees(l.videoRatePerMinutePaise)}</span>
                    <span>{rupees(l.voiceRatePerMinutePaise)}</span>
                    <span>{rupees(l.messageRatePaise)}</span>
                    <span className="flex justify-end">
                      {current ? (
                        <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-600 text-white"><Icon name="check" size={14} /></span>
                      ) : (
                        <span className={`h-6 w-6 rounded-md border-[1.5px] ${locked ? 'border-black/10' : 'border-brand-200'}`} />
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {level && <p className="mt-2 px-1 text-[12px] text-ink-400">Maximum price per minute (video, voice) and per message at each level. You move up automatically as you earn.</p>}
        </div>
      </div>

      {/* Change call rate — bottom sheet with the rate form */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 animate-fade-in lg:items-center" onClick={() => setEditing(false)}>
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-canvas p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:rounded-3xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/10 lg:hidden" />
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[18px] font-extrabold text-ink-900">Change call rate</p>
              <button onClick={() => setEditing(false)} className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-ink-500" aria-label="Close"><Icon name="x" size={16} /></button>
            </div>
        <div>
        <SectionTitle className="mb-2">Per-minute rates (₹)</SectionTitle>
        <div className="card p-4 space-y-3.5">
          <div>
            <span className="label">Video call</span>
            <input className="input" value={video} onChange={(e) => setVideo(e.target.value.replace(/[^\d.]/g, ''))} placeholder={max ? String(max.videoRatePerMinutePaise / 100) : ''} />
            <p className="text-[12px] text-ink-400 mt-1">{hint(max?.videoRatePerMinutePaise)}</p>
          </div>
          <div>
            <span className="label">Voice call</span>
            <input className="input" value={voice} onChange={(e) => setVoice(e.target.value.replace(/[^\d.]/g, ''))} placeholder={max ? String(max.voiceRatePerMinutePaise / 100) : ''} />
            <p className="text-[12px] text-ink-400 mt-1">{hint(max?.voiceRatePerMinutePaise)}</p>
          </div>
          <div><span className="label">Private live</span><input className="input" value={priv} onChange={(e) => setPriv(e.target.value.replace(/[^\d.]/g, ''))} placeholder="30" /></div>
        </div>
        </div>
        <div>
        <SectionTitle className="mt-5 lg:mt-0 mb-2">Per-message price (₹)</SectionTitle>
        <div className="card p-4">
          <span className="label">Message from a user</span>
          <input className="input" value={message} onChange={(e) => setMessage(e.target.value.replace(/[^\d.]/g, ''))} placeholder={max ? String(max.messageRatePaise / 100) : ''} />
          <p className="text-[12px] text-ink-400 mt-1">{hint(max?.messageRatePaise)}</p>
        </div>
        <SectionTitle className="mt-5 mb-2">Availability</SectionTitle>
        <div className="card p-4 divide-y divide-black/5">
          <div className="flex items-center gap-3 pb-3"><span className="flex-1 text-[15px] font-semibold text-ink-900">Auto-accept calls</span><Toggle on={auto} onChange={setAuto} /></div>
          <div className="flex items-center gap-3 pt-3"><span className="flex-1 text-[15px] font-semibold text-ink-900">Voice calls only after 12 AM</span><Toggle on={night} onChange={setNight} /></div>
        </div>
        </div>
        <ErrorCard message={err} compact className="mt-3" />
        <button onClick={save} disabled={busy} className="btn-primary mt-4 disabled:opacity-60">{busy ? 'Saving…' : 'Save rates'}</button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

/* 41 — Gallery */
export function Gallery() {
  return (
    <AppLayout tab="/settings" title="Gallery" back bottomNav={false} maxW="lg" bg="white">
      <TopBar title="Gallery" />
      <div className="px-5 lg:px-0 pt-3 lg:pt-0"><GalleryPanel /></div>
    </AppLayout>
  )
}

export function GalleryPanel() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState('All')
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const [mediaType, setMediaType] = useState('photo')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const [addErr, setAddErr] = useState('')
  const [broken, setBroken] = useState(() => new Set())
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef(null)

  const load = () => { setErr(''); profileApi.listGallery().then((res) => setItems(res.items || [])).catch((e) => setErr(errorMessage(e, 'Could not load your gallery.'))).finally(() => setLoading(false)) }
  useEffect(load, [])

  const filtered = items.filter((t) => f === 'All' || (f === 'Photos' ? t.mediaType === 'photo' : t.mediaType === 'video'))

  const addItem = async () => {
    if (!url.trim()) return
    setSaving(true)
    setAddErr('')
    try {
      await profileApi.addGalleryItem(mediaType, url.trim())
      setUrl('')
      setAdding(false)
      await load()
    } catch (e) {
      setAddErr(errorMessage(e, 'Could not add that item.'))
    } finally {
      setSaving(false)
    }
  }

  const uploadFile = async (file) => {
    setUploading(true)
    setErr('')
    try {
      const type = file.type.startsWith('video') ? 'video' : 'photo'
      const { uploadUrl, url: publicUrl } = await profileApi.getGalleryUploadUrl(file.type || 'application/octet-stream')
      await profileApi.uploadGalleryFile(uploadUrl, file)
      await profileApi.addGalleryItem(type, publicUrl)
      await load()
    } catch (e) {
      setErr(errorMessage(e, 'Could not upload that file.'))
    } finally {
      setUploading(false)
    }
  }

  const remove = async (id) => {
    setDeleting(true)
    try {
      await profileApi.deleteGalleryItem(id)
      setItems((prev) => prev.filter((t) => t.id !== id))
      setViewing(null)
    } catch (e) {
      setErr(errorMessage(e, 'Could not remove that item.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="pb-4">
        <div className="flex gap-2">
          {['All', 'Photos', 'Videos'].map((c) => (
            <button key={c} onClick={() => setF(c)} className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${f === c ? 'bg-brand-600 text-white' : 'bg-black/5 text-ink-400'}`}>{c}</button>
          ))}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) uploadFile(file) }}
        />
        {adding && (
          <div className="card mt-3 p-3.5 space-y-2.5">
            <div className="flex gap-2">
              {['photo', 'video'].map((t) => (
                <button key={t} onClick={() => setMediaType(t)} className={`rounded-full px-3 py-1 text-[12px] font-semibold capitalize ${mediaType === t ? 'bg-brand-600 text-white' : 'bg-black/5 text-ink-400'}`}>{t}</button>
              ))}
            </div>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="input" />
            <ErrorCard message={addErr} compact />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setAdding(false)} className="btn-outline text-[13px]">Cancel</button>
              <button onClick={addItem} disabled={saving || !url.trim()} className="btn-primary text-[13px] disabled:opacity-60">{saving ? 'Adding…' : 'Add'}</button>
            </div>
          </div>
        )}
        <ErrorCard message={err} onRetry={load} className="mt-4" />
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-2.5 mt-4">
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="aspect-square rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/60 grid place-items-center text-brand-500 disabled:opacity-60">
            {uploading ? <Icon name="refresh" size={20} className="animate-spinslow" /> : <Icon name="plus" size={22} />}
          </button>
          {loading && [0, 1, 2, 3, 4].map((i) => <Skel key={i} className="aspect-square rounded-2xl" />)}
          {!loading && filtered.map((t) => (
            // Tapping used to delete instantly, no confirmation, no way to see it full-size
            // first — now it opens the viewer below; deleting only happens from an explicit
            // button there.
            <button key={t.id} onClick={() => setViewing(t)} className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-brand-300/60 to-gold-300/50 grid place-items-center">
              {broken.has(t.id) ? (
                <span className="flex flex-col items-center gap-1 text-ink-500/70 px-2 text-center">
                  <Icon name="alert" size={18} />
                  <span className="text-[10px] font-semibold">Couldn't load</span>
                </span>
              ) : t.mediaType === 'video' ? (
                <>
                  {/* preload="metadata" gets the browser to paint the video's first frame as
                      a real thumbnail — previously every video showed the same blank gradient
                      with a play icon, indistinguishable from each other. */}
                  <video src={t.url} className="absolute inset-0 h-full w-full object-cover" muted playsInline preload="metadata" onError={() => setBroken((s) => new Set(s).add(t.id))} />
                  <span className="absolute h-9 w-9 grid place-items-center rounded-full bg-black/40 text-white pointer-events-none">▶</span>
                </>
              ) : (
                <img src={t.url} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setBroken((s) => new Set(s).add(t.id))} />
              )}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-gold-50 px-3 py-2.5 text-[12px] text-gold-600">
          <Icon name="shield" size={14} className="mt-0.5 shrink-0" /> All uploads are reviewed. Nudity or off-platform contact will be removed.
        </div>
        {!adding && <button onClick={() => setAdding(true)} className="mt-3 text-[12px] font-semibold text-brand-600">or add by URL instead</button>}
      </div>

      {viewing && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col" onClick={() => setViewing(null)}>
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setViewing(null)} className="h-10 w-10 grid place-items-center rounded-full bg-white/10 text-white"><Icon name="x" size={18} /></button>
            <button
              onClick={(e) => { e.stopPropagation(); remove(viewing.id) }}
              disabled={deleting}
              className="flex items-center gap-1.5 rounded-full bg-rose-500 text-white px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
            >
              <Icon name="ban" size={15} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
          <div className="flex-1 grid place-items-center px-4 pb-4" onClick={(e) => e.stopPropagation()}>
            {broken.has(viewing.id) ? (
              <div className="text-center text-white/70">
                <Icon name="alert" size={28} className="mx-auto" />
                <p className="text-[13px] mt-2">This {viewing.mediaType} couldn't be loaded.</p>
                <p className="text-[11px] mt-1 break-all opacity-60">{viewing.url}</p>
              </div>
            ) : viewing.mediaType === 'video' ? (
              <video src={viewing.url} className="max-h-full max-w-full rounded-xl" controls autoPlay playsInline onError={() => setBroken((s) => new Set(s).add(viewing.id))} />
            ) : (
              <img src={viewing.url} alt="" className="max-h-full max-w-full rounded-xl object-contain" onError={() => setBroken((s) => new Set(s).add(viewing.id))} />
            )}
          </div>
        </div>
      )}
    </>
  )
}

/* 41 — Payout details */
export function PayoutDetails() {
  const nav = useNavigate()
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [menu, setMenu] = useState(null)

  const load = () => { setErr(''); profileApi.listPayoutMethods().then((res) => setMethods(res.methods || [])).catch((e) => setErr(errorMessage(e, 'Could not load your payout methods.'))).finally(() => setLoading(false)) }
  useEffect(load, [])

  const makePrimary = async (id) => {
    setMenu(null)
    try { await profileApi.setPrimaryPayoutMethod(id); load() } catch (e) { setErr(errorMessage(e, 'Could not update your primary method.')) }
  }
  const sorted = [...methods].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
  const title = (m) => (m.type === 'upi' ? m.details?.vpa : `${m.details?.bankName || 'Bank'} •••• ${String(m.details?.accountNumber || '').slice(-4)}`)
  const sub = (m) => (m.type === 'upi' ? `UPI · ${m.isPrimary ? 'Primary' : 'Backup'}` : `${m.details?.accountHolderName || 'Bank account'} · ${m.isPrimary ? 'Primary' : 'Backup'}`)

  return (
    <AppLayout tab="/settings" title="Payout details" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Payout details" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-8">
        {loading && <SkelGroup><SkelRows rows={2} /></SkelGroup>}
        <ErrorCard message={err} onRetry={load} className="mb-3" />
        {!loading && !err && methods.length === 0 && <p className="py-4 text-center text-[13px] text-ink-400">No payout methods yet.</p>}
        <div className="space-y-3">
          {sorted.map((m) => (
            <div key={m.id} className="relative flex items-center gap-3 rounded-2xl border border-black/[.06] bg-white p-4 shadow-sm">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${m.isPrimary ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white' : 'bg-blue-50 text-blue-600'}`}>
                <Icon name={m.type === 'upi' ? 'wallet' : 'card'} size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold text-ink-900">{title(m)}</p>
                <p className="truncate text-[13px] text-ink-400">{sub(m)}</p>
              </div>
              {m.isPrimary ? (
                <span className="pill bg-emerald-50 text-[12px] font-semibold text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-current" /> {m.isVerified === false ? 'Primary' : 'Verified'}</span>
              ) : (
                <button onClick={() => setMenu(menu === m.id ? null : m.id)} className="grid h-9 w-9 place-items-center rounded-full text-ink-500 hover:bg-black/5" aria-label="More"><Icon name="more-vertical" size={18} /></button>
              )}
              {menu === m.id && (
                <div className="absolute right-4 top-14 z-10 w-44 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg">
                  <button onClick={() => makePrimary(m.id)} className="block w-full px-4 py-3 text-left text-[14px] font-medium text-ink-900 hover:bg-black/[.03]">Make primary</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <SectionTitle className="mt-6 mb-1">Payout schedule</SectionTitle>
        <div className="divide-y divide-black/5">
          <Row icon="clock" tone="brand" title="Processing time" sub="2–3 business days after you withdraw" right={<span />} />
          <Row icon="wallet" tone="gold" title="Minimum amount" sub="₹ 10 per withdrawal" right={<span />} />
        </div>
        <button onClick={() => nav('/settings/payouts/add')} className="btn-outline mt-4 bg-white"><Icon name="plus" size={16} /> Add payout method</button>
      </div>
    </AppLayout>
  )
}

/* 42 — Notification settings */
const PREF_FIELDS = [
  ['Calls & chat', [['incomingCalls', 'Incoming calls'], ['missedCalls', 'Missed calls'], ['newMessages', 'New messages'], ['callReminders', 'Call reminders']]],
  ['Money', [['giftsReceived', 'Gifts received'], ['withdrawalUpdates', 'Withdrawal updates'], ['weeklyEarningsSummary', 'Weekly earnings summary'], ['walletActivityAlerts', 'Wallet activity alerts']]],
  ['Other', [['liveAlerts', 'Live alerts'], ['promotionsAndTips', 'Promotions & tips'], ['dndEnabled', 'Do not disturb']]],
]

export function NotificationSettings() {
  const [prefs, setPrefs] = useState(null)
  const [err, setErr] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const load = () => { setErr(''); profileApi.getNotificationPreferences().then(setPrefs).catch((e) => setErr(errorMessage(e, 'Could not load your notification settings.'))) }
  useEffect(load, [])

  const update = async (key, value) => {
    const previous = prefs[key]
    setPrefs((p) => ({ ...p, [key]: value }))
    setSaveErr('')
    try {
      await profileApi.updateNotificationPreferences({ [key]: value })
    } catch (e) {
      setPrefs((p) => ({ ...p, [key]: previous }))
      setSaveErr(errorMessage(e, 'Could not save that change.'))
    }
  }

  return (
    <AppLayout tab="/settings" title="Notification settings" back bottomNav={false} maxW="xl" bg="canvas">
      <TopBar title="Notification Settings" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-6 space-y-5 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
        {!prefs && !err && [4, 4, 3].map((n, i) => <SkelGroup key={i}><Skel className="h-3 w-24 rounded-md mb-2" /><SkelToggles rows={n} /></SkelGroup>)}
        <ErrorCard message={err} onRetry={load} className="lg:col-span-3" />
        <ErrorCard message={saveErr} compact className="lg:col-span-3" />
        {prefs && PREF_FIELDS.map(([g, rows]) => (
          <div key={g}>
            <SectionTitle className="mb-2 !font-bold">{g}</SectionTitle>
            <div className="rounded-2xl border border-black/[.06] bg-white px-4 py-1 shadow-sm">
              {rows.map(([key, label]) => (
                <div key={key} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1 text-[15px] font-semibold text-ink-900">{label}</span>
                  <Toggle on={!!prefs[key]} onChange={(v) => update(key, v)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}

/* 43 — Help & support */
const HELP_TOPICS = [
  ['wallet', 'gold', 'Why is my withdrawal pending?', 'Withdrawals are processed in 2–3 business days. Your KYC must be approved and you need a payout method on file. You can follow each request in My Withdrawals.'],
  ['shield', 'green', 'KYC document guidelines', 'Upload a clear photo of a government ID (front and back) where your name and photo are easy to read. Blurry, cropped or expired documents are rejected.'],
  ['phone', 'brand', 'Improving call quality', 'Use Wi-Fi or a strong 4G/5G signal, face a light source, and keep the app open during calls. The beauty filter can also help in low light.'],
  ['flag', 'rose', 'Reporting an abusive user', 'During or after a call, open the user’s options and choose Report or Block. Our team reviews every report. Blocked users can’t call or message you.'],
]

export function HelpSupport() {
  const nav = useNavigate()
  const [open, setOpen] = useState(null)
  return (
    <AppLayout tab="/settings" title="Help & support" back bottomNav={false} maxW="lg" bg="canvas">
      <TopBar title="Help & support" />
      <SupportFab aboveNav={false} />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-8 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
        <div>
          <div className="rounded-2xl border border-black/[.06] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-50">
                <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-dashed border-brand-300 text-brand-600"><Icon name="lifebuoy" size={18} /></span>
              </span>
              <div>
                <p className="text-[16px] font-bold text-ink-900">Talk to us</p>
                <p className="text-[13px] text-ink-400">Message our support team</p>
              </div>
            </div>
            <button onClick={() => nav('/settings/help/chat')} className="btn-primary mt-4">Start a chat</button>
          </div>

          <SectionTitle className="mt-6 mb-1">Popular topics</SectionTitle>
          <div className="divide-y divide-black/5">
            {HELP_TOPICS.map(([icon, tone, q, a], i) => (
              <div key={q}>
                <Row icon={icon} tone={tone} title={q} onClick={() => setOpen(open === i ? null : i)} right={<Icon name={open === i ? 'chevron-down' : 'chevron-right'} size={18} className="text-ink-700" />} />
                {open === i && <p className="-mt-1 pb-3.5 pl-[54px] text-[13px] leading-relaxed text-ink-500">{a}</p>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle className="mt-6 lg:mt-0 mb-1">Legal</SectionTitle>
          <div className="divide-y divide-black/5">
            <Row icon="file-text" tone="brand" title="Terms of service" onClick={() => nav('/settings/terms')} />
            <Row icon="file-text" tone="brand" title="Privacy policy" onClick={() => nav('/settings/terms#privacy')} />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

/* Availability — online status and how calls reach the host. */
export function Availability() {
  const { me, setMe } = useAuth()
  const hp = me?.hostProfile || {}
  const [online, setOnline] = useState(null)
  const [auto, setAuto] = useState(hp.autoAcceptCalls ?? true)
  const [night, setNight] = useState(hp.voiceCallsOnlyAfterMidnight ?? false)
  const [err, setErr] = useState('')

  useEffect(() => { earningsApi.dashboard().then((d) => setOnline(!!d?.isOnline)).catch(() => {}) }, [])

  const setPresence = async (v) => {
    const prev = online
    setOnline(v)
    setErr('')
    try { await presenceApi.setOnline(v) } catch (e) { setOnline(prev); setErr(errorMessage(e, 'Could not update your status.')) }
  }
  const savePref = async (key, value, setter, prev) => {
    setter(value)
    setErr('')
    try {
      const updated = await profileApi.updateHostProfile({ [key]: value })
      setMe({ ...me, hostProfile: { ...me?.hostProfile, ...updated } })
    } catch (e) {
      setter(prev)
      setErr(errorMessage(e, 'Could not save that change.'))
    }
  }

  return (
    <AppLayout tab="/settings" title="Availability" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Availability" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-8 space-y-5">
        <ErrorCard message={err} compact />
        <div>
          <SectionTitle className="mb-2 !font-bold">Status</SectionTitle>
          <div className="rounded-2xl border border-black/[.06] bg-white px-4 py-3 shadow-sm flex items-center gap-3">
            <span className="flex-1">
              <span className="block text-[15px] font-semibold text-ink-900">{online ? 'Online' : 'Offline'}</span>
              <span className="block text-[12px] text-ink-400">{online ? 'Users can call you now' : 'Users can’t call you right now'}</span>
            </span>
            {online === null ? <Skel className="h-7 w-12 rounded-full" /> : <Toggle on={online} onChange={setPresence} />}
          </div>
        </div>
        <div>
          <SectionTitle className="mb-2 !font-bold">Calls</SectionTitle>
          <div className="rounded-2xl border border-black/[.06] bg-white px-4 py-1 shadow-sm">
            <div className="flex items-center gap-3 py-2.5">
              <span className="flex-1"><span className="block text-[15px] font-semibold text-ink-900">Auto-accept calls</span><span className="block text-[12px] text-ink-400">Connect incoming calls without tapping Accept</span></span>
              <Toggle on={auto} onChange={(v) => savePref('autoAcceptCalls', v, setAuto, auto)} />
            </div>
            <div className="flex items-center gap-3 border-t border-black/5 py-2.5">
              <span className="flex-1"><span className="block text-[15px] font-semibold text-ink-900">Voice calls only after 12 AM</span><span className="block text-[12px] text-ink-400">Video calls are turned off late at night</span></span>
              <Toggle on={night} onChange={(v) => savePref('voiceCallsOnlyAfterMidnight', v, setNight, night)} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

/* Blocked users — everyone the host has blocked, with unblock. */
export function BlockedUsers() {
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState(null)
  const load = () => {
    setErr('')
    moderationApi.listBlocked().then((res) => setList(res.blocks || res.blocked || res.items || (Array.isArray(res) ? res : []))).catch((e) => setErr(errorMessage(e, 'Could not load blocked users.')))
  }
  useEffect(load, [])
  const who = (b) => b.user || b.blockedUser || b.blocked || b
  const unblock = async (id) => {
    setBusyId(id)
    try { await moderationApi.unblock(id); setList((l) => l.filter((b) => (who(b).id || b.blockedUserId || b.userId) !== id)) } catch (e) { setErr(errorMessage(e, 'Could not unblock.')) } finally { setBusyId(null) }
  }
  return (
    <AppLayout tab="/settings" title="Blocked users" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Blocked Users" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-8">
        <ErrorCard message={err} onRetry={load} className="mb-3" />
        {!list && !err && <SkelGroup><SkelList rows={3} /></SkelGroup>}
        {list && list.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon name="ban" size={24} /></span>
            <p className="mt-3 text-[16px] font-medium text-ink-900">No blocked users</p>
            <p className="mt-1 text-[12px] text-ink-400">People you block can’t call or message you.</p>
          </div>
        )}
        {list && list.length > 0 && (
          <div className="card divide-y divide-black/5 px-4">
            {list.map((b) => {
              const u = who(b)
              const id = u.id || b.blockedUserId || b.userId
              return (
                <div key={id} className="flex items-center gap-3 py-3">
                  <Avatar name={u.name || 'User'} size={40} src={u.avatarUrl} />
                  <span className="flex-1 truncate text-[15px] font-semibold text-ink-900">{u.name || u.phone || 'User'}</span>
                  <button onClick={() => unblock(id)} disabled={busyId === id} className="rounded-lg border border-black/10 px-3 py-1.5 text-[13px] font-semibold text-ink-700 disabled:opacity-60">{busyId === id ? '…' : 'Unblock'}</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

/* About us */
export function AboutUs() {
  return (
    <AppLayout tab="/settings" title="About us" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="About Us" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-8 space-y-3">
        <div className="flex flex-col items-center rounded-2xl bg-white p-6 text-center shadow-sm">
          <img src={logoUrl} alt="" className="h-16 w-16" />
          <p className="mt-3 text-[18px] font-bold text-ink-900">Host app</p>
          <p className="mt-1 text-[13px] text-ink-500">Talk, go live and earn — on your own schedule.</p>
        </div>
        <div className="card p-4 space-y-2 text-[13px] leading-relaxed text-ink-600">
          <p>Hosts earn from video and voice calls, gifts, messages and live streams. Earnings are paid out to your bank or UPI after KYC.</p>
          <p>Every upload is reviewed and every report is looked at by our team, to keep the community safe for hosts and users.</p>
        </div>
      </div>
    </AppLayout>
  )
}

/* Terms & policies — the rules the app already applies. */
export function TermsPolicies() {
  return (
    <AppLayout tab="/settings" title="Terms & policies" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Terms & Policies" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-8 space-y-4">
        <div className="card p-4">
          <p className="text-[15px] font-bold text-ink-900">Terms of service</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-600">
            <li>You must complete KYC before your first withdrawal.</li>
            <li>Nudity and sharing contact details to meet off the platform are not allowed and are removed.</li>
            <li>Screen recording and screenshots of calls are prohibited.</li>
            <li>Withdrawals are processed in 2–3 business days. TDS may be deducted under prevailing regulations.</li>
          </ul>
        </div>
        <div id="privacy" className="card p-4">
          <p className="text-[15px] font-bold text-ink-900">Privacy policy</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-600">
            <li>KYC documents are stored privately and used only to verify your identity and pay you.</li>
            <li>Chats may be reviewed only when they are reported for safety.</li>
            <li>You can block anyone, and manage notifications from Settings.</li>
          </ul>
        </div>
        <p className="text-center text-[12px] text-ink-400">The full legal documents will be published here.</p>
      </div>
    </AppLayout>
  )
}
