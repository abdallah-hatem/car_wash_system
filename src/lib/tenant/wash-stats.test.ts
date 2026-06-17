import { describe, it, expect } from "vitest"
import {
  dayKey,
  totalRevenue,
  computeKpis,
  revenueByDay,
  washesByDay,
  washesByWeekday,
  washesByHour,
  statusBreakdown,
  topPackages,
  byBranch,
  cancellationsByReason,
  topEmployees,
  computeWashStats,
  type StatsWash,
} from "./wash-stats"

// ── Builders ──────────────────────────────────────────────────────────────────

let seq = 0
function wash(overrides: Partial<StatsWash> = {}): StatsWash {
  seq += 1
  return {
    id: `w${seq}`,
    status: "done",
    price: 100,
    created_at: "2026-06-01T10:00:00",
    started_at: "2026-06-01T10:10:00",
    completed_at: "2026-06-01T10:40:00",
    cancelled_at: null,
    cancellation_reason: null,
    package_name: "Basic",
    branch_name: "Main",
    employee_name: "Ali",
    payments: [{ amount: 100, paid_at: "2026-06-01T10:45:00" }],
    ...overrides,
  }
}

// ── dayKey ──────────────────────────────────────────────────────────────────

describe("dayKey", () => {
  it("returns local YYYY-MM-DD", () => {
    expect(dayKey("2026-06-01T10:00:00")).toBe("2026-06-01")
    expect(dayKey("2026-12-31T23:00:00")).toBe("2026-12-31")
  })
})

// ── KPIs ──────────────────────────────────────────────────────────────────────

describe("totalRevenue", () => {
  it("sums every payment across all washes", () => {
    const data = [
      wash({ payments: [{ amount: 50, paid_at: "2026-06-01T10:00:00" }] }),
      wash({
        payments: [
          { amount: 30, paid_at: "2026-06-01T11:00:00" },
          { amount: 20, paid_at: "2026-06-02T09:00:00" },
        ],
      }),
      wash({ payments: [] }),
    ]
    expect(totalRevenue(data)).toBe(100)
  })

  it("is 0 for empty input", () => {
    expect(totalRevenue([])).toBe(0)
  })
})

describe("computeKpis", () => {
  it("computes all KPIs over a mixed dataset", () => {
    const data: StatsWash[] = [
      // done, 10 min wait, 30 min service, 100 paid
      wash({
        status: "done",
        created_at: "2026-06-01T10:00:00",
        started_at: "2026-06-01T10:10:00",
        completed_at: "2026-06-01T10:40:00",
        payments: [{ amount: 100, paid_at: "2026-06-01T10:45:00" }],
      }),
      // done, 20 min wait, 40 min service, 200 paid
      wash({
        status: "done",
        created_at: "2026-06-02T10:00:00",
        started_at: "2026-06-02T10:20:00",
        completed_at: "2026-06-02T11:00:00",
        payments: [{ amount: 200, paid_at: "2026-06-02T11:05:00" }],
      }),
      // in_progress: started but not completed → contributes to wait only
      wash({
        status: "in_progress",
        created_at: "2026-06-02T12:00:00",
        started_at: "2026-06-02T12:30:00",
        completed_at: null,
        payments: [],
      }),
      // waiting: never started → no wait/service contribution
      wash({
        status: "waiting",
        created_at: "2026-06-03T09:00:00",
        started_at: null,
        completed_at: null,
        payments: [],
      }),
    ]
    const k = computeKpis(data)
    expect(k.revenue).toBe(300)
    expect(k.washCount).toBe(4)
    expect(k.doneCount).toBe(2)
    expect(k.avgTicket).toBe(150) // 300 / 2 done
    expect(k.completionRate).toBeCloseTo(0.5) // 2 done / 4 total
    expect(k.avgWaitMinutes).toBe(20) // (10 + 20 + 30) / 3
    expect(k.avgServiceMinutes).toBe(35) // (30 + 40) / 2
  })

  it("guards division by zero and empty data (nulls, not NaN)", () => {
    const k = computeKpis([])
    expect(k.revenue).toBe(0)
    expect(k.washCount).toBe(0)
    expect(k.doneCount).toBe(0)
    expect(k.avgTicket).toBeNull()
    expect(k.completionRate).toBeNull()
    expect(k.avgWaitMinutes).toBeNull()
    expect(k.avgServiceMinutes).toBeNull()
  })

  it("avgTicket is null when revenue exists but nothing is completed", () => {
    const data = [
      wash({ status: "waiting", started_at: null, completed_at: null, payments: [{ amount: 40, paid_at: "2026-06-01T10:00:00" }] }),
    ]
    const k = computeKpis(data)
    expect(k.revenue).toBe(40)
    expect(k.avgTicket).toBeNull()
  })
})

