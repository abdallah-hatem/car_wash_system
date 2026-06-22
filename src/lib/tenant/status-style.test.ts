import { describe, it, expect } from "vitest"
import { statusBadgeClass } from "./status-style"
import type { WashStatus } from "./operations"

const STATUSES: WashStatus[] = ["waiting", "in_progress", "done", "cancelled"]

describe("statusBadgeClass", () => {
  it("returns a non-empty class string for every WashStatus", () => {
    for (const status of STATUSES) {
      const cls = statusBadgeClass(status)
      expect(cls, `statusBadgeClass("${status}") should not be empty`).toBeTruthy()
    }
  })

  it("waiting → amber classes", () => {
    expect(statusBadgeClass("waiting")).toContain("amber")
  })

  it("in_progress → blue classes", () => {
    expect(statusBadgeClass("in_progress")).toContain("blue")
  })

  it("done → green classes", () => {
    expect(statusBadgeClass("done")).toContain("green")
  })

  it("cancelled → red classes", () => {
    expect(statusBadgeClass("cancelled")).toContain("red")
  })

  it("each status has distinct colors from the others", () => {
    const classes = STATUSES.map((s) => statusBadgeClass(s))
    const unique = new Set(classes)
    expect(unique.size).toBe(STATUSES.length)
  })
})
