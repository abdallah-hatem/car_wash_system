# Plan 3B — Customers & Vehicles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A `/app/customers` page with customer CRUD, per-customer vehicle CRUD, and tenant-scoped plate-number search — i18n/RTL/responsive and tenant-isolated, with tests.

**Architecture:** Mirrors the 3A tenant pattern (data modules + Table/Dialog pages, `tenant_id` from the JWT claim, RLS isolation). Adds a plate search over `vehicles` joined to `customers`.

**Tech Stack:** React + Vite + TS, Tailwind v3 + shadcn (v2), react-i18next, supabase-js, Vitest, pgTAP.

**Existing context to reuse:**
- 3A pattern: `src/pages/tenant/BranchesPage.tsx`, `src/components/tenant/BranchDialog.tsx`, `src/lib/tenant/branches.ts`, `src/lib/tenant/validators.ts`, `src/components/tenant/SidebarNav.tsx`, `src/components/tenant/TenantLayout.tsx`.
- `useAuth().claims.tenantId` for inserts; shadcn primitives present (button,input,label,card,table,dialog,badge,select); `lucide-react` available.
- i18n `src/i18n/locales/{en,ar}.json` + parity test `src/i18n/locales.test.ts`.
- Schema: `customers(id,tenant_id,name,phone,created_at)`, `vehicles(id,tenant_id,customer_id,plate_number,make,model,color,created_at)` (customer_id FK ON DELETE SET NULL; index `vehicles_tenant_plate_idx`). Audit trigger fires on `customers`.

**File structure:**
- Create: `src/lib/tenant/plate.ts`, `src/lib/tenant/plate.test.ts`, `src/lib/tenant/customers.ts`, `src/lib/tenant/vehicles.ts`
- Modify: `src/lib/tenant/validators.ts`, `src/lib/tenant/validators.test.ts`
- Create: `src/pages/tenant/CustomersPage.tsx`, `src/components/tenant/{CustomerDialog,CustomerDetailDialog,VehicleDialog,PlateSearch}.tsx`
- Modify: `src/components/tenant/SidebarNav.tsx`, `src/routes.tsx`, `src/i18n/locales/{en,ar}.json`
- Create: `supabase/tests/0012_customers_vehicles_rls_test.sql`
- Modify: `docs/BUSINESS_LOGIC.md`

---

## Task 1: Pure helpers (TDD) + validators + i18n keys

**Files:** Create `src/lib/tenant/plate.ts`, `plate.test.ts`. Modify `validators.ts`, `validators.test.ts`, `src/i18n/locales/{en,ar}.json`.

- [ ] **Step 1: Failing tests** — `src/lib/tenant/plate.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { normalizePlate } from "./plate"

describe("normalizePlate", () => {
  it("trims, uppercases, and collapses inner whitespace", () => {
    expect(normalizePlate("  ab 123  ")).toBe("AB 123")
    expect(normalizePlate("abc123")).toBe("ABC123")
    expect(normalizePlate("a  b   c")).toBe("A B C")
    expect(normalizePlate("")).toBe("")
  })
})
```
Append to `src/lib/tenant/validators.test.ts`:
```ts
import { validateCustomer, validateVehicle } from "./validators"
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
```

- [ ] **Step 2: Run `npm test` — FAIL.**

- [ ] **Step 3: Implement** `src/lib/tenant/plate.ts`:
```ts
/** Normalize a plate for display/search: trim ends, collapse inner whitespace, uppercase. */
export function normalizePlate(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase()
}
```
Append to `src/lib/tenant/validators.ts`:
```ts
export function validateCustomer(input: { name?: string }): string | null {
  if (!input.name?.trim()) return "name_required"
  return null
}
export function validateVehicle(input: { plate_number?: string }): string | null {
  if (!input.plate_number?.trim()) return "plate_required"
  return null
}
```

- [ ] **Step 4: Run `npm test` — PASS.**

