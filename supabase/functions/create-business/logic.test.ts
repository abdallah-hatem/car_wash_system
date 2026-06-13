import {
  assertEquals,
  assertObjectMatch,
} from "jsr:@std/assert@1";
import { tempPassword, validateInput } from "./logic.ts";

Deno.test("tempPassword: >=12 chars with upper, lower, digit", () => {
  for (let i = 0; i < 50; i++) {
    const pw = tempPassword();
    if (pw.length < 12) {
      throw new Error(`too short: ${pw}`);
    }
    if (!/[A-Z]/.test(pw)) throw new Error(`no uppercase: ${pw}`);
    if (!/[a-z]/.test(pw)) throw new Error(`no lowercase: ${pw}`);
    if (!/[0-9]/.test(pw)) throw new Error(`no digit: ${pw}`);
  }
});

Deno.test("validateInput: rejects blank businessName", () => {
  const r = validateInput({
    businessName: "   ",
    ownerEmail: "a@b.com",
    ownerFullName: "A",
  });
  assertObjectMatch(r, { error: "missing_fields" });
});

Deno.test("validateInput: rejects bad email", () => {
  const r = validateInput({
    businessName: "Acme",
    ownerEmail: "not-an-email",
    ownerFullName: "A",
  });
  assertObjectMatch(r, { error: "missing_fields" });
});

Deno.test("validateInput: rejects missing email", () => {
  const r = validateInput({ businessName: "Acme" });
  assertObjectMatch(r, { error: "missing_fields" });
});

Deno.test("validateInput: rejects non-object body", () => {
  assertObjectMatch(validateInput(null), { error: "missing_fields" });
  assertObjectMatch(validateInput("nope"), { error: "missing_fields" });
});

Deno.test("validateInput: accepts and trims valid input", () => {
  const r = validateInput({
    businessName: "  Acme Wash  ",
    ownerEmail: "  acme@owner.test  ",
    ownerFullName: "  Acme Owner  ",
  });
  assertEquals(r, {
    businessName: "Acme Wash",
    ownerEmail: "acme@owner.test",
    ownerFullName: "Acme Owner",
  });
});
