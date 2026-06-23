# Car Wash System — Business Logic & Flows

> **Living document.** This is the single source of truth for the product's domain
> model, business rules, and flows. Whenever business logic, a flow, the data model,
> roles/permissions, or scope changes, **update this file in the same change** (it's a
> required step — see CLAUDE.md). Keep it accurate to what the code actually does; mark
> anything not yet built as **Planned**.

Last updated: 2026-06-23 (a wash can't go `in_progress` without an assigned staff member — Start dialog requires a staff selection, DB CHECK constraint `wash_orders_in_progress_needs_employee` migration 0019; see §6 Operations/Start flow. Earlier 2026-06-20: transactional email via Resend — invites & password resets send a secure set-password link instead of a temp password; create-business + manage-users email + return the link, new `/set-password` screen, bilingual templates; see §6.1, §6.11, §6.12. Earlier 2026-06-17: sidebar icons; customers created-`branch_id` (migration 0018); per-tab `BranchFilter` replacing the navbar dropdown; roles & permissions branch-scoped sub-users, migrations 0016/0017 — §6.5/§6.6/§6.7/§6.11).

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
| **Tenant manager (sub-user)** | Branch-scoped staff the owner adds | `/app` (limited) | `profiles.role = 'manager'` + `user_branches` + `profiles.permissions`; JWT `app_role` + `branch_ids` + `permissions` |
| **Employee (washer)** | Staff who perform washes | — (not a login) | a row in `employees`; **not** an auth user |

Operations are **counter-operated**: owner/managers run everything from a tablet at the
counter. The **owner** has full access to all branches and manages users + branches. A
**manager** is a sub-user the owner creates, **scoped to one or more branches** and granted
**per-tab `view`/`edit` permissions** (see §6.11). Washers are records, not logins.

## 3. Tenancy & security model (the backbone)

- Every operational row carries a **`tenant_id`**. Branch-scoped rows also carry `branch_id`.
- A Supabase **auth hook** (`custom_access_token_hook`) injects `tenant_id`, `app_role`,
  `is_platform_admin`, and — for sub-users — `branch_ids` (from `user_branches`) and
  `permissions` (from `profiles.permissions`) into the JWT at token-issue time. The app role is
  carried under **`app_role`** (not `role`): the JWT `role` claim is left as GoTrue's default
  (`authenticated`) so PostgREST's role switching (`jwt-role-claim-key` = `role`) sets a valid
  Postgres role.
- **Postgres RLS** enforces isolation on every table: `tenant_id = current_tenant_id()`
  where `current_tenant_id()` reads the `tenant_id` JWT claim. A tenant physically cannot
  read or write another tenant's rows.
- **Branch + permission gating (sub-users)** layers on top of tenant isolation via helpers
  `current_app_role()`, `current_branch_ids()`, `current_permission()`, `can_access_branch()`,
  `can_edit()`: `wash_orders`/`employees` reads are limited to the user's branch(es), `branches`
  reads to the user's branch(es); writes require the matching tab's `edit` permission
  (`queue`/`staff`/`customers`/`packages`), and `branches` writes are owner-only. Owners
  short-circuit every check (full access). This is the real boundary; the UI gating (hidden
  tabs, disabled controls) is defense-in-depth. See §6.11.
- **`platform_admins`** is RLS-locked and revoked from `anon`/`authenticated` — only
  `service_role` / SECURITY DEFINER functions touch it (prevents privilege escalation).
- **Suspension / deactivation is enforced in the auth hook:** if the user's tenant
  `status <> 'active'` **or the sub-user's `profiles.is_active = false`**, the hook withholds the
  tenant claims. With no tenant claim, RLS returns nothing and the user is routed to
  `/no-access`. Effective on the next token refresh (≤ ~1h) for already-logged-in users.
- Secrets: frontend uses the **anon key only**; `service_role` key and DB password never
  reach the client. The `create-business` and `manage-users` Edge Functions are the only paths
  using service_role.

## 4. Data model (current)

Entities (all under Postgres `public`, all tenant-scoped except platform tables):

- **`tenants`** — a carwash business. `name`, `status` (`active` | `suspended`), `created_at`.
- **`platform_admins`** — `user_id` → an auth user who is a platform admin.
- **`branches`** — `tenant_id`, `name`, `address`. A tenant's physical locations.
- **`profiles`** — links an auth user to a tenant + role. `user_id`, `tenant_id`,
  `role` (`owner` | `manager`), `full_name`, `permissions` (jsonb per-tab `view`/`edit` map —
  managers only; owners ignore it), `is_active` (owner can deactivate a sub-user).
- **`user_branches`** — which branches a `manager` sub-user is responsible for. `tenant_id`,
  `user_id`, `branch_id` (PK `user_id`+`branch_id`, all FKs cascade). Owners need no rows
  (they see all branches). Tenant-isolated by RLS.
- **`customers`** — `tenant_id`, `name`, `phone`, `branch_id` (the branch where the customer
  was first registered — informational; customers stay tenant-wide/visible across branches).
- **`vehicles`** — `tenant_id`, `customer_id`, `plate_letters` (3 Arabic letters),
  `plate_digits` (1–4 Western digits), `plate_number` (derived canonical form
  `"<letters> <digits>"`; indexed for `ilike` search), `make`, `model`, `color`.
  Per-tenant uniqueness enforced by DB unique index
  `vehicles_tenant_plate_unique(tenant_id, plate_letters, plate_digits)` — the same plate
  may exist across different tenants but never twice within the same tenant.
- **`packages`** — wash offerings. `tenant_id`, `name`, `description` (optional free text),
  `price`, `duration_minutes`, `is_active`.
- **`employees`** — washers (not users). `tenant_id`, `branch_id`, `name`, `phone`,
  `is_active`.
- **`wash_orders`** — the operations hub. `tenant_id`, `branch_id`, `customer_id`,
  `vehicle_id`, `package_id`, `assigned_employee_id`, `status`
  (`waiting` → `in_progress` → `done` → `cancelled`), `price`, `notes`, timestamps
  (`created_at`/`started_at`/`completed_at`/`cancelled_at`), and `cancellation_reason` (a required
  reason captured when a wash is cancelled).
- **`payments`** — `tenant_id`, `wash_order_id`, `amount`, `method` (`cash` | `card` |
  `transfer`), `paid_at`. (Manual recording — no real processor in MVP.)
- **`audit_log`** — generic trigger-written log (`tenant_id`, `table_name`, `row_id`,
  `action`, `actor`, `at`) on `wash_orders`, `payments`, `customers`.
- **`push_subscriptions`** — one row per browser/device web-push subscription
  (`tenant_id`, `user_id`, `endpoint` (unique), `p256dh`, `auth`, `lang`, `user_agent`,
  `created_at`). `tenant_id` defaults to `current_tenant_id()` and `user_id` to `auth.uid()`
  **server-side via column DEFAULTs**, so the client only ever sends the push fields and
  cannot spoof another tenant. Tenant-isolated by the `tenant_isolation` RLS policy; read by
  the `notify-wash-event` edge function with the `service_role` to send pushes. (Migration
  `0014_push_subscriptions.sql`; pgTAP `0017_push_subscriptions_test.sql`.)

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
   - creates the owner auth user (random password the owner never uses; email pre-confirmed),
   - inserts the `tenant`, the owner `profile` (role `owner`), and a default **"Main Branch"**,
   - on any failure after user creation, deletes the orphaned auth user (atomic),
   - generates a Supabase **set-password (invite) link**, emails it via Resend, and returns the
     link + an `emailed` flag.
4. The owner gets an **invite email** to set their own password (see §6.12); the admin screen
   also shows a **copy-able link** to hand over directly if email is delayed.

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
  Fields: name, optional description (free text, shown as a subtitle in the list),
  price, optional duration (minutes), is_active.
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

**Per-customer vehicles + wash history (dedicated page `/app/customers/:id`):**
- Opened from the "Vehicles" button in the customer list row, or by clicking a plate
  search result.
- Shows customer name + phone, then a table of linked vehicles (plate, make, model,
  color) with **Add vehicle / Edit vehicle / Delete vehicle** actions.
- Vehicle count in the customer list row reflects the live count.
- All vehicle mutations trigger `onChanged()` to refresh the outer customer list.
- Below the vehicles, a **Wash history** table lists the customer's recent washes (date,
  plate, package, status, price, paid/unpaid) via `listCustomerWashes(customer_id)`
  (`useCustomerWashes`, keyed under `["washes"]` so wash mutations refresh it).
