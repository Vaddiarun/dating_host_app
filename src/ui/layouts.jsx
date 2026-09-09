import { StatusBar, BottomNav, SideNav, DesktopTopBar } from './kit.jsx'

const MAXW = {
  sm: 'lg:max-w-md',
  md: 'lg:max-w-xl',
  lg: 'lg:max-w-3xl',
  xl: 'lg:max-w-5xl',
  '2xl': 'lg:max-w-6xl',
  full: 'lg:max-w-none',
}

/**
 * App layout.
 *  - mobile  : full-width single column app screen (status bar + optional bottom nav)
 *  - desktop : sidebar + top bar + centered content column
 * No device frame anywhere.
 */
export function AppLayout({ children, title, back, bottomNav = true, bg = 'canvas', maxW = 'lg', pad = true }) {
  const bgClass = bg === 'white' ? 'bg-white' : 'bg-canvas'
  return (
    <div className="min-h-[100dvh] w-full lg:flex bg-white">
      <SideNav />
      <div className="flex min-h-[100dvh] w-full flex-col lg:flex-1 lg:min-w-0">
        <StatusBar />
        <DesktopTopBar title={title} back={back} />
        <main className={`flex-1 overflow-y-auto overflow-x-hidden no-scrollbar ${bgClass} lg:bg-canvas`}>
          <div className={`w-full min-w-0 lg:mx-auto ${MAXW[maxW]} ${pad ? 'lg:px-8 lg:py-8' : ''}`}>{children}</div>
        </main>
        {bottomNav && <BottomNav />}
      </div>
    </div>
  )
}

/**
 * Center layout — onboarding / auth. Mobile: plain full screen.
 * Desktop: two-pane — brand panel + the screen in a comfortable column.
 */
export function CenterLayout({ children }) {
  return (
    <div className="min-h-[100dvh] w-full bg-white lg:flex">
      <div className="hidden lg:flex w-[42%] max-w-[520px] flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-800 to-night-900 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-300 to-brand-500" />
          <span className="text-[20px] font-extrabold">Splash</span>
        </div>
        <div>
          <h2 className="text-[34px] font-extrabold leading-tight">Host. Connect.<br />Get paid.</h2>
          <p className="mt-3 text-[15px] text-white/60 max-w-sm">Video &amp; voice calls, live streams and gifts — with fast, transparent payouts.</p>
        </div>
        <p className="text-[12px] text-white/40">© 2026 Splash</p>
      </div>
      <div className="flex min-h-[100dvh] w-full flex-col lg:flex-1 lg:items-center lg:justify-center lg:min-h-0">
        <div className="flex min-h-[100dvh] w-full flex-col lg:min-h-0 lg:max-w-[440px]">{children}</div>
      </div>
    </div>
  )
}

/**
 * Immersive layout — full-bleed dark experiences (calls, live, splash, gift overlays).
 * Mobile & desktop both full-bleed; content constrains its own width for readability.
 */
export function ImmersiveLayout({ children }) {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-clip bg-[#0f0a1f]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[60vh] w-[60vh] -translate-x-1/2 rounded-full bg-brand-700/25 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[40vh] w-[40vh] rounded-full bg-gold-500/10 blur-[120px]" />
      </div>
      <div className="relative">{children}</div>
    </div>
  )
}
