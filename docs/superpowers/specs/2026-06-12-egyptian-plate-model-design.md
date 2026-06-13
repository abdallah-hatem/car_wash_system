# Egyptian License Plate Model — Design

**Date:** 2026-06-12
**Status:** Approved
**Modifies:** 3B vehicle model + 3C new-wash vehicle entry + plate search.

## 1. Purpose

Model vehicle plates as Egyptian plates — **3 Arabic letters + a 1–4 digit number** — and
enforce **per-tenant uniqueness**, with a structured input field that reflects the format.

## 2. Decisions (recommended defaults, approved)

- Exactly **3 Arabic letters** + **1–4 digits** (lenient count, ≥1 digit).
- Letters accept any Arabic letter (not restricted to the legal subset — it changes over time).
- **Digits stored as Western** (`٠-٩` normalized to `0-9`) so `١٢٣` ≡ `123` for uniqueness.
- **Uniqueness enforced at the DB** via a unique index on `(tenant_id, plate_letters,
  plate_digits)`. Per tenant — two tenants may share a real plate.
- The structured input **replaces** the free-text plate (Egypt-focused). Existing test
  vehicles have unparseable free-text plates → recommend `supabase db reset` (seed adds a
  properly-structured demo vehicle).

## 3. Data model (`vehicles`)

Migration `00NN_egyptian_plate.sql`:
- Add `plate_letters text` — the 3 Arabic letters in plate order, normalized (trimmed, no
  internal spaces/diacritics).
- Add `plate_digits text` — the number as Western digits, normalized.
- Keep `plate_number text` as the **canonical display** value (`plate_letters || ' ' ||
  plate_digits`), maintained by the app on write. Existing search (`ilike plate_number`)
  keeps working.
- Unique index: `create unique index vehicles_tenant_plate_unique on vehicles
  (tenant_id, plate_letters, plate_digits)`. New columns are nullable so the unique index
  ignores legacy rows (NULLs don't conflict); the app requires the structured fields going
  forward.
- Keep the existing `vehicles_tenant_plate_idx (tenant_id, plate_number)` for search.

## 4. Pure helpers (`src/lib/tenant/plate.ts` — extend; unit-tested)

- `normalizePlateDigits(s): string` — map `٠-٩` → `0-9`, strip non-digits.
- `normalizePlateLetters(s): string` — trim, remove spaces/tatweel/diacritics; keep letters.
- `isArabicLetter(ch): boolean` — for input filtering/validation.
- `validateEgyptianPlate({ letters, digits }): string | null` — `letters_required` (must be
  exactly 3 Arabic letters), `digits_required` (1–4 digits). Returns null when valid.
- `canonicalPlate(letters, digits): string` — `${normLetters} ${normDigits}` (storage value).
- `formatPlate(letters, digits, locale): string` — display; Arabic locale renders digits as
  `٠-٩`, letters spaced.
- `normalizePlateSearch(term): string` — for search: digits→Western, collapse, trim.

## 5. Components

### 5.1 `src/components/tenant/PlateInput.tsx`
Controlled component: props `{ value: { letters: string; digits: string }, onChange }`.
- Three single-char boxes for letters in **RTL plate order** (rightmost = first letter),
  each accepting one Arabic letter (filters non-Arabic; auto-advance focus); a digits box
  (maxLength 4, accepts Arabic/Western numerals → normalized to Western on change).
- A live **preview** of `formatPlate(...)`.
- Accessible labels; logical utilities; responsive; works in LTR and RTL.

### 5.2 Wiring
- `VehicleDialog` (3B): replace the plate text input with `<PlateInput>`; on save pass
  `plate_letters`, `plate_digits`, and the computed `plate_number`. Map DB unique violation
  (`23505`) → `t("vehicles.errors.duplicate")`.
- `NewWashDialog` (3C): the "create new vehicle" path uses `<PlateInput>` for the plate; the
  plate **search** keeps using the existing search box (matches canonical `plate_number`).
- Data layer `vehicles.ts`: `createVehicle`/`updateVehicle` accept `{ plate_letters,
  plate_digits }`, compute `plate_number = canonicalPlate(...)`, and write all three. Map
  `23505` to an `Error("duplicate")`. `searchVehiclesByPlate` normalizes the term via
  `normalizePlateSearch` and `ilike`s `plate_number` (letters or digits both match).

## 6. i18n (standing rule)
Keys: `vehicles.plateLetters`, `vehicles.plateDigits`, `vehicles.platePreview`,
`vehicles.errors.duplicate`, `validation.letters_required`, `validation.digits_required` —
both locales, parity-tested, real Arabic. RTL-correct; responsive.

## 7. Error handling
Inline validation (3 letters + digits) before submit. DB `23505` → friendly duplicate
message (and the user can use plate search to find the existing vehicle). Non-Arabic letter
input is filtered at the field.

## 8. Testing (required)
- **Vitest:** `normalizePlateDigits` (Arabic→Western, strips junk), `normalizePlateLetters`,
  `validateEgyptianPlate` (exactly 3 letters; 0/5 letters fail; 0/5 digits fail; valid),
  `canonicalPlate`, `normalizePlateSearch`, `isArabicLetter`.
- **pgTAP** (`supabase/tests/00NN_plate_unique_test.sql`): under tenant-A claim, inserting two
  vehicles with the same `(plate_letters, plate_digits)` fails with `23505`; the SAME plate
  under tenant-B (seeded) does NOT conflict (per-tenant uniqueness); isolation holds.
- **Full-flow + edge cases:** add a vehicle via the structured input → canonical plate shows
  → plate search finds it (by letters and by number) → adding a duplicate is rejected with
  the friendly message → entering Arabic numerals `١٢٣` matches a vehicle stored as `123`.
  RTL: letter boxes in correct plate order, preview correct, no overflow. Mobile + tablet,
  EN + AR.
- Full local suite green; **gate the push on green**.

## 9. Out of scope
Restricting to the exact legal letter subset; plate images/OCR; governorate codes; non-Egypt
plate formats; backfilling legacy free-text plates (cleared via reset).

## 10. Docs
Update `docs/BUSINESS_LOGIC.md` (vehicles use the Egyptian structured plate + per-tenant
uniqueness) and `supabase/seed.sql` (a demo vehicle with structured plate).