- The **Washes** history page also has a debounced plate-number search (numeral-agnostic via
  `normalizePlateSearch`, inner-joins `vehicles` when active).

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

**Branch context:** an in-page **branch filter** at the top of the Queue (`BranchFilter`
component) persists the chosen branch in `localStorage` via BranchProvider — the same shared
context the Dashboard's filter reads, so a pick on one carries to the other. All queue
reads/writes use this `branchId`; switching re-fetches and filters to that branch only. The
filter is **hidden when the user has a single branch** (single-branch tenants and members
locked to one branch). New Wash uses the selected branch. (The old global navbar dropdown was
removed in favor of these per-tab filters.)

**Wash order status flow:**
```
waiting → in_progress → done
       ↘              ↘
        cancelled      cancelled
```
- `waiting`: car arrived, in queue. Actions: **Start** (→ in_progress, requires an assigned
  staff member), **Cancel**.
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
- "Start" button opens a dialog to assign an active employee. **A staff member is required**
  — the dialog has no "no employee" option and the Start button stays disabled until one is
  selected (`validateStart()` in `operations.ts`).
- Commits `status = 'in_progress'`, `started_at`, and `assigned_employee_id`.
- **A wash cannot be `in_progress` without an assigned staff member** — enforced at the DB by
  CHECK constraint `wash_orders_in_progress_needs_employee` (migration 0019), plus a guard in
  `startWashOrder()`. If a branch has no staff, you must add staff before starting a wash.

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

