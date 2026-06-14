import { describe, it, expect } from "vitest"
import { normalizePhone, isValidEgyptianMobile, formatPhoneForStore } from "./phone"

describe("normalizePhone", () => {
  it("converts Arabic-Indic digits to Western", () => {
    expect(normalizePhone("٠١٠١٢٣٤٥٦٧٨")).toBe("01012345678")
  })
  it("strips spaces, dashes, and parentheses", () => {
    expect(normalizePhone("010 123-456-78")).toBe("01012345678")
    expect(normalizePhone("(010) 123 45678")).toBe("01012345678")
  })
  it("handles empty string", () => {
    expect(normalizePhone("")).toBe("")
  })
})

describe("isValidEgyptianMobile", () => {
  it("accepts valid 010 number", () => {
    expect(isValidEgyptianMobile("01012345678")).toBe(true)
  })
  it("accepts valid 011 number", () => {
    expect(isValidEgyptianMobile("01112345678")).toBe(true)
  })
  it("accepts valid 012 number", () => {
    expect(isValidEgyptianMobile("01212345678")).toBe(true)
  })
  it("accepts valid 015 number", () => {
    expect(isValidEgyptianMobile("01512345678")).toBe(true)
  })
  it("accepts Arabic-Indic digit equivalent of 01012345678", () => {
    expect(isValidEgyptianMobile("٠١٠١٢٣٤٥٦٧٨")).toBe(true)
  })
  it("rejects short number", () => {
    expect(isValidEgyptianMobile("0123")).toBe(false)
  })
  it("rejects wrong prefix (020…)", () => {
    expect(isValidEgyptianMobile("02012345678")).toBe(false)
  })
  it("rejects wrong prefix (013…)", () => {
    expect(isValidEgyptianMobile("01312345678")).toBe(false)
  })
  it("rejects number with letters", () => {
    expect(isValidEgyptianMobile("0101234567a")).toBe(false)
  })
  it("rejects empty string", () => {
    expect(isValidEgyptianMobile("")).toBe(false)
  })
})

describe("formatPhoneForStore", () => {
  it("returns normalized digits-only form", () => {
    expect(formatPhoneForStore("010 123-456-78")).toBe("01012345678")
    expect(formatPhoneForStore("٠١٠١٢٣٤٥٦٧٨")).toBe("01012345678")
  })
})
