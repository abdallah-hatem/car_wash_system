import { describe, it, expect } from "vitest"
import en from "./locales/en.json"
import ar from "./locales/ar.json"

function keyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    return v && typeof v === "object"
      ? keyPaths(v as Record<string, unknown>, path)
      : [path]
  })
}

describe("locale parity", () => {
  it("en and ar have identical key sets", () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(ar).sort())
  })
})
