import { describe, it, expect } from "vitest"
import { dirForLang } from "./dir"
describe("dirForLang", () => {
  it("returns rtl for Arabic", () => {
    expect(dirForLang("ar")).toBe("rtl")
    expect(dirForLang("ar-EG")).toBe("rtl")
  })
  it("returns ltr for English and unknown", () => {
    expect(dirForLang("en")).toBe("ltr")
    expect(dirForLang("en-US")).toBe("ltr")
    expect(dirForLang("fr")).toBe("ltr")
    expect(dirForLang("")).toBe("ltr")
  })
})
