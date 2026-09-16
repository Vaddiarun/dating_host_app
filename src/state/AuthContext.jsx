import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { auth as authApi, profile as profileApi } from '../api/index.js'
import { getTokens, clearTokens, ApiError } from '../api/client.js'
import { connectSocket, disconnectSocket } from '../lib/socket.js'

const AuthContext = createContext(null)

/** Where onboarding should resume/land, given the freshest /me. */
export function resolveEntryRoute(me) {
  if (!me) return '/login'
  if (!me.name) return '/onboarding/profile'
  switch (me.kycStatus) {
    case 'approved':
      return '/home'
    case 'pending':
      return '/onboarding/review'
    case 'rejected':
      return '/onboarding/rejected'
    case 'not_submitted':
    default:
      return '/onboarding/kyc'
  }
}

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null)
  const [status, setStatus] = useState('loading') // loading | authed | guest
  const [pendingPhone, setPendingPhone] = useState('')

  const bootstrap = useCallback(async () => {
    const { accessToken } = getTokens()
    if (!accessToken) {
      setStatus('guest')
      return null
    }
    try {
      const data = await profileApi.getMe()
      setMe(data)
      setStatus('authed')
      return data
    } catch {
      clearTokens()
      setMe(null)
      setStatus('guest')
      return null
    }
  }, [])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (status === 'authed') connectSocket()
    else if (status === 'guest') disconnectSocket()
  }, [status])

  const requestOtp = useCallback(async (phone) => {
    setPendingPhone(phone)
    return authApi.requestOtp(phone)
  }, [])

  const verifyOtp = useCallback(async (phone, code) => {
    const verified = await authApi.verifyOtp(phone, code, 'host')
    // `role` is only honored by the backend for a brand-new signup — an
    // existing account (e.g. this phone number was already used on the
    // User app) keeps whatever role it already has, regardless of what we
    // asked for here. Without this check, that phone number logs in "fine"
    // but every host-only endpoint afterward 403s ("Not allowed for this
    // role"), landing on a broken dashboard with no explanation.
    if (verified.user?.role !== 'host') {
      clearTokens()
      throw new ApiError('This number is already registered as a different account type. Use a different number, or log in from the correct app.', 403)
    }
    const data = await profileApi.getMe()
    setMe(data)
    setStatus('authed')
    return data
  }, [])

  const refreshMe = useCallback(async () => {
    const data = await profileApi.getMe()
    setMe(data)
    return data
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setMe(null)
      setStatus('guest')
    }
  }, [])

  return (
    <AuthContext.Provider value={{ me, status, pendingPhone, requestOtp, verifyOtp, refreshMe, logout, setMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
