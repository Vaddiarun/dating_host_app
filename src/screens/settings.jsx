import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { TopBar, Avatar, Toggle, Row, IconBadge, ResultScreen, SectionTitle, ErrorCard, ReferenceRow } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { useAuth } from '../state/AuthContext.jsx'
import { profile as profileApi } from '../api/index.js'
import { rupees, referenceCode } from '../lib/format.js'
import { errorMessage } from '../lib/errors.js'

/* 39 / 40 — Settings + Profile */
export function Settings() {
  const nav = useNavigate()
  const { me, logout } = useAuth()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const doLogout = async () => {
    setBusy(true)
    // logout() clears the local session even if the server-side call fails, so there's
    // nothing left to recover into — always land back on /login.
    try { await logout() } finally { nav('/login', { replace: true }) }
  }

  const name = me?.name || 'Host'
  const rating = me?.hostProfile?.rating
  const videoRate = me?.hostProfile?.ratePerMinutePaise

  return (
    <AppLayout tab="/settings" title="Profile & settings" maxW="lg" bg="canvas" pad={false}>
      <div className="lg:max-w-2xl lg:mx-auto lg:py-8">
        <div className="relative bg-gradient-to-br from-brand-600 to-brand-800 px-5 lg:px-6 pt-3 lg:pt-6 pb-6 text-white lg:rounded-2xl">
          <div className="flex items-center gap-3">
            <Avatar name={name} size={56} className="ring-2 ring-white/40" />
            <div>
              <p className="text-[19px] font-bold flex items-center gap-1.5">{name} {me?.kycStatus === 'approved' && <Icon name="shield-check" size={16} className="text-gold-300" />}</p>
              <p className="text-[12px] text-white/70">{me?.phone}</p>
              <div className="mt-1.5 flex gap-2">
                <span className="pill bg-black/25 text-white text-[11px]">{rating?.average != null ? rating.average.toFixed(1) : '—'} ★</span>
                <span className="pill bg-black/25 text-white text-[11px]">{rating?.count ?? 0} ratings</span>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 lg:px-0 -mt-4 lg:mt-4 pb-4">
          <SectionTitle className="mt-5 mb-1">Account</SectionTitle>
          <div className="card px-4 divide-y divide-black/5">
            <Row icon="trending-up" tone="brand" title="Performance" sub="Meter, livestream score & leaderboards" onClick={() => nav('/settings/performance')} />
            <Row icon="settings" tone="brand" title="Edit profile" sub="Name, bio, languages" onClick={() => nav('/settings/edit-profile')} />
            <Row icon="image" tone="brand" title="Gallery" sub="Photos & videos" onClick={() => nav('/settings/gallery')} />
            <Row icon="wallet" tone="gold" title="Rate settings" sub={videoRate ? `${rupees(videoRate)}/min video` : 'Set your rates'} onClick={() => nav('/settings/rates')} />
            <Row icon="shield-check" tone="green" title="KYC status" sub={me?.kycStatus?.replace('_', ' ')} right={<span className="pill bg-emerald-50 text-emerald-600 text-[11px] capitalize">{me?.kycStatus?.replace('_', ' ')}</span>} onClick={() => nav('/settings/kyc')} />
            <Row icon="card" tone="brand" title="Payout details" onClick={() => nav('/settings/payouts')} />
            <Row icon="bell" tone="brand" title="Notifications" sub="Calls, gifts, payouts" onClick={() => nav('/settings/notifications')} />
            <Row icon="help" tone="brand" title="Help & support" onClick={() => nav('/settings/help')} />
            <Row icon="logout" danger title="Logout" onClick={() => setLogoutOpen(true)} />
          </div>
        </div>
      </div>

      {logoutOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end lg:justify-center lg:items-center" onClick={() => setLogoutOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-3xl lg:rounded-2xl lg:max-w-sm w-full p-5 animate-sheet-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="grid place-items-center h-11 w-11 rounded-full border-2 border-dashed border-rose-300 text-rose-500 shrink-0"><Icon name="logout" size={18} /></span>
              <div><p className="text-[17px] font-bold text-ink-900">Logging out?</p><p className="text-[13px] text-ink-400 mt-0.5">You'll stop receiving calls and gifts until you sign back in. Your earnings stay safe.</p></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => setLogoutOpen(false)} className="btn-outline">Cancel</button>
              <button onClick={doLogout} disabled={busy} className="btn-danger-outline disabled:opacity-60"><Icon name="logout" size={16} /> {busy ? 'Logging out…' : 'Log out'}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

/* 40 — KYC status */
export function KycStatus() {
  const { me } = useAuth()
  const [kyc, setKyc] = useState(null)
  const [err, setErr] = useState('')
  const load = () => { setErr(''); profileApi.getKycStatus().then(setKyc).catch((e) => setErr(errorMessage(e, 'Could not load your KYC status.'))) }
  useEffect(load, [])
  const status = kyc?.kycStatus || 'not_submitted'
  const tone = status === 'approved' ? 'brand' : status === 'rejected' ? 'rose' : 'gold'
  const pillTone = status === 'approved' ? 'bg-emerald-50 text-emerald-600' : status === 'rejected' ? 'bg-rose-50 text-rose-500' : 'bg-gold-50 text-gold-600'
  const ref = referenceCode(kyc, me?.id)
  return (
    <AppLayout tab="/settings" title="KYC status" back bottomNav={false} maxW="md" bg="white">
      <TopBar title="KYC status" />
      <div className="py-8">
        <ErrorCard message={err} onRetry={load} className="mx-5" />
        <ResultScreen tone={tone} icon="shield-check" title={status === 'approved' ? 'Identity verified' : status === 'rejected' ? 'Verification rejected' : status === 'pending' ? 'Under review' : 'Not submitted'}>
          <span className={`mx-auto pill ${pillTone} text-[12px] -mt-3 capitalize`}><span className="h-1.5 w-1.5 rounded-full bg-current" /> {status.replace('_', ' ')}</span>
          {status !== 'not_submitted' && <ReferenceRow value={ref} label="Application ID" />}
          {kyc?.rejectionReason && <p className="text-[13px] text-rose-500 text-center">{kyc.rejectionReason}</p>}
          <div className="card p-4 text-left mt-2">
            {(kyc?.documents || []).length === 0 && <p className="text-[13px] text-ink-400 py-2">No documents submitted yet.</p>}
            {(kyc?.documents || []).map((d) => (
              <div key={d.documentType} className="flex items-center justify-between py-2 text-[14px]">
                <span className="text-ink-500 capitalize">{d.documentType.replace('_', ' ')}</span>
                <span className="font-semibold text-ink-900 flex items-center gap-1.5">Uploaded <Icon name="check" size={14} className="text-emerald-500" /></span>
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
  const { me, setMe } = useAuth()
  const [name, setName] = useState(me?.name || '')
  const [email, setEmail] = useState(me?.email || '')
  const [bio, setBio] = useState(me?.hostProfile?.bio || '')
  const [languages, setLanguages] = useState((me?.languages || []).join(', '))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setBusy(true)
    setErr('')
    try {
      const langs = languages.split(',').map((s) => s.trim()).filter(Boolean)
      const updated = await profileApi.updateMe({ name: name.trim(), email: email.trim() || undefined, languages: langs })
      await profileApi.updateHostProfile({ bio: bio.trim() || undefined, languages: langs })
      setMe({ ...updated, hostProfile: { ...me?.hostProfile, bio, languages: langs } })
      nav(-1)
    } catch (e) {
      setErr(errorMessage(e, 'Could not save changes.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout tab="/settings" title="Edit profile" back bottomNav={false} maxW="md" bg="white">
      <TopBar title="Edit profile" right={<button onClick={save} disabled={busy} className="rounded-xl bg-brand-600 text-white px-4 py-2 text-[14px] font-semibold disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>} />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-6">
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar name={name || 'Host'} size={88} className="ring-4 ring-brand-500/30" />
            <span className="absolute bottom-0 right-0 h-7 w-7 grid place-items-center rounded-full bg-brand-600 text-white"><Icon name="camera" size={13} /></span>
          </div>
        </div>
        <div className="mt-4 space-y-3.5">
          <div><span className="label">Display name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><span className="label">E-mail</span><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><span className="label">Bio</span><input className="input" value={bio} onChange={(e) => setBio(e.target.value)} /></div>
          <div><span className="label">Languages</span><input className="input" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="Hindi, English" /></div>
        </div>
        <ErrorCard message={err} compact className="mt-3" />
        <button onClick={save} disabled={busy} className="btn-primary mt-4 lg:hidden disabled:opacity-60">{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </AppLayout>
  )
}

/* 40 — Rate settings */
export function RateSettings() {
  const { me, setMe } = useAuth()
  const hp = me?.hostProfile
  const [video, setVideo] = useState(hp?.ratePerMinutePaise != null ? String(hp.ratePerMinutePaise / 100) : '')
  const [voice, setVoice] = useState(hp?.voiceRatePerMinutePaise != null ? String(hp.voiceRatePerMinutePaise / 100) : '')
  const [priv, setPriv] = useState(hp?.privateLiveRatePerMinutePaise != null ? String(hp.privateLiveRatePerMinutePaise / 100) : '')
  const [auto, setAuto] = useState(hp?.autoAcceptCalls ?? true)
  const [night, setNight] = useState(hp?.voiceCallsOnlyAfterMidnight ?? false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setBusy(true)
    setErr('')
    try {
      const updated = await profileApi.updateHostProfile({
        ratePerMinutePaise: video ? Math.round(Number(video) * 100) : undefined,
        voiceRatePerMinutePaise: voice ? Math.round(Number(voice) * 100) : undefined,
        privateLiveRatePerMinutePaise: priv ? Math.round(Number(priv) * 100) : undefined,
        autoAcceptCalls: auto,
        voiceCallsOnlyAfterMidnight: night,
      })
      setMe({ ...me, hostProfile: updated })
    } catch (e) {
      setErr(errorMessage(e, 'Could not save rates.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout tab="/settings" title="Rate settings" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Rate settings" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-4">
        <SectionTitle className="mb-2">Per-minute rates (₹)</SectionTitle>
        <div className="card p-4 space-y-3.5">
          <div><span className="label">Video call</span><input className="input" value={video} onChange={(e) => setVideo(e.target.value.replace(/[^\d.]/g, ''))} placeholder="24" /></div>
          <div><span className="label">Voice call</span><input className="input" value={voice} onChange={(e) => setVoice(e.target.value.replace(/[^\d.]/g, ''))} placeholder="12" /></div>
          <div><span className="label">Private live</span><input className="input" value={priv} onChange={(e) => setPriv(e.target.value.replace(/[^\d.]/g, ''))} placeholder="30" /></div>
        </div>
        <SectionTitle className="mt-5 mb-2">Availability</SectionTitle>
        <div className="card p-4 divide-y divide-black/5">
          <div className="flex items-center gap-3 pb-3"><span className="flex-1 text-[15px] font-semibold text-ink-900">Auto-accept calls</span><Toggle on={auto} onChange={setAuto} /></div>
          <div className="flex items-center gap-3 pt-3"><span className="flex-1 text-[15px] font-semibold text-ink-900">Voice calls only after 12 AM</span><Toggle on={night} onChange={setNight} /></div>
        </div>
        <ErrorCard message={err} compact className="mt-3" />
        <button onClick={save} disabled={busy} className="btn-primary mt-4 disabled:opacity-60">{busy ? 'Saving…' : 'Save rates'}</button>
      </div>
    </AppLayout>
  )
}

/* 41 — Gallery */
export function Gallery() {
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
    setItems((prev) => prev.filter((t) => t.id !== id))
    try { await profileApi.deleteGalleryItem(id) } catch (e) { setErr(errorMessage(e, 'Could not remove that item.')); load() }
  }

  return (
    <AppLayout tab="/settings" title="Gallery" back bottomNav={false} maxW="lg" bg="white">
      <TopBar title="Gallery" sub={`${items.length} items`} />
      <div className="px-5 lg:px-0 pt-3 lg:pt-0 pb-4">
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
          {!loading && filtered.map((t) => (
            <button key={t.id} onClick={() => remove(t.id)} className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-brand-300/60 to-gold-300/50 grid place-items-center group">
              {t.mediaType === 'video' ? (
                <span className="h-9 w-9 grid place-items-center rounded-full bg-black/30 text-white">▶</span>
              ) : (
                <img src={t.url} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              )}
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/40 grid place-items-center text-white text-[11px] font-semibold transition">Remove</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-gold-50 px-3 py-2.5 text-[12px] text-gold-600">
          <Icon name="shield" size={14} className="mt-0.5 shrink-0" /> All uploads are reviewed. Nudity or off-platform contact will be removed.
        </div>
        {!adding && <button onClick={() => setAdding(true)} className="mt-3 text-[12px] font-semibold text-brand-600">or add by URL instead</button>}
      </div>
    </AppLayout>
  )
}

/* 41 — Payout details */
export function PayoutDetails() {
  const nav = useNavigate()
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = () => { setErr(''); profileApi.listPayoutMethods().then((res) => setMethods(res.methods || [])).catch((e) => setErr(errorMessage(e, 'Could not load your payout methods.'))).finally(() => setLoading(false)) }
  useEffect(load, [])

  const makePrimary = async (id) => {
    try { await profileApi.setPrimaryPayoutMethod(id); load() } catch (e) { setErr(errorMessage(e, 'Could not update your primary method.')) }
  }

  return (
    <AppLayout tab="/settings" title="Payout details" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Payout details" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-4">
        {loading && <p className="text-[13px] text-ink-400 text-center py-4">Loading…</p>}
        <ErrorCard message={err} onRetry={load} className="mb-3" />
        {!loading && !err && methods.length === 0 && <p className="text-[13px] text-ink-400 text-center py-4">No payout methods yet.</p>}
        {methods.map((m) => (
          <button key={m.id} onClick={() => !m.isPrimary && makePrimary(m.id)} className="card p-4 flex items-center gap-3 mt-3 w-full text-left first:mt-0">
            <IconBadge name={m.type === 'upi' ? 'wallet' : 'card'} tone="brand" size={44} />
            <div className="flex-1">
              <p className="text-[15px] font-semibold text-ink-900">{m.type === 'upi' ? m.details?.vpa : `${m.details?.accountHolderName || 'Bank'} •••• ${String(m.details?.accountNumber || '').slice(-4)}`}</p>
              <p className="text-[12px] text-ink-400">{m.type === 'upi' ? 'UPI' : 'Bank transfer'} · {m.isPrimary ? 'Primary' : 'Backup'}</p>
            </div>
            {m.isPrimary && <span className="pill bg-emerald-50 text-emerald-600 text-[11px]"><span className="h-1.5 w-1.5 rounded-full bg-current" /> Primary</span>}
          </button>
        ))}
        <button onClick={() => nav('/settings/payouts/add')} className="btn-outline mt-4"><Icon name="plus" size={16} /> Add payout method</button>
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
    <AppLayout tab="/settings" title="Notification settings" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Notification settings" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-6 space-y-5">
        {!prefs && !err && <p className="text-[13px] text-ink-400 text-center py-4">Loading…</p>}
        <ErrorCard message={err} onRetry={load} />
        <ErrorCard message={saveErr} compact />
        {prefs && PREF_FIELDS.map(([g, rows]) => (
          <div key={g}>
            <SectionTitle className="mb-2">{g}</SectionTitle>
            <div className="card p-4 divide-y divide-black/5">
              {rows.map(([key, label]) => (
                <div key={key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="flex-1 text-[15px] font-medium text-ink-900">{label}</span>
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
        <SectionTitle className="mb-1">Popular topics</SectionTitle>
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
