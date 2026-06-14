import { describe, it, expect } from "vitest"
import {
  canTransition,
  amountPaid,
  isPaid,
  remaining,
  validateNewWash,
  validateCancelReason,
  availableEmployees,
} from "./operations"

describe("availableEmployees", () => {
  const e = (id: string, branch_id: string | null, is_active = true) => ({ id, branch_id, is_active })
  it("keeps active staff for the branch + unassigned floaters; drops other branches and inactive", () => {
    const list = [e("a", "b1"), e("b", "b2"), e("c", null), e("d", "b1", false), e("f", null, false)]
    expect(availableEmployees(list, "b1").map((x) => x.id)).toEqual(["a", "c"])
  })
  it("with no branch selected, returns only floaters", () => {
    const list = [e("a", "b1"), e("c", null)]
    expect(availableEmployees(list, null).map((x) => x.id)).toEqual(["c"])
  })
})

describe("canTransition", () => {
  it("allows the legal moves", () => {
    expect(canTransition("waiting", "in_progress")).toBe(true)
    expect(canTransition("in_progress", "done")).toBe(true)
    expect(canTransition("waiting", "cancelled")).toBe(true)
    expect(canTransition("in_progress", "cancelled")).toBe(true)
  })
  it("rejects illegal moves", () => {
    expect(canTransition("done", "in_progress")).toBe(false)
    expect(canTransition("cancelled", "waiting")).toBe(false)
    expect(canTransition("waiting", "done")).toBe(false)
    expect(canTransition("done", "cancelled")).toBe(false)
  })
})
describe("payment math", () => {
  const p = (n: number) => ({ amount: n })
  it("sums payments", () => {
    expect(amountPaid([])).toBe(0)
    expect(amountPaid([p(10), p(15)])).toBe(25)
  })
  it("isPaid when sum >= price", () => {
    expect(isPaid(25, [])).toBe(false)
    expect(isPaid(25, [p(10)])).toBe(false)
    expect(isPaid(25, [p(25)])).toBe(true)
    expect(isPaid(25, [p(30)])).toBe(true)
    expect(isPaid(25, [p(10), p(20)])).toBe(true)
  })
  it("remaining never negative", () => {
    expect(remaining(25, [])).toBe(25)
    expect(remaining(25, [p(10)])).toBe(15)
    expect(remaining(25, [p(30)])).toBe(0)
  })
})
describe("validateNewWash", () => {
  it("requires a package", () => {
    expect(validateNewWash({ package_id: "", price: 10, vehicle_id: "v1" })).toBe("package_required")
  })
  it("requires a positive price", () => {
    expect(validateNewWash({ package_id: "p1", price: 0, vehicle_id: "v1" })).toBe("price_invalid")
  })
  it("requires a vehicle (selected or new)", () => {
    expect(validateNewWash({ package_id: "p1", price: 25 })).toBe("vehicle_required")
    expect(validateNewWash({ package_id: "p1", price: 25, vehicle_id: null })).toBe("vehicle_required")
  })
  it("passes when vehicle is selected by id", () => {
    expect(validateNewWash({ package_id: "p1", price: 25, vehicle_id: "v1" })).toBeNull()
  })
  it("passes when a new vehicle is being created", () => {
    expect(validateNewWash({ package_id: "p1", price: 25, has_new_vehicle: true })).toBeNull()
  })
})
describe("validateCancelReason", () => {
  it("returns true for non-empty reason, false for empty/whitespace", () => {
    expect(validateCancelReason("customer left")).toBe(true)
    expect(validateCancelReason("  ")).toBe(false)
    expect(validateCancelReason("")).toBe(false)
  })
})
