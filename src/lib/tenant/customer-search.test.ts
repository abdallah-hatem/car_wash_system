import { describe, it, expect } from "vitest"
import { mergeCustomerResults } from "./customer-search"

describe("mergeCustomerResults", () => {
  it("name-only hit: returns customer with matched_plate null", () => {
    const result = mergeCustomerResults(
      [{ id: "c1", name: "Ahmed Ali", phone: "0500000001" }],
      [],
    )
    expect(result).toEqual([
      { id: "c1", name: "Ahmed Ali", phone: "0500000001", matched_plate: null },
    ])
  })

  it("plate-only hit: adds the customer with matched_plate set", () => {
    const result = mergeCustomerResults(
      [],
      [
        {
          plate_number: "أبج 123",
          customer: { id: "c2", name: "Khalid", phone: null },
        },
      ],
    )
    expect(result).toEqual([
      { id: "c2", name: "Khalid", phone: null, matched_plate: "أبج 123" },
    ])
  })

  it("overlap: customer from both sources — deduped, matched_plate filled", () => {
    const result = mergeCustomerResults(
      [{ id: "c3", name: "Sara", phone: "0501234567" }],
      [
        {
          plate_number: "دهو 456",
          customer: { id: "c3", name: "Sara", phone: "0501234567" },
        },
      ],
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: "c3",
      name: "Sara",
      phone: "0501234567",
      matched_plate: "دهو 456",
    })
  })

  it("null-customer plate hit: skipped (not included in results)", () => {
    const result = mergeCustomerResults(
      [],
      [{ plate_number: "مطو 789", customer: null }],
    )
    expect(result).toHaveLength(0)
  })

  it("stable order: name/phone hits first, then plate-only hits", () => {
    const result = mergeCustomerResults(
      [{ id: "c1", name: "First", phone: null }],
      [
        { plate_number: "أبج 1", customer: { id: "c2", name: "Second", phone: null } },
        { plate_number: "دهو 2", customer: { id: "c1", name: "First", phone: null } },
      ],
    )
    expect(result[0].id).toBe("c1") // name/phone hit first
    expect(result[1].id).toBe("c2") // plate-only hit after
    expect(result[0].matched_plate).toBe("دهو 2") // plate filled on the overlap
  })

  it("multiple name/phone hits dedupe correctly", () => {
    const result = mergeCustomerResults(
      [
        { id: "c1", name: "Alice", phone: "111" },
        { id: "c2", name: "Bob", phone: "222" },
        { id: "c1", name: "Alice", phone: "111" }, // duplicate
      ],
      [],
    )
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id)).toEqual(["c1", "c2"])
  })
})
