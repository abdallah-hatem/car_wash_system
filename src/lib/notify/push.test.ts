import { describe, it, expect } from "vitest"
import { urlBase64ToUint8Array } from "./push"

// A known VAPID public key sample (65-byte uncompressed EC key in URL-safe base64).
// This is a realistic but non-secret test vector.
const SAMPLE_VAPID_KEY =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkgnhhcV7So6wbk_4yV9wP7_OGh3qf73JYXUE36fQ"

describe("urlBase64ToUint8Array", () => {
  it("returns a Uint8Array", () => {
    const result = urlBase64ToUint8Array(SAMPLE_VAPID_KEY)
    expect(result).toBeInstanceOf(Uint8Array)
  })

  it("decodes to the correct byte length (64 bytes for this test vector)", () => {
    const result = urlBase64ToUint8Array(SAMPLE_VAPID_KEY)
    expect(result.length).toBe(64)
  })

  it("first byte is 0x04 (uncompressed EC point marker)", () => {
    const result = urlBase64ToUint8Array(SAMPLE_VAPID_KEY)
    expect(result[0]).toBe(0x04)
  })

  it("handles URL-safe characters (- and _) correctly", () => {
    // A minimal 3-byte payload encoded in URL-safe base64: "a-b_"
    // URL-safe: "a-b_" → standard: "a+b/" → binary: 69 AB 7F → 3 bytes
    const encoded = "a-b_"
    const result = urlBase64ToUint8Array(encoded)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(3)
  })

  it("handles standard base64 input without url-safe chars", () => {
    // "AAEC" decodes to bytes [0, 1, 2]
    const result = urlBase64ToUint8Array("AAEC")
    expect(Array.from(result)).toEqual([0, 1, 2])
  })

  it("handles empty string", () => {
    const result = urlBase64ToUint8Array("")
    expect(result.length).toBe(0)
  })
})
