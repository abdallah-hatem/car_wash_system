# Egyptian License Plate Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Model vehicle plates as Egyptian plates (3 Arabic letters + 1–4 digits) with per-tenant uniqueness and a structured input field, replacing the free-text plate. Tested, i18n/RTL/responsive.

**Architecture:** New structured columns (`plate_letters`, `plate_digits`) + a unique index; `plate_number` kept as the derived canonical display. Pure normalization/validation helpers (unit-tested). A `PlateInput` component used by the vehicle dialog and new-wash form. Data layer computes the canonical plate and maps DB unique violations to a friendly error.

**Tech Stack:** React + Vite + TS, Tailwind v3 + shadcn (v2), react-i18next, supabase-js, Vitest, pgTAP.

**Existing context:**
- `src/lib/tenant/plate.ts` (has `normalizePlate`); `src/lib/tenant/vehicles.ts` (`createVehicle` returns id, `updateVehicle`, `searchVehiclesByPlate`, `Vehicle`/`PlateMatch`); `src/lib/tenant/validators.ts` (`validateVehicle`).
- `src/components/tenant/VehicleDialog.tsx` (3B, create/edit vehicle for a customer); `src/components/tenant/CustomerDetailDialog.tsx` uses it; `src/components/tenant/NewWashDialog.tsx` (3C, has a "create new vehicle" path with a plate input).
- Schema `vehicles(id,tenant_id,customer_id,plate_number,make,model,color,created_at)` + index `vehicles_tenant_plate_idx (tenant_id,plate_number)`. Migrations latest = `0011`. Tests latest = `0014`.
- `supabase/seed.sql` seeds Demo Carwash + Main Branch.
- i18n `src/i18n/locales/{en,ar}.json` + parity test. CLAUDE.md standing rules (i18n/RTL/responsive; pgTAP scope assertions; gate push on green).

**File structure:**
- Modify: `src/lib/tenant/plate.ts` (+ `plate.test.ts`), `src/lib/tenant/validators.ts`
- Create: `supabase/migrations/0012_egyptian_plate.sql`; modify `supabase/seed.sql`
- Create: `src/components/tenant/PlateInput.tsx`
- Modify: `src/lib/tenant/vehicles.ts`, `src/components/tenant/VehicleDialog.tsx`, `src/components/tenant/NewWashDialog.tsx`, `src/lib/database.types.ts` (regenerate), `src/i18n/locales/{en,ar}.json`
- Create: `supabase/tests/0015_plate_unique_test.sql`
- Modify: `docs/BUSINESS_LOGIC.md`

---

## Task 1: Pure plate helpers (TDD) + i18n keys

**Files:** Modify `src/lib/tenant/plate.ts`, `src/lib/tenant/plate.test.ts`, `src/lib/tenant/validators.ts`, `src/lib/tenant/validators.test.ts`, `src/i18n/locales/{en,ar}.json`.

- [ ] **Step 1: Failing tests** — append to `src/lib/tenant/plate.test.ts`:
```ts
import { normalizePlateDigits, normalizePlateLetters, isArabicLetter, canonicalPlate, normalizePlateSearch } from "./plate"

describe("normalizePlateDigits", () => {
  it("maps Arabic-Indic to Western and strips non-digits", () => {
    expect(normalizePlateDigits("١٢٣")).toBe("123")
    expect(normalizePlateDigits("12 34")).toBe("1234")
    expect(normalizePlateDigits(" ٤٥٦ ")).toBe("456")
    expect(normalizePlateDigits("a1b2")).toBe("12")
  })
})
describe("normalizePlateLetters", () => {
  it("trims and removes spaces/tatweel", () => {
    expect(normalizePlateLetters(" أ ب ج ")).toBe("أبج")
    expect(normalizePlateLetters("أـب")).toBe("أب") // tatweel removed
  })
})
describe("isArabicLetter", () => {
  it("detects single Arabic letters", () => {
    expect(isArabicLetter("أ")).toBe(true)
    expect(isArabicLetter("ب")).toBe(true)
    expect(isArabicLetter("a")).toBe(false)
    expect(isArabicLetter("1")).toBe(false)
  })
})
describe("canonicalPlate", () => {
  it("joins normalized letters + western digits", () => {
    expect(canonicalPlate("أبج", "١٢٣")).toBe("أبج 123")
    expect(canonicalPlate(" أ ب ج ", "12")).toBe("أبج 12")
  })
})
describe("normalizePlateSearch", () => {
  it("normalizes digits and trims for searching", () => {
    expect(normalizePlateSearch("١٢٣")).toBe("123")
    expect(normalizePlateSearch("  أبج ")).toBe("أبج")
  })
})
```
Append to `src/lib/tenant/validators.test.ts`:
```ts
import { validateEgyptianPlate } from "./validators"
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
```

