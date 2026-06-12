import { describe, it, expect } from "vitest"
import { normalizePlate } from "./plate"

describe("normalizePlate", () => {
  it("trims, uppercases, and collapses inner whitespace", () => {
    expect(normalizePlate("  ab 123  ")).toBe("AB 123")
    expect(normalizePlate("abc123")).toBe("ABC123")
    expect(normalizePlate("a  b   c")).toBe("A B C")
    expect(normalizePlate("")).toBe("")
  })
})
