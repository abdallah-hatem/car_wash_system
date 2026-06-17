import { describe, it, expect } from "vitest"
import {
  parseClaims,
  decodeClaims,
  EMPTY_CLAIMS,
  isOwner,
  canView,
  canEdit,
  visibleBranches,
  type AppClaims,
} from "./claims"

describe("parseClaims", () => {
  it("extracts tenant_id, role, admin flag, branch_ids and permissions", () => {
    const payload = {
      tenant_id: "00000000-0000-0000-0000-00000000aaaa",
      app_role: "manager",
      is_platform_admin: false,
      branch_ids: ["b1", "b2"],
      permissions: { queue: "edit", packages: "view" },
    }
    expect(parseClaims(payload)).toEqual({
      tenantId: "00000000-0000-0000-0000-00000000aaaa",
      role: "manager",
      isPlatformAdmin: false,
      branchIds: ["b1", "b2"],
      permissions: { queue: "edit", packages: "view" },
    })
  })

  it("returns safe defaults when claims are absent", () => {
    expect(parseClaims({})).toEqual({
      tenantId: null,
      role: null,
      isPlatformAdmin: false,
      branchIds: [],
      permissions: {},
    })
  })

  it("ignores malformed branch_ids and permission values", () => {
    const parsed = parseClaims({
      branch_ids: ["ok", 42, null] as unknown[],
      permissions: { queue: "edit", bogus: "frobnicate", staff: 7 } as Record<string, unknown>,
    })
    expect(parsed.branchIds).toEqual(["ok"])
    expect(parsed.permissions).toEqual({ queue: "edit" })
  })

  it("tolerates non-object permissions / non-array branch_ids", () => {
    const parsed = parseClaims({ branch_ids: "nope", permissions: "nope" })
    expect(parsed.branchIds).toEqual([])
    expect(parsed.permissions).toEqual({})
  })
})

describe("decodeClaims", () => {
  it("returns EMPTY_CLAIMS for a null session", () => {
    expect(decodeClaims(null)).toEqual(EMPTY_CLAIMS)
  })

  it("parses claims from a valid JWT-shaped token", () => {
    const payloadJson = JSON.stringify({
      tenant_id: "00000000-0000-0000-0000-00000000bbbb",
      app_role: "owner",
      is_platform_admin: false,
      branch_ids: [],
      permissions: {},
    })
    const access_token = `header.${btoa(payloadJson)}.sig`
    expect(decodeClaims({ access_token })).toEqual({
      tenantId: "00000000-0000-0000-0000-00000000bbbb",
      role: "owner",
      isPlatformAdmin: false,
      branchIds: [],
      permissions: {},
    })
  })

  it("returns EMPTY_CLAIMS for a malformed access_token without throwing", () => {
    expect(decodeClaims({ access_token: "not.a.jwt" })).toEqual(EMPTY_CLAIMS)
    expect(decodeClaims({ access_token: "garbage" })).toEqual(EMPTY_CLAIMS)
  })

  it("returns EMPTY_CLAIMS when the payload decodes but is not valid JSON", () => {
    const access_token = `header.${btoa("this-is-not-json")}.sig`
    expect(decodeClaims({ access_token })).toEqual(EMPTY_CLAIMS)
  })
})

const owner: AppClaims = { ...EMPTY_CLAIMS, role: "owner" }
const member: AppClaims = {
  ...EMPTY_CLAIMS,
  role: "manager",
  branchIds: ["b1"],
  permissions: { dashboard: "view", queue: "edit", packages: "view" },
}

describe("isOwner / canView / canEdit", () => {
  it("owner can view and edit every tab", () => {
    expect(isOwner(owner)).toBe(true)
    expect(canView(owner, "staff")).toBe(true)
    expect(canEdit(owner, "staff")).toBe(true)
    expect(canEdit(owner, "packages")).toBe(true)
  })

  it("member view requires view or edit on the tab", () => {
    expect(isOwner(member)).toBe(false)
    expect(canView(member, "dashboard")).toBe(true) // view
    expect(canView(member, "queue")).toBe(true) // edit implies view
    expect(canView(member, "packages")).toBe(true) // view
    expect(canView(member, "staff")).toBe(false) // missing → none
    expect(canView(member, "customers")).toBe(false) // missing → none
  })

  it("member edit requires edit on the tab", () => {
    expect(canEdit(member, "queue")).toBe(true) // edit
    expect(canEdit(member, "packages")).toBe(false) // only view
    expect(canEdit(member, "dashboard")).toBe(false) // only view
    expect(canEdit(member, "staff")).toBe(false) // none
  })
})

describe("visibleBranches", () => {
  const branches = [{ id: "b1" }, { id: "b2" }, { id: "b3" }]
  it("returns all branches for an owner", () => {
    expect(visibleBranches(owner, branches)).toEqual(branches)
  })
  it("returns only assigned branches for a member", () => {
    expect(visibleBranches(member, branches)).toEqual([{ id: "b1" }])
  })
  it("returns nothing when a member has no branches", () => {
    expect(visibleBranches({ ...EMPTY_CLAIMS, role: "manager" }, branches)).toEqual([])
  })
})
