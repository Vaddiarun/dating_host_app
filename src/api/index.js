import { apiFetch, apiDownload, uploadToPresignedUrl, getTokens, setTokens, clearTokens } from './client.js'

/** Platform-wide, rarely-changing settings (currently just the bean↔paise rate — it's
 * admin-configurable and time-versioned server-side, so read it here rather than inferring
 * it from a balance snapshot). */
export const config = {
  get: () => apiFetch('/config'),
}

export const auth = {
  requestOtp: (phone) => apiFetch('/auth/otp/request', { method: 'POST', auth: false, body: { phone } }),
  verifyOtp: async (phone, code, role = 'host') => {
    const data = await apiFetch('/auth/otp/verify', { method: 'POST', auth: false, body: { phone, code, role } })
    setTokens(data)
    return data
  },
  refresh: async () => {
    const { refreshToken } = getTokens()
    const data = await apiFetch('/auth/token/refresh', { method: 'POST', auth: false, body: { refreshToken } })
    setTokens(data)
    return data
  },
  logout: async () => {
    const { refreshToken } = getTokens()
    try {
      await apiFetch('/auth/logout', { method: 'POST', body: { refreshToken } })
    } finally {
      clearTokens()
    }
  },
}

export const profile = {
  getMe: () => apiFetch('/me'),
  updateMe: (data) => apiFetch('/me', { method: 'PATCH', body: data }),
  updateHostProfile: (data) => apiFetch('/me/host-profile', { method: 'PATCH', body: data }),

  getKycUploadUrl: (contentType) => apiFetch('/me/kyc/upload-url', { method: 'POST', body: { contentType } }),
  uploadKycFile: (uploadUrl, file) => uploadToPresignedUrl(uploadUrl, file),
  submitKyc: (documents) => apiFetch('/me/kyc', { method: 'POST', body: { documents } }),
  getKycStatus: () => apiFetch('/me/kyc'),

  // Profile photo — same presign-then-PATCH shape as gallery uploads below,
  // except the result is saved via updateMe({ avatarUrl }) rather than a
  // dedicated "add" endpoint.
  getAvatarUploadUrl: (contentType) => apiFetch('/me/avatar/upload-url', { method: 'POST', body: { contentType } }),
  uploadAvatarFile: (uploadUrl, file) => uploadToPresignedUrl(uploadUrl, file),

  listGallery: () => apiFetch('/me/host-profile/gallery'),
  addGalleryItem: (mediaType, url) => apiFetch('/me/host-profile/gallery', { method: 'POST', body: { mediaType, url } }),
  deleteGalleryItem: (id) => apiFetch(`/me/host-profile/gallery/${id}`, { method: 'DELETE' }),
  // Gallery media is public (unlike KYC docs) — the response's `url` is the final public
  // URL to hand straight to addGalleryItem, no need to construct it from the key ourselves.
  getGalleryUploadUrl: (contentType) => apiFetch('/me/host-profile/gallery/upload-url', { method: 'POST', body: { contentType } }),
  uploadGalleryFile: (uploadUrl, file) => uploadToPresignedUrl(uploadUrl, file),

  listPayoutMethods: () => apiFetch('/me/payout-methods'),
  addPayoutMethod: (data) => apiFetch('/me/payout-methods', { method: 'POST', body: data }),
  setPrimaryPayoutMethod: (id) => apiFetch(`/me/payout-methods/${id}/primary`, { method: 'PATCH' }),

  getNotificationPreferences: () => apiFetch('/me/notification-preferences'),
  updateNotificationPreferences: (data) => apiFetch('/me/notification-preferences', { method: 'PATCH', body: data }),

  // Full replace, not a merge — always send the complete beauty-settings object. Echoed back
  // on GET /me as hostProfile.beautySettings (null until the host saves it once).
  updateBeautySettings: (data) => apiFetch('/me/beauty-settings', { method: 'PATCH', body: data }),
}

export const presence = {
  setOnline: (isOnline) => apiFetch('/me/presence', { method: 'PATCH', body: { isOnline } }),
}

export const calls = {
  accept: (id) => apiFetch(`/calls/${id}/accept`, { method: 'POST' }),
  reject: (id) => apiFetch(`/calls/${id}/reject`, { method: 'POST' }),
  get: (id) => apiFetch(`/calls/${id}`),
  end: (id) => apiFetch(`/calls/${id}/end`, { method: 'POST' }),
  rate: (id, stars) => apiFetch(`/calls/${id}/rating`, { method: 'POST', body: { stars } }),
}

export const chat = {
  send: (recipientId, content) => apiFetch('/chat/messages', { method: 'POST', body: { recipientId, content } }),
  listConversations: () => apiFetch('/chat/conversations'),
  getMessages: (conversationId, page = 1, pageSize = 50) =>
    apiFetch(`/chat/conversations/${conversationId}/messages`, { query: { page, pageSize } }),
}

export const gifts = {
  catalog: () => apiFetch('/gifts'),
  request: (userId, suggestedGiftId) => apiFetch('/gifts/request', { method: 'POST', body: { userId, suggestedGiftId } }),
}

export const live = {
  adultModeStatus: () => apiFetch('/live/adult-mode'),
  start: (title) => apiFetch('/live/broadcasts', { method: 'POST', body: { title } }),
  get: (id) => apiFetch(`/live/broadcasts/${id}`),
  sendChat: (id, content) => apiFetch(`/live/broadcasts/${id}/chat`, { method: 'POST', body: { content } }),
  end: (id) => apiFetch(`/live/broadcasts/${id}/end`, { method: 'POST' }),
}

export const withdrawals = {
  request: (beans) => apiFetch('/withdrawals', { method: 'POST', body: { beans } }),
  list: () => apiFetch('/withdrawals'),
  get: (id) => apiFetch(`/withdrawals/${id}`),
}

export const earnings = {
  dashboard: () => apiFetch('/me/dashboard'),
  summary: () => apiFetch('/me/earnings'),
  breakdown: (from, to) => apiFetch('/me/earnings/breakdown', { query: { from, to } }),
  history: (type = 'all', page = 1, pageSize = 20) => apiFetch('/me/history', { query: { type, page, pageSize } }),
  downloadStatement: (from, to) => apiDownload('/me/earnings/statement', { query: { from, to }, filename: `statement-${from || 'current'}.csv` }),
}

export const notifications = {
  list: (page = 1, pageSize = 20) => apiFetch('/me/notifications', { query: { page, pageSize } }),
  markRead: (id) => apiFetch(`/me/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => apiFetch('/me/notifications/read-all', { method: 'PATCH' }),
}

export const moderation = {
  block: (userId) => apiFetch('/moderation/blocks', { method: 'POST', body: { userId } }),
  listBlocked: () => apiFetch('/moderation/blocks'),
  unblock: (userId) => apiFetch(`/moderation/blocks/${userId}`, { method: 'DELETE' }),
  report: (targetType, targetId, reason) =>
    apiFetch('/moderation/reports', { method: 'POST', body: { targetType, targetId, reason } }),
  logCapture: (context, contextId) => apiFetch('/moderation/capture-event', { method: 'POST', body: { context, contextId } }),
}

export { ApiError } from './client.js'