- [ ] **Step 5: i18n keys** in BOTH `en.json` + `ar.json` (identical, real Arabic):
  - `nav.customers`.
  - `customers`: `title`, `newCustomer`, `name`, `phone`, `vehicleCount`, `empty`, `deleteWarn` (warns vehicles will be unlinked), `errors.generic`, `detailTitle`.
  - `vehicles`: `title`, `newVehicle`, `plate`, `make`, `model`, `color`, `empty`, `errors.generic`.
  - `plateSearch`: `placeholder`, `noResults`, `owner`, `searching`, `label`.
  - `validation`: `plate_required` (name_required exists).
  Run `npm test` → parity passes.

- [ ] **Step 6: Commit** `feat(tenant): customer/vehicle validators, plate normalize, i18n keys`

---

## Task 2: Data layer (customers + vehicles + plate search)

**Files:** Create `src/lib/tenant/customers.ts`, `src/lib/tenant/vehicles.ts`.

- [ ] **Step 1:** `src/lib/tenant/customers.ts`
```ts
import { supabase } from "@/lib/supabase"

export interface Customer { id: string; name: string; phone: string | null; created_at: string; vehicle_count: number }

export async function listCustomers(): Promise<Customer[]> {
  // vehicle_count via a left join aggregate using the embedded count
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,phone,created_at,vehicles(count)")
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((c: any) => ({
    id: c.id, name: c.name, phone: c.phone, created_at: c.created_at,
    vehicle_count: c.vehicles?.[0]?.count ?? 0,
  }))
}
export async function createCustomer(tenantId: string, input: { name: string; phone?: string | null }): Promise<string> {
  const { data, error } = await supabase.from("customers")
    .insert({ tenant_id: tenantId, name: input.name.trim(), phone: input.phone?.trim() || null })
    .select("id").single()
  if (error) throw error
  return data.id
}
export async function updateCustomer(id: string, input: { name: string; phone?: string | null }): Promise<void> {
  const { error } = await supabase.from("customers")
    .update({ name: input.name.trim(), phone: input.phone?.trim() || null }).eq("id", id)
  if (error) throw error
}
export async function removeCustomer(id: string): Promise<void> {
  const { error } = await supabase.from("customers").delete().eq("id", id)
  if (error) throw error
}
```
NOTE: verify the embedded `vehicles(count)` shape against the generated types; if the aggregate embed is awkward, fall back to fetching vehicles per customer or a view. Keep `vehicle_count` working.

- [ ] **Step 2:** `src/lib/tenant/vehicles.ts`
```ts
import { supabase } from "@/lib/supabase"
import { normalizePlate } from "./plate"

export interface Vehicle { id: string; customer_id: string | null; plate_number: string; make: string | null; model: string | null; color: string | null; created_at: string }
export interface PlateMatch extends Vehicle { customer_name: string | null }

export async function listVehiclesByCustomer(customerId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase.from("vehicles")
    .select("id,customer_id,plate_number,make,model,color,created_at")
    .eq("customer_id", customerId).order("created_at")
  if (error) throw error
  return data as Vehicle[]
}
export async function createVehicle(tenantId: string, input: { customer_id: string | null; plate_number: string; make?: string | null; model?: string | null; color?: string | null }): Promise<void> {
  const { error } = await supabase.from("vehicles").insert({
    tenant_id: tenantId, customer_id: input.customer_id, plate_number: input.plate_number.trim(),
    make: input.make?.trim() || null, model: input.model?.trim() || null, color: input.color?.trim() || null,
  })
  if (error) throw error
}
export async function updateVehicle(id: string, input: { plate_number: string; make?: string | null; model?: string | null; color?: string | null }): Promise<void> {
  const { error } = await supabase.from("vehicles").update({
    plate_number: input.plate_number.trim(), make: input.make?.trim() || null,
    model: input.model?.trim() || null, color: input.color?.trim() || null,
  }).eq("id", id)
  if (error) throw error
}
export async function removeVehicle(id: string): Promise<void> {
  const { error } = await supabase.from("vehicles").delete().eq("id", id)
  if (error) throw error
}
export async function searchVehiclesByPlate(term: string): Promise<PlateMatch[]> {
  const norm = normalizePlate(term)
  if (!norm) return []
  const { data, error } = await supabase.from("vehicles")
    .select("id,customer_id,plate_number,make,model,color,created_at,customers(name)")
    .ilike("plate_number", `%${norm}%`).limit(20)
  if (error) throw error
  return (data ?? []).map((v: any) => ({
    id: v.id, customer_id: v.customer_id, plate_number: v.plate_number, make: v.make, model: v.model,
    color: v.color, created_at: v.created_at, customer_name: v.customers?.name ?? null,
  }))
}
```
NOTE: `ilike` with `%NORM%` matches case-insensitively against stored plates. Since stored plates may be mixed case, `ilike` (case-insensitive) handles it; normalizing the term to uppercase is harmless for `ilike`. RLS scopes results to the tenant automatically.

