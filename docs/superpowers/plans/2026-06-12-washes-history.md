# Washes History Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A filterable Washes history page (date/status/employee/branch) showing assignee + queued/wait/service timings, using the already-captured `created_at`/`started_at`/`completed_at`. No migration.

**Architecture:** Pure tested duration/date helpers + a `listWashes(filters)` data function + a `useWashes` React Query hook feed a new `WashesPage` with a filter bar and responsive table.

**Tech Stack:** React + Vite + TS, Tailwind v3 + shadcn (v2), react-i18next, supabase-js, @tanstack/react-query, Vitest.

**Existing context:**
- `wash_orders(id,tenant_id,branch_id,customer_id,vehicle_id,package_id,assigned_employee_id,status,price,notes,created_at,started_at,completed_at)`; FKs to vehicles/customers/packages/employees/branches; RLS isolates by tenant (proven in `0013`).
- React Query set up: `src/lib/query.ts`, hooks in `src/lib/tenant/queries.ts` (pattern: `useQuery({queryKey, queryFn})`). `isPaid` in `src/lib/tenant/operations.ts`. `WashStatus` type there.
- Patterns: `QueuePage`/`CustomersPage` (table, loading/empty/error, useBranch), shadcn Select/Table/Badge, `src/components/tenant/SidebarNav.tsx`, `src/routes.tsx`, i18n parity test.

**File structure:**
- Create: `src/lib/tenant/duration.ts` + `duration.test.ts`, `src/lib/tenant/washes.ts`, `src/pages/tenant/WashesPage.tsx`
- Modify: `src/lib/tenant/queries.ts` (add `useWashes`), `src/components/tenant/SidebarNav.tsx`, `src/routes.tsx`, `src/i18n/locales/{en,ar}.json`, `docs/BUSINESS_LOGIC.md`

---

## Task 1: Pure helpers (TDD) + i18n keys

**Files:** Create `src/lib/tenant/duration.ts`, `duration.test.ts`. Modify locales.

- [ ] **Step 1: Failing tests** `src/lib/tenant/duration.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { diffMinutes, formatDuration, defaultDateRange, dayRangeToBounds } from "./duration"

describe("diffMinutes", () => {
  it("returns minutes between, null if either missing, clamps >= 0", () => {
    expect(diffMinutes("2026-06-12T10:00:00Z", "2026-06-12T10:45:00Z")).toBe(45)
    expect(diffMinutes("2026-06-12T10:00:00Z", null)).toBeNull()
    expect(diffMinutes(null, "2026-06-12T10:00:00Z")).toBeNull()
    expect(diffMinutes("2026-06-12T10:45:00Z", "2026-06-12T10:00:00Z")).toBe(0)
  })
})
describe("formatDuration", () => {
  it("formats minutes", () => {
    expect(formatDuration(null)).toBe("—")
    expect(formatDuration(45)).toBe("45m")
    expect(formatDuration(60)).toBe("1h")
    expect(formatDuration(65)).toBe("1h 5m")
  })
})
describe("defaultDateRange", () => {
  it("returns last 7 days inclusive as YYYY-MM-DD", () => {
    const r = defaultDateRange(new Date(2026, 5, 12)) // local June 12 2026
    expect(r.to).toBe("2026-06-12")
    expect(r.from).toBe("2026-06-06")
  })
})
describe("dayRangeToBounds", () => {
  it("expands to local start-of-from-day .. end-of-to-day", () => {
    const b = dayRangeToBounds("2026-06-06", "2026-06-12")
    expect(new Date(b.fromISO).getFullYear()).toBe(2026)
    // fromISO is local midnight of 06-06; toISO is local end-of-day of 06-12
    expect(new Date(b.toISO).getTime()).toBeGreaterThan(new Date(b.fromISO).getTime())
  })
})
```

- [ ] **Step 2: Run `npm test` — FAIL.**