**Branch context:** the Dashboard has its own in-page `BranchFilter` (top-right, beside
Refresh) bound to the same shared `BranchProvider` as the Queue — switching re-fetches and
updates all KPI cards. Hidden when the user has a single branch.

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

### 6.7a Analytics / Statistics — BUILT

**`/app/analytics`** — a tenant-wide analytics dashboard over a chosen **date range** and
**branch** (default: last 30 days, all branches). Reachable from the sidebar (`nav.analytics`,
chart icon, placed right after Dashboard).

**Data path:** `listWashesForStats({ from, to, branchId })` (`src/lib/tenant/washes.ts`)
fetches **all** matching `wash_orders` in the range with no pagination, capped at
`STATS_LIMIT = 5000` rows (ordered newest-first), embedding package/branch/employee names
and `payments(amount, paid_at)`. RLS scopes to the tenant automatically; the branch filter is
optional ("all" = no branch filter). A `capped` flag is returned when the row cap is hit so
the UI can note "showing first N". The `useWashStats` query hook (`queries.ts`,
`placeholderData: keepPreviousData` for smooth refilter) runs the records through a **pure,
unit-tested aggregation module** `src/lib/tenant/wash-stats.ts` (`computeWashStats`) in its
`select`. The aggregations are empty-safe (zeros / nulls / empty arrays) and use
locale-independent `YYYY-MM-DD` day keys.

**Metrics (all pure functions in `wash-stats.ts`, tested in `wash-stats.test.ts`):**
- **KPIs:** total revenue (sum of all payments in range), wash count, avg ticket
  (revenue ÷ completed count, null-guarded), completion rate (done ÷ total), avg wait
  (`diffMinutes(created_at, started_at)` over started washes), avg service
  (`diffMinutes(started_at, completed_at)` over completed washes).
