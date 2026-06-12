import { describe, it, expect } from "vitest"
import { pageToRange, pagerInfo } from "./pagination"

describe("pageToRange", () => {
  it("maps 0-based page + size to inclusive range", () => {
    expect(pageToRange(0, 20)).toEqual({ from: 0, to: 19 })
    expect(pageToRange(2, 20)).toEqual({ from: 40, to: 59 })
  })
})
describe("pagerInfo", () => {
  it("computes item range + boundaries", () => {
    expect(pagerInfo(0, 20, 45)).toEqual({ fromItem: 1, toItem: 20, total: 45, pageCount: 3, hasPrev: false, hasNext: true })
    expect(pagerInfo(2, 20, 45)).toEqual({ fromItem: 41, toItem: 45, total: 45, pageCount: 3, hasPrev: true, hasNext: false })
    expect(pagerInfo(0, 20, 0)).toEqual({ fromItem: 0, toItem: 0, total: 0, pageCount: 0, hasPrev: false, hasNext: false })
  })
})
