# Car Wash System — Business Logic & Flows

> **Living document.** This is the single source of truth for the product's domain
> model, business rules, and flows. Whenever business logic, a flow, the data model,
> roles/permissions, or scope changes, **update this file in the same change** (it's a
> required step — see CLAUDE.md). Keep it accurate to what the code actually does; mark
> anything not yet built as **Planned**.

Last updated: 2026-06-12 (Plan 3 COMPLETE — Egyptian structured plate model: PlateInput (3 Arabic letters + 1–4 digits), per-tenant DB unique index, numeral-agnostic search, pgTAP uniqueness test `0015`).

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
- **`vehicles`** — `tenant_id`, `customer_id`, `plate_letters` (3 Arabic letters),
  `plate_digits` (1–4 Western digits), `plate_number` (derived canonical form
  `"<letters> <digits>"`; indexed for `ilike` search), `make`, `model`, `color`.
  Per-tenant uniqueness enforced by DB unique index
  `vehicles_tenant_plate_unique(tenant_id, plate_letters, plate_digits)` — the same plate
  may exist across different tenants but never twice within the same tenant.
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

**Egyptian structured plate model (migration `0012_egyptian_plate.sql`):**
Vehicles use the **Egyptian licence plate format**: 3 Arabic letters + 1–4 digits.

- **Storage:** `plate_letters` (text, 3 Arabic Unicode letters) + `plate_digits` (text,
  1–4 Western digits) + derived `plate_number` (`"<letters> <digits>"`, e.g. `"أبج 123"`).
- **Per-tenant uniqueness:** DB unique index `vehicles_tenant_plate_unique(tenant_id,
  plate_letters, plate_digits)`. Duplicate within the same tenant → SQLSTATE `23505`
  (HTTP 409). The same plate can coexist across different tenants (per-tenant, not global).
  Verified by pgTAP test `0015_plate_unique_test.sql` (3 assertions).
- **Structured PlateInput component** (`src/components/tenant/PlateInput.tsx`): renders
  3 individual letter boxes in `dir=rtl` order (rightmost = first letter, matching the
  physical plate), a digits box with `inputMode="numeric"`, and a live preview showing
  the formatted plate. Focus advances automatically box-to-box. Min-height ≥ 44 px.
- **Validation** (`validateEgyptianPlate` in `src/lib/tenant/validators.ts`): exactly 3
  Arabic letters (non-tatweel) + 1–4 digits required before submitting.
- **Plate helpers** (`src/lib/tenant/plate.ts`):
  - `normalizePlateLetters`: strips spaces/tatweel, keeps only Arabic letters.
  - `normalizePlateDigits`: converts Arabic-Indic digits (٠١٢٣…) to Western and strips
    non-digit chars; used on the digits input.
  - `canonicalPlate(letters, digits)`: builds the stored `plate_number` string.
  - `normalizePlateSearch(term)`: converts Arabic-Indic digits in the search term to
    Western before querying — enables **numeral-agnostic search** (typing `١٢٣` or `123`
    both match a vehicle stored as `"أبج 123"`).
  - `formatPlate(letters, digits, locale)`: display form with spaced letters; in `ar`
    locale digits are converted back to Arabic-Indic for display.
- **Duplicate error:** `createVehicle`/`updateVehicle` catch SQLSTATE `23505` and throw
  `new Error("duplicate")`; VehicleDialog and NewWashDialog surface `t("vehicles.errors.duplicate")`
  ("A vehicle with this plate already exists.") with the dialog staying open.

**Per-customer vehicles (CustomerDetailDialog):**
- Opened from the "Vehicles" button in the customer list row, or by clicking a plate
  search result.
- Shows customer name + phone, then a table of linked vehicles (plate, make, model,
  color) with **Add vehicle / Edit vehicle / Delete vehicle** actions.
- Vehicle count in the customer list row reflects the live count.
- All vehicle mutations trigger `onChanged()` to refresh the outer customer list.

**Plate search (PlateSearch component):**
- Debounced (300 ms) `ilike '%<normalised_term>%'` query against `vehicles.plate_number`.
- `normalizePlateSearch()` (in `src/lib/tenant/plate.ts`) converts Arabic-Indic digits to
  Western before querying — **numeral-agnostic**: entering `١٢٣` finds `أبج 123`.
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

### 6.6 Tenant operations — BUILT (Plan 3C)

**`/app/queue`** — the counter-operator's main screen. A 3-column Kanban board
(Waiting / In Progress / Done) scoped to the currently-selected branch.

**Branch context:** the header branch selector (BranchSelector component) persists
the chosen branch in `localStorage` via BranchProvider. All queue reads/writes use this
`branchId`. Switching branches re-fetches and filters to that branch only.

