import { Navigate } from 'react-router-dom'
import { useAuth, resolveEntryRoute } from './AuthContext.jsx'
import { Skel, SkelGroup, SkelHero, SkelStats, SkelList } from '../ui/Skeleton.jsx'

/** App-shaped placeholder while the session is being restored. */
function AppSkeleton() {
  return (
    <SkelGroup className="min-h-[100dvh] bg-canvas">
      <div className="bg-white px-5 pt-4 pb-3 flex items-center gap-3"><Skel className="h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><Skel className="h-3.5 w-32 rounded-md" /><Skel className="h-3 w-16 rounded-full" /></div><Skel className="h-9 w-9 rounded-xl" /></div>
      <div className="mx-auto w-full max-w-5xl px-5 pt-4 space-y-4"><SkelHero /><SkelStats count={3} /><SkelList rows={4} /></div>
    </SkelGroup>
  )
}

/** Gate for screens that need a logged-in host. Bounces guests to /login. */
export default function RequireAuth({ children }) {
  const { status } = useAuth()
  if (status === 'loading') {
    return <AppSkeleton />
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
    return <AppSkeleton />
  }
  if (status === 'guest') return <Navigate to="/login" replace />
  if (me?.kycStatus !== 'approved') return <Navigate to={resolveEntryRoute(me)} replace />
  return children
}
