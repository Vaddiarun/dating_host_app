/* Account screens from the new design set: My withdrawals + invoice, My earnings, Refer & earn,
 * My referrals, Profile menu, Languages and the in-app support chat. */
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { TopBar, Toggle, Row, SectionTitle, ErrorCard } from '../ui/kit.jsx'
import { AppLayout } from '../ui/layouts.jsx'
import { useAuth } from '../state/AuthContext.jsx'
import {
  withdrawals as withdrawalsApi, earnings as earningsApi, profile as profileApi, config as configApi,
  referrals as referralsApi, support as supportApi,
} from '../api/index.js'
import { rupees, beans as beansFmt, clockTime } from '../lib/format.js'
import { errorMessage } from '../lib/errors.js'
import { onSocketEventWhenReady } from '../lib/socket.js'
import { compressImage } from '../lib/chatImage.js'
import { uploadToPresignedUrl } from '../api/client.js'
import { SkelGroup, SkelHero, SkelList, SkelRows } from '../ui/Skeleton.jsx'

const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—')
const longDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const time24 = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '')

const WD_STATUS = {
  paid: ['Paid', 'text-emerald-600', 'bg-emerald-500'],
  approved: ['Approved', 'text-emerald-600', 'bg-emerald-500'],
  processing: ['Processing', 'text-gold-600', 'bg-gold-500'],
  submitted: ['Requested', 'text-gold-600', 'bg-gold-500'],
  pending: ['Requested', 'text-gold-600', 'bg-gold-500'],
  rejected: ['Rejected', 'text-rose-500', 'bg-rose-500'],
  failed: ['Failed', 'text-rose-500', 'bg-rose-500'],
}
const wdStatus = (s) => WD_STATUS[s] || [s ? s[0].toUpperCase() + s.slice(1) : '—', 'text-ink-400', 'bg-ink-300']

function UpdateKycButton() {
  const nav = useNavigate()
  return (
    <button onClick={() => nav('/settings/kyc')} className="rounded-xl bg-brand-50 px-3.5 py-2 text-[14px] font-semibold text-brand-700">
      Update KYC
    </button>
  )
}

/* The dark "My level" style card shared by Rate settings and My earnings. */
export function RateHeroCard({ title, videoPaise, voicePaise, action, onAction }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-[#120a24] p-5 text-white shadow-lg">
      <div className="pointer-events-none absolute -left-10 -top-16 h-56 w-56 rounded-full bg-brand-600/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-0 h-40 w-40 rounded-full bg-fuchsia-600/30 blur-3xl" />
      <div className="relative">
        {title}
        <div className={`grid grid-cols-2 gap-3 ${title ? 'mt-4' : ''}`}>
          {[['Video Call Rate', videoPaise], ['Audio Call Rate', voicePaise]].map(([label, v]) => (
            <div key={label} className="rounded-2xl border border-white/15 bg-white/[.04] px-3 py-3.5 text-center">
              <p className="text-[12px] text-white/70">{label}</p>
              <p className="mt-1 text-[18px] font-extrabold text-gold-400">{v != null ? `${rupees(v)}/min` : '—'}</p>
            </div>
          ))}
        </div>
        <button onClick={onAction} className="mt-4 h-12 w-full rounded-xl bg-brand-600 text-[15px] font-bold text-white transition hover:bg-brand-500 active:scale-[.99]">
          {action}
        </button>
      </div>
    </div>
  )
}