**Wash order status flow:**
```
waiting → in_progress → done
       ↘              ↘
        cancelled      cancelled
```
- `waiting`: car arrived, in queue. Actions: **Start** (→ in_progress), **Cancel**.
- `in_progress`: actively being washed. Actions: **Complete** (→ done), **Cancel**.
- `done`: finished. No further status changes. Shows **paid/unpaid** + remaining balance.
- `cancelled`: removed from board (not displayed). Allowed from `waiting` or `in_progress`.
- Status transitions validated both client-side (`canTransition()` in `operations.ts`) and
  enforced by the DB state machine via `wash_orders.status` update.

**New wash dialog (NewWashDialog):**
- Free-text plate search field (debounced, numeral-agnostic via `normalizePlateSearch`) —
  picks an existing vehicle from results or expands to the **structured PlateInput**
  (3-box letters + digits, same as VehicleDialog) when "New vehicle" is clicked.
- A duplicate plate in the new-vehicle path surfaces `t("vehicles.errors.duplicate")`
  (SQLSTATE `23505`), keeping the dialog open.
- Optional customer quick-create (name + phone).
- Package selector: choose from active packages; price auto-fills from the package.
- Price is overridable (default from package, editable before submit).
- Notes optional.
- On submit: creates vehicle + optional customer if new, then inserts `wash_order` with
  `status = 'waiting'`.

**Start flow (AssignStartDialog):**
- "Start" button opens a dialog to optionally assign an active employee.
- Commits `status = 'in_progress'`, `started_at`, and `assigned_employee_id`.

**Complete:**
- "Complete" button sets `status = 'done'`, `completed_at = now()`.

**Cancel:**
- `window.confirm` guard, then sets `status = 'cancelled'`.
- Cancelled orders leave the board immediately (filter excludes `cancelled`).

**Done column visibility rule:**
- Shows today's done orders (by local calendar day) PLUS any done orders that are still
  unpaid (regardless of day) — so unpaid done orders persist until payment is recorded.
- Realtime / kanban-drag: **deferred** (board refreshes on each action, not live-pushed).

**Manual payments (PaymentDialog):**
- Accessible on `done` + `unpaid` orders via "Record payment" button.
- Amount field defaults to the remaining balance (price − sum of prior payments).
- Method: cash | card | transfer.
- Multiple partial payments supported: each payment recorded as a `payments` row.
- `isPaid()` = sum of all `payments.amount` ≥ `wash_orders.price`.
- Card shows "Paid" badge when fully paid; "Unpaid" + "Remaining: N" when not.

**Tenant isolation:** `wash_orders` and `payments` carry `tenant_id` and `branch_id`;
RLS (`tenant_isolation` policy) ensures each tenant sees only its own data. Verified by
pgTAP test `0013_operations_rls_test.sql` (5 assertions: isolation from other tenant,
status update persistence, audit trigger on both tables).

**Audit:** every `wash_orders` INSERT/UPDATE/DELETE and every `payments` INSERT fires
the `write_audit` trigger → `audit_log` row. Readable by tenant owner under `audit_read`
RLS policy.

**Responsive/RTL:** board columns stack at < 1024 px (single column), display side-by-side
at ≥ 1024 px (`lg:grid-cols-3`). RTL mirrors sidebar to right, column order inverts
logically (Done on visual-left in RTL = logical-start). New Wash dialog scrolls/fits
at 375 px. No horizontal overflow at 375 px or 820 px. Cairo font in Arabic.

### 6.7 Dashboard — BUILT (Plan 3D)

**`/app/dashboard`** — the default landing page after sign-in (`/app` → redirect to
`/app/dashboard`). Shows KPI cards for the currently-selected branch scoped to today
(local calendar day).

**KPI cards:**
- **Revenue today:** sum of `payments.amount` where `paid_at >= local midnight` for the
  branch. Payments are joined to `wash_orders` and filtered by `branch_id`. Using
  `paid_at` (not order date) correctly captures payments made today on older unpaid-done
  orders — cross-day correct. Revenue = 0 for branches with no payments today.
- **Washes today:** count of `wash_orders` where `created_at >= local midnight` for the
  branch, regardless of status.
- **Status breakdown:** Waiting / In Progress / Done / Cancelled counts from today's orders.
- **Empty state:** when both revenue and washes are 0, shows "No activity today." message.

**Branch context:** uses the same `BranchProvider`/`BranchSelector` as the queue page.
Switching branches in the header immediately re-fetches and updates all KPI cards.

**Refresh button:** manual refresh re-fetches all KPI data. 44px min touch-target.

**Tenant isolation:** enforced by RLS (`tenant_isolation` policy on `payments` and
`wash_orders`). Verified by pgTAP test `0014_dashboard_rls_test.sql` (3 assertions:
revenue sum scoped to branch A, wash count scoped to branch A, row-level isolation check).

**Responsive/RTL:**
- KPI cards: `grid-cols-1` at mobile (375 px), `sm:grid-cols-2` at ≥ 640 px,
  `lg:grid-cols-4` at ≥ 1024 px. No horizontal overflow at 375 px or 820 px.
