import type { WashStatus } from "./operations"
import { diffMinutes } from "./duration"

/**
 * A single payment attached to a wash, as needed for stats aggregation.
 * `paid_at` is an ISO timestamp; revenue is bucketed by the day a payment was
 * RECORDED (paid_at), so a payment made today on an older order lands today.
 */
export interface StatsPayment {
  amount: number
  paid_at: string
}

/**
 * One wash record used by the analytics aggregations. Mirrors the columns
 * fetched by `listWashesForStats` (washes.ts). All embeds are flattened to
 * nullable name strings; payments carry amount + paid_at.
 */
export interface StatsWash {
  id: string
  status: WashStatus
  price: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  package_name: string | null
  branch_name: string | null
  employee_name: string | null
  payments: StatsPayment[]
}

// ─── Small helpers ────────────────────────────────────────────────────────────

/** Local YYYY-MM-DD key for an ISO timestamp (no UTC shift). */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Mean of a list of numbers, rounded; null when the list is empty. */
function avg(values: number[]): number | null {
  if (values.length === 0) return null
  const sum = values.reduce((s, n) => s + n, 0)
  return Math.round(sum / values.length)
}

// ─── KPIs ───────────────────────────────────────────────────────────────────

export interface WashKpis {
  /** Sum of every payment amount across all washes in range. */
  revenue: number
  /** Total number of wash records in range. */
  washCount: number
  /** Revenue / number of completed (done) washes; null when no completed washes. */
  avgTicket: number | null
  /** done / total, in 0..1; null when there are no washes. */
  completionRate: number | null
  /** Avg minutes created→started over washes that have started; null if none. */
  avgWaitMinutes: number | null
  /** Avg minutes started→completed over completed washes; null if none. */
  avgServiceMinutes: number | null
  /** Count of completed (done) washes — handy for the avg-ticket denominator note. */
  doneCount: number
}

/** Sum every payment amount across all washes (revenue recognised by payments made). */
export function totalRevenue(washes: StatsWash[]): number {
  let sum = 0
  for (const w of washes) {
    for (const p of w.payments) sum += Number(p.amount)
  }
  return sum
}

export function computeKpis(washes: StatsWash[]): WashKpis {
  const revenue = totalRevenue(washes)
  const washCount = washes.length
  const doneCount = washes.filter((w) => w.status === "done").length

  const waitValues: number[] = []
  const serviceValues: number[] = []
  for (const w of washes) {
    const wait = diffMinutes(w.created_at, w.started_at)
    if (wait != null) waitValues.push(wait)
    const service = diffMinutes(w.started_at, w.completed_at)
    if (service != null) serviceValues.push(service)
  }

  return {
    revenue,
    washCount,
    avgTicket: doneCount > 0 ? Math.round(revenue / doneCount) : null,
    completionRate: washCount > 0 ? doneCount / washCount : null,
    avgWaitMinutes: avg(waitValues),
    avgServiceMinutes: avg(serviceValues),
    doneCount,
  }
}

// ─── Time series ──────────────────────────────────────────────────────────────

export interface DayPoint {
  /** YYYY-MM-DD (sortable, locale-independent). */
  date: string
  value: number
}