- [ ] **Step 2: Run `npm test` — FAIL.**

- [ ] **Step 3: Implement** — append to `src/lib/tenant/plate.ts`:
```ts
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩"

export function normalizePlateDigits(s: string): string {
  return [...(s ?? "")]
    .map((ch) => {
      const ai = ARABIC_INDIC.indexOf(ch)
      return ai >= 0 ? String(ai) : ch
    })
    .join("")
    .replace(/[^0-9]/g, "")
}
export function isArabicLetter(ch: string): boolean {
  return /^[ء-ي]$/.test(ch)
}
export function normalizePlateLetters(s: string): string {
  return [...(s ?? "")].filter((ch) => isArabicLetter(ch)).join("")
}
export function canonicalPlate(letters: string, digits: string): string {
  return `${normalizePlateLetters(letters)} ${normalizePlateDigits(digits)}`
}
export function normalizePlateSearch(term: string): string {
  return normalizePlateDigits(term) === ""
    ? (term ?? "").trim()
    : (term ?? "").trim().split("").map((ch) => {
        const ai = ARABIC_INDIC.indexOf(ch); return ai >= 0 ? String(ai) : ch
      }).join("")
}
```
NOTE: `normalizePlateSearch` should normalize Arabic digits to Western but KEEP Arabic letters (so letter searches still work). Simplify the impl to: convert any Arabic-Indic digit chars to Western, trim, leave letters as-is. Make the tests above pass; adjust impl if cleaner.
Append to `src/lib/tenant/validators.ts`:
```ts
import { normalizePlateLetters, normalizePlateDigits } from "./plate"
export function validateEgyptianPlate(input: { letters?: string; digits?: string }): string | null {
  const letters = normalizePlateLetters(input.letters ?? "")
  if (letters.length !== 3) return "letters_required"
  const digits = normalizePlateDigits(input.digits ?? "")
  if (digits.length < 1 || digits.length > 4) return "digits_required"
  return null
}
```

- [ ] **Step 4: Run `npm test` — PASS.**

- [ ] **Step 5: i18n keys** (BOTH locales, real Arabic): `vehicles.plateLetters`, `vehicles.plateDigits`, `vehicles.platePreview`, `vehicles.errors.duplicate`; `validation.letters_required`, `validation.digits_required`. Run `npm test` → parity passes.

- [ ] **Step 6: Commit** `feat(plate): Egyptian plate normalization + validation helpers + i18n`

---

## Task 2: Migration (structured columns + unique index) + seed

**Files:** Create `supabase/migrations/0012_egyptian_plate.sql`. Modify `supabase/seed.sql`. Regenerate `src/lib/database.types.ts`.

- [ ] **Step 1: Migration** `supabase/migrations/0012_egyptian_plate.sql`:
```sql
alter table public.vehicles add column plate_letters text;
alter table public.vehicles add column plate_digits  text;

-- Per-tenant uniqueness on the structured plate. Legacy rows have NULLs which
-- do not participate in the unique index. New rows must set both (app-enforced).
create unique index vehicles_tenant_plate_unique
  on public.vehicles (tenant_id, plate_letters, plate_digits);
```

- [ ] **Step 2: Seed** — in `supabase/seed.sql`, add a demo vehicle (and a demo customer if helpful) for Demo Carwash with structured plate. Use fixed UUIDs + `on conflict do nothing`. Example:
```sql
insert into public.customers (id, tenant_id, name, phone)
  values ('00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-00000000de70', 'Demo Customer', '0100000000')
  on conflict (id) do nothing;
insert into public.vehicles (id, tenant_id, customer_id, plate_letters, plate_digits, plate_number, make, model, color)
  values ('00000000-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-00000000de70',
          '00000000-0000-0000-0000-00000000cc01', 'أبج', '123', 'أبج 123', 'Toyota', 'Corolla', 'White')
  on conflict (id) do nothing;
```

- [ ] **Step 3: Apply + regenerate types**
```bash
npx supabase db reset
npx supabase gen types typescript --local > src/lib/database.types.ts
```
(Confirm `database.types.ts` now has `plate_letters`/`plate_digits` on `vehicles`. Strip any stray stdout prefix as in prior gen-types runs.)

