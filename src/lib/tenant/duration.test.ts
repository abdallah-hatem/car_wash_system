import { describe, it, expect } from "vitest"
import { diffMinutes, formatDuration, defaultDateRange, dayRangeToBounds } from "./duration"

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
