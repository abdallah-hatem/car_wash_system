import { describe, it, expect } from "vitest"
import {
  diffMinutes,
  formatDuration,
  defaultDateRange,
  dayRangeToBounds,
  formatYmd,
  parseYmd,
  presetRange,
} from "./duration"

describe("diffMinutes", () => {
  it("returns minutes between, null if either missing, clamps >= 0", () => {
    expect(diffMinutes("2026-06-12T10:00:00Z", "2026-06-12T10:45:00Z")).toBe(45)
    expect(diffMinutes("2026-06-12T10:00:00Z", null)).toBeNull()
    expect(diffMinutes(null, "2026-06-12T10:00:00Z")).toBeNull()
    expect(diffMinutes("2026-06-12T10:45:00Z", "2026-06-12T10:00:00Z")).toBe(0)
  })
})
describe("formatDuration", () => {
  it("formats minutes", () => {
    expect(formatDuration(null)).toBe("—")
    expect(formatDuration(45)).toBe("45m")
    expect(formatDuration(60)).toBe("1h")
    expect(formatDuration(65)).toBe("1h 5m")
  })
})
describe("defaultDateRange", () => {
  it("returns last 7 days inclusive as YYYY-MM-DD", () => {
    const r = defaultDateRange(new Date(2026, 5, 12)) // local June 12 2026
    expect(r.to).toBe("2026-06-12")
    expect(r.from).toBe("2026-06-06")
  })
})
describe("dayRangeToBounds", () => {
  it("expands to local start-of-from-day .. end-of-to-day", () => {
    const b = dayRangeToBounds("2026-06-06", "2026-06-12")
    expect(new Date(b.fromISO).getFullYear()).toBe(2026)
    // fromISO is local midnight of 06-06; toISO is local end-of-day of 06-12
    expect(new Date(b.toISO).getTime()).toBeGreaterThan(new Date(b.fromISO).getTime())
  })
})

describe("formatYmd / parseYmd", () => {
  it("round-trips without TZ drift", () => {
    // Fixed dates chosen to expose UTC-vs-local off-by-one
    const dates = [
      new Date(2026, 0, 1),   // Jan 1
      new Date(2026, 5, 13),  // June 13
      new Date(2026, 11, 31), // Dec 31
    ]
    for (const d of dates) {
      const s = formatYmd(d)
      const parsed = parseYmd(s)
      expect(parsed.getFullYear()).toBe(d.getFullYear())
      expect(parsed.getMonth()).toBe(d.getMonth())
      expect(parsed.getDate()).toBe(d.getDate())
    }
  })

  it("parseYmd does NOT use UTC (no off-by-one)", () => {
    // If it used `new Date("2026-06-13")` it would parse UTC midnight
    // which in any negative-UTC-offset TZ becomes June 12.
    const d = parseYmd("2026-06-13")
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)   // June = 5
    expect(d.getDate()).toBe(13)
  })
})

describe("presetRange", () => {
  const today = new Date(2026, 5, 13) // June 13, 2026

  it("today → single day", () => {
    expect(presetRange("today", today)).toEqual({ from: "2026-06-13", to: "2026-06-13" })
  })

  it("last7 → 7 days inclusive (June 7–13)", () => {
    expect(presetRange("last7", today)).toEqual({ from: "2026-06-07", to: "2026-06-13" })
  })

  it("last30 → 30 days inclusive (May 15–June 13)", () => {
    expect(presetRange("last30", today)).toEqual({ from: "2026-05-15", to: "2026-06-13" })
  })

  it("thisMonth → first of month to today", () => {
    expect(presetRange("thisMonth", today)).toEqual({ from: "2026-06-01", to: "2026-06-13" })
  })
})
