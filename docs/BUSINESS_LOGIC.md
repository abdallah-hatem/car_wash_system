# Car Wash System — Business Logic & Flows

> **Living document.** This is the single source of truth for the product's domain
> model, business rules, and flows. Whenever business logic, a flow, the data model,
> roles/permissions, or scope changes, **update this file in the same change** (it's a
> required step — see CLAUDE.md). Keep it accurate to what the code actually does; mark
> anything not yet built as **Planned**.

Last updated: 2026-06-12 (Plan 3B complete — customers, vehicles, plate search built; responsive/RTL overflow fix in CustomerDetailDialog).

---

## 1. What the product is

A **multi-tenant SaaS** for carwash businesses. One deployment serves many independent
carwash companies ("tenants"). Each tenant can have multiple branches, staff, customers,
and operations. A separate **platform owner** (us) administers all tenants.

Stack: React + Vite + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres + Auth + RLS +
Edge Functions), PWA. Bilingual **English + Arabic (RTL)**, tablet-first responsive.

## 2. Actors & roles

| Actor | What they are | Where they work | How identified |
|---|---|---|---|
| **Platform admin** | Us, the SaaS operator | `/admin` console | row in `platform_admins`; JWT claim `is_platform_admin: true` |
| **Tenant owner** | Owner of one carwash business | `/app` (tenant app) | `profiles.role = 'owner'`; JWT claims `tenant_id` + `app_role` |
| **Tenant manager** | Day-to-day operator of a business | `/app` | `profiles.role = 'manager'` |
| **Employee (washer)** | Staff who perform washes | — (not a login) | a row in `employees`; **not** an auth user |

Operations are **counter-operated**: the owner/manager runs everything from a tablet at the
counter. Washers are tracked as records and assigned to washes; they do not log in.

## 3. Tenancy & security model (the backbone)

- Every operational row carries a **`tenant_id`**. Branch-scoped rows also carry `branch_id`.
- A Supabase **auth hook** (`custom_access_token_hook`) injects `tenant_id`, `app_role`, and
  `is_platform_admin` into the user's JWT at token-issue time, read from `profiles` /
  `platform_admins`. The app role is carried under **`app_role`** (not `role`): the JWT
  `role` claim is left as GoTrue's default (`authenticated`) so PostgREST's role switching
  (`jwt-role-claim-key` = `role`) sets a valid Postgres role.
- **Postgres RLS** enforces isolation on every table: `tenant_id = current_tenant_id()`
  where `current_tenant_id()` reads the `tenant_id` JWT claim. A tenant physically cannot
  read or write another tenant's rows.
- **`platform_admins`** is RLS-locked and revoked from `anon`/`authenticated` — only
  `service_role` / SECURITY DEFINER functions touch it (prevents privilege escalation).
- **Suspension is enforced in the auth hook:** if the user's tenant `status <> 'active'`,
  the hook withholds the `tenant_id`/`app_role` claims. With no tenant claim, RLS returns
  nothing and the user is routed to `/no-access`. Effective on the next token refresh
  (≤ ~1h) for already-logged-in users.
- Secrets: frontend uses the **anon key only**; `service_role` key and DB password never
  reach the client. The `create-business` Edge Function is the only path using service_role.

## 4. Data model (current)

Entities (all under Postgres `public`, all tenant-scoped except platform tables):

- **`tenants`** — a carwash business. `name`, `status` (`active` | `suspended`), `created_at`.
- **`platform_admins`** — `user_id` → an auth user who is a platform admin.
- **`branches`** — `tenant_id`, `name`, `address`. A tenant's physical locations.
- **`profiles`** — links an auth user to a tenant + role. `user_id`, `tenant_id`,
  `role` (`owner` | `manager`), `full_name`.
- **`customers`** — `tenant_id`, `name`, `phone`.
- **`vehicles`** — `tenant_id`, `customer_id`, `plate_number` (indexed for search),
  `make`, `model`, `color`.
- **`packages`** — wash offerings. `tenant_id`, `name`, `price`, `duration_minutes`,
  `is_active`.
- **`employees`** — washers (not users). `tenant_id`, `branch_id`, `name`, `phone`,
  `is_active`.
- **`wash_orders`** — the operations hub. `tenant_id`, `branch_id`, `customer_id`,
  `vehicle_id`, `package_id`, `assigned_employee_id`, `status`
  (`waiting` → `in_progress` → `done` → `cancelled`), `price`, `notes`, timestamps.
- **`payments`** — `tenant_id`, `wash_order_id`, `amount`, `method` (`cash` | `card` |
  `transfer`), `paid_at`. (Manual recording — no real processor in MVP.)
- **`audit_log`** — generic trigger-written log (`tenant_id`, `table_name`, `row_id`,
  `action`, `actor`, `at`) on `wash_orders`, `payments`, `customers`.

Relationships: a `tenant` has many branches/customers/vehicles/packages/employees/wash_orders;
a `wash_order` ties together customer + vehicle + package + assigned employee + branch, and
has many `payments`.

## 5. Routing & access flow