- [ ] **Step 3:** `npm run build` passes. Commit `feat(tenant): customers/vehicles data layer + plate search`.

---

## Task 3: Customers page + customer dialog + nav/route

**Files:** Create `src/pages/tenant/CustomersPage.tsx`, `src/components/tenant/CustomerDialog.tsx`. Modify `src/components/tenant/SidebarNav.tsx`, `src/routes.tsx`.

- [ ] **Step 1: SidebarNav** — add a `Customers` link (`/app/customers`) to the items list, using `t("nav.customers")`, placed after Staff (or first — sensible). Keep existing links + coming-soon items.

- [ ] **Step 2: Route** — in `src/routes.tsx`, add `{ path: "customers", element: <CustomersPage/> }` under the `TenantLayout` children (alongside branches/packages/staff).

- [ ] **Step 3: CustomerDialog** `src/components/tenant/CustomerDialog.tsx` — create/edit (name required, phone optional), mirrors `BranchDialog`. Uses `validateCustomer`, `createCustomer`/`updateCustomer` with `claims.tenantId`. Strings via t(); logical utilities; fits 375px.

- [ ] **Step 4: CustomersPage** `src/pages/tenant/CustomersPage.tsx` — mirrors `BranchesPage`:
  - Header `t("customers.title")` + "New customer" button.
  - **PlateSearch** component mounted at top (Task 5 creates it; import + render; until then a placeholder is fine but prefer doing Task 5 first or together).
  - Table: name, phone, `t("customers.vehicleCount")` (the count), actions: Manage (opens CustomerDetailDialog — Task 4), Edit (CustomerDialog), Delete (confirm with `t("customers.deleteWarn")` then `removeCustomer`).
  - loading/empty/error; refetch after changes; `overflow-x-auto`.

- [ ] **Step 5:** `npm run build` + `npm test` pass. Commit `feat(tenant): customers page + dialog + nav`.

---

## Task 4: Customer detail + vehicle CRUD

**Files:** Create `src/components/tenant/CustomerDetailDialog.tsx`, `src/components/tenant/VehicleDialog.tsx`.

- [ ] **Step 1: VehicleDialog** `src/components/tenant/VehicleDialog.tsx` — create/edit a vehicle for a given `customerId`. Fields: plate (required), make/model/color (optional). Uses `validateVehicle`, `createVehicle`(with `claims.tenantId` + customer_id)/`updateVehicle`. Strings via t().

- [ ] **Step 2: CustomerDetailDialog** `src/components/tenant/CustomerDetailDialog.tsx` — props `{ open, onOpenChange, customer, onChanged }`. Shows customer name/phone + a list/table of their vehicles (`listVehiclesByCustomer`), each with Edit + Delete (confirm), plus an "Add vehicle" button (VehicleDialog). Refresh the vehicle list on change and call `onChanged` so the page can refresh counts. Responsive; strings via t().

- [ ] **Step 3:** `npm run build` + `npm test` pass. Commit `feat(tenant): customer detail + vehicle CRUD`.

---

## Task 5: Plate search component

**Files:** Create `src/components/tenant/PlateSearch.tsx`. Wire into `CustomersPage`.

