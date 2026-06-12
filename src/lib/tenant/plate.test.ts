import { describe, it, expect } from "vitest"
import { normalizePlate, normalizePlateDigits, normalizePlateLetters, isArabicLetter, canonicalPlate, normalizePlateSearch, formatPlate } from "./plate"

describe("normalizePlate", () => {
  it("trims, uppercases, and collapses inner whitespace", () => {
    expect(normalizePlate("  ab 123  ")).toBe("AB 123")
    expect(normalizePlate("abc123")).toBe("ABC123")
    expect(normalizePlate("a  b   c")).toBe("A B C")
    expect(normalizePlate("")).toBe("")
  })
})

describe("normalizePlateDigits", () => {
  it("maps Arabic-Indic to Western and strips non-digits", () => {
    expect(normalizePlateDigits("١٢٣")).toBe("123")
    expect(normalizePlateDigits("12 34")).toBe("1234")
    expect(normalizePlateDigits(" ٤٥٦ ")).toBe("456")
    expect(normalizePlateDigits("a1b2")).toBe("12")
  })
})
describe("normalizePlateLetters", () => {
  it("trims and removes spaces/tatweel", () => {
    expect(normalizePlateLetters(" أ ب ج ")).toBe("أبج")
    expect(normalizePlateLetters("أـب")).toBe("أب") // tatweel removed
  })
})
describe("isArabicLetter", () => {
  it("detects single Arabic letters", () => {
    expect(isArabicLetter("أ")).toBe(true)
    expect(isArabicLetter("ب")).toBe(true)
    expect(isArabicLetter("a")).toBe(false)
    expect(isArabicLetter("1")).toBe(false)
  })
})
describe("canonicalPlate", () => {
  it("joins normalized letters + western digits", () => {
    expect(canonicalPlate("أبج", "١٢٣")).toBe("أبج 123")
    expect(canonicalPlate(" أ ب ج ", "12")).toBe("أبج 12")
  })
})
describe("normalizePlateSearch", () => {
  it("normalizes digits and trims for searching", () => {
    expect(normalizePlateSearch("١٢٣")).toBe("123")
    expect(normalizePlateSearch("  أبج ")).toBe("أبج")
  })
})
describe("formatPlate", () => {
  it("EN keeps Western digits with spaced letters", () => {
    expect(formatPlate("أبج", "123", "en")).toBe("أ ب ج  123")
  })
  it("AR maps digits to Arabic-Indic", () => {
    expect(formatPlate("أبج", "123", "ar")).toBe("أ ب ج  ١٢٣")
  })
})
