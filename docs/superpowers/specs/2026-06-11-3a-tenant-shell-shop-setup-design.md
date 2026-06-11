# Plan 3A — Tenant App Shell + Shop Setup — Design

**Date:** 2026-06-11
**Status:** Approved
**Part of:** Plan 3 (Tenant Operations), decomposed into 3A→3D. This is 3A.
**Depends on:** Plans 1–2 (schema, RLS, auth, AppHeader, admin patterns).

## 1. Purpose

Give a logged-in tenant (owner or manager) a real app shell at `/app` and the ability to
configure their shop: full CRUD for **branches, packages, and employees** — the setup data
that wash orders (3C) depend on.

## 2. Locked decisions

- Sub-plan order 3A→3D; this is 3A.
- **Left sidebar** shell (collapses to a drawer on mobile); Queue/Dashboard shown as
  disabled "coming soon" nav items.
- **Full CRUD** for branches/packages/employees; both **delete and deactivate** offered
  (UI nudges toward deactivate to preserve history).
- **Owner and manager** both have full access (no finer role split in v1).
- Global branch selector **deferred to 3C**.
- React component tests **not** set up in 3A (continue with pure-logic Vitest + pgTAP +
  integration/screenshot verification, as in Plans 1–2).

## 3. App shell (`TenantLayout`)

- New `src/components/tenant/TenantLayout.tsx`: a left sidebar + top bar + `<Outlet/>`,
  rendered as the layout for the `/app` subtree (inside `RequireTenant`).
  - **Sidebar:** nav links Branches, Packages, Staff (active-route highlight); disabled
    Queue + Dashboard items labeled "coming soon". Collapses to a hamburger-triggered
    drawer on mobile (`<lg`).
  - **Top bar:** app name, `LanguageSwitcher` (reused), sign-out (reuse the existing
    sign-out logic from `AppHeader`).
- Routing (`src/routes.tsx`): under `RequireAuth → RequireTenant`, a `TenantLayout` layout
  route with children `branches` (index/redirect target), `packages`, `staff`. `/app` →
  redirect `/app/branches`. `/admin` keeps its existing `AppHeader` unchanged.
- Shared bits (LanguageSwitcher, a `signOut` helper) are reused, not duplicated. This is a
  targeted change to the `/app` branch of the router only.

## 4. Data layer

`src/lib/tenant/branches.ts`, `packages.ts`, `employees.ts` — typed helpers over the
supabase client. RLS auto-scopes reads/writes to the caller's tenant; inserts set
`tenant_id` from the JWT claim (`useAuth().claims.tenantId`), which RLS `with check`
validates.

- **branches:** `listBranches()`, `createBranch({name,address})`, `updateBranch(id,{...})`,
  `removeBranch(id)`.
- **packages:** `listPackages()`, `createPackage({name,price,duration_minutes,is_active})`,
  `updatePackage(id,{...})`, `setPackageActive(id,bool)`, `removePackage(id)`.
- **employees:** `listEmployees()`, `createEmployee({name,phone,branch_id,is_active})`,
  `updateEmployee(id,{...})`, `setEmployeeActive(id,bool)`, `removeEmployee(id)`.
- Pure validators (unit-tested): `validateBranch` (name required), `validatePackage`
  (name required, price is a number > 0), `validateEmployee` (name required).

## 5. Pages (Table + Dialog pattern, reused from admin)

Located under `src/pages/tenant/`:
- **BranchesPage:** table (name, address, created); "New branch" + edit dialog; delete.
  `wash_orders.branch_id` is `ON DELETE RESTRICT` → a delete blocked by existing orders
  surfaces a friendly `branches.errors.in_use` message (Postgres error `23503`).
- **PackagesPage:** table (name, price, duration, active badge); create/edit dialog
  (name, price, duration_minutes, is_active); active toggle; delete (FK `SET NULL`).
- **StaffPage:** table (name, phone, branch name, active badge); create/edit dialog
  (name, phone, branch `<select>` from branches, is_active); active toggle; delete
  (FK `SET NULL`).

Branch select in the employee dialog lists the tenant's branches (optional — employee may
have no branch). Price shows as a plain number (currency setting deferred); duration in min.

## 6. Cross-cutting (standing rule)

i18n: new keys under `nav.*`, `branches.*`, `packages.*`, `staff.*`, plus shared
`common.*` (save, cancel, edit, delete, deactivate, activate, create, confirmDelete,
loading, empty, etc.) — added to BOTH `en.json` and `ar.json` (parity-tested, real Arabic).
RTL-correct logical utilities; responsive sidebar (drawer on mobile) + tables; verified at
mobile + tablet in LTR and RTL; Arabic uses Cairo.

## 7. Error handling

- Validation errors shown inline in dialogs (no submit until valid).
- DB/RLS errors surfaced as friendly localized messages; the branch-in-use (`23503`) case
  is specifically detected and messaged. Delete actions confirm first.
- List load failure shows a localized error with a retry.

## 8. Testing

- **Vitest:** `validateBranch/Package/Employee` (required fields, price > 0, bad inputs).
- **pgTAP:** under a `tenant_id` claim, a tenant can insert + read its own
  branches/packages/employees and cannot read another tenant's rows (extends isolation
  coverage to these tables; same policy proven generally in Plan 1).
- **Integration + responsive/RTL:** as the seeded demo owner, create→edit→toggle→delete a
  branch, a package, and an employee; confirm persistence + tenant isolation; verify the
  shell + three pages at mobile (375) + tablet (820) in EN and AR.
- Full local suite (pgTAP + Vitest + build) green before pushing to `dev`.

## 9. Out of scope (later sub-plans)

Customers/vehicles (3B), operations/queue/wash orders/payments (3C), dashboard (3D),
global branch selector (3C), per-tenant currency, bulk import, finer owner/manager
permission split, React component-test harness.

## 10. Docs

Update `docs/BUSINESS_LOGIC.md` (tenant app shell + setup CRUD now BUILT; 3A done) as part
of this work, per the maintenance rule.