- [ ] **Step 3: Implement** `src/lib/tenant/duration.ts`:
```ts
export function diffMinutes(fromISO: string | null, toISO: string | null): number | null {
  if (!fromISO || !toISO) return null
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime()
  return Math.max(0, Math.round(ms / 60000))
}
export function formatDuration(minutes: number | null): string {
  if (minutes == null) return "—"
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
export function defaultDateRange(today: Date): { from: string; to: string } {
  const from = new Date(today)
  from.setDate(from.getDate() - 6) // last 7 days inclusive
  return { from: ymd(from), to: ymd(today) }
}
export function dayRangeToBounds(from: string, to: string): { fromISO: string; toISO: string } {
  const [fy, fm, fd] = from.split("-").map(Number)
  const [ty, tm, td] = to.split("-").map(Number)
  const start = new Date(fy, fm - 1, fd, 0, 0, 0, 0)
  const end = new Date(ty, tm - 1, td, 23, 59, 59, 999)
  return { fromISO: start.toISOString(), toISO: end.toISOString() }
}
```

- [ ] **Step 4: Run `npm test` — PASS.**

- [ ] **Step 5: i18n keys** (BOTH locales, real Arabic): `nav.washes`; `washes`: `title`,
  `from`, `to`, `status`, `employee`, `branch`, `allStatuses`, `allEmployees`, `allBranches`,
  `colQueued`, `colPlate`, `colCustomer`, `colPackage`, `colBranch`, `colStatus`,
  `colEmployee`, `colWait`, `colService`, `colPrice`, `colPaid`, `empty`, `capped`,
  `errors.generic`. (`status.*`, `wash.paid/unpaid` already exist.) Run `npm test` → parity passes.

- [ ] **Step 6: Commit** `feat(washes): duration/date helpers + i18n`

---

## Task 2: Data layer + query hook

**Files:** Create `src/lib/tenant/washes.ts`. Modify `src/lib/tenant/queries.ts`.

- [ ] **Step 1:** `src/lib/tenant/washes.ts`
```ts
import { supabase } from "@/lib/supabase"
import type { WashStatus } from "./operations"
import { dayRangeToBounds } from "./duration"

export interface WashFilters {
  branchId: string | "all"
  status: WashStatus | "all"
  employeeId: string | "all"
  from: string // YYYY-MM-DD
  to: string   // YYYY-MM-DD
}
export interface WashRow {
  id: string; status: WashStatus; price: number
  created_at: string; started_at: string | null; completed_at: string | null
  plate_number: string | null; customer_name: string | null; package_name: string | null
  employee_name: string | null; branch_name: string | null; payments: { amount: number }[]
}
export const WASHES_LIMIT = 200

const SELECT =
  "id,status,price,created_at,started_at,completed_at," +
  "vehicles(plate_number),customers(name),packages(name),employees(name),branches(name),payments(amount)"

export async function listWashes(f: WashFilters): Promise<WashRow[]> {
  const { fromISO, toISO } = dayRangeToBounds(f.from, f.to)
  let q = supabase.from("wash_orders").select(SELECT)
    .gte("created_at", fromISO).lte("created_at", toISO)
  if (f.branchId !== "all") q = q.eq("branch_id", f.branchId)
  if (f.status !== "all") q = q.eq("status", f.status)
  if (f.employeeId !== "all") q = q.eq("assigned_employee_id", f.employeeId)
  q = q.order("created_at", { ascending: false }).limit(WASHES_LIMIT)
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as unknown as Array<{
    id: string; status: WashStatus; price: number; created_at: string
    started_at: string | null; completed_at: string | null
    vehicles: { plate_number: string } | null; customers: { name: string } | null
    packages: { name: string } | null; employees: { name: string } | null
    branches: { name: string } | null; payments: { amount: number }[]
  }>).map((o) => ({
    id: o.id, status: o.status, price: Number(o.price), created_at: o.created_at,
    started_at: o.started_at, completed_at: o.completed_at,
    plate_number: o.vehicles?.plate_number ?? null, customer_name: o.customers?.name ?? null,
    package_name: o.packages?.name ?? null, employee_name: o.employees?.name ?? null,
    branch_name: o.branches?.name ?? null,
    payments: (o.payments ?? []).map((p) => ({ amount: Number(p.amount) })),
  }))
}
```
NOTE: verify the embeds compile against `database.types.ts`; use the contained `as unknown as` cast at the mapping boundary (same pattern as wash-orders.ts). `branches`/`employees` embeds resolve via the single FK each.