- `/login` — email/password sign-in (Supabase `signInWithPassword`).
- `RequireAuth` — not signed in → `/login`.
- `/admin/*` — `RequireAdmin` (needs `is_platform_admin`); non-admins bounced to `/app`.
- `/app/*` — `RequireTenant` (needs `tenant_id`); non-tenant users bounced to `/admin`.
- `/no-access` — signed-in users with **neither** a tenant nor admin rights (e.g. an
  orphaned account, or a suspended tenant's owner). Has a sign-out.
- `/` → redirects to `/app`.
- Authenticated `/app` and `/admin` render inside **AppHeader** (app name, language
  switcher, sign-out).

Guard targeting avoids redirect loops: a user with no tenant and not an admin lands on
`/no-access` rather than ping-ponging between `/app` and `/admin`.

## 6. Flows

### 6.1 Onboard a business (platform admin) — BUILT
1. Admin signs in → `/admin` (Businesses list).
2. Clicks **New business**, enters business name + owner email + owner full name.
3. Frontend calls the **`create-business` Edge Function** (service_role), which:
   - authoritatively verifies the caller is a platform admin (DB check, not just the claim),
   - generates a random **temp password**,
   - creates the owner auth user (email pre-confirmed),
   - inserts the `tenant`, the owner `profile` (role `owner`), and a default **"Main Branch"**,
   - on any failure after user creation, deletes the orphaned auth user (atomic),
   - returns the new business + the **temp password shown once**.
4. Admin relays the temp password to the owner (out of band). Owner can change it later.

### 6.2 Suspend / reactivate a business — BUILT
- Admin toggles a business's `status` in the list (`tenants.status` update via RLS).
- Suspended → on the owner's next token the auth hook withholds the tenant claim → owner
  is blocked at `/no-access`. Reactivate restores access on next login/refresh.

### 6.3 Sign in & land in the right place — BUILT
- Platform admin → `/admin`. Tenant owner/manager → `/app`. Orphan/suspended → `/no-access`.

### 6.4 Tenant app shell + shop setup — BUILT (Plan 3A)
Tenant owners log in and land on `/app/branches` inside a sidebar shell. The shell renders
a permanent left sidebar at `lg` (1024 px +) breakpoints and a hamburger → drawer on mobile.
The sidebar mirrors to the right in RTL (Arabic). Nav links: Branches, Packages, Staff;
Queue and Dashboard are placeholders marked "coming soon".

**Shop setup CRUD (fully built):**
- **Branches** (`/app/branches`): list, create, edit, delete. "Main Branch" seeded by
  onboarding. Delete blocked if branch has associated wash orders.
- **Packages** (`/app/packages`): list, create, edit, activate/deactivate, delete.
  Fields: name, price, optional duration (minutes), is_active.
- **Staff** (`/app/staff`): list, create, edit, activate/deactivate, delete. Fields:
  name, optional phone, optional branch assignment, is_active.

All three tables are RLS-isolated per tenant (enforced by `current_tenant_id()` claim).
All pages are i18n/RTL/responsive (375 px mobile through 1280 px desktop, en + ar).

### 6.5 Customers & Vehicles — BUILT (Plan 3B)

**`/app/customers`** — full CRUD for customers and per-customer vehicles, plus a
live plate search widget.

**Customers CRUD:**
- List view shows name, phone, vehicle count, and action buttons (Vehicles / Edit / Delete).
- **New customer** dialog: name (required), phone (optional).
- **Edit customer** dialog: update name / phone.
- **Delete customer**: `window.confirm` with copy "Deleting this customer will unlink
  their vehicles. Continue?" — on confirm, customer is deleted and vehicles have their
  `customer_id` set to NULL (via `ON DELETE SET NULL` FK).
- After any mutation the customer list auto-refreshes.

**Per-customer vehicles (CustomerDetailDialog):**
- Opened from the "Vehicles" button in the customer list row, or by clicking a plate
  search result.
- Shows customer name + phone, then a table of linked vehicles (plate, make, model,
  color) with **Add vehicle / Edit vehicle / Delete vehicle** actions.
- Vehicle count in the customer list row reflects the live count.
- All vehicle mutations trigger `onChanged()` to refresh the outer customer list.

**Plate search (PlateSearch component):**
- Debounced (300 ms) `ilike '%<normalised_term>%'` query against `vehicles.plate_number`.
- `normalizePlate()` (in `src/lib/tenant/plate.ts`): trims, collapses inner whitespace,
  uppercases. Applied before building the query term.
- LIKE wildcards (`%`, `_`, `\`) are escaped client-side (`vehicles.ts:searchVehiclesByPlate`)
  before being passed to PostgREST `ilike`, so a literal `%` does **not** match all rows.
- Results show plate, make+model, and "Owner: <name>" (via PostgREST join to `customers`).
- No results → "No vehicles found." state. Blank input → idle (no query).
- Clicking a result opens the customer's detail dialog.
- Search is scoped to the tenant by RLS (`tenant_isolation` policy on `vehicles`).

**Tenant isolation:** both `customers` and `vehicles` carry `tenant_id` and are
protected by the `tenant_isolation` RLS policy (`tenant_id = current_tenant_id()`).
Verified by pgTAP test `0012_customers_vehicles_rls_test.sql` (5 assertions).

**Audit:** every customer INSERT/UPDATE/DELETE is captured by the `audit_customers`
trigger (`write_audit` function) into `audit_log`; readable under the `audit_read` RLS
policy (tenant A reads only its own rows).

### 6.6 Tenant operations — PLANNED (Plan 3C)
The counter workflows for tenant owners:
- **New wash:** find/create customer → plate-search/create vehicle → pick package
  → car enters the **queue** (`waiting`) → assign an employee + mark `in_progress` →
  `done` → record a manual **payment**.
- **Dashboard:** today's revenue, wash counts by status, live queue, per-branch filter.

### 6.7 JWT role claim conflict — RESOLVED (2026-06-11)
**Was:** the `custom_access_token_hook` wrote `role = "owner" | "manager"` into the JWT
claims to carry the app role. PostgREST's default `jwt-role-claim-key = ".role"` then tried
to `SET ROLE owner` on every tenant-authenticated request, but `owner` is not a Postgres
role → `22023` error, so all RLS-scoped reads/writes failed in the browser.
**Fix (migration `0011_auth_hook_app_role.sql`):** the hook now injects the app role under
**`app_role`** and never touches the `role` claim, so `role` stays GoTrue's default
(`authenticated`) and PostgREST sets a valid Postgres role. `src/auth/claims.ts` reads
`payload.app_role` (the public `AppClaims.role` field is unchanged). Verified at the token
level (owner token: `role="authenticated"`, `app_role="owner"`, `tenant_id` present) and
end-to-end (`GET /rest/v1/branches` with the owner bearer token → HTTP 200).

## 7. Cross-cutting conventions

- **i18n:** all user-facing strings come from `src/i18n/locales/{en,ar}.json` (identical key
  sets, parity-tested). Default auto-detects; falls back to **Arabic**. Choice persists per
  device (`localStorage` key `lng`).
- **RTL:** `<html dir>` follows the language; UI uses **logical** Tailwind utilities so
  layouts mirror. Arabic uses the self-hosted **Cairo** font; English uses Geist.
- **Responsive:** tablet-first; every screen works at mobile (~375px) and tablet
  (~768–1024px) in both LTR and RTL.
- **Audit:** key tables are audit-logged via DB triggers.

## 8. Build status & scope

- **Plan 1 — Foundation:** DONE. Schema, RLS, auth hook, audit, login, guards.
- **Arabic/RTL + responsiveness:** DONE.
- **Plan 2 — Admin Console:** DONE. Seed/bootstrap, `create-business` Edge Function,
  enforced suspend, businesses list + create dialog.
- **Plan 3A — Tenant App Shell + Shop Setup:** DONE. Sidebar shell, branches/packages/
  employees CRUD, i18n/RTL/responsive, pgTAP RLS isolation tests. (The JWT role-claim
  conflict that previously blocked browser data-fetch is now RESOLVED — see 6.7.)
- **Plan 3B — Customers, Vehicles & Plate Search:** DONE. `/app/customers` with full
  customer CRUD, per-customer vehicle CRUD (nested detail dialog), debounced plate search
  with wildcard-escaped `ilike` query, RTL/responsive at 375 px–820 px, pgTAP RLS
  isolation test `0012_customers_vehicles_rls_test.sql` (5 assertions: isolation,
  plate search, audit trigger). `CustomerDetailDialog` overflow fix applied
  (`min-w-0` on flex column + table wrapper). See section 6.5.
- **Plan 3C — Operations / Queue / Payments:** NEXT (see 6.6).

**Deferred (not in MVP):** inventory/chemicals, assets/machines/depreciation,
payroll/commission, analytics suite, ratings/performance, appointments/booking, push
notifications, real payment processing, admin usage-metrics/billing, support impersonation,
email-invite onboarding (we use temp-password), per-user/server-side language persistence,
multi-owner-per-tenant, editing an owner's email/password from admin.

## 9. Known follow-ups / tech debt

- ~~**JWT role claim conflict (HIGH):**~~ **RESOLVED 2026-06-11** — the hook now carries the
  app role under `app_role` (migration `0011_auth_hook_app_role.sql`) and leaves the JWT
  `role` claim as `authenticated`, so PostgREST sets a valid Postgres role. See section 6.6.
- Rotate the Supabase **DB password** before production (was shared in chat). See CLAUDE.md.
- `create-business` duplicate-email detection relies on GoTrue error-string matching
  (fails closed to 500 if wording changes) — consider checking the error code/status.
- Temp password is returned in the function response body (by design) — could move to an
  email-invite/reset-link flow later.
- Suspension takes effect on next token refresh (≤ ~1h) for live sessions, not instantly.
- Bundle is a single ~704 kB chunk (post 3A) — code-split as the app grows.

---

*Specs and implementation plans live in `docs/superpowers/specs/` and
`docs/superpowers/plans/`. This document summarizes their current, in-effect outcome — when
they diverge, the running code + this file win.*