/* My withdrawals — every withdrawal request with its status and an invoice. */
export function MyWithdrawals() {
  const nav = useNavigate()
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  const load = () => {
    setErr('')
    withdrawalsApi.list()
      .then((res) => setList(res.withdrawals || res.items || (Array.isArray(res) ? res : [])))
      .catch((e) => setErr(errorMessage(e, 'Could not load your withdrawals.')))
  }
  useEffect(load, [])

  return (
    <AppLayout tab="/settings" title="My withdrawals" back bottomNav={false} maxW="lg" bg="canvas">
      <TopBar title="My Withdrawals" right={<UpdateKycButton />} />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-8">
        <ErrorCard message={err} onRetry={load} />
        {!list && !err && <SkelGroup><SkelRows rows={4} /></SkelGroup>}
        {list && list.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon name="wallet" size={26} /></span>
            <p className="mt-3 text-[16px] font-semibold text-ink-900">No withdrawals yet</p>
            <p className="mt-1 text-[13px] text-ink-400">Your withdrawal requests and invoices will show here.</p>
            <button onClick={() => nav('/withdraw')} className="btn-primary mt-5 !w-auto px-8">Withdraw</button>
          </div>
        )}
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {list?.map((w) => {
            const [label, text, dot] = wdStatus(w.status)
            return (
              <div key={w.id} className="rounded-2xl border border-black/[.08] bg-white px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[17px] font-bold text-ink-900">{shortDate(w.createdAt || w.requestedAt)} · {time24(w.createdAt || w.requestedAt)}</p>
                    <p className={`mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold ${text}`}><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{label}</p>
                  </div>
                  <p className="text-[17px] font-bold text-ink-900">{rupees(w.netPayoutPaise ?? w.convertedAmountPaise)}</p>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <button onClick={() => nav(`/settings/withdrawals/${w.id}/invoice`)} className="text-[14px] font-medium text-brand-700">View invoice</button>
                  <button onClick={() => nav(`/withdraw/status/${w.id}`)} className="text-[12px] font-medium text-ink-400">Details</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AppLayout>
  )
}

/* Invoice for one withdrawal — the host's invoice to the platform for services provided.
 * "Save as PDF" uses the browser's print dialog (Save as PDF), printing only the invoice. */
export function Invoice() {
  const { id } = useParams()
  const { me } = useAuth()
  const [wd, setWd] = useState(null)
  const [primary, setPrimary] = useState(null)
  const [company, setCompany] = useState(null)
  const [err, setErr] = useState('')
  const load = () => {
    setErr('')
    configApi.get().then((c) => setCompany(c?.invoiceCompany || null)).catch(() => {})
    withdrawalsApi.get(id).then(setWd).catch((e) => setErr(errorMessage(e, 'Could not load this invoice.')))
    profileApi.listPayoutMethods().then((res) => setPrimary((res.methods || []).find((m) => m.isPrimary) || res.methods?.[0] || null)).catch(() => {})
  }
  useEffect(load, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const gross = wd?.convertedAmountPaise ?? 0
  const money = (p) => `₹${((p ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const invoiceNo = wd ? `INV-${String(wd.id).replace(/-/g, '').slice(0, 8).toUpperCase()}` : ''

  return (
    <AppLayout tab="/settings" title="Invoice" back bottomNav={false} maxW="lg" bg="canvas">
      <TopBar title="Invoice" right={<UpdateKycButton />} />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-8">
        <ErrorCard message={err} onRetry={load} />
        {!wd && !err && <SkelGroup><SkelHero height="h-28" /><div className="mt-4"><SkelRows rows={4} /></div></SkelGroup>}
        {wd && (
          <>
            <div id="print-invoice" className="text-ink-900">
              {/* Company details come from /config; the box stays hidden until they're set on the server. */}
              {company && (
                <div className="rounded-xl border border-black/10 bg-white px-4 py-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Billed to</p>
                  <p className="mt-1 text-[18px] font-semibold">{company.name}</p>
                  {company.address && <p className="whitespace-pre-line text-[12px] text-ink-500">{company.address}</p>}
                  {company.gstin && <p className="text-[12px] text-ink-500">GSTIN: {company.gstin}</p>}
                </div>
              )}
              <div className="mt-3 flex justify-between text-[12px]">
                <div><p className="text-ink-400">Invoice no.</p><p className="font-bold">{invoiceNo}</p></div>
                <div className="text-right"><p className="text-ink-400">Invoice date</p><p className="font-bold">{longDate(wd.createdAt || wd.requestedAt)}</p></div>
              </div>
              <p className="mt-2 text-[12px] text-ink-500">From: <span className="font-semibold text-ink-900">{me?.name || 'Host'}</span>{me?.phone ? ` · ${me.phone}` : ''}</p>

              <table className="mt-3 w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-white">
                    <th className="border border-black/10 px-3 py-2.5 text-left font-semibold">Description</th>
                    <th className="w-14 border border-black/10 px-3 py-2.5 text-left font-semibold">Qty</th>
                    <th className="w-28 border border-black/10 px-3 py-2.5 text-left font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="border border-black/10 px-3 py-3">Recreation &amp; Other Services<span className="block text-[11px] text-ink-400">HSN 999699</span></td>
                    <td className="border border-black/10 px-3 py-3">1</td>
                    <td className="border border-black/10 px-3 py-3">{money(gross)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-3 space-y-1.5 text-[13px]">
                {[['Gross', gross], ['CGST', 0], ['SGST', 0], ['IGST', 0]].map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span className="text-ink-600">{k}</span><span className="font-semibold">{money(v)}</span></div>
                ))}
              </div>
              <div className="mt-2 flex justify-between border-t-2 border-ink-900 pt-2.5 text-[16px]"><span>Total</span><span className="font-extrabold">{money(gross)}</span></div>

              {(wd.processingFeePaise > 0 || wd.tdsPaise > 0) && (
                <div className="mt-3 space-y-1 rounded-xl bg-white px-3.5 py-3 text-[12px]">
                  <div className="flex justify-between"><span className="text-ink-500">Processing fee</span><span>– {money(wd.processingFeePaise)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-500">TDS</span><span>– {money(wd.tdsPaise)}</span></div>
                  <div className="flex justify-between font-bold"><span>Net paid to you</span><span>{money(wd.netPayoutPaise)}</span></div>
                </div>
              )}

              <p className="mt-4 text-[13px] font-medium">Bank details</p>
              {primary ? (
                <p className="text-[12px] text-ink-500">
                  {primary.type === 'upi'
                    ? <>UPI: {primary.details?.vpa}</>
                    : <>{primary.details?.accountHolderName || 'Bank account'} · A/c •••• {String(primary.details?.accountNumber || '').slice(-4)}{primary.details?.ifsc ? ` · IFSC ${primary.details.ifsc}` : ''}</>}
                </p>
              ) : <p className="text-[12px] text-ink-400">No payout method on file.</p>}
              <p className="mt-3 text-[13px] font-medium">Terms &amp; Conditions</p>
              <p className="text-[12px] text-ink-500">TDS may be deducted where applicable under prevailing regulations.</p>
            </div>
            <button onClick={() => window.print()} className="btn-primary mt-5 print:hidden"><Icon name="download" size={17} /> Save as PDF</button>
          </>
        )}
      </div>
    </AppLayout>
  )
}

/* My earnings — current rates, Withdraw, and earnings per day in beans. */
export function MyEarnings() {
  const nav = useNavigate()
  const [level, setLevel] = useState(null)
  const [items, setItems] = useState(null)
  const [paisePerBean, setPaisePerBean] = useState(null)
  const [err, setErr] = useState('')
  const load = () => {
    setErr('')
    profileApi.getLevel().then(setLevel).catch(() => {})
    configApi.get().then((c) => setPaisePerBean(c?.paisePerBean || 1)).catch(() => setPaisePerBean(1))
    earningsApi.history('all', 1, 100).then((res) => setItems(res.items || [])).catch((e) => setErr(errorMessage(e, 'Could not load your earnings.')))
  }
  useEffect(load, [])

  // Sum each calendar day's earnings, newest first.
  const days = useMemo(() => {
    if (!items) return null
    const map = new Map()
    for (const it of items) {
      if (!it.when) continue
      const d = new Date(it.when)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const cur = map.get(key) || { when: it.when, paise: 0, beans: 0 }
      cur.paise += it.amountPaise || 0
      cur.beans += it.beans ?? it.beansCredited ?? 0
      map.set(key, cur)
    }
    return [...map.values()].sort((a, b) => new Date(b.when) - new Date(a.when))
  }, [items])
  const dayBeans = (d) => d.beans || (paisePerBean ? Math.round(d.paise / paisePerBean) : 0)

  return (
    <AppLayout tab="/earnings" title="My earnings" back bottomNav={false} maxW="lg" bg="canvas">
      <TopBar title="My Earnings" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-8 lg:grid lg:grid-cols-[380px_1fr] lg:gap-6 lg:items-start">
        <div className="lg:sticky lg:top-6">
          {!level ? <SkelGroup><SkelHero height="h-44" /></SkelGroup> : (
            <RateHeroCard videoPaise={level.currentPrices?.videoRatePerMinutePaise} voicePaise={level.currentPrices?.voiceRatePerMinutePaise} action="Withdraw" onAction={() => nav('/withdraw')} />
          )}
        </div>
        <div className="mt-5 lg:mt-0">
          <ErrorCard message={err} onRetry={load} />
          {!days && !err && <SkelGroup><SkelList rows={7} avatar={false} /></SkelGroup>}
          {days && (
            <div className="overflow-hidden rounded-2xl border border-black/[.07] bg-white">
              <p className="bg-black/[.03] px-4 py-2.5 text-[12px] text-ink-400">All Earnings</p>
              {days.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-ink-400">No earnings yet. Calls, gifts and live streams show up here.</p>}
              {days.map((d) => (
                <div key={d.when} className="flex items-center gap-3 border-t border-black/[.06] px-5 py-4">
                  <Icon name="calendar" size={18} className="text-ink-700" />
                  <span className="flex-1 text-[15px] font-bold text-ink-900">{shortDate(d.when)}</span>
                  <span className="flex items-center gap-1.5 text-[14px] font-bold text-gold-500"><Icon name="sparkles" size={15} /> {beansFmt(dayBeans(d))} beans</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

/* Referral code from /me — the backend may not send one yet. */
function useReferralCode() {
  const { me } = useAuth()
  return me?.referralCode || me?.hostProfile?.referralCode || null
}

function shareInvite(code, onCopied) {
  const text = `Join me as a host and start earning! Use my referral code ${code} when you sign up.`
  const url = `${window.location.origin}${window.location.pathname}#/login?ref=${encodeURIComponent(code)}`
  if (navigator.share) {
    navigator.share({ title: 'Become a host', text, url }).catch(() => {})
  } else {
    navigator.clipboard?.writeText(`${text} ${url}`).then(onCopied).catch(() => {})
  }
}

/* Refer and earn */
export function ReferAndEarn() {
  const nav = useNavigate()
  const code = useReferralCode()
  const [copied, setCopied] = useState(false)
  const copy = () => {
    if (!code) return
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }).catch(() => {})
  }
  return (
    <AppLayout tab="/settings" title="Refer and earn" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Refer and Earn" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-8 space-y-3">
        <div className="flex flex-col items-center rounded-2xl bg-brand-600 px-5 py-6 text-center text-white">
          <Icon name="gift" size={34} />
          <p className="mt-2.5 text-[17px] font-bold">Grow together</p>
          <p className="mt-0.5 text-[13px] text-white/85">Earn 15% from your referrals' earnings.</p>
        </div>
        <div className="grid h-16 place-items-center rounded-2xl bg-brand-50">
          {code
            ? <span className="text-[24px] font-black tracking-[0.12em] text-brand-900">{code}</span>
            : <span className="text-[13px] font-medium text-brand-700">Your referral code will appear here soon</span>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={copy} disabled={!code} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white text-[15px] font-medium text-brand-700 shadow-sm disabled:opacity-50">
            <Icon name={copied ? 'check' : 'copy'} size={17} /> {copied ? 'Copied' : 'Copy Code'}
          </button>
          <button onClick={() => code && shareInvite(code, () => setCopied(true))} disabled={!code} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white text-[15px] font-medium text-brand-700 shadow-sm disabled:opacity-50">
            <Icon name="share" size={17} /> Share Link
          </button>
        </div>
        <button onClick={() => nav('/settings/referrals')} className="h-11 w-full rounded-xl bg-brand-600 text-[15px] font-medium text-white">My Referrals</button>
      </div>
    </AppLayout>
  )
}

/* My referrals — streamers and agents who joined with the host's code. */
export function MyReferrals() {
  const code = useReferralCode()
  const [tab, setTab] = useState('streamers')
  const [lists, setLists] = useState({})
  const [err, setErr] = useState('')
  useEffect(() => {
    if (lists[tab] || tab === 'agents') return
    setErr('')
    referralsApi.list(tab)
      .then((res) => setLists((l) => ({ ...l, [tab]: res.referrals || res.items || [] })))
      .catch((e) => {
        if (e?.status === 404) setLists((l) => ({ ...l, [tab]: [] })) // not built yet — nothing to show
        else setErr(errorMessage(e, 'Could not load your referrals.'))
      })
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps
  const list = lists[tab]

  return (
    <AppLayout tab="/settings" title="My referrals" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="My Referrals" />
      <div className="px-5 lg:px-0 pb-8">
        <div className="grid grid-cols-2 border-b border-black/10">
          {[['streamers', 'My Streamers'], ['agents', 'My Agents']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`py-3 text-[13px] ${tab === k ? 'border-b-2 border-brand-600 bg-brand-50 font-semibold text-brand-700' : 'text-ink-700'}`}>{l}</button>
          ))}
        </div>
        <ErrorCard message={err} className="mt-4" />
        {tab === 'agents' && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon name="users" size={24} /></span>
            <p className="mt-3 text-[16px] font-medium text-ink-900">Agents are coming soon</p>
            <p className="mt-1 text-[12px] text-ink-400">You'll be able to see agents you've referred here.</p>
          </div>
        )}
        {tab === 'streamers' && !list && !err && <SkelGroup className="mt-4"><SkelList rows={3} /></SkelGroup>}
        {tab === 'streamers' && list && list.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon name="users" size={24} /></span>
            <p className="mt-3 text-[16px] font-medium text-ink-900">No data found</p>
            <p className="mt-1 text-[12px] text-ink-400">Invite friends to begin building your network.</p>
          </div>
        )}
        {tab === 'streamers' && list && list.length > 0 && (
          <div className="card mt-4 divide-y divide-black/5 px-4">
            {list.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-[14px] font-bold text-brand-700">{(r.name || '?').slice(0, 1).toUpperCase()}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink-900">{r.name || 'New host'}</p>
                  <p className="text-[12px] text-ink-400">Joined {shortDate(r.joinedAt || r.createdAt)}</p>
                </div>
                {r.earnedForYouPaise > 0
                  ? <span className="text-[13px] font-bold text-gold-500">+{rupees(r.earnedForYouPaise)}</span>
                  : <span className="text-[11px] font-medium text-ink-300">Earnings soon</span>}
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 rounded-xl bg-brand-50 py-3 text-center text-[13px] text-brand-700">
          My Ref Code: <span className="font-bold">{code || '—'}</span>
        </div>
        <button onClick={() => code && shareInvite(code, () => {})} disabled={!code} className="mt-3 h-11 w-full rounded-xl bg-brand-600 text-[16px] font-medium text-white disabled:opacity-50">Invite Friends</button>
      </div>
    </AppLayout>
  )
}

/* Profile — the host's own profile pieces in one place. */
export function ProfileMenu() {
  const nav = useNavigate()
  const { me } = useAuth()
  const [gallery, setGallery] = useState(null)
  const [primary, setPrimary] = useState(undefined)
  useEffect(() => {
    profileApi.listGallery().then((res) => setGallery(res.items || [])).catch(() => {})
    profileApi.listPayoutMethods().then((res) => setPrimary((res.methods || []).find((m) => m.isPrimary) || res.methods?.[0] || null)).catch(() => setPrimary(null))
  }, [])
  const photos = gallery?.filter((g) => g.mediaType !== 'video').length ?? 0
  const videos = gallery?.filter((g) => g.mediaType === 'video').length ?? 0
  const payoutSub = primary === undefined ? '' : !primary ? 'Add a payout method' : primary.type === 'upi' ? primary.details?.vpa : `${primary.details?.bankName || 'Bank'} •••• ${String(primary.details?.accountNumber || '').slice(-4)}`
  return (
    <AppLayout tab="/settings" title="Profile" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Profile" />
      <div className="px-5 lg:px-0 pt-2 lg:pt-0 pb-8">
        <div className="divide-y divide-black/5">
          <Row icon="settings" tone="brand" title="Edit profile" sub="Name, bio, photo" onClick={() => nav('/settings/edit-profile')} />
          <Row icon="globe" tone="brand" title="Languages" sub={(me?.languages || []).join(', ') || 'Languages you speak'} onClick={() => nav('/settings/languages')} />
          <Row icon="image" tone="brand" title="Gallery" sub={gallery ? `${photos} photo${photos === 1 ? '' : 's'} · ${videos} video${videos === 1 ? '' : 's'}` : 'Photos & videos'} onClick={() => nav('/settings/gallery')} />
          <Row icon="wallet" tone="brand" title="Payout details" sub={payoutSub} onClick={() => nav('/settings/payouts')} />
        </div>
      </div>
    </AppLayout>
  )
}

/* Languages — toggle the languages the host speaks, add new ones. */
const COMMON_LANGUAGES = ['Hindi', 'English', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Bengali']
export function Languages() {
  const nav = useNavigate()
  const { me, setMe } = useAuth()
  const initial = me?.languages || []
  const [options, setOptions] = useState(() => [...new Set([...initial, ...COMMON_LANGUAGES.slice(0, 3)])])
  const [on, setOn] = useState(() => new Set(initial))
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef(null)

  const add = () => {
    const name = adding.trim().replace(/\s+/g, ' ')
    if (!name) return
    const pretty = name[0].toUpperCase() + name.slice(1)
    if (!options.some((o) => o.toLowerCase() === pretty.toLowerCase())) setOptions((o) => [...o, pretty])
    setOn((s) => new Set(s).add(options.find((o) => o.toLowerCase() === pretty.toLowerCase()) || pretty))
    setAdding('')
  }
  const save = async () => {
    const langs = options.filter((o) => on.has(o))
    if (langs.length === 0) { setErr('Turn on at least one language.'); return }
    setBusy(true)
    setErr('')
    try {
      const updated = await profileApi.updateMe({ languages: langs })
      await profileApi.updateHostProfile({ languages: langs })
      setMe({ ...me, ...updated, languages: langs })
      nav(-1)
    } catch (e) {
      setErr(errorMessage(e, 'Could not save your languages.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout tab="/settings" title="Languages" back bottomNav={false} maxW="md" bg="canvas">
      <TopBar title="Languages" />
      <div className="px-5 lg:px-0 pt-4 lg:pt-0 pb-8">
        <SectionTitle className="mb-2">Languages you speak</SectionTitle>
        <div className="card p-4 divide-y divide-black/5">
          {options.map((l) => (
            <div key={l} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="flex-1 text-[15px] font-semibold text-ink-900">{l}</span>
              <Toggle on={on.has(l)} onChange={(v) => setOn((s) => { const n = new Set(s); v ? n.add(l) : n.delete(l); return n })} />
            </div>
          ))}
        </div>
        <div className="card mt-3 flex items-center gap-2 p-2 pl-4">
          <input
            ref={inputRef}
            value={adding}
            onChange={(e) => setAdding(e.target.value.slice(0, 30))}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Add new language"
            list="lang-suggestions"
            className="h-10 flex-1 bg-transparent text-[15px] font-semibold text-ink-900 outline-none placeholder:text-ink-900"
          />
          <datalist id="lang-suggestions">{COMMON_LANGUAGES.filter((l) => !options.includes(l)).map((l) => <option key={l} value={l} />)}</datalist>
          {adding.trim() && <button onClick={add} className="rounded-lg bg-brand-50 px-3 py-2 text-[13px] font-semibold text-brand-700">Add</button>}
        </div>
        <ErrorCard message={err} compact className="mt-3" />
        <button onClick={save} disabled={busy} className="btn-primary mt-4 disabled:opacity-60">{busy ? 'Saving…' : 'Save languages'}</button>
      </div>
    </AppLayout>
  )
}

/* Support chat — talk to the support team. One conversation (the latest open ticket). */
export function SupportChat() {
  const [state, setState] = useState('loading') // loading | ready | unavailable | error
  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  // After the host writes, the automatic assistant usually answers within seconds (if it's
  // switched on) — show that it's replying, but never for more than 30 seconds.
  const [awaitingReply, setAwaitingReply] = useState(false)
  const bottomRef = useRef(null)
  useEffect(() => {
    if (!awaitingReply) return
    const t = setTimeout(() => setAwaitingReply(false), 30_000)
    return () => clearTimeout(t)
  }, [awaitingReply])

  const openTicket = (id) => supportApi.getTicket(id).then((res) => { setTicket(res.ticket || res); setMessages(res.messages || []) })
  const load = () => {
    setState('loading')
    supportApi.listTickets()
      .then(async (res) => {
        const latest = (res.tickets || [])[0] // most recently active first
        if (latest) await openTicket(latest.id)
        setState('ready')
      })
      .catch((e) => setState(e?.status === 404 ? 'unavailable' : 'error'))
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }) }, [messages.length, awaitingReply])

  // Safety net next to the live socket event: re-check the open ticket every 5 seconds while the
  // chat is on screen, so a reply always shows up without leaving and reopening the chat.
  const sendingRef = useRef(false)
  sendingRef.current = sending
  useEffect(() => {
    if (!ticket?.id) return
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible' || sendingRef.current) return
      supportApi.getTicket(ticket.id).then((res) => {
        const next = res.messages || []
        // needsAgent changes when the assistant hands the ticket to the team.
        const fresh = res.ticket || res
        // ...and status changes when support closes it — then the chat locks (see `closed` below).
        setTicket((cur) => (cur && (cur.needsAgent !== fresh.needsAgent || cur.status !== fresh.status) ? fresh : cur))
        if (next.some((m) => m.sender === 'bot' || m.sender === 'agent') && next[next.length - 1]?.sender !== 'host') setAwaitingReply(false)
        setMessages((cur) => (next.length !== cur.filter((m) => !String(m.id).startsWith('local-')).length ? next : cur))
      }).catch(() => {})
    }, 5000)
    return () => clearInterval(t)
  }, [ticket?.id])
  // Support's replies arrive live.
  useEffect(() => onSocketEventWhenReady('support:message', ({ ticketId, message } = {}) => {
    if (!message || (ticket && ticketId !== ticket.id)) return
    setMessages((m) => (m.some((x) => x.id === message.id) ? m : [...m, message]))
    setAwaitingReply(false)
    if (ticketId) supportApi.getTicket(ticketId).then((res) => setTicket(res.ticket || res)).catch(() => {})
  }), [ticket])

  // Sends text, a photo, or both (the typed text becomes the photo's caption). A photo is
  // shrunk on the device, uploaded straight to storage, then sent with the key it was given.
  // `preset` is a fixed message (the "Talk to a person" button) that leaves the input alone.
  const send = async ({ preset, photo } = {}) => {
    const content = (preset ?? text).trim()
    if ((!content && !photo) || sending) return
    setSending(true)
    setErr('')
    if (preset === undefined) setText('')
    const previewUrl = photo ? URL.createObjectURL(photo) : null
    setMessages((m) => [...m, {
      id: `local-${Date.now()}`, sender: 'host', content,
      attachments: previewUrl ? [{ type: 'image', url: previewUrl }] : [],
      createdAt: new Date().toISOString(),
    }])
    try {
      let mediaKey
      if (photo) {
        const blob = await compressImage(photo)
        const presign = await supportApi.attachmentUploadUrl(blob.type)
        await uploadToPresignedUrl(presign.uploadUrl, blob)
        mediaKey = presign.mediaKey
      }
      if (ticket) {
        await supportApi.reply(ticket.id, content, mediaKey)
        await openTicket(ticket.id)
      } else {
        const subject = content.slice(0, 80) || 'Photo attached'
        const created = await supportApi.createTicket({ subject, category: 'other', content, mediaKey })
        await openTicket(created.ticket?.id || created.id)
      }
      setAwaitingReply(true)
    } catch (e) {
      setMessages((m) => m.filter((x) => !String(x.id).startsWith('local-')))
      if (preset === undefined) setText(content)
      setErr(e?.status === 404 ? 'Support chat isn’t switched on yet. Please try again later.' : errorMessage(e, 'Message not sent. Try again.'))
    } finally {
      setSending(false)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }
  const photoInputRef = useRef(null)
  // A ticket support has closed is read-only. Writing again starts a NEW ticket (it doesn't
  // reopen the old one), so each issue stays its own conversation for the team.
  const closed = ticket?.status === 'closed'
  const startNewChat = () => { setTicket(null); setMessages([]); setAwaitingReply(false); setErr('') }

  return (
    <AppLayout tab="/settings" title="Support" back bottomNav={false} maxW="lg" bg="canvas">
      <TopBar title="Support chat" sub={closed ? 'This chat is closed' : ticket ? `Ticket ${ticket.id}` : 'Our team replies here'} />
      <div className="flex min-h-[calc(100dvh-64px)] flex-col lg:min-h-[70vh]">
        <div className="flex-1 space-y-3 px-5 lg:px-0 py-4">
          {state === 'loading' && <SkelGroup><SkelList rows={3} /></SkelGroup>}
          {state === 'unavailable' && (
            <div className="flex flex-col items-center py-12 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon name="lifebuoy" size={28} /></span>
              <p className="mt-3 text-[16px] font-semibold text-ink-900">Support chat is coming soon</p>
              <p className="mt-1 max-w-xs text-[13px] text-ink-400">You'll be able to message our team right here. Until then, see the popular topics on the Help & support screen.</p>
            </div>
          )}
          {state === 'error' && <ErrorCard message="Could not load your support chat." onRetry={load} />}
          {state === 'ready' && (
            <>
              <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[14px] text-ink-900 shadow-sm">
                Hi! Tell us what happened — include the call or withdrawal if it's about one — and our team will get back to you here.
              </div>
              {messages.map((m) => {
                const mine = m.sender === 'host' || m.sender === 'user'
                const bot = m.sender === 'bot'
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14px] ${mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white text-ink-900 shadow-sm'}`}>
                      {!mine && (
                        <span className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold text-brand-600">
                          {bot ? 'Support assistant' : m.senderName || 'Support'}
                          {bot && <span className="rounded-full bg-brand-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-brand-600">Automated</span>}
                        </span>
                      )}
                      {(m.attachments || []).filter((a) => a.type === 'image').map((a, i) => (
                        <a key={i} href={a.url} target="_blank" rel="noreferrer" className="mb-1 block">
                          <img src={a.url} alt="Attached photo" className="max-h-56 max-w-full rounded-xl object-cover" />
                        </a>
                      ))}
                      {m.content}
                      <span className={`mt-1 block text-[10px] ${mine ? 'text-white/60' : 'text-ink-300'}`}>{clockTime(m.createdAt)}</span>
                    </div>
                  </div>
                )
              })}
              {closed && (
                <div className="flex items-center gap-3 py-2 text-[12px] text-ink-400">
                  <span className="h-px flex-1 bg-black/10" />
                  Chat closed by support{ticket?.closedAt ? ` · ${clockTime(ticket.closedAt)}` : ''}
                  <span className="h-px flex-1 bg-black/10" />
                </div>
              )}
              {awaitingReply && !closed && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[13px] text-ink-400 shadow-sm">Assistant is replying…</div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>
        {state === 'ready' && closed && (
          <div className="sticky bottom-0 border-t border-black/5 bg-white px-4 py-4 text-center">
            <p className="text-[14px] font-semibold text-ink-900">This chat has been closed</p>
            <p className="mt-0.5 text-[12px] text-ink-400">Still need help? Start a new chat and we'll pick it up.</p>
            <button onClick={startNewChat} className="btn-primary mt-3">Start a new chat</button>
          </div>
        )}
        {state === 'ready' && !closed && (
          <div className="sticky bottom-0 border-t border-black/5 bg-white px-3 py-3">
            {ticket?.needsAgent && (
              <p className="mb-2 rounded-xl bg-brand-50 px-3 py-2 text-[12px] font-medium text-brand-600">Our support team will reply here.</p>
            )}
            {ticket && !ticket.needsAgent && (
              <button
                onClick={() => send({ preset: 'I’d like to talk to a person.' })}
                disabled={sending}
                className="mb-2 rounded-full border border-black/10 px-3 py-1 text-[12px] font-medium text-ink-500 disabled:opacity-40"
              >
                Talk to a person
              </button>
            )}
            <ErrorCard message={err} compact className="mb-2" />
            <div className="flex items-center gap-2">
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { send({ photo: e.target.files?.[0] }); e.target.value = '' }} />
              <button onClick={() => photoInputRef.current?.click()} disabled={sending} aria-label="Attach a photo" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/10 text-ink-500 disabled:opacity-50"><Icon name="image" size={18} /></button>
              <input value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type your message…" className="input flex-1" />
              <button onClick={() => send()} disabled={sending || !text.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600 text-white disabled:opacity-50"><Icon name="send" size={17} /></button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
