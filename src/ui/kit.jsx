import { useState } from 'react'
import { useNavigate, NavLink, useLocation } from 'react-router-dom'
import Icon from './Icon.jsx'
import { me } from '../data.js'
import { useNotificationsCount } from '../state/NotificationsContext.jsx'

/* ============ Phone status bar (mobile only) ============ */
/* Real phones already show their own time/signal/battery — this used to render a fake
 * mock of one (hardcoded "9:30") purely for desktop design-preview purposes. Gutted here
 * rather than touching every call site individually. */
export function StatusBar() {
  return null
}

/* ============ Mobile headers (hidden on desktop — shell provides TopBar) ============ */
export function TopBar({ title, right, sub, onBack }) {
  const nav = useNavigate()
  return (
    <div className="lg:hidden px-4 pt-1 pb-3 bg-white border-b border-black/5">
      <div className="flex items-center gap-3">
        <button onClick={() => (onBack ? onBack() : nav(-1))} className="h-9 w-9 grid place-items-center rounded-xl border border-black/10 text-ink-900 active:scale-95">
          <Icon name="chevron-left" size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[19px] font-bold text-ink-900 truncate">{title}</h1>
          {sub && <p className="text-[12px] text-ink-400 -mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
    </div>
  )
}

export function PlainHeader({ title, sub, right }) {
  return (
    <div className="lg:hidden px-5 pt-2 pb-3 bg-white border-b border-black/5 flex items-end justify-between">
      <div>
        <h1 className="text-[22px] font-extrabold text-ink-900">{title}</h1>
        {sub && <p className="text-[12px] text-ink-400">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

/* ============ Bottom navigation (mobile only) ============ */
export const NAV = [
  { to: '/home', icon: 'home', label: 'Home' },
  { to: '/chat', icon: 'chat', label: 'Chat', badge: 3 },
  { to: '/calls', icon: 'phone', label: 'Calls' },
  { to: '/earnings', icon: 'wallet', label: 'Wallet' },
  { to: '/live', icon: 'live', label: 'Live' },
]

export function BottomNav() {
  return (
    <nav className="lg:hidden shrink-0 bg-white border-t border-black/5 px-2 pt-2 pb-3 flex justify-around">
      {NAV.slice(0, 4).map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => `relative flex flex-col items-center gap-1 px-4 py-1 text-[11px] font-semibold ${isActive ? 'text-brand-600' : 'text-ink-400'}`}>
          {({ isActive }) => (
            <>
              <span className={`grid place-items-center h-7 w-12 rounded-full ${isActive ? 'bg-brand-50' : ''}`}><Icon name={t.icon} size={21} /></span>
              {t.label}
              {t.badge && <span className="absolute top-0 right-3 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-brand-600 text-white text-[10px]">{t.badge}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/* ============ Floating "Go Live" pill (mobile only) ============ */
export function FloatingGoLive() {
  const nav = useNavigate()
  return (
    <button
      onClick={() => nav('/live')}
      className="lg:hidden fixed bottom-[86px] right-5 z-40 flex items-center gap-1.5 rounded-full bg-brand-600 text-white pl-3.5 pr-4 py-2.5 shadow-pop active:scale-95"
    >
      <Icon name="live" size={15} />
      <span className="text-[13px] font-bold">Go Live</span>
    </button>
  )
}

/* ============ Desktop sidebar ============ */
export function SideNav() {
  const nav = useNavigate()
  const { unreadCount } = useNotificationsCount()
  return (
    <aside className="hidden lg:flex w-[248px] shrink-0 flex-col border-r border-black/5 bg-white">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-black/5">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600" />
        <span className="text-[17px] font-extrabold text-ink-900">Splash</span>
      </div>
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-1">
        {NAV.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-black/[.03]'}`}>
            <Icon name={t.icon} size={19} />
            <span className="flex-1">{t.label}</span>
            {t.badge && <span className="h-5 min-w-5 px-1 grid place-items-center rounded-full bg-brand-600 text-white text-[11px]">{t.badge}</span>}
          </NavLink>
        ))}
        <div className="pt-3 mt-3 border-t border-black/5 space-y-1">
          <NavLink to="/notifications" className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-black/[.03]'}`}>
            <Icon name="bell" size={19} /> <span className="flex-1">Notifications</span>
            {unreadCount > 0 && <span className="h-5 min-w-5 px-1 grid place-items-center rounded-full bg-brand-600 text-white text-[11px]">{unreadCount}</span>}
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-black/[.03]'}`}>
            <Icon name="settings" size={19} /> <span className="flex-1">Settings</span>
          </NavLink>
          <NavLink to="/settings/help" className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-black/[.03]'}`}>
            <Icon name="help" size={19} /> <span className="flex-1">Help &amp; support</span>
          </NavLink>
        </div>
      </nav>
      <button onClick={() => nav('/settings')} className="m-3 flex items-center gap-3 rounded-xl border border-black/5 p-3 text-left hover:bg-black/[.02]">
        <Avatar name={me.name} size={38} />
        <div className="min-w-0"><p className="text-[13px] font-bold text-ink-900 truncate">{me.name}</p><p className="text-[11px] text-emerald-600 font-semibold">● Online</p></div>
      </button>
    </aside>
  )
}

/* ============ Desktop top bar ============ */
export function DesktopTopBar({ title, back }) {
  const nav = useNavigate()
  const { unreadCount } = useNotificationsCount()
  return (
    <header className="hidden lg:flex h-16 shrink-0 items-center gap-3 border-b border-black/5 bg-white px-8">
      {back && (
        <button onClick={() => nav(-1)} className="h-9 w-9 grid place-items-center rounded-xl border border-black/10 text-ink-900 hover:bg-black/[.03]">
          <Icon name="chevron-left" size={18} />
        </button>
      )}
      <h1 className="text-[18px] font-bold text-ink-900">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        <button onClick={() => nav('/notifications')} className="relative h-9 w-9 grid place-items-center rounded-xl border border-black/10 text-ink-600 hover:bg-black/[.03]">
          <Icon name="bell" size={18} />
          {unreadCount > 0 && <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-brand-600 text-white text-[10px]">{unreadCount}</span>}
        </button>
        <button onClick={() => nav('/earnings')} className="h-9 w-9 grid place-items-center rounded-xl border border-black/10 text-ink-600 hover:bg-black/[.03]"><Icon name="wallet" size={18} /></button>
        <Avatar name={me.name} size={34} />
      </div>
    </header>
  )
}

/* ============ Avatar ============ */
const GRADS = [
  ['#8b7cf6', '#d9a4e0'], ['#6db4f0', '#8b7cf6'], ['#f0759a', '#f4b58b'],
  ['#c8a26a', '#8fb98f'], ['#7cc4a4', '#6db4f0'], ['#e0a92e', '#f0759a'],
]
export function Avatar({ name = '?', size = 44, ring, className = '', src }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`inline-block rounded-full shrink-0 object-cover ${ring ? 'ring-2 ring-offset-1' : ''} ${className}`}
        style={{ width: size, height: size, '--tw-ring-color': ring || undefined }}
      />
    )
  }
  const i = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length
  const [a, b] = GRADS[i]
  return (
    <span
      className={`inline-grid place-items-center rounded-full shrink-0 text-white font-semibold ${ring ? 'ring-2 ring-offset-1' : ''} ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${a}, ${b})`, fontSize: size * 0.4, '--tw-ring-color': ring || undefined }}
    >
      {name[0]?.toUpperCase()}
    </span>
  )
}

/* ============ primitives ============ */
export function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange?.(!on)} className={`h-7 w-12 rounded-full p-0.5 transition ${on ? 'bg-brand-600' : 'bg-black/15'}`}>
      <span className={`block h-6 w-6 rounded-full bg-white shadow transition ${on ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value
        const l = typeof o === 'string' ? o : o.label
        return (
          <button key={v} onClick={() => onChange(v)} className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold border transition ${value === v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-ink-500 border-black/10'}`}>{l}</button>
        )
      })}
    </div>
  )
}

