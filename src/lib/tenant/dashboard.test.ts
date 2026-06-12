import { describe, it, expect } from "vitest"
import { sumPayments, summarizeStatuses, startOfDay } from "./dashboard"

describe("sumPayments", () => {
  it("sums amounts (0 when empty, handles numeric strings)", () => {
    expect(sumPayments([])).toBe(0)
    expect(sumPayments([{ amount: 10 }, { amount: 15.5 }])).toBe(25.5)
    expect(sumPayments([{ amount: 20 as unknown as number }, { amount: 5 }])).toBe(25)
  })
})
describe("summarizeStatuses", () => {
  it("counts each status, zero-filled", () => {
    expect(summarizeStatuses([])).toEqual({ waiting: 0, in_progress: 0, done: 0, cancelled: 0 })
    expect(summarizeStatuses([
      { status: "waiting" }, { status: "waiting" }, { status: "done" }, { status: "cancelled" },
    ])).toEqual({ waiting: 2, in_progress: 0, done: 1, cancelled: 1 })
  })
})
describe("startOfDay", () => {
  it("returns local midnight of the given date", () => {
    const d = new Date(2026, 5, 12, 15, 30, 0) // local June 12 2026 15:30
    const s = startOfDay(d)
    expect(s.getFullYear()).toBe(2026)
    expect(s.getMonth()).toBe(5)
    expect(s.getDate()).toBe(12)
    expect(s.getHours()).toBe(0)
    expect(s.getMinutes()).toBe(0)
    expect(s.getSeconds()).toBe(0)
  })
})
