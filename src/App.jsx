import { Routes, Route, Navigate, Outlet } from 'react-router-dom'

import RequireAuth, { RequireApproved } from './state/RequireAuth.jsx'
import RealtimeBridge from './state/RealtimeBridge.jsx'
import { Splash, Login, Otp, ProfileSetup, KycIntro, DocumentUpload, PayoutAccount, UnderReview, Verified, Rejected } from './screens/onboarding.jsx'
import Home from './screens/home.jsx'
import { CallsList, IncomingCall, Connecting, ActiveCall, CallSummary } from './screens/calls.jsx'
import { ChatList, ChatConvo } from './screens/chat.jsx'
import { GoLive, Broadcast, LiveSummary } from './screens/live.jsx'
import { Earnings, Breakdown, EarningsHistory, Statement } from './screens/earnings.jsx'
import { Withdraw, WithdrawConfirm, WithdrawStatus } from './screens/withdraw.jsx'
import { Settings, KycStatus, EditProfile, RateSettings, Gallery, PayoutDetails, NotificationSettings, HelpSupport } from './screens/settings.jsx'
import {
  Notifications, ReportUser, ReportSubmitted, BlockUser, Blocked, AskGift, GiftReceived,
  LoadingState, NoCalls, SomethingWrong, OfflineState, Reconnecting, SessionExpired, AccountSuspended, ScreenshotBlocked,
} from './screens/misc.jsx'

export default function App() {
  return (
    <>
    <RealtimeBridge />
    <Routes>
      <Route path="/" element={<Navigate to="/splash" replace />} />
      <Route path="/splash" element={<Splash />} />
      <Route path="/login" element={<Login />} />
      <Route path="/otp" element={<Otp />} />

      <Route element={<RequireAuth><Outlet /></RequireAuth>}>
        <Route path="/onboarding/profile" element={<ProfileSetup />} />
        <Route path="/onboarding/kyc" element={<KycIntro />} />
        <Route path="/onboarding/documents" element={<DocumentUpload />} />
        <Route path="/onboarding/payout" element={<PayoutAccount />} />
        <Route path="/onboarding/review" element={<UnderReview />} />
        <Route path="/onboarding/verified" element={<Verified />} />
        <Route path="/onboarding/rejected" element={<Rejected />} />

        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/kyc" element={<KycStatus />} />
        <Route path="/settings/edit-profile" element={<EditProfile />} />
        <Route path="/settings/rates" element={<RateSettings />} />
        <Route path="/settings/gallery" element={<Gallery />} />
        <Route path="/settings/payouts" element={<PayoutDetails />} />
        <Route path="/settings/payouts/add" element={<PayoutAccount standalone />} />
        <Route path="/settings/notifications" element={<NotificationSettings />} />
        <Route path="/settings/help" element={<HelpSupport />} />

        {/* The real dashboard — locked until KYC is approved, not just "logged in". */}
        <Route element={<RequireApproved><Outlet /></RequireApproved>}>
          <Route path="/home" element={<Home />} />

          <Route path="/calls" element={<CallsList />} />
          <Route path="/call/incoming" element={<IncomingCall />} />
          <Route path="/call/connecting" element={<Connecting />} />
          <Route path="/call/active" element={<ActiveCall />} />
          <Route path="/call/summary" element={<CallSummary />} />

          <Route path="/chat" element={<ChatList />} />
          <Route path="/chat/:id" element={<ChatConvo />} />

          <Route path="/live" element={<GoLive />} />
          <Route path="/live/broadcast" element={<Broadcast />} />
          <Route path="/live/summary" element={<LiveSummary />} />

          <Route path="/earnings" element={<Earnings />} />
          <Route path="/earnings/breakdown" element={<Breakdown />} />
          <Route path="/earnings/history" element={<EarningsHistory />} />
          <Route path="/earnings/statement" element={<Statement />} />

          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/withdraw/confirm" element={<WithdrawConfirm />} />
          <Route path="/withdraw/status/:state" element={<WithdrawStatus />} />

          <Route path="/notifications" element={<Notifications />} />
          <Route path="/report" element={<ReportUser />} />
          <Route path="/report/submitted" element={<ReportSubmitted />} />
          <Route path="/block/:id" element={<BlockUser />} />
          <Route path="/blocked/:id" element={<Blocked />} />
          <Route path="/gift/ask/:ctx" element={<AskGift />} />
          <Route path="/gift/received" element={<GiftReceived />} />
        </Route>
      </Route>

      <Route path="/state/loading" element={<LoadingState />} />
      <Route path="/state/no-calls" element={<NoCalls />} />
      <Route path="/state/error" element={<SomethingWrong />} />
      <Route path="/state/offline" element={<OfflineState />} />
      <Route path="/state/reconnecting" element={<Reconnecting />} />
      <Route path="/state/session-expired" element={<SessionExpired />} />
      <Route path="/state/suspended" element={<AccountSuspended />} />
      <Route path="/state/screenshot-blocked" element={<ScreenshotBlocked />} />

      <Route path="*" element={<Navigate to="/splash" replace />} />
    </Routes>
    </>
  )
}