- [ ] **Step 2:** Add to `src/lib/tenant/queries.ts`:
```ts
import { listWashes, type WashFilters } from "./washes"
export function useWashes(filters: WashFilters) {
  return useQuery({ queryKey: ["washes", filters], queryFn: () => listWashes(filters) })
}
```
(Optional: have the wash/payment mutation `onSuccess` also `invalidateQueries({ queryKey: ["washes"] })` so the history refreshes after an action — add if trivial.)

- [ ] **Step 3:** `npm run build` passes. Commit `feat(washes): listWashes filters + useWashes hook`.

---

## Task 3: Washes page + nav/route

**Files:** Create `src/pages/tenant/WashesPage.tsx`. Modify `SidebarNav.tsx`, `src/routes.tsx`.

- [ ] **Step 1: SidebarNav** — add a `Washes` `NavLink` to `/app/washes` after Queue (order: Dashboard, Queue, Washes, Customers, Branches, Packages, Staff).

- [ ] **Step 2: Route** — add `{ path: "washes", element: <WashesPage/> }` under `TenantLayout`.

- [ ] **Step 3: WashesPage** `src/pages/tenant/WashesPage.tsx`:
  - Filter state seeded from `defaultDateRange(new Date())` + branch = `useBranch().branchId` (or "all"); status "all"; employee "all".
  - Filter bar (responsive, wraps): two `<input type="date">` (from/to), status `<Select>` (all + each `status.*`), employee `<Select>` (all + `useEmployees()` active list), branch `<Select>` (all + `useBranches()`).
  - `const { data: rows = [], isLoading, isError } = useWashes(filters)`.
  - Responsive `<Table>` in `overflow-x-auto`: Queued (`new Date(created_at).toLocaleString(i18n.language)`), Plate (`?? "—"`), Customer, Package, Branch, Status `<Badge>` (reuse the queue's status variants), Employee (`?? "—"`), Wait (`formatDuration(diffMinutes(created_at, started_at))`), Service (`formatDuration(diffMinutes(started_at, completed_at))`), Price, Paid `<Badge>` (`isPaid(price, payments)`).
  - Loading/error(+retry)/empty states; if `rows.length === WASHES_LIMIT` show `t("washes.capped", { n: WASHES_LIMIT })`. All strings via `t`; logical utilities; `min-h-[44px]` controls.

- [ ] **Step 4: Verify** `npm run build` + `npm test` pass. Commit `feat(washes): washes history page + nav/route`.

---

## Task 4: Verify + docs (gated push)

**Files:** Modify `docs/BUSINESS_LOGIC.md`.

- [ ] **Step 1: Full suite** — `npx supabase test db`, `npm test`, `npm run build` green. Paste.
- [ ] **Step 2: Browser** (login `owner@demo.test`/`password123`; ensure some washes exist across statuses — create/advance a few or seed via REST):
  - Open `/app/washes` → lists historical washes within the default last-7-days range, newest first.
  - Filter by **status** (e.g. done) → only those; by **employee** → only that assignee's; by **branch** (incl. **All branches**) → scope changes; adjust **date range** → result set changes.
  - Confirm **assigned employee** shows, and **Wait**/**Service** durations render (e.g. a started+completed wash shows both; a waiting one shows "—").
  - Quick RTL + mobile pass (table scrolls, filter bar wraps).
  Report findings; fix any real bug.
- [ ] **Step 3: Docs** — update `docs/BUSINESS_LOGIC.md` (Washes history page; timestamps/durations exposed; analytics deferred). Bump Last updated.
- [ ] **Step 4: Commit + GATED push** — commit `docs: washes history`. Controller runs pgTAP + Vitest + build and pushes only if all green.

---

## Definition of Done
- `/app/washes` lists wash history with date/status/employee/branch filters (default last 7 days), newest first, capped at 200 with a note.
- Shows assignee + queued time + wait/service durations from the existing timestamps (no migration).
- i18n (en/ar parity), RTL-correct, responsive (verified).
- Vitest (duration/date helpers) + build + existing pgTAP all green; pushed only after green.
- `docs/BUSINESS_LOGIC.md` updated.