- [ ] **Step 1: PlateSearch** `src/components/tenant/PlateSearch.tsx` — props `{ onOpenCustomer: (customerId: string) => void }`. A labeled search input (`t("plateSearch.placeholder")`); debounce (~300ms via a `setTimeout` in `useEffect` on the term); calls `searchVehiclesByPlate`; renders states: idle (empty term → nothing), searching, no-results (`t("plateSearch.noResults")`), and a results list (each: plate, make/model, owner name or a dash). Clicking a result with a `customer_id` calls `onOpenCustomer(customer_id)`. Accessible (label + `role="list"`); logical utilities; responsive.

- [ ] **Step 2:** In `CustomersPage`, render `<PlateSearch onOpenCustomer={(id) => openDetailForCustomerId(id)} />` above the table; `openDetailForCustomerId` finds the customer in state (or refetches) and opens CustomerDetailDialog.

- [ ] **Step 3:** `npm run build` + `npm test` pass. Commit `feat(tenant): plate search`.

---

## Task 6: pgTAP isolation/search test + full verification + docs

**Files:** Create `supabase/tests/0012_customers_vehicles_rls_test.sql`. Modify `docs/BUSINESS_LOGIC.md`.

- [ ] **Step 1: pgTAP** `supabase/tests/0012_customers_vehicles_rls_test.sql` — under tenant-A claim: insert customer + vehicle (visible, count 1 each); a tenant-B customer+vehicle seeded as superuser is invisible; an `ilike` plate query as tenant A returns only A's vehicle; and a customer insert wrote an `audit_log` row. ~5 assertions, valid hex UUIDs, `set local role authenticated` + `set_config('request.jwt.claims', '{"tenant_id":"...A...","role":"owner"}', true)`. Example core:
```sql
select is((select count(*)::int from public.customers), 1, 'tenant A sees only its customer');
select is((select count(*)::int from public.vehicles where plate_number ilike '%ABC%'), 1, 'plate search scoped to tenant A');
select is((select count(*)::int from public.audit_log where table_name='customers' and action='INSERT'), 1, 'customer insert audited');
```
(Seed tenant-B rows as superuser BEFORE `set local role authenticated`. Audit assertion: the audit trigger runs as the inserting role; ensure the tenant-A customer insert happens under the authenticated role and check the audit row exists — the audit_read policy allows the tenant to see its own audit rows.)

- [ ] **Step 2: Run `npx supabase test db`** — all pass. Paste summary.

- [ ] **Step 3: Full suite** — `npx supabase test db`, `npm test`, `npm run build` all green. Paste output.

- [ ] **Step 4: Integration + edge cases + responsive/RTL** (login as `owner@demo.test`/`password123`):
  - Create a customer "Ali" (phone). Open detail → add vehicle plate "ABC 123" (make/model/color). 
  - Plate search: search "abc" (lowercase, partial) → finds "ABC 123" with owner Ali; click → opens Ali's detail. Search "zzz" → no-results state. Search " abc 123 " (spaces) → still finds it.
  - Edit the vehicle; delete it; delete the customer (confirm the warn copy). Verify tenant isolation (only Demo Carwash data shows).
  - Screenshots: `/app/customers` (table + a search with results + the detail dialog) at 375 + 820 in EN + AR. Verify RTL mirrors, no overflow, Arabic Cairo, search results readable, dialogs fit. Fix any breakage.

- [ ] **Step 5: Update `docs/BUSINESS_LOGIC.md`** — add a "Customers & vehicles + plate search — BUILT (3B)" subsection; mark 3B done, 3C next; bump Last updated to 2026-06-12.

- [ ] **Step 6: Commit** `test(tenant): customers/vehicles RLS + plate search; docs: 3B built`.

---

## Definition of Done
- `/app/customers` lists customers (with vehicle counts), full customer CRUD, per-customer vehicle CRUD via detail dialog.
- Plate search finds tenant vehicles case-insensitively/partially and opens the owner; no-results handled.
- i18n (en/ar parity), RTL-correct, responsive (verified mobile+tablet, EN+AR).
- Vitest (validators + normalizePlate + parity), pgTAP (0012 isolation + plate scope + audit), build — all green.
- `docs/BUSINESS_LOGIC.md` updated.
