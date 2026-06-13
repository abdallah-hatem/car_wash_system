# Plan 3D — Dashboard — Design

**Date:** 2026-06-12
**Status:** Approved
**Part of:** Plan 3 (Tenant Operations), final sub-plan 3D. Depends on 3A–3C. Reads data that
3C produces (wash orders + payments).

## 1. Purpose

The owner/manager's at-a-glance view: today's revenue, today's wash count, and a live
status breakdown — scoped to the selected branch.

## 2. Decisions (recommended defaults taken)

- Enable the "Dashboard" nav item (was coming-soon) → `/app/dashboard`, and make it the
  **default `/app` landing** (change the `/app` index redirect from `/app/branches` to
  `/app/dashboard`).
- Scoped to the **header branch selector + today (local day)**; the existing selector is the
  per-branch filter (no new control). Local-day boundary, consistent with the 3C fix.
- KPIs: **Revenue today** (sum of payments recorded today), **Washes today** (count of
  orders created today), and a **status breakdown** (Waiting / In Progress / Done) that
  doubles as the live-queue snapshot. Manual **Refresh**; Realtime deferred.
- Read-only. No new tables/columns.

## 3. Components

### 3.1 Pure helpers (`src/lib/tenant/dashboard.ts` — unit-tested)
- `sumPayments(payments: { amount: number }[]): number` — total revenue (Number-coerced).
- `summarizeStatuses(orders: { status: WashStatus }[]): Record<WashStatus, number>` — counts
  per status (waiting/in_progress/done/cancelled), zero-filled.
- `startOfTodayISO(): string` — local start-of-day as an ISO string for query lower-bounds
  (computed from local Y/M/D; pure given a clock, but reads `new Date()` at call time — keep
  the date math in a tiny tested helper `startOfDay(date)` that takes a Date and returns the
  local-midnight Date, and unit-test THAT; the wrapper just passes `new Date()`).

### 3.2 Data (`src/lib/tenant/dashboard.ts`)
- `getTodayStats(branchId: string): Promise<DayStats>` where
  `DayStats = { revenue: number; washesToday: number; counts: Record<WashStatus, number> }`.
  - Revenue: `payments` where `paid_at >= startOfToday`, joined to `wash_orders!inner(branch_id)`
    filtered to `branchId` (RLS scopes to tenant); sum via `sumPayments`.
  - Orders today + counts: `wash_orders` where `branch_id = branchId` and
    `created_at >= startOfToday`; `washesToday` = length; `counts` via `summarizeStatuses`.
  - Two queries composed in JS. RLS auto-scopes to the tenant; the branch filter is explicit.

### 3.3 Page (`src/pages/tenant/DashboardPage.tsx`)
- Uses `useBranch()`. Header: `t("dashboard.title")` + a Refresh button. Loads
  `getTodayStats(branchId)`; loading/error/empty (no activity) states.
- KPI cards (responsive grid, stack on mobile): Revenue today, Washes today, then the
  status breakdown (Waiting/In Progress/Done counts — small cards or a compact row).
- Refetch on branch change + on Refresh.
- Sidebar: turn "Dashboard" from coming-soon into a real `NavLink`; route under TenantLayout;
  `/app` index → `/app/dashboard`.

## 4. Cross-cutting (standing rule)
i18n keys under `nav.dashboard` (exists; becomes active), `dashboard.*` (title, revenueToday,
washesToday, byStatus, waiting/inProgress/done labels reuse `status.*`, empty, refresh,
errors.generic) — both locales, parity-tested, real Arabic. RTL-correct logical utilities;
responsive (cards stack + mirror); Cairo for Arabic. Card/Badge patterns reused.

## 5. Error handling
Query failure → localized error with retry. Empty (no orders/payments today) → a friendly
empty state (zeros are fine to show too). Branch-loading handled (reuse the pattern from
QueuePage).

## 6. Testing (required)
- **Vitest** (`dashboard.test.ts`): `sumPayments` (empty → 0, multiple, string-coerced),
  `summarizeStatuses` (empty → all zeros, mixed statuses counted correctly, all four keys
  present), `startOfDay(date)` (returns local midnight; same-day vs different-day).
- **pgTAP** (`supabase/tests/0014_dashboard_rls_test.sql`): under a tenant-A claim, a
  payments-today aggregate and an orders-today count see only tenant A's rows (a tenant-B
  order+payment seeded as superuser is excluded) — proves the dashboard read path is
  tenant-isolated. ~3 assertions.
- **Full-flow + edge cases:** with a branch selected, create a wash + record a payment →
  dashboard shows the revenue + incremented washes + status counts; advance a wash through
  statuses → breakdown updates on refresh; switch branch → numbers change to that branch
  (empty for an empty branch); no-activity empty state. Local-day boundary correct.
  Responsive/RTL at mobile + tablet, EN + AR (cards stack + mirror).
- Full local suite (pgTAP + Vitest + build) green; **gate the push on green**.

## 7. Out of scope (deferred analytics)
Charts/trends, date-range selection (today only), cost-per-wash, employee/branch performance
comparison, inventory consumption, exports. These are the deferred Analytics suite.

## 8. Docs
Update `docs/BUSINESS_LOGIC.md`: dashboard BUILT; **Plan 3 complete** (3A–3D done); note the
remaining roadmap is the deferred modules. Bump Last updated.