- **Time series:** `revenueByDay` (by each payment's `paid_at` day — cross-day correct),
  `washesByDay` (by `created_at`), `washesByWeekday` (Sun–Sat), `washesByHour` (0–23).
- **Breakdowns:** `statusBreakdown` (waiting/in_progress/done/cancelled), `topPackages`
  (count + revenue), `byBranch` (count + revenue), `cancellationsByReason` (cancelled only),
  `topEmployees` (completed-wash count per employee).

**UI (`src/pages/tenant/AnalyticsPage.tsx`):** card-based, teal-accented, icon-chip card
headers matching the WashDetail design. KPI cards row + a charts grid built with **Recharts**
via the **shadcn chart component** (`src/components/ui/chart.tsx`): revenue trend (area, full
width, teal gradient), washes-by-status donut (status colors matching `statusBadgeClass`),
busiest weekdays (bar, localized labels), busiest hours (bar, `HH:00`), top packages
(horizontal bar, revenue in tooltip), by-branch (washes + revenue bars, rendered only when
>1 branch), cancellations-by-reason (ranked list + share bars), top employees (ranked list).
Skeleton loading mirrors the KPI + charts layout; empty state when no washes in range; error
state with retry; a subtle note when the data cap is hit. Fully i18n (`analytics.*` +
`nav.analytics` in en/ar, parity-tested), RTL-correct (logical utilities; numeric axes stay
LTR per convention), tablet-first responsive (KPI grid + charts reflow at 375 px). Uses the
anon Supabase client (RLS-scoped).

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

### 6.10 PWA + Web Push notifications — IN PROGRESS (Plan: pwa-push-notifications)

The app is an installable **PWA** with a custom service worker that handles `push` and
`notificationclick` (Phase 1 — DONE). **Web push** for wash-lifecycle events is delivered
per-tenant (Phase 2).

**Events that notify (per tenant):**
1. **New wash queued** — `wash_orders` INSERT with status `waiting` → `queued`.
2. **Wash completed** — `wash_orders` UPDATE where status transitions to `done` and the wash
   is fully paid (sum of `payments.amount` ≥ `price`) → `completed`.
3. **Wash done & awaiting payment** — the same `done` transition when paid < `price` →
   `done_unpaid`.
4. **Long wait (> 15 min)** — **Planned** (Phase 3, `pg_cron` + `wait_notified_at`).

**Subscriptions:** the **Enable-notifications** toggle (bell) in the tenant header
(`NotificationsToggle` in `TenantLayout`) requests Notification permission, subscribes via the
service worker's `PushManager` using `VITE_VAPID_PUBLIC_KEY`, and **upserts** the subscription
(by `endpoint`) into `push_subscriptions` through the **anon** client — `tenant_id`/`user_id`
are filled by DB defaults. Unsubscribe removes the `PushManager` subscription and deletes the
row. The control reflects state (subscribed / unsubscribed / denied / unsupported); on browsers
without push (e.g. iOS Safari before "Add to Home Screen") it shows a disabled bell with a hint
rather than disappearing. Localized (en/ar), RTL, ≥ 44 px. Per device.
(`src/lib/notify/subscriptions.ts`: `pushSupported`, `currentPushState`, `enablePush`,
`disablePush`; VAPID-key encoder `src/lib/notify/push.ts`.)

**Send pipeline — `notify-wash-event` edge function** (`supabase/functions/notify-wash-event/`):
receives a Supabase **Database Webhook** payload (`{ type, record, old_record }`) for
`public.wash_orders` INSERT + UPDATE. A **pure** classifier (`classify.ts`, Deno-tested)
maps the row change to `queued` / `completed` / `null`. For a `completed` (→`done`) result the
function queries `payments` for that wash (via **service_role**) and downgrades to `done_unpaid`
when paid < `price`. It then loads that tenant's `push_subscriptions` (service_role, bypassing
RLS — server-side only) and sends each one a push via **`web-push`** (VAPID), pruning any
subscription that returns **404/410**. Notification copy is a tiny server-side i18n map
(`copy.ts`) keyed by the subscription's `lang`; the body includes the plate when known; title
"WashFlow" (ar "واش فلو"). The function is guarded by an optional shared-secret header
(`WEBHOOK_SECRET`) and returns a JSON summary `{ classified, sent, pruned, … }`.

