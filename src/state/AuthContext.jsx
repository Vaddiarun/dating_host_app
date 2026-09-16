import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { auth as authApi, profile as profileApi } from '../api/index.js'
import { getTokens, clearTokens } from '../api/client.js'
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
    // The backend looks this phone number up scoped to role "host"
    // specifically (users table is unique per phone+role, not phone alone)
    // — a phone already used on the User app has a separate User account
    // that this can never return or escalate into. It either logs into
    // this phone's own Host account or creates one; either way the result
    // is always role "host".
    await authApi.verifyOtp(phone, code, 'host')
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
