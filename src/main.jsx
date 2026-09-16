import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './state/AuthContext.jsx'
import { NotificationsProvider } from './state/NotificationsContext.jsx'
import './index.css'

// After a new deploy, a tab left open from before it still holds an old
// index.html that references old, now-deleted chunk hashes (Agora's SDK is
// one of these — it's lazy-loaded via dynamic import, see lib/agora.js).
// The next lazy import from that stale page 404s with "Failed to fetch
// dynamically imported module," which is exactly what killed a live call's
// audio/video with no other symptom. Vite's documented fix: reload once to
// pick up the current build. Guarded by sessionStorage so a *genuinely*
// broken deployment doesn't reload-loop forever.
window.addEventListener('vite:preloadError', () => {
  const key = 'vite-preload-reload'
  if (sessionStorage.getItem(key)) return
  sessionStorage.setItem(key, '1')
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <NotificationsProvider>
          <App />
        </NotificationsProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
)