**Security:** the VAPID **private key** lives only as an edge-function env var
(`VAPID_PRIVATE_KEY`); the **public key** ships to the client (`VITE_VAPID_PUBLIC_KEY`, public
by design). `push_subscriptions` is tenant-isolated by RLS; the send function reads it via
`service_role` server-side only — never exposed to the client. A user only ever receives their
own tenant's events.

**Cloud wiring (per environment — not done in code; see "Build status & scope"):** set
`VITE_VAPID_PUBLIC_KEY` (Vercel) + `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
(and optionally `WEBHOOK_SECRET`) as Supabase function secrets; deploy `notify-wash-event`; and
create a **Database Webhook** on `public.wash_orders` for **INSERT + UPDATE** pointing at the
function URL (with the `x-webhook-secret` header if `WEBHOOK_SECRET` is set). Locally the
function is tested directly (the webhook itself is a cloud step).

### 6.11 Roles & permissions (branch-scoped sub-users) — BUILT

**Goal:** an owner with one or more branches adds **sub-users** (role `manager`) who can run
**specific branches** and access **specific tabs**, at `view` or `edit` level per tab.

**Model.** Two roles via the existing `tenant_role` enum: `owner` (full access, all branches,
manages users + branches) and `manager` (the sub-user). A manager's scope is `user_branches`
(one+ branches) + `profiles.permissions` (a `{tab: 'view'|'edit'}` map; missing = no access).
Gateable tabs: `dashboard`, `analytics` (view-only), `queue`, `washes` (view-only), `customers`,
`packages`, `staff`. `branches` + `users` management are **owner-only**. Wash mutations
(create/start/complete/cancel/pay) are all gated by `queue:'edit'`; the Washes tab is read-only
(history) — RLS can't distinguish a "cancel" UPDATE from a "complete" one.

**Enforcement (two layers).**
- **DB / RLS (the boundary):** the auth hook injects `branch_ids` + `permissions`; helpers
  `can_access_branch()` / `can_edit()` scope `wash_orders`/`employees`/`branches` reads to the
  user's branch(es) and gate writes on the matching `edit` permission (§3). Owners short-circuit.
- **UI (defense-in-depth):** the sidebar hides tabs the user can't `view`; `RequireTabAccess`
  redirects a member who URL-navigates to a non-permitted tab to their first accessible tab;
  `RequireOwner` guards `/app/branches` + `/app/users`; the branch switcher shows only the
  user's branches (the branches-read RLS returns only those); within a permitted tab, edit
  controls (New/Edit/Delete + queue ops) are **disabled (not hidden)** unless the user has `edit`.

**User management.** Owner-only **`/app/users`** lists sub-users (branches + active + feature
count) and an add/edit dialog with email, branch multi-select, and a tab×level permission grid
(**no password field**). All writes go through the **`manage-users`** edge function (service_role,
owner-gated like create-business): `list`/`create`/`update`/`setActive`/`delete`/`resetPassword`.
It only targets `manager` rows in the caller's tenant (never another owner/tenant), validates
that assigned branches belong to the tenant, and rolls back an orphan auth user on partial create.
**Create** emails the new user a set-password (invite) link and **resetPassword** emails a reset
link (both via Resend, see §6.12) — and both **return the link** so the owner can copy/hand it
over directly. No owner-typed passwords. Permission/branch changes take effect on the sub-user's
next token refresh / re-login.

**Tests.** pgTAP `0018` (helpers, hook claims, branch-scoped reads, write-permission gating);
Deno `manage-users/logic.test.ts` (validation + authorization guards); Vitest `claims.test.ts`
(`canView`/`canEdit`/`isOwner`/`visibleBranches`, claim parsing). Migrations `0016` (helpers,
profiles cols, `user_branches`, profiles RLS, auth hook) + `0017` (operational table RLS rewrite).

### 6.12 Transactional email — invites & password resets (Resend) — BUILT (local)

**Goal:** instead of relaying a temporary password, new users (tenant owners via create-business,
sub-users via manage-users) and password resets get a **secure set-password link** by email; the
user clicks it and **sets their own password** — no plaintext password is stored or sent.

**How.** The edge functions generate a Supabase **recovery (set-password) action link**
(`auth.admin.generateLink`, `redirectTo = <appUrl>/set-password`, where `appUrl` is the caller's
browser origin so it's environment-correct), then email it via **Resend** from the shared
`_shared/email.ts` module (branded, **bilingual EN/AR** invite + reset templates;
`RESEND_API_KEY` + `EMAIL_FROM` are function secrets). The link is **also returned** to the
caller so the owner/admin can copy and hand it over — so the flow works even **before** the
sending domain is verified (email is best-effort; the copy-link is the always-available fallback).

**Set-password screen** (`/set-password`, public): Supabase parses the recovery token from the
URL hash (`detectSessionInUrl`), the user picks a password (`auth.updateUser`), then lands in the
app. Invalid/expired links show a friendly message.

**Per-environment config:** `redirectTo` is environment-correct automatically (browser origin),
but Supabase only honors an allow-listed redirect — so each environment's `/set-password` URL must
be in **`additional_redirect_urls`** (local is in `config.toml`; staging/prod set in their auth
config). Sending domain: **`washflow.khalidelewa.com`** (verified in Resend).

**Tests:** Deno `_shared/email.test.ts` (template rendering + soft-fail send) + the manage-users /
create-business validation tests. Cloud go-live: set `RESEND_API_KEY`/`EMAIL_FROM` secrets +
allow-list URLs on staging/prod, redeploy the functions.

## 7. Cross-cutting conventions

- **i18n:** all user-facing strings come from `src/i18n/locales/{en,ar}.json` (identical key
  sets, parity-tested). Default auto-detects; falls back to **Arabic**. Choice persists per
  device (`localStorage` key `lng`).
- **RTL:** `<html dir>` follows the language; UI uses **logical** Tailwind utilities so
  layouts mirror. Arabic uses the self-hosted **Cairo** font; English uses Geist.
- **Responsive:** tablet-first; every screen works at mobile (~375px) and tablet
  (~768–1024px) in both LTR and RTL.
- **Audit:** key tables are audit-logged via DB triggers.
- **Data fetching (reactive):** the frontend uses **TanStack Query**. Components read data
  via query hooks (`src/lib/tenant/queries.ts`, `src/lib/admin-queries.ts`); mutations
  **invalidate the related query keys** on success, so any add/edit/delete refreshes all
  related views automatically (e.g. creating a branch updates the branch filters; recording
  a payment updates the dashboard) — no manual refresh. The branch context
  (`branch-context.tsx`) is a `useBranches()` consumer, so the in-page branch filters
  (Queue + Dashboard) stay reactive. Realtime/multi-client sync is deferred.
- **Confirmations:** destructive actions use a custom `ConfirmDialog` (shadcn AlertDialog,
  `src/components/ui/confirm-dialog.tsx`) — no native `window.confirm`.
- **Session resilience:** a `401` from the data/functions API signs the user out and the
  guards redirect to `/login` (avoids cryptic errors from an expired/revoked session).

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
  plate search, audit trigger). `the customer detail page (`/app/customers/:id`)` overflow fix applied
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

- **Wash detail page (`/app/washes/:id`):** DONE. Read-only detail page for a single wash order — plate + status header, customer (name + phone, name links to `/app/customers/:id`), vehicle, service (package / price / employee / branch), timeline (queued / started / completed or cancelled-at + cancellation reason, wait and service durations), payments breakdown (table of amount + method + paid_at, total paid, remaining, paid/unpaid badge). Reachable by clicking the plate cell in the Washes history list.

- **Analytics / Statistics page (`/app/analytics`):** DONE. Tenant-wide analytics over a date range + branch filter (default last 30 days, all branches). Pure unit-tested aggregation module `wash-stats.ts` (KPIs: revenue, washes, avg ticket, completion rate, avg wait, avg service; series: revenue-by-day, washes-by-day/weekday/hour; breakdowns: status, top packages, by branch, cancellations-by-reason, top employees). Data fetched by `listWashesForStats` (no pagination, capped at 5000, RLS-scoped) via `useWashStats`. Charts built with Recharts + the shadcn chart component (`src/components/ui/chart.tsx`), teal-themed: revenue area trend, status donut, weekday/hour bars, top-packages horizontal bar, by-branch bars (only when >1 branch), cancellations + top-employees lists. KPI cards + icon-chip card headers matching WashDetail quality; skeleton/empty/error states; cap note; en/ar parity (`analytics.*` + `nav.analytics`); RTL + tablet-first responsive. Sidebar link added after Dashboard. Unit tests: `wash-stats.test.ts` (29 tests). See section 6.7a.

- **PWA + Web Push — Phase 1 (PWA foundation):** DONE. `vite-plugin-pwa` (injectManifest),
  custom `src/sw.ts` with precache + offline shell + `push`/`notificationclick` handlers,
  manifest + icons, update toast, pure VAPID-key encoder `src/lib/notify/push.ts`.
- **PWA + Web Push — Phase 2 (web push core):** DONE (local). `push_subscriptions` table +
  RLS (migration `0014_push_subscriptions.sql`, pgTAP `0017_push_subscriptions_test.sql`,
  4 assertions: server-side tenant_id/user_id defaults, RLS isolation, unique endpoint).
  `notify-wash-event` edge function (pure `classify.ts` + Deno test, payment-check for
  `done_unpaid`, service_role sub-load, `web-push` send + 404/410 prune, server-side i18n
  copy, optional `WEBHOOK_SECRET`). Client `subscriptions.ts` (support detection,
  enable/disable, anon upsert). Enable-notifications bell in the tenant header
  (`NotificationsToggle`), localized/RTL/≥44 px/graceful-when-unsupported. See section 6.10.
  **Cloud-only remaining:** set `VITE_VAPID_PUBLIC_KEY` (Vercel) + `VAPID_*` secrets, deploy
  the function, and create the `wash_orders` INSERT+UPDATE **Database Webhook** → the fn URL.
- **PWA + Web Push — Phase 3 (long-wait > 15 min) & Phase 4 (realtime live queue):** Planned.
- **Roles & permissions (branch-scoped sub-users):** DONE (local). Owner adds `manager`
  sub-users scoped to 1+ branches (`user_branches`) with a per-tab `view`/`edit` map
  (`profiles.permissions`), enforced in **RLS** (branch-scoped reads + edit-gated writes via
  `can_access_branch`/`can_edit`; auth hook injects `branch_ids` + `permissions`; `is_active`
  deactivation) **and the UI** (sidebar hides un-viewable tabs, `RequireTabAccess`/`RequireOwner`
  guards, branch switcher limited, edit controls **disabled-not-hidden**). Owner-only
  `/app/users` + `manage-users` edge fn (service_role, owner-gated). Migrations 0016/0017;
  pgTAP 0018; Deno (manage-users) + Vitest (claims). **Cloud-only remaining:** apply 0016/0017
  to staging + prod DBs and deploy `manage-users`. See section 6.11.

**Deferred (not in MVP):** inventory/chemicals, assets/machines/depreciation,
payroll/commission, ratings/performance, appointments/booking, real payment
processing, admin usage-metrics/billing, support impersonation, email-invite onboarding (we
use temp-password), per-user/server-side language persistence, multi-owner-per-tenant, editing
an owner's email/password from admin. (Push notifications: see Phases 1–2 above — now built.)

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
