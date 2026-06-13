import { describe, it, expect } from "vitest"
import { validateCreate } from "./admin"

describe("validateCreate", () => {
  it("returns null for a valid input", () => {
    expect(
      validateCreate({
        businessName: "Speedy Wash",
        ownerEmail: "owner@example.com",
        ownerFullName: "John Doe",
      }),
    ).toBeNull()
  })

  it("returns 'missing_fields' when businessName is blank", () => {
    expect(
      validateCreate({
        businessName: "   ",
        ownerEmail: "owner@example.com",
        ownerFullName: "John Doe",
      }),
    ).toBe("missing_fields")
  })

  it("returns 'missing_fields' when businessName is absent", () => {
    expect(
      validateCreate({
        ownerEmail: "owner@example.com",
        ownerFullName: "John Doe",
      }),
    ).toBe("missing_fields")
  })

  it("returns 'missing_fields' for a bad email (no @)", () => {
    expect(
      validateCreate({
        businessName: "Speedy Wash",
        ownerEmail: "not-an-email",
        ownerFullName: "John Doe",
      }),
    ).toBe("missing_fields")
  })

  it("returns 'missing_fields' for a bad email (no domain)", () => {
    expect(
      validateCreate({
        businessName: "Speedy Wash",
        ownerEmail: "user@",
        ownerFullName: "John Doe",
      }),
    ).toBe("missing_fields")
  })

  it("returns null for a valid email without ownerFullName (not required by validator)", () => {
    expect(
      validateCreate({
        businessName: "Speedy Wash",
        ownerEmail: "user@domain.co",
      }),
    ).toBeNull()
  })
})