export function IconBadge({ name, tone = 'brand', size = 40 }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600', gold: 'bg-gold-50 text-gold-500',
    green: 'bg-emerald-50 text-emerald-600', rose: 'bg-rose-50 text-rose-500', slate: 'bg-black/5 text-ink-500',
  }
  return <span className={`grid place-items-center rounded-xl ${tones[tone]}`} style={{ width: size, height: size }}><Icon name={name} size={size * 0.5} /></span>
}

export function Row({ icon, tone, title, sub, right, onClick, danger }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3.5 py-3.5 text-left hover:bg-black/[.02]">
      {icon && <IconBadge name={icon} tone={danger ? 'rose' : tone} />}
      <span className="flex-1 min-w-0">
        <span className={`block text-[15px] font-semibold ${danger ? 'text-rose-500' : 'text-ink-900'}`}>{title}</span>
        {sub && <span className="block text-[13px] text-ink-400 truncate">{sub}</span>}
      </span>
      {right ?? <Icon name="chevron-right" size={18} className="text-ink-300" />}
    </button>
  )
}

/* Centered result — works mobile + desktop */
export function ResultScreen({ tone = 'green', icon = 'check', title, desc, children }) {
  const ring = {
    green: 'bg-emerald-500 shadow-[0_0_0_10px_rgba(16,185,129,.12),0_0_0_20px_rgba(16,185,129,.07)]',
    rose: 'bg-rose-500 shadow-[0_0_0_10px_rgba(226,58,94,.12),0_0_0_20px_rgba(226,58,94,.07)]',
    gold: 'bg-gold-400 shadow-[0_0_0_10px_rgba(224,169,46,.14),0_0_0_20px_rgba(224,169,46,.08)]',
    brand: 'bg-brand-100 text-brand-600 shadow-[0_0_0_10px_rgba(109,59,230,.10),0_0_0_20px_rgba(109,59,230,.06)]',
  }[tone]
  return (
    <div className="flex flex-col items-center px-6 pt-14 lg:pt-6 text-center animate-fade-in">
      <span className={`grid place-items-center h-20 w-20 rounded-full text-white ${ring}`}><Icon name={icon} size={38} /></span>
      <h2 className="mt-6 text-[24px] font-extrabold text-ink-900">{title}</h2>
      {desc && <p className="mt-1.5 text-[14px] text-ink-400 max-w-[18rem]">{desc}</p>}
      <div className="w-full max-w-sm mt-6 space-y-3">{children}</div>
    </div>
  )
}

