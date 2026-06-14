import { describe, it, expect } from "vitest"
import { normalizePhone, isValidEgyptianMobile, formatPhoneForStore, sanitizePhoneInput } from "./phone"

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

describe("sanitizePhoneInput", () => {
  it("converts Arabic-Indic digits to Western digits", () => {
    expect(sanitizePhoneInput("٠١٠١٢٣٤٥٦٧٨")).toBe("01012345678")
  })
  it("strips letters", () => {
    expect(sanitizePhoneInput("01a2b3c")).toBe("0123")
  })
  it("strips symbols and spaces", () => {
    expect(sanitizePhoneInput("010-123 456")).toBe("010123456")
  })
  it("strips parentheses and dashes", () => {
    expect(sanitizePhoneInput("(010) 123-45678")).toBe("01012345678")
  })
  it("truncates to 11 digits", () => {
    expect(sanitizePhoneInput("012345678901234")).toBe("01234567890")
  })
  it("mixed Arabic-Indic and Western digits truncated to 11", () => {
    expect(sanitizePhoneInput("٠١٠١٢٣٤٥٦٧٨٩٠")).toBe("01012345678")
  })
  it("returns empty string for empty input", () => {
    expect(sanitizePhoneInput("")).toBe("")
  })
  it("returns empty string when all chars are non-digits", () => {
    expect(sanitizePhoneInput("abc-xyz")).toBe("")
  })
  it("preserves exactly 11 Western digits unchanged", () => {
    expect(sanitizePhoneInput("01012345678")).toBe("01012345678")
  })
})
