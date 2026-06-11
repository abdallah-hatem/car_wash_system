import { describe, it, expect } from "vitest"
import { validateBranch, validatePackage, validateEmployee } from "./validators"

describe("validateBranch", () => {
  it("requires a name", () => {
    expect(validateBranch({ name: "" })).toBe("name_required")
    expect(validateBranch({ name: "Main" })).toBeNull()
  })
})
describe("validatePackage", () => {
  it("requires name and positive price", () => {
    expect(validatePackage({ name: "", price: 10 })).toBe("name_required")
    expect(validatePackage({ name: "Basic", price: 0 })).toBe("price_invalid")
    expect(validatePackage({ name: "Basic", price: -5 })).toBe("price_invalid")
    expect(validatePackage({ name: "Basic", price: 25 })).toBeNull()
  })
})
describe("validateEmployee", () => {
  it("requires a name", () => {
    expect(validateEmployee({ name: "" })).toBe("name_required")
    expect(validateEmployee({ name: "Sam" })).toBeNull()
  })
})
