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

/** Format a local Date as YYYY-MM-DD (no UTC shift). */
export function formatYmd(d: Date): string {
  return ymd(d)
}

/**
 * Parse a YYYY-MM-DD string as a LOCAL date.
 * Never use `new Date("YYYY-MM-DD")` — that parses as UTC and shifts by TZ offset.
 */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export type RangePreset = "today" | "last7" | "last30" | "thisMonth"

/** Return the `from`/`to` YYYY-MM-DD pair for a named preset relative to `today`. */
export function presetRange(
  kind: RangePreset,
  today: Date
): { from: string; to: string } {
  switch (kind) {
    case "today":
      return { from: formatYmd(today), to: formatYmd(today) }
    case "last7": {
      const from = new Date(today)
      from.setDate(from.getDate() - 6)
      return { from: formatYmd(from), to: formatYmd(today) }
    }
    case "last30": {
      const from = new Date(today)
      from.setDate(from.getDate() - 29)
      return { from: formatYmd(from), to: formatYmd(today) }
    }
    case "thisMonth": {
      const from = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: formatYmd(from), to: formatYmd(today) }
    }
  }
}

export function defaultDateRange(today: Date): { from: string; to: string } {
  return presetRange("last7", today)
}

export function dayRangeToBounds(from: string, to: string): { fromISO: string; toISO: string } {
  const [fy, fm, fd] = from.split("-").map(Number)
  const [ty, tm, td] = to.split("-").map(Number)
  const start = new Date(fy, fm - 1, fd, 0, 0, 0, 0)
  const end = new Date(ty, tm - 1, td, 23, 59, 59, 999)
  return { fromISO: start.toISOString(), toISO: end.toISOString() }
}