- RTL: Arabic labels ("إيرادات اليوم", "غسيل اليوم", etc.), `dir=rtl` on html,
  Cairo font, header mirrors correctly.
- RTL 375 px overflow bug **fixed** (2026-06-12): header right-side flex container
  (`BranchSelector + LanguageSwitcher + SignOut`) was 4 px too wide in RTL; fixed by
  adding `min-w-0 overflow-hidden` to the container and `shrink` + `max-w-[130px]` to
  `BranchSelector`. Verified: `body.scrollWidth === body.clientWidth = 375` after fix.

### 6.8 JWT role claim conflict — RESOLVED (2026-06-11)
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

### 6.9 Vite dep-cache React-duplicate bug — RESOLVED (2026-06-12)
**Was:** after running `supabase test db` (which populates `node_modules/.deno/` with its
own React copy), the Vite pre-bundle cache in `node_modules/.vite/deps/` became stale and
resolved React in `@radix-ui/react-select` from a different instance than `react-dom`. This
triggered the "Cannot read properties of null (reading 'useMemo')" crash on `/app/queue` —
the entire route was unmounted by React Router's default error boundary.
**Permanent fix (2026-06-12):** `vite.config.ts` now sets `resolve.dedupe: ["react",
"react-dom"]`, so Vite always pre-bundles a single React copy even when a stray
`node_modules/.deno/react` exists — the dual-instance crash can no longer occur. (If a dev
server was already running from before this fix, restart it once to pick up the config.)
This was the root cause of the "Start a wash (waiting→in_progress) gives an error" report:
the operation itself is correct at every layer (verified via REST 204 and a full browser
run of Start/Complete/Payment); the error was the stale dual-React bundle crashing the
queue's dialogs, now prevented by dedupe.

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
- **Egyptian plate model (Task 5):** DONE. Vehicles use Egyptian structured plate:
  3 Arabic letters + 1–4 digits stored as `plate_letters`/`plate_digits` +
  derived `plate_number`. Per-tenant uniqueness enforced by DB unique index
  `vehicles_tenant_plate_unique`. Structured `PlateInput` component (3 RTL letter
  boxes + digits + preview). Numeral-agnostic search (Arabic-Indic ↔ Western). Duplicate
  plate shows friendly error; dialog stays open. pgTAP test `0015_plate_unique_test.sql`
  (3 assertions: duplicate rejected SQLSTATE 23505, same plate coexists across tenants,
  RLS isolation). All 18 pgTAP files pass (54 assertions); 39 unit tests pass. See section 6.5.
- **Plan 3C — Operations / Queue / Payments:** DONE. `/app/queue` with 3-column Kanban
  board (Waiting / In Progress / Done), branch context selector, New Wash dialog (plate
  search/create, customer quick-add, package picker, price override, notes), Start +
  Assign Employee dialog, Complete + Cancel actions, manual payment recording with partial-
  payment support, paid/unpaid + remaining display. RTL/responsive at 375–1280 px, en + ar.
  pgTAP RLS isolation test `0013_operations_rls_test.sql` (5 assertions). Vite dep-cache
  React-duplicate crash found and resolved (see 6.9). Realtime/kanban-drag deferred.
- **Plan 3D — Dashboard:** DONE. `/app/dashboard` as default `/app` landing. KPI cards:
  Revenue today (sum of `payments.paid_at` today, cross-day correct), Washes today,
  status breakdown (Waiting / In Progress / Done / Cancelled). Branch-scoped via header
  selector. Manual Refresh button. RTL/responsive at 375–1280 px, en + ar. RTL 375 px
  overflow fix applied (header right-side flex container). pgTAP RLS isolation test
  `0014_dashboard_rls_test.sql` (3 assertions: revenue isolation, count isolation, row
  visibility). See section 6.7.

**Plan 3 — COMPLETE (3A + 3B + 3C + 3D + Egyptian plate model all done).**

**Deferred (not in MVP):** inventory/chemicals, assets/machines/depreciation,
payroll/commission, analytics suite, ratings/performance, appointments/booking, push
notifications, real payment processing, admin usage-metrics/billing, support impersonation,
email-invite onboarding (we use temp-password), per-user/server-side language persistence,
multi-owner-per-tenant, editing an owner's email/password from admin.

## 9. Known follow-ups / tech debt

- ~~**JWT role claim conflict (HIGH):**~~ **RESOLVED 2026-06-11** — the hook now carries the
  app role under `app_role` (migration `0011_auth_hook_app_role.sql`) and leaves the JWT
  `role` claim as `authenticated`, so PostgREST sets a valid Postgres role. See section 6.8.
- ~~**Vite dep-cache React-duplicate crash:**~~ **RESOLVED 2026-06-12** — stale vite
  pre-bundle cache after `supabase test db` run caused dual-React instance. Fix: delete
  `node_modules/.vite` and restart dev server. See section 6.9.
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
