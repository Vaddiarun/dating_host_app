# Splash — Host app

React + Vite + Tailwind implementation of the full Figma screen set (`Splash host`), built as a
**responsive web app** — no phone mockup / device frame.

- **Mobile (`< lg`)** — faithful to the Figma designs: status bar, in-app headers, bottom tab bar.
- **Desktop (`≥ lg`)** — a real dashboard layout: left sidebar navigation, top bar, wide content
  (2-column dashboards, split-pane chat, split-screen auth). Designed to fill the viewport.

Immersive screens (splash, calls, live broadcast, gift overlays, connection states) render
full-bleed on both.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build && npm run preview
```

## Navigating

The main flows are wired (sidebar / bottom tabs, back buttons, primary CTAs). Individual screens
can also be opened directly by URL, e.g. `#/home?state=online`, `#/withdraw?v=min`,
`#/withdraw/status/paid`, `#/state/session-expired`.

## Structure

```
src/
  ui/
    Icon.jsx        inline icon set
    kit.jsx         StatusBar, SideNav, BottomNav, TopBar, Avatar, primitives
    layouts.jsx     AppLayout (mobile app / desktop dashboard), CenterLayout, ImmersiveLayout
  screens/
    onboarding.jsx  splash, login, OTP, profile, KYC, documents, payout, review, verified, rejected
    home.jsx        dashboard — offline / online / in-call / broadcasting states
    calls.jsx       call log, incoming, connecting, active call, summary
    chat.jsx        message list + conversation (split-pane on desktop)
    live.jsx        go-live setup, broadcast, stream summary
    earnings.jsx    earnings, breakdown, history, statement
    withdraw.jsx    withdraw + amount states, confirm, status flow (submitted…paid / rejected / failed)
    settings.jsx    profile, KYC status, edit profile, rates, gallery, payouts, notifications, help
    misc.jsx        notifications, report / block, gift ask / received, system states
  data.js           mock data
  App.jsx           routes + screen index
```
# dating_host_app