- [ ] **Step 4:** `npm run build` passes (types compile). Commit `feat(db): vehicles structured plate columns + per-tenant unique index + seed`.

---

## Task 3: PlateInput component

**Files:** Create `src/components/tenant/PlateInput.tsx`.

- [ ] **Step 1: Implement** a controlled `PlateInput`:
```tsx
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isArabicLetter, normalizePlateDigits, formatPlate } from "@/lib/tenant/plate"

export interface PlateValue { letters: string; digits: string }

export function PlateInput({ value, onChange }: { value: PlateValue; onChange: (v: PlateValue) => void }) {
  const { t, i18n } = useTranslation()
  const letters = [...(value.letters || "")]
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  function setLetter(idx: number, ch: string) {
    const last = ch.slice(-1)
    if (last && !isArabicLetter(last)) return
    const arr = [letters[0] ?? "", letters[1] ?? "", letters[2] ?? ""]
    arr[idx] = last ?? ""
    onChange({ ...value, letters: arr.join("") })
    if (last && idx < 2) refs[idx + 1].current?.focus()
  }

  return (
    <div className="space-y-2">
      <Label>{t("vehicles.plateLetters")}</Label>
      {/* Letter boxes in plate (RTL) order: show rightmost = first letter under dir=rtl naturally */}
      <div className="flex gap-2" dir="rtl">
        {[0, 1, 2].map((idx) => (
          <Input key={idx} ref={refs[idx]} value={letters[idx] ?? ""} inputMode="text"
            maxLength={1} className="w-12 text-center min-h-[44px] text-lg"
            aria-label={`${t("vehicles.plateLetters")} ${idx + 1}`}
            onChange={(e) => setLetter(idx, e.target.value)} />
        ))}
      </div>
      <Label htmlFor="plate-digits">{t("vehicles.plateDigits")}</Label>
      <Input id="plate-digits" inputMode="numeric" value={value.digits} maxLength={4}
        className="max-w-[8rem] min-h-[44px] text-lg tracking-widest"
        onChange={(e) => onChange({ ...value, digits: normalizePlateDigits(e.target.value) })} />
      <p className="text-sm text-muted-foreground">
        {t("vehicles.platePreview")}: <span className="font-semibold">{formatPlate(value.letters, value.digits, i18n.resolvedLanguage ?? "en")}</span>
      </p>
    </div>
  )
}
```
Also add `formatPlate` to `src/lib/tenant/plate.ts` (Arabic locale → Arabic-Indic digits; spaced letters):
```ts
export function formatPlate(letters: string, digits: string, locale: string): string {
  const L = normalizePlateLetters(letters).split("").join(" ")
  let D = normalizePlateDigits(digits)
  if (locale.startsWith("ar")) {
    const ai = "٠١٢٣٤٥٦٧٨٩"
    D = D.split("").map((d) => ai[Number(d)] ?? d).join("")
  }
  return `${L}  ${D}`.trim()
}
```
(Add a Vitest case for `formatPlate`: EN keeps Western digits; AR maps to Arabic-Indic.)

- [ ] **Step 2:** `npm run build` + `npm test` pass. Commit `feat(plate): structured Egyptian PlateInput component`.

---

## Task 4: Wire into data layer + dialogs + search

**Files:** Modify `src/lib/tenant/vehicles.ts`, `src/components/tenant/VehicleDialog.tsx`, `src/components/tenant/NewWashDialog.tsx`.

- [ ] **Step 1: vehicles.ts** — extend `Vehicle` with `plate_letters`/`plate_digits`; change `createVehicle`/`updateVehicle` inputs to take `{ plate_letters, plate_digits, ... }`, compute `plate_number = canonicalPlate(letters, digits)`, write all three; map `23505` → `throw new Error("duplicate")`. `searchVehiclesByPlate` uses `normalizePlateSearch(term)` then escapes LIKE wildcards (keep the existing escape) and `ilike`s `plate_number`. Keep `customer_id` linking. Update `listVehiclesByCustomer`/`PlateMatch` selects to include `plate_letters,plate_digits` if useful (optional).
```ts
// inside createVehicle (signature updated):
import { canonicalPlate } from "./plate"
// ...
const plate_number = canonicalPlate(input.plate_letters, input.plate_digits)
const { error } = await supabase.from("vehicles").insert({
  tenant_id: tenantId, customer_id: input.customer_id,
  plate_letters: input.plate_letters, plate_digits: input.plate_digits, plate_number,
  make: ..., model: ..., color: ...,
})
if (error) { if ((error as {code?:string}).code === "23503") {/* existing */} 
  if ((error as {code?:string}).code === "23505") throw new Error("duplicate"); throw error }
```
(Do the same in `updateVehicle`. Note: `createVehicle` currently returns `id` — preserve that.)