// ── Time series ─────────────────────────────────────────────────────────────────

describe("revenueByDay", () => {
  it("buckets by paid_at day and sorts ascending", () => {
    const data = [
      wash({ payments: [{ amount: 100, paid_at: "2026-06-02T10:00:00" }] }),
      wash({ payments: [{ amount: 50, paid_at: "2026-06-01T10:00:00" }] }),
      wash({ payments: [{ amount: 25, paid_at: "2026-06-01T18:00:00" }] }),
    ]
    expect(revenueByDay(data)).toEqual([
      { date: "2026-06-01", value: 75 },
      { date: "2026-06-02", value: 100 },
    ])
  })

  it("uses paid_at, not created_at (cross-day payment lands on payment day)", () => {
    const data = [
      wash({
        created_at: "2026-06-01T10:00:00",
        payments: [{ amount: 100, paid_at: "2026-06-05T09:00:00" }],
      }),
    ]
    expect(revenueByDay(data)).toEqual([{ date: "2026-06-05", value: 100 }])
  })

  it("is empty for no payments", () => {
    expect(revenueByDay([])).toEqual([])
    expect(revenueByDay([wash({ payments: [] })])).toEqual([])
  })
})

describe("washesByDay", () => {
  it("counts washes per created_at day, sorted", () => {
    const data = [
      wash({ created_at: "2026-06-02T10:00:00" }),
      wash({ created_at: "2026-06-01T10:00:00" }),
      wash({ created_at: "2026-06-01T23:00:00" }),
    ]
    expect(washesByDay(data)).toEqual([
      { date: "2026-06-01", value: 2 },
      { date: "2026-06-02", value: 1 },
    ])
  })

  it("is empty for no washes", () => {
    expect(washesByDay([])).toEqual([])
  })
})

