export function rupees(paise) {
  const v = Math.round((paise ?? 0) / 100)
  return `₹ ${v.toLocaleString('en-IN')}`
}

export function rupeesRaw(paise) {
  return Math.round((paise ?? 0) / 100)
}

export function beans(n) {
  return (n ?? 0).toLocaleString('en-IN')
}

/** Compact form for tight leaderboard rows — 8210 -> "8.2K", 920 -> "920". */
export function compactBeans(n) {
  const v = n ?? 0
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return String(v)
}

export function initialsName(host) {
  return host?.name || host?.username || host?.phone || 'Host'
}

export function timeAgo(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.round(hrs / 24)
  return `${days}d`
}

export function clockTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/**
 * Best-effort tracking number for a record. Backends spell the id field
 * differently (`id`, `_id`, `kycId`, `referenceId`, ...), and a "my KYC"
 * endpoint may not carry one of its own at all — in which case the account
 * id doubles as the thing support can look the submission up by.
 */
export function referenceCode(obj, fallbackId) {
  const raw = obj?.id ?? obj?._id ?? obj?.kycId ?? obj?.referenceId ?? obj?.reference ?? obj?.applicationId ?? obj?.submissionId ?? fallbackId
  return raw ? String(raw) : ''
}

export function dayLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(Date.now() - 86400000)
  const same = (a, b) => a.toDateString() === b.toDateString()
  if (same(d, today)) return 'Today'
  if (same(d, yest)) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