- [ ] **Step 2: VehicleDialog** — replace the plate text `<Input>` with `<PlateInput value={{letters,digits}} onChange=...>`; hold `letters`/`digits` in state (seed from the editing vehicle's `plate_letters`/`plate_digits`). Validate with `validateEgyptianPlate` (map `letters_required`/`digits_required` → `t("validation.*")`). On save pass `plate_letters`/`plate_digits`. Map a thrown `"duplicate"` → `t("vehicles.errors.duplicate")` shown inline (dialog stays open).

- [ ] **Step 3: NewWashDialog** — in the "create new vehicle" path, replace the plate text input with `<PlateInput>`; validate with `validateEgyptianPlate` before creating; pass `plate_letters`/`plate_digits` to `createVehicle`; map `"duplicate"` → friendly message. The plate SEARCH box (to find an existing vehicle) stays as-is.

- [ ] **Step 4:** `npm run build` + `npm test` pass. Commit `feat(plate): structured plate in vehicle dialog, new-wash, and search`.

---

## Task 5: pgTAP uniqueness + full verification + docs (gated push)

**Files:** Create `supabase/tests/0015_plate_unique_test.sql`. Modify `docs/BUSINESS_LOGIC.md`.

- [ ] **Step 1: pgTAP** `supabase/tests/0015_plate_unique_test.sql` — valid hex UUIDs. Seed tenant A + B. Under tenant-A claim (`set local role authenticated` + jwt A): insert a vehicle (letters 'أبج', digits '123'); assert a SECOND insert of the same (tenant A, 'أبج','123') raises `23505` (use `throws_ok(..., '23505', ...)`); assert tenant B can insert the SAME plate without conflict (seed B's vehicle as superuser OR switch claims). ~3 assertions, all scoped (the live DB may hold app rows — scope by the test's tenant/plate). Run `npx supabase test db` → all pass.

- [ ] **Step 2: Full suite** — `npx supabase test db`, `npm test`, `npm run build` all green. Paste output.

- [ ] **Step 3: Integration + edge cases** (browser; login `owner@demo.test`/`password123`; data was reset so the seeded structured demo vehicle 'أبج 123' exists):
  - Customers → open a customer → Add vehicle: enter 3 Arabic letters + a number via the structured field; preview shows the canonical plate; save → appears.
  - Plate search: search by the number, and by the letters → finds it. Enter Arabic numerals `١٢٣` → matches the vehicle stored as `123`.
  - Add a DUPLICATE plate (same letters+digits) → friendly "already exists" error; dialog stays open.
  - New Wash: create-new-vehicle path uses the structured input; a duplicate there is rejected too.
  - RTL: letter boxes are in correct plate order; preview correct; no overflow. Tenant isolation.
  Label browser- vs API-verified; report real bugs; small UI fixes you may apply + note.

- [ ] **Step 4: Responsive × RTL** — screenshot the vehicle dialog (with PlateInput) + a plate search at 375 + 820 in EN + AR. Verify letter boxes/preview render correctly, no overflow, Arabic Cairo. Fix + re-verify any break.

- [ ] **Step 5: Docs** — update `docs/BUSINESS_LOGIC.md`: vehicles use the Egyptian structured plate (3 Arabic letters + 1–4 digits), per-tenant uniqueness, structured input; bump Last updated.

- [ ] **Step 6: Commit (do NOT push)** — `test(plate): per-tenant plate uniqueness; docs` — commit but leave unpushed; the controller runs the gated push (pgTAP + Vitest + build all green → push).

---

## Definition of Done
- Vehicles are entered via the structured Egyptian plate field (3 Arabic letters + 1–4 digits) with a live canonical preview, in the vehicle dialog AND the new-wash flow.
- Plates are unique per tenant (DB-enforced); duplicates show a friendly error; two tenants may share a plate.
- Arabic and Western numerals are equivalent for storage/search (`١٢٣`≡`123`); search matches letters or digits.
- i18n (en/ar parity), RTL-correct, responsive (verified mobile+tablet, EN+AR).
- Vitest (normalize/validate/format), pgTAP (0015 uniqueness), build — all green; pushed only after a green suite.
- `docs/BUSINESS_LOGIC.md` + `seed.sql` updated.
