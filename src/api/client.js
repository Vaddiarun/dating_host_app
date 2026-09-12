const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://triloapp-plan.onrender.com'

const ACCESS_KEY = 'triloplan_host_access_token'
const REFRESH_KEY = 'triloplan_host_refresh_token'

export function getTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_KEY) || '',
    refreshToken: localStorage.getItem(REFRESH_KEY) || '',
  }
}

export function setTokens({ accessToken, refreshToken } = {}) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

let refreshPromise = null
async function refreshAccessToken() {
  const { refreshToken } = getTokens()
  if (!refreshToken) throw new ApiError('No refresh token', 401)
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) throw new ApiError('Session expired', res.status)
        const data = await res.json()
        setTokens(data)
        return data
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

function buildUrl(path, query) {
  let url = `${BASE_URL}${path}`
  if (query && Object.keys(query).length) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ).toString()
    if (qs) url += `?${qs}`
  }
  return url
}

/**
 * Core fetch wrapper: injects the base URL + bearer token, retries once on a
 * 401 by refreshing the access token, and throws ApiError with the server's
 * `{ error }` message on non-2xx responses.
 */
export async function apiFetch(path, { method = 'GET', body, auth = true, query, retry = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const { accessToken } = getTokens()
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
  }

  const url = buildUrl(path, query)

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && auth && retry) {
    try {
      await refreshAccessToken()
    } catch {
      clearTokens()
      throw new ApiError('Session expired', 401)
    }
    return apiFetch(path, { method, body, auth, query, retry: false })
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    throw new ApiError(data?.error || res.statusText || 'Request failed', res.status, data)
  }
  return data
}

/**
 * Fetches a file response (CSV/PDF export, not JSON) and hands it to the browser as a save —
 * same 401-refresh-and-retry-once shape as apiFetch, since this hits an authed endpoint too.
 */
export async function apiDownload(path, { query, filename } = {}, retry = true) {
  const { accessToken } = getTokens()
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  const res = await fetch(buildUrl(path, query), { headers })

  if (res.status === 401 && retry) {
    try {
      await refreshAccessToken()
    } catch {
      clearTokens()
      throw new ApiError('Session expired', 401)
    }
    return apiDownload(path, { query, filename }, false)
  }

  if (!res.ok) {
    let body = null
    try { body = await res.json() } catch { /* not JSON — a plain error page or empty body */ }
    throw new ApiError(body?.error || res.statusText || 'Download failed', res.status, body)
  }

  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') || ''
  const name = filename || /filename="?([^";]+)"?/.exec(disposition)?.[1] || 'download'
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000)
}

/** Uploads a file straight to the presigned S3 URL returned by /me/kyc/upload-url. No auth header. */
export async function uploadToPresignedUrl(uploadUrl, file) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!res.ok) throw new ApiError('Upload failed', res.status)
  return true
}

export { BASE_URL }
