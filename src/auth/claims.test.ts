import { describe, it, expect } from "vitest"
import { parseClaims } from "./claims"

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

  it("returns null claims for malformed/garbage input", () => {
    // parseClaims itself is pure — no atob/JSON.parse — so we just verify
    // that unknown/unexpected values don't blow up and return safe defaults
    expect(parseClaims({ tenant_id: undefined, role: undefined, is_platform_admin: undefined })).toEqual({
      tenantId: null,
      role: null,
      isPlatformAdmin: false,
    })
  })
})
