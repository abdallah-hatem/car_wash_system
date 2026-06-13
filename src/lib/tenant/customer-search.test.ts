import { describe, it, expect } from "vitest"
import { dedupeIds } from "./customer-search"

describe("dedupeIds", () => {
  it("returns empty array for no lists", () => {
    expect(dedupeIds()).toEqual([])
  })

  it("returns ids from a single list unchanged", () => {
    expect(dedupeIds(["a", "b", "c"])).toEqual(["a", "b", "c"])
  })

  it("dedupes within a single list preserving first occurrence", () => {
    expect(dedupeIds(["a", "b", "a", "c"])).toEqual(["a", "b", "c"])
  })

  it("unions multiple lists, preserving order and deduping across them", () => {
    expect(dedupeIds(["a", "b"], ["b", "c"], ["c", "d"])).toEqual(["a", "b", "c", "d"])
  })

  it("first list takes precedence for duplicates", () => {
    const result = dedupeIds(["id1", "id2"], ["id3", "id1"])
    expect(result).toEqual(["id1", "id2", "id3"])
  })

  it("handles empty lists among non-empty ones", () => {
    expect(dedupeIds([], ["x", "y"], [])).toEqual(["x", "y"])
  })

  it("handles all empty lists", () => {
    expect(dedupeIds([], [], [])).toEqual([])
  })

  it("stable order: name hits, then phone-only, then plate-only", () => {
    // simulating name/phone/plate id lists as they come from matchingCustomerIds
    const nameIds = ["c1", "c2"]
    const phoneIds = ["c3", "c1"] // c1 already seen
    const plateIds = ["c4", "c2"] // c2 already seen
    expect(dedupeIds(nameIds, phoneIds, plateIds)).toEqual(["c1", "c2", "c3", "c4"])
  })
})
