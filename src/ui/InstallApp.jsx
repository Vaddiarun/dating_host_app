import { useState } from 'react'
import Icon from './Icon.jsx'
import logoUrl from '../assets/logo.png'
import { useInstallPrompt, APK_URL } from '../lib/pwa.js'

// "Get the Splash Host app": the real install dialog on Chrome/Edge, Add-to-Home-Screen steps on
// iPhone, and an APK download when VITE_ANDROID_APK_URL is set. Hidden when already running as
// the app, or when this browser can't offer any of them (unless `always`, used on /download).
export function InstallAppCard({ className = '', always = false }) {
  const { canInstall, installed, ios, install } = useInstallPrompt()
  const [iosHelp, setIosHelp] = useState(false)
  const [done, setDone] = useState(false)

  if (installed && !always) return null
  if (!always && !canInstall && !ios && !APK_URL) return null

  return (
    <div className={`card p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <img src={logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="flex-1 text-left">
          <p className="text-[15px] font-bold text-ink-900">Get the Splash Host app</p>
          <p className="text-[12px] text-ink-400">Opens full-screen from your home screen, so you never miss a call.</p>
        </div>
      </div>

      {installed || done ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[13px] font-semibold text-emerald-700">
          <Icon name="check" size={15} /> {installed ? "You're using the app." : 'Installed — find Splash Host on your home screen.'}
        </p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {canInstall && (
            <button className="btn-primary !py-3" onClick={async () => setDone(await install())}>
              <Icon name="download" size={16} /> Install app
            </button>
          )}
          {ios && !canInstall && (
            <button className="btn-primary !py-3" onClick={() => setIosHelp((v) => !v)}>
              <Icon name="plus" size={16} /> Add to Home Screen
            </button>
          )}
          {APK_URL && (
            <a href={APK_URL} download className="btn-outline !py-3">
              <Icon name="phone" size={16} /> Download APK (Android)
            </a>
          )}
        </div>
      )}

      {iosHelp && (
        <ol className="mt-3 space-y-1.5 rounded-xl bg-black/[.03] p-3 text-left text-[13px] text-ink-700">
          <li>1. In <b>Safari</b>, tap <b>Share</b> (the square with an arrow) at the bottom.</li>
          <li>2. Scroll and tap <b>Add to Home Screen</b>.</li>
          <li>3. Tap <b>Add</b>. Splash Host appears on your home screen.</li>
        </ol>
      )}

      {always && !installed && !done && !canInstall && !ios && !APK_URL && (
        <p className="mt-3 text-left text-[13px] leading-relaxed text-ink-500">
          Open this page in <b>Chrome</b> on Android (or Chrome/Edge on a computer) and tap <b>Install app</b>, or use the
          browser menu → <b>Install app</b> / <b>Add to Home screen</b>.
        </p>
      )}
    </div>
  )
}

// Small "Get the app" button for the login screen: opens the install dialog where the browser
// offers one, otherwise the /download page (iPhone steps, APK, instructions). Hidden in the app.
export function InstallAppButton({ className = '' }) {
  const { canInstall, installed, install } = useInstallPrompt()
  if (installed) return null
  const cls = `w-full flex items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 py-3 text-[14px] font-semibold text-brand-700 active:scale-[.98] transition ${className}`
  return canInstall ? (
    <button type="button" onClick={install} className={cls}><Icon name="download" size={16} /> Install the Splash Host app</button>
  ) : (
    <a href="#/download" className={cls}><Icon name="download" size={16} /> Get the Splash Host app</a>
  )
}

// Public, shareable page: <host-site>/#/download — works without logging in.
export default function DownloadPage() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-gradient-to-br from-brand-800 via-night-800 to-night-900 p-5">
      <div className="w-full max-w-md text-center">
        <img src={logoUrl} alt="Splash" className="mx-auto h-16 w-16 rounded-2xl" />
        <h1 className="mt-4 text-[26px] font-extrabold text-white">Get Splash Host</h1>
        <p className="mt-1 text-[14px] text-white/60">Go online, take calls, go live and track your earnings.</p>
        <InstallAppCard always className="mt-6" />
        <a href="#/login" className="mt-5 inline-block text-[14px] font-semibold text-white/80 underline">Continue in the browser</a>
      </div>
    </div>
  )
}
