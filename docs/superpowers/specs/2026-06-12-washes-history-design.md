# Washes History Page — Design

**Date:** 2026-06-12
**Status:** Approved
**Builds on:** 3C operations (wash_orders + the three timestamps), the reactive data layer.

## 1. Purpose

A filterable history of all wash orders — see who was assigned, when each wash was queued /
started / finished, and the wait and service durations. Surfaces the timing data that future
analytics (busiest days/times, average wait/service) will aggregate.

## 2. Time capture (no migration)

The data already exists on `wash_orders`:
- `created_at` — when the order entered **Waiting** (created as `waiting`).
- `started_at` — set on Waiting → In Progress (the wash start).
- `completed_at` — set on In Progress → Done (the wash end).
So **wait time** = `started_at − created_at` and **service time** = `completed_at − started_at`
are derivable. No schema change; this feature exposes the data.

## 3. Decisions (recommended defaults, approved)

- New **Washes** nav tab → `/app/washes` (sidebar: Dashboard · Queue · Washes · Customers ·
  Branches · Packages · Staff).
- Filters: **date range** (default last 7 days), **status** (all/each), **employee**
  (all/specific), **branch** (defaults to the selected branch, plus an **All branches**
  option). Ordered newest-first, capped at **200** rows with a "showing latest N" note when
  exceeded.
- Out of scope (deferred): statistics/charts, CSV export, editing a past wash.

## 4. Components

### 4.1 Pure helpers (`src/lib/tenant/duration.ts` + test)
- `diffMinutes(fromISO: string | null, toISO: string | null): number | null` — minutes
  between two timestamps, `null` if either is missing, clamped ≥ 0.
- `formatDuration(minutes: number | null): string` — `"—"` when null, else `"45m"` /
  `"1h 5m"` / `"2h"`.
- `defaultDateRange(today: Date): { from: string; to: string }` — last-7-days as `YYYY-MM-DD`
  (local), used to seed the filter (pure given a Date; unit-tested with a fixed date).
- `dayRangeToBounds(from: string, to: string): { fromISO: string; toISO: string }` — turn
  `YYYY-MM-DD` filter values into inclusive local-day ISO bounds (`from` start-of-day →
  `to` end-of-day) for the query.

### 4.2 Data layer (`src/lib/tenant/washes.ts`)
- `WashFilters = { branchId: string | "all"; status: WashStatus | "all"; employeeId: string |
  "all"; from: string; to: string }`.
- `WashRow = { id, status, price, created_at, started_at, completed_at, plate_number,
  customer_name, package_name, employee_name, branch_name, payments }`.
- `listWashes(filters): Promise<WashRow[]>` — `wash_orders` select embedding
  `vehicles(plate_number), customers(name), packages(name), employees(name),
  branches(name), payments(amount)`; applies `.eq` for branch/status/employee when not
  "all"; `.gte/.lte created_at` to the date bounds; `.order("created_at", desc).limit(200)`.
  RLS scopes to the tenant automatically.

### 4.3 Query hook (`src/lib/tenant/queries.ts`)
- `useWashes(filters)` — `useQuery({ queryKey: ["washes", filters], queryFn: () =>
  listWashes(filters) })`. (Wash/payment mutations may also invalidate `["washes"]` so the
  history stays fresh, but it's primarily a read view.)

### 4.4 Page (`src/pages/tenant/WashesPage.tsx`)
- Filter bar: date from/to (`<input type="date">`), status `<Select>`, employee `<Select>`
  (from `useEmployees`), branch `<Select>` (from `useBranches`, default = current
  `useBranch().branchId`, plus All branches). Filters held in local state, seeded from
  `defaultDateRange` + the selected branch.
- Responsive `<Table>` (overflow-x-auto): Queued (date+time, localized), Plate, Customer,
  Package, Branch, Status badge, Employee (or "—"), Wait (`formatDuration(diffMinutes(...))`),
  Service, Price, Paid badge (`isPaid`). Loading/error/empty states; "showing latest 200"
  note when capped.
- Sidebar gets a Washes `NavLink`; route added under `TenantLayout`.

## 5. Cross-cutting
i18n keys under `nav.washes`, `washes.*` (title, filter labels, column headers, allBranches/
allStatuses/allEmployees, from/to, empty, capped) — both locales, parity-tested, real Arabic.
RTL-correct logical utilities; responsive (table scrolls on mobile; filter bar wraps). Reuses
the Badge/Table/Select patterns.

## 6. Error handling
Query error → localized error + retry (from `isError`). Empty result → friendly empty state.
Invalid date range (from > to) → clamp or show nothing gracefully.

## 7. Testing
- **Vitest:** `diffMinutes` (both present, one/both missing → null, negative clamps to 0),
  `formatDuration` (null → "—", <60, exact hour, h+m), `defaultDateRange` (fixed date → last
  7 days), `dayRangeToBounds` (start/end of local day).
- **No new pgTAP:** `wash_orders` RLS isolation is already proven (`0013`); `listWashes`
  reuses the same table/policies. (Browser check covers the filters.)
- **Browser:** the Washes page lists historical washes; filtering by status/employee/branch/
  date narrows correctly; wait/service durations render; assignee shows; All-branches works;
  RTL + mobile pass.
- Full local suite (pgTAP + Vitest + build) green; **gate the push on green**.

## 8. Docs
Update `docs/BUSINESS_LOGIC.md`: a Washes history page (filterable: date/status/employee/
branch) exposing assignee + the captured timestamps (wait/service durations); note analytics
(busiest days/times) remains a deferred future feature built on this data.
