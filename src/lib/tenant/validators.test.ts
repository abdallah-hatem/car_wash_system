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

import { validateCustomer, validateVehicle, validateEgyptianPlate } from "./validators"
describe("validateCustomer", () => {
  it("requires a name", () => {
    expect(validateCustomer({ name: "" })).toBe("name_required")
    expect(validateCustomer({ name: "Ali" })).toBeNull()
  })
})
describe("validateVehicle", () => {
  it("requires a plate", () => {
    expect(validateVehicle({ plate_number: "" })).toBe("plate_required")
    expect(validateVehicle({ plate_number: "ABC123" })).toBeNull()
  })
})
describe("validateEgyptianPlate", () => {
  it("requires exactly 3 Arabic letters and 1-4 digits", () => {
    expect(validateEgyptianPlate({ letters: "أبج", digits: "123" })).toBeNull()
    expect(validateEgyptianPlate({ letters: "أب", digits: "123" })).toBe("letters_required")
    expect(validateEgyptianPlate({ letters: "أبجد", digits: "123" })).toBe("letters_required")
    expect(validateEgyptianPlate({ letters: "abج", digits: "123" })).toBe("letters_required")
    expect(validateEgyptianPlate({ letters: "أبج", digits: "" })).toBe("digits_required")
    expect(validateEgyptianPlate({ letters: "أبج", digits: "12345" })).toBe("digits_required")
  })
})