describe("washesByWeekday", () => {
  it("always returns 7 buckets Sun..Sat", () => {
    const res = washesByWeekday([])
    expect(res).toHaveLength(7)
    expect(res.map((r) => r.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(res.every((r) => r.count === 0)).toBe(true)
  })

  it("counts into the correct weekday bucket", () => {
    // 2026-06-01 is a Monday (getDay() === 1)
    const data = [
      wash({ created_at: "2026-06-01T10:00:00" }), // Mon
      wash({ created_at: "2026-06-01T12:00:00" }), // Mon
      wash({ created_at: "2026-06-07T12:00:00" }), // Sun
    ]
    const res = washesByWeekday(data)
    expect(res[1].count).toBe(2) // Monday
    expect(res[0].count).toBe(1) // Sunday
    expect(res[3].count).toBe(0) // Wednesday
  })
})

describe("washesByHour", () => {
  it("always returns 24 buckets 0..23", () => {
    const res = washesByHour([])
    expect(res).toHaveLength(24)
    expect(res[0].hour).toBe(0)
    expect(res[23].hour).toBe(23)
    expect(res.every((r) => r.count === 0)).toBe(true)
  })

  it("counts into the correct hour bucket", () => {
    const data = [
      wash({ created_at: "2026-06-01T08:15:00" }),
      wash({ created_at: "2026-06-02T08:55:00" }),
      wash({ created_at: "2026-06-02T17:05:00" }),
    ]
    const res = washesByHour(data)
    expect(res[8].count).toBe(2)
    expect(res[17].count).toBe(1)
    expect(res[9].count).toBe(0)
  })
})

// ── Breakdowns ───────────────────────────────────────────────────────────────

describe("statusBreakdown", () => {
  it("returns all four keys with zeros for empty data", () => {
    expect(statusBreakdown([])).toEqual({
      waiting: 0,
      in_progress: 0,
      done: 0,
      cancelled: 0,
    })
  })

  it("counts each status", () => {
    const data = [
      wash({ status: "waiting" }),
      wash({ status: "waiting" }),
      wash({ status: "in_progress" }),
      wash({ status: "done" }),
      wash({ status: "cancelled" }),
    ]
    expect(statusBreakdown(data)).toEqual({
      waiting: 2,
      in_progress: 1,
      done: 1,
      cancelled: 1,
    })
  })
})

describe("topPackages", () => {
  it("aggregates count + revenue per package, sorted by count desc", () => {
    const data = [
      wash({ package_name: "Premium", payments: [{ amount: 200, paid_at: "2026-06-01T10:00:00" }] }),
      wash({ package_name: "Basic", payments: [{ amount: 50, paid_at: "2026-06-01T10:00:00" }] }),
      wash({ package_name: "Basic", payments: [{ amount: 50, paid_at: "2026-06-01T10:00:00" }] }),
    ]
    const res = topPackages(data)
    expect(res[0]).toEqual({ name: "Basic", count: 2, revenue: 100 })
    expect(res[1]).toEqual({ name: "Premium", count: 1, revenue: 200 })
  })

  it("buckets null package name under '—'", () => {
    const res = topPackages([wash({ package_name: null, payments: [] })])
    expect(res).toEqual([{ name: "—", count: 1, revenue: 0 }])
  })

  it("is empty for empty data", () => {
    expect(topPackages([])).toEqual([])
  })
})

describe("byBranch", () => {
  it("aggregates count + revenue per branch, sorted by revenue desc", () => {
    const data = [
      wash({ branch_name: "North", payments: [{ amount: 30, paid_at: "2026-06-01T10:00:00" }] }),
      wash({ branch_name: "South", payments: [{ amount: 300, paid_at: "2026-06-01T10:00:00" }] }),
    ]
    const res = byBranch(data)
    expect(res[0]).toEqual({ name: "South", count: 1, revenue: 300 })
    expect(res[1]).toEqual({ name: "North", count: 1, revenue: 30 })
  })

  it("is empty for empty data", () => {
    expect(byBranch([])).toEqual([])
  })
})

describe("cancellationsByReason", () => {
  it("counts only cancelled washes grouped by reason", () => {
    const data = [
      wash({ status: "cancelled", cancellation_reason: "Customer left" }),
      wash({ status: "cancelled", cancellation_reason: "Customer left" }),
      wash({ status: "cancelled", cancellation_reason: "Vehicle issue" }),
      wash({ status: "done", cancellation_reason: null }),
    ]
    const res = cancellationsByReason(data)
    expect(res[0]).toEqual({ reason: "Customer left", count: 2 })
    expect(res[1]).toEqual({ reason: "Vehicle issue", count: 1 })
    expect(res).toHaveLength(2)
  })

  it("buckets blank/missing reasons under '—'", () => {
    const data = [
      wash({ status: "cancelled", cancellation_reason: "   " }),
      wash({ status: "cancelled", cancellation_reason: null }),
    ]
    expect(cancellationsByReason(data)).toEqual([{ reason: "—", count: 2 }])
  })

  it("is empty when there are no cancellations", () => {
    expect(cancellationsByReason([wash({ status: "done" })])).toEqual([])
    expect(cancellationsByReason([])).toEqual([])
  })
})

describe("topEmployees", () => {
  it("counts completed washes per employee, sorted desc", () => {
    const data = [
      wash({ status: "done", employee_name: "Ali" }),
      wash({ status: "done", employee_name: "Ali" }),
      wash({ status: "done", employee_name: "Sara" }),
      // not done → ignored even though it has an employee
      wash({ status: "in_progress", employee_name: "Ali" }),
      // done but no employee → ignored
      wash({ status: "done", employee_name: null }),
    ]
    const res = topEmployees(data)
    expect(res[0]).toEqual({ name: "Ali", count: 2 })
    expect(res[1]).toEqual({ name: "Sara", count: 1 })
    expect(res).toHaveLength(2)
  })

  it("is empty for empty data", () => {
    expect(topEmployees([])).toEqual([])
  })
})

// ── Bundle / empty-safety ───────────────────────────────────────────────────────

describe("computeWashStats", () => {
  it("returns a fully-zeroed bundle for empty data without throwing", () => {
    const s = computeWashStats([])
    expect(s.kpis.revenue).toBe(0)
    expect(s.kpis.avgTicket).toBeNull()
    expect(s.revenueByDay).toEqual([])
    expect(s.washesByDay).toEqual([])
    expect(s.washesByWeekday).toHaveLength(7)
    expect(s.washesByHour).toHaveLength(24)
    expect(s.statusBreakdown).toEqual({ waiting: 0, in_progress: 0, done: 0, cancelled: 0 })
    expect(s.topPackages).toEqual([])
    expect(s.byBranch).toEqual([])
    expect(s.cancellationsByReason).toEqual([])
    expect(s.topEmployees).toEqual([])
  })

  it("wires every aggregation together", () => {
    const data = [
      wash({ status: "done", branch_name: "Main", package_name: "Basic" }),
      wash({ status: "cancelled", cancellation_reason: "Mistake", payments: [] }),
    ]
    const s = computeWashStats(data)
    expect(s.kpis.washCount).toBe(2)
    expect(s.kpis.doneCount).toBe(1)
    expect(s.statusBreakdown.done).toBe(1)
    expect(s.statusBreakdown.cancelled).toBe(1)
    expect(s.topPackages.length).toBeGreaterThan(0)
    expect(s.byBranch.length).toBeGreaterThan(0)
    expect(s.cancellationsByReason).toEqual([{ reason: "Mistake", count: 1 }])
  })
})
