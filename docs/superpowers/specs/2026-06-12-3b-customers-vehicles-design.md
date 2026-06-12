# Plan 3B — Customers & Vehicles (with plate search) — Design

**Date:** 2026-06-12
**Status:** Approved
**Part of:** Plan 3 (Tenant Operations), sub-plan 3B. Depends on 3A (app shell, tenant CRUD pattern).

## 1. Purpose

Let a tenant manage **customers** and their **vehicles**, and quickly find a vehicle (and
its owner) by **plate number** — the lookup the counter does constantly.

## 2. Decisions (recommended defaults taken)

- New nav page **`/app/customers`** with: plate search, customers table CRUD, and per-customer
  vehicle management in a detail dialog.
- A vehicle **belongs to a customer** in 3B (created within the customer detail). Standalone
  walk-in vehicle creation is deferred to 3C. (`vehicles.customer_id` is nullable; we just
  don't expose the null path yet.)
- Plate stored **as entered**; search **normalizes** (trim, case-insensitive `ilike '%term%'`),
  tenant-scoped. Per-tenant volume is small, so match quality beats index usage.
- Delete customer → vehicles' `customer_id` → null (FK `SET NULL`); confirm + warn. Delete
  vehicle → hard delete.

## 3. Components

### 3.1 Data layer
- `src/lib/tenant/customers.ts`: `listCustomers()` (with vehicle counts), `createCustomer`,
  `updateCustomer`, `removeCustomer`. Inserts set `tenant_id` from the JWT claim.
- `src/lib/tenant/vehicles.ts`: `listVehiclesByCustomer(customerId)`, `createVehicle`,
  `updateVehicle`, `removeVehicle`, and `searchVehiclesByPlate(term)` — returns matches with
  the joined customer name (`select ..., customers(name)`), `ilike` on normalized plate,
  ordered, limited (e.g. 20).
- `src/lib/tenant/plate.ts`: pure `normalizePlate(s)` (trim, collapse spaces, uppercase) used
  for consistent search; `validateCustomer` / `validateVehicle` in
  `src/lib/tenant/validators.ts` (extend existing file).

### 3.2 Pages & components
- `src/pages/tenant/CustomersPage.tsx`: top **PlateSearch**; **Customers table** (name, phone,
  vehicle count, actions) with create/edit/delete; opens **CustomerDetailDialog**.
- `src/components/tenant/CustomerDialog.tsx`: create/edit customer (name required, phone).
- `src/components/tenant/CustomerDetailDialog.tsx`: shows the customer + their vehicles, with
  add/edit/delete vehicle (uses VehicleDialog). Reachable from a table row and from a plate
  search result.
- `src/components/tenant/VehicleDialog.tsx`: create/edit vehicle (plate required; make, model,
  color optional) for a given customer.
- `src/components/tenant/PlateSearch.tsx`: debounced input → `searchVehiclesByPlate` → results
  list (plate, make/model, owner); clicking a result opens that customer's detail dialog.
- Sidebar (`SidebarNav`): add a **Customers** link (before Branches or after Staff — place
  sensibly), localized.

## 4. Cross-cutting (standing rule)
i18n keys under `nav.customers`, `customers.*`, `vehicles.*`, `plateSearch.*`, plus shared
`common.*` reuse — added to BOTH `en.json` and `ar.json` (parity-tested, real Arabic).
RTL-correct logical utilities; responsive at mobile + tablet; verified LTR + RTL; Arabic in
Cairo. Follows the 3A Table+Dialog pattern.

## 5. Error handling
Validation inline in dialogs; DB/RLS errors localized; delete confirms (customer delete warns
about detaching vehicles). Empty/loading/error states on the list and on search (incl. an
explicit **no-results** state).

## 6. Testing (required)
- **Vitest:** `validateCustomer` (name required), `validateVehicle` (plate required),
  `normalizePlate` (trim/case/space-collapse), and any pure search-term builder.
- **pgTAP** (`supabase/tests/0012_customers_vehicles_rls_test.sql`): under a tenant-A claim,
  inserting a customer + vehicle is visible (count 1), a tenant-B customer/vehicle seeded as
  superuser is NOT visible; a plate `ilike` query returns only tenant-A's vehicle; confirm the
  audit trigger writes a row on customer insert (the trigger already exists from Plan 1).
- **Full-flow + edge cases:** create customer → add vehicle → search by partial & lowercase
  plate finds it → open owner from result → edit → delete vehicle → delete customer. Verify
  no-result search, case-insensitivity, partial match, vehicle with only a plate. Tenant
  isolation. Responsive/RTL at mobile + tablet in EN + AR (incl. the search results + dialogs).
- Full local suite (pgTAP + Vitest + build) green before pushing to `dev`.

## 7. Out of scope (later)
Walk-in/standalone vehicle creation, vehicle history view (3C builds wash history), bulk
import, fuzzy/normalized-plate column, customer notes/tags, dedup. Operations/queue (3C),
dashboard (3D).

## 8. Docs
Update `docs/BUSINESS_LOGIC.md` (customers/vehicles + plate search now BUILT; 3B done, 3C next)
as part of this work.
