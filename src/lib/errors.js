import { ApiError } from '../api/client.js'

/** The backend always answers failures with `{ error: "<real message>" }`, and ApiError
 * carries that straight through as `.message` — so surface it verbatim instead of a generic
 * string. Falls back only for errors that never reached the server (offline, DNS, CORS). */
export function errorMessage(e, fallback = "Something went wrong — check your connection and try again.") {
  if (e instanceof ApiError && e.message) return e.message
  if (e?.message) return e.message
  return fallback
}
