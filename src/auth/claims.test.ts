import { describe, it, expect } from "vitest"
import { parseClaims, decodeClaims, EMPTY_CLAIMS } from "./claims"

describe("parseClaims", () => {
  it("extracts tenant_id, role, and admin flag from a decoded JWT payload", () => {
    const payload = {
      tenant_id: "00000000-0000-0000-0000-00000000aaaa",
      role: "owner",
      is_platform_admin: false,
    }
    expect(parseClaims(payload)).toEqual({
      tenantId: "00000000-0000-0000-0000-00000000aaaa",
      role: "owner",
      isPlatformAdmin: false,
    })
  })

  it("returns nulls when claims are absent", () => {
    expect(parseClaims({})).toEqual({
      tenantId: null,
      role: null,
      isPlatformAdmin: false,
    })
  })

  it("returns safe defaults when claim fields are undefined", () => {
    // parseClaims itself is pure — no atob/JSON.parse — so we just verify
    // that unknown/unexpected values don't blow up and return safe defaults
    expect(parseClaims({ tenant_id: undefined, role: undefined, is_platform_admin: undefined })).toEqual({
      tenantId: null,
      role: null,
      isPlatformAdmin: false,
    })
  })
})

describe("decodeClaims", () => {
  it("returns EMPTY_CLAIMS for a null session", () => {
    expect(decodeClaims(null)).toEqual(EMPTY_CLAIMS)
  })

  it("correctly parses claims from a valid JWT-shaped token", () => {
    const payloadJson = JSON.stringify({
      tenant_id: "00000000-0000-0000-0000-00000000bbbb",
      role: "owner",
      is_platform_admin: false,
    })
    const payload = btoa(payloadJson)
    const access_token = `header.${payload}.sig`
    expect(decodeClaims({ access_token })).toEqual({
      tenantId: "00000000-0000-0000-0000-00000000bbbb",
      role: "owner",
      isPlatformAdmin: false,
    })
  })

  it("returns EMPTY_CLAIMS for a malformed/garbage access_token without throwing", () => {
    expect(decodeClaims({ access_token: "not.a.jwt" })).toEqual(EMPTY_CLAIMS)
    expect(decodeClaims({ access_token: "garbage" })).toEqual(EMPTY_CLAIMS)
  })

  it("returns EMPTY_CLAIMS when the token payload segment decodes but is not valid JSON", () => {
    // base64-encode a non-JSON string so atob succeeds but JSON.parse fails
    const access_token = `header.${btoa("this-is-not-json")}.sig`
    expect(decodeClaims({ access_token })).toEqual(EMPTY_CLAIMS)
  })
})