/** A copyable reference/tracking number, e.g. on a pending-review or request-status screen. */
export function ReferenceRow({ value, label = 'Reference ID', className = '' }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard API unavailable (older browser, no permission) — nothing to fall back to safely
    }
  }
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl bg-black/[.04] px-3.5 py-2.5 ${className}`}>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
        <p className="text-[13px] font-mono font-semibold text-ink-900 truncate">{value}</p>
      </div>
      <button onClick={copy} className="shrink-0 flex items-center gap-1.5 rounded-lg bg-white border border-black/10 px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 active:scale-95">
        <Icon name={copied ? 'check' : 'copy'} size={13} className={copied ? 'text-emerald-500' : ''} /> {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export function KV({ k, v, strong, danger }) {
  return (
    <div className="flex items-center justify-between py-2 text-[14px]">
      <span className="text-ink-500">{k}</span>
      <span className={`font-semibold ${danger ? 'text-rose-500' : strong ? 'text-ink-900' : 'text-ink-700'}`}>{v}</span>
    </div>
  )
}

/* Section heading used inside content */
export function SectionTitle({ children, className = '' }) {
  return <p className={`text-[12px] font-semibold tracking-wide text-ink-400 uppercase ${className}`}>{children}</p>
}

/** Consistent error display for the real message the backend sent back — never a swallowed
 * failure. `compact` for under a form field; the default block form for a whole screen/section
 * that failed to load, with an optional Retry action. */
export function ErrorCard({ message, onRetry, compact = false, className = '' }) {
  if (!message) return null
  if (compact) {
    return (
      <div className={`rounded-xl bg-rose-50 border border-rose-100 px-3.5 py-3 flex items-start gap-2.5 ${className}`}>
        <Icon name="alert" size={16} className="text-rose-500 mt-0.5 shrink-0" />
        <p className="flex-1 min-w-0 text-[13px] text-rose-600 font-medium leading-snug">{message}</p>
        {onRetry && <button onClick={onRetry} className="shrink-0 text-[12px] font-semibold text-rose-600">Retry</button>}
      </div>
    )
  }
  return (
    <div className={`flex flex-col items-center text-center px-6 py-10 ${className}`}>
      <span className="grid place-items-center h-14 w-14 rounded-full bg-rose-50 text-rose-500"><Icon name="alert" size={26} /></span>
      <p className="mt-3 text-[14px] font-semibold text-ink-900">Couldn't load this</p>
      <p className="mt-1 text-[13px] text-ink-400 max-w-xs">{message}</p>
      {onRetry && <button onClick={onRetry} className="btn-outline mt-4 text-[13px] px-5 w-auto"><Icon name="refresh" size={14} /> Try again</button>}
    </div>
  )
}
