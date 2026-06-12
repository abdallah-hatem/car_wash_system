export function diffMinutes(fromISO: string | null, toISO: string | null): number | null {
  if (!fromISO || !toISO) return null
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime()
  return Math.max(0, Math.round(ms / 60000))
}

export function formatDuration(minutes: number | null): string {
  if (minutes == null) return "—"
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function defaultDateRange(today: Date): { from: string; to: string } {
  const from = new Date(today)
  from.setDate(from.getDate() - 6) // last 7 days inclusive
  return { from: ymd(from), to: ymd(today) }
}

export function dayRangeToBounds(from: string, to: string): { fromISO: string; toISO: string } {
  const [fy, fm, fd] = from.split("-").map(Number)
  const [ty, tm, td] = to.split("-").map(Number)
  const start = new Date(fy, fm - 1, fd, 0, 0, 0, 0)
  const end = new Date(ty, tm - 1, td, 23, 59, 59, 999)
  return { fromISO: start.toISOString(), toISO: end.toISOString() }
}
