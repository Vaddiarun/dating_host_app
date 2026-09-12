import { Navigate } from 'react-router-dom'
import { useAuth, resolveEntryRoute } from './AuthContext.jsx'

/** Gate for screens that need a logged-in host. Bounces guests to /login. */
export default function RequireAuth({ children }) {
  const { status } = useAuth()
  if (status === 'loading') {
    return <div className="min-h-[100dvh] grid place-items-center bg-white text-ink-400 text-[13px]">Loading…</div>
  }
  if (status === 'guest') return <Navigate to="/login" replace />
  return children
}

/** Gate for the real host-facing app (dashboard, calls, chat, live, earnings, withdrawals,
 * moderation). A host with an unapproved KYC status has nothing to do there yet — send them
 * back to wherever onboarding left off instead of letting them land on a half-working dashboard. */
export function RequireApproved({ children }) {
  const { status, me } = useAuth()
  if (status === 'loading') {
    return <div className="min-h-[100dvh] grid place-items-center bg-white text-ink-400 text-[13px]">Loading…</div>
  }
  if (status === 'guest') return <Navigate to="/login" replace />
  if (me?.kycStatus !== 'approved') return <Navigate to={resolveEntryRoute(me)} replace />
  return children
}