/** Revenue per day, keyed by each payment's `paid_at` day. Sorted ascending. */
export function revenueByDay(washes: StatsWash[]): DayPoint[] {
  const map = new Map<string, number>()
  for (const w of washes) {
    for (const p of w.payments) {
      const k = dayKey(p.paid_at)
      map.set(k, (map.get(k) ?? 0) + Number(p.amount))
    }
  }
  return [...map.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Wash count per day, keyed by `created_at` day. Sorted ascending. */
export function washesByDay(washes: StatsWash[]): DayPoint[] {
  const map = new Map<string, number>()
  for (const w of washes) {
    const k = dayKey(w.created_at)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface WeekdayPoint {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
  count: number
}

/** Wash counts bucketed by weekday (Sun..Sat) from `created_at`. Always 7 entries. */
export function washesByWeekday(washes: StatsWash[]): WeekdayPoint[] {
  const counts = new Array<number>(7).fill(0)
  for (const w of washes) {
    const d = new Date(w.created_at).getDay()
    counts[d] += 1
  }
  return counts.map((count, weekday) => ({ weekday, count }))
}

export interface HourPoint {
  /** 0..23 local hour. */
  hour: number
  count: number
}

/** Wash counts bucketed by hour-of-day (0..23) from `created_at`. Always 24 entries. */
export function washesByHour(washes: StatsWash[]): HourPoint[] {
  const counts = new Array<number>(24).fill(0)
  for (const w of washes) {
    const h = new Date(w.created_at).getHours()
    counts[h] += 1
  }
  return counts.map((count, hour) => ({ hour, count }))
}

// ─── Breakdowns ────────────────────────────────────────────────────────────────

export type StatusBreakdown = Record<WashStatus, number>

/** Counts per wash status. Always returns all four keys (zeros when absent). */
export function statusBreakdown(washes: StatsWash[]): StatusBreakdown {
  const counts: StatusBreakdown = { waiting: 0, in_progress: 0, done: 0, cancelled: 0 }
  for (const w of washes) counts[w.status] = (counts[w.status] ?? 0) + 1
  return counts
}

export interface PackageStat {
  name: string
  count: number
  revenue: number
}

/**
 * Per-package count + revenue, sorted by count desc (revenue desc tiebreak).
 * Washes with no package fall under a null-name bucket the UI labels "—".
 */
export function topPackages(washes: StatsWash[]): PackageStat[] {
  const map = new Map<string, { count: number; revenue: number }>()
  for (const w of washes) {
    const name = w.package_name ?? "—"
    const cur = map.get(name) ?? { count: 0, revenue: 0 }
    cur.count += 1
    for (const p of w.payments) cur.revenue += Number(p.amount)
    map.set(name, cur)
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, count: v.count, revenue: v.revenue }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue || a.name.localeCompare(b.name))
}

export interface BranchStat {
  name: string
  count: number
  revenue: number
}

/** Per-branch count + revenue, sorted by revenue desc (count desc tiebreak). */
export function byBranch(washes: StatsWash[]): BranchStat[] {
  const map = new Map<string, { count: number; revenue: number }>()
  for (const w of washes) {
    const name = w.branch_name ?? "—"
    const cur = map.get(name) ?? { count: 0, revenue: 0 }
    cur.count += 1
    for (const p of w.payments) cur.revenue += Number(p.amount)
    map.set(name, cur)
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, count: v.count, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count || a.name.localeCompare(b.name))
}

export interface ReasonStat {
  reason: string
  count: number
}

/**
 * Cancelled washes grouped by cancellation reason, sorted by count desc.
 * Only considers `status === "cancelled"` rows; blank/absent reasons bucket to "—".
 */
export function cancellationsByReason(washes: StatsWash[]): ReasonStat[] {
  const map = new Map<string, number>()
  for (const w of washes) {
    if (w.status !== "cancelled") continue
    const reason = w.cancellation_reason?.trim() || "—"
    map.set(reason, (map.get(reason) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
}

export interface EmployeeStat {
  name: string
  count: number
}

/**
 * Top employees by COMPLETED (done) wash count, sorted desc. Completed washes
 * with no assigned employee are ignored (no meaningful name to credit).
 */
export function topEmployees(washes: StatsWash[]): EmployeeStat[] {
  const map = new Map<string, number>()
  for (const w of washes) {
    if (w.status !== "done") continue
    if (!w.employee_name) continue
    map.set(w.employee_name, (map.get(w.employee_name) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

// ─── Bundle ────────────────────────────────────────────────────────────────────

export interface WashStats {
  kpis: WashKpis
  revenueByDay: DayPoint[]
  washesByDay: DayPoint[]
  washesByWeekday: WeekdayPoint[]
  washesByHour: HourPoint[]
  statusBreakdown: StatusBreakdown
  topPackages: PackageStat[]
  byBranch: BranchStat[]
  cancellationsByReason: ReasonStat[]
  topEmployees: EmployeeStat[]
}

/** Compute the full analytics bundle from raw wash records. Pure; empty-safe. */
export function computeWashStats(washes: StatsWash[]): WashStats {
  return {
    kpis: computeKpis(washes),
    revenueByDay: revenueByDay(washes),
    washesByDay: washesByDay(washes),
    washesByWeekday: washesByWeekday(washes),
    washesByHour: washesByHour(washes),
    statusBreakdown: statusBreakdown(washes),
    topPackages: topPackages(washes),
    byBranch: byBranch(washes),
    cancellationsByReason: cancellationsByReason(washes),
    topEmployees: topEmployees(washes),
  }
}
