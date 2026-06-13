# Plan 3D — Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A tenant dashboard at `/app/dashboard` (default landing) showing today's revenue, washes, and a status breakdown for the selected branch — i18n/RTL/responsive, tenant-isolated, tested. Completes Plan 3.

**Architecture:** Pure aggregation helpers (unit-tested) + a `getTodayStats(branchId)` data function (two RLS-scoped queries) feed a read-only `DashboardPage` that uses the existing `useBranch()` context.

**Tech Stack:** React + Vite + TS, Tailwind v3 + shadcn (v2), react-i18next, supabase-js, Vitest, pgTAP.

**Existing context to reuse:**
- `useBranch()` (`src/lib/tenant/branch-context.tsx`); `WashStatus` + helpers (`src/lib/tenant/operations.ts`).
- Patterns: `QueuePage.tsx` (branch-scoped page, loading/error/empty, refetch on branch change), shadcn `Card`/`Badge`, `SidebarNav.tsx`, `src/routes.tsx`.
- i18n `src/i18n/locales/{en,ar}.json` + parity test. `nav.dashboard` + `status.*` keys already exist.
- Schema: `wash_orders(branch_id,status,created_at,...)`, `payments(amount,paid_at,wash_order_id,...)`. RLS isolates by tenant.

**File structure:**
- Create: `src/lib/tenant/dashboard.ts` + `dashboard.test.ts`, `src/pages/tenant/DashboardPage.tsx`
- Modify: `src/components/tenant/SidebarNav.tsx`, `src/routes.tsx`, `src/i18n/locales/{en,ar}.json`
- Create: `supabase/tests/0014_dashboard_rls_test.sql`
- Modify: `docs/BUSINESS_LOGIC.md`

---

## Task 1: Pure helpers (TDD) + i18n keys

**Files:** Create `src/lib/tenant/dashboard.ts` (helpers portion), `dashboard.test.ts`. Modify `src/i18n/locales/{en,ar}.json`.

- [ ] **Step 1: Failing tests** `src/lib/tenant/dashboard.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { sumPayments, summarizeStatuses, startOfDay } from "./dashboard"

describe("sumPayments", () => {
  it("sums amounts (0 when empty, handles numeric strings)", () => {
    expect(sumPayments([])).toBe(0)
    expect(sumPayments([{ amount: 10 }, { amount: 15.5 }])).toBe(25.5)
    expect(sumPayments([{ amount: 20 as unknown as number }, { amount: 5 }])).toBe(25)
  })
})
describe("summarizeStatuses", () => {
  it("counts each status, zero-filled", () => {
    expect(summarizeStatuses([])).toEqual({ waiting: 0, in_progress: 0, done: 0, cancelled: 0 })
    expect(summarizeStatuses([
      { status: "waiting" }, { status: "waiting" }, { status: "done" }, { status: "cancelled" },
    ])).toEqual({ waiting: 2, in_progress: 0, done: 1, cancelled: 1 })
  })
})
describe("startOfDay", () => {
  it("returns local midnight of the given date", () => {
    const d = new Date(2026, 5, 12, 15, 30, 0) // local June 12 2026 15:30
    const s = startOfDay(d)
    expect(s.getFullYear()).toBe(2026)
    expect(s.getMonth()).toBe(5)
    expect(s.getDate()).toBe(12)
    expect(s.getHours()).toBe(0)
    expect(s.getMinutes()).toBe(0)
    expect(s.getSeconds()).toBe(0)
  })
})
```

- [ ] **Step 2: Run `npm test` — FAIL.**

- [ ] **Step 3: Implement** the helpers in `src/lib/tenant/dashboard.ts`:
```ts
import { supabase } from "@/lib/supabase"
import type { WashStatus } from "./operations"

export function sumPayments(payments: { amount: number }[]): number {
  return payments.reduce((s, p) => s + Number(p.amount), 0)
}
export function summarizeStatuses(orders: { status: WashStatus }[]): Record<WashStatus, number> {
  const counts: Record<WashStatus, number> = { waiting: 0, in_progress: 0, done: 0, cancelled: 0 }
  for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1
  return counts
}
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}
```

- [ ] **Step 4: Run `npm test` — PASS.**

- [ ] **Step 5: i18n keys** (BOTH locales, identical, real Arabic): `dashboard`: `title`,
  `revenueToday`, `washesToday`, `byStatus`, `empty`, `refresh`, `errors.generic`.
  (`nav.dashboard` and `status.*` already exist.) Run `npm test` → parity passes.

- [ ] **Step 6: Commit** `feat(tenant): dashboard aggregation helpers + i18n`

---

## Task 2: Data layer (getTodayStats)

**Files:** Modify `src/lib/tenant/dashboard.ts` (append the data function).

- [ ] **Step 1: Append** to `src/lib/tenant/dashboard.ts`:
```ts
export interface DayStats {
  revenue: number
  washesToday: number
  counts: Record<WashStatus, number>
}

export async function getTodayStats(branchId: string): Promise<DayStats> {
  const since = startOfDay(new Date()).toISOString()

  // revenue: today's payments for orders in this branch (RLS scopes to tenant)
  const { data: pays, error: pErr } = await supabase
    .from("payments")
    .select("amount,wash_orders!inner(branch_id)")
    .gte("paid_at", since)
    .eq("wash_orders.branch_id", branchId)
  if (pErr) throw pErr
  const revenue = sumPayments((pays ?? []) as unknown as { amount: number }[])

  // today's orders for this branch → count + status breakdown
  const { data: orders, error: oErr } = await supabase
    .from("wash_orders")
    .select("status,created_at")
    .eq("branch_id", branchId)
    .gte("created_at", since)
  if (oErr) throw oErr
  const list = (orders ?? []) as { status: WashStatus }[]
  return { revenue, washesToday: list.length, counts: summarizeStatuses(list) }
}
```
NOTE: the `payments → wash_orders!inner(branch_id)` embed uses the FK `payments.wash_order_id → wash_orders.id`; `!inner` makes it a filtering inner join so the `.eq("wash_orders.branch_id", branchId)` applies. Verify the embed/filter against the generated types; if the nested filter is awkward, fall back to: fetch today's orders for the branch (ids), then `payments.in('wash_order_id', ids)` and sum — keep `revenue` correct. Note which approach you used.

- [ ] **Step 2:** `npm run build` passes. Commit `feat(tenant): dashboard getTodayStats query`.

---

## Task 3: Dashboard page + nav/route + default landing

**Files:** Create `src/pages/tenant/DashboardPage.tsx`. Modify `src/components/tenant/SidebarNav.tsx`, `src/routes.tsx`.

- [ ] **Step 1: SidebarNav** — make "Dashboard" a real `NavLink` to `/app/dashboard` (place it FIRST, above Branches, since it's the landing). It currently sits with Queue/coming-soon — Queue is already a real link (3C); move Dashboard up to the main list as a real link. Keep the order sensible (Dashboard, Queue, Customers, Branches, Packages, Staff). No coming-soon items should remain.

- [ ] **Step 2: Route + default landing** — in `src/routes.tsx`: add `{ path: "dashboard", element: <DashboardPage/> }` under `TenantLayout` children, and change the index redirect from `/app/branches` to `<Navigate to="/app/dashboard" replace/>`.

- [ ] **Step 3: DashboardPage** `src/pages/tenant/DashboardPage.tsx` — mirrors QueuePage's branch/loading/error handling:
  - `useBranch()`; if `branchLoading` show loading; if no `branchId` show a sensible state.
  - Load `getTodayStats(branchId)` into state (loading/error). Header: `t("dashboard.title")` + a Refresh button (refetch).
  - Render a responsive card grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`, stacking on mobile): **Revenue today** (`stats.revenue`), **Washes today** (`stats.washesToday`), and status cards **Waiting / In Progress / Done** (`stats.counts.*`, labels from `status.*`). Use shadcn `Card`. Numbers prominent.
  - Empty/zero state: if everything is zero, optionally show `t("dashboard.empty")` (or just show zeros — either is fine; prefer showing the cards with zeros plus a subtle empty hint).
  - Refetch on branch change + on Refresh. All strings via t(); logical utilities; `min-h-[44px]` on the refresh button.

- [ ] **Step 4: Verify** `npm run build` + `npm test` pass. Manually (or note for Task 4): signing in lands on `/app/dashboard`. Commit `feat(tenant): dashboard page + nav + default landing`.

---

## Task 4: pgTAP + full verification + docs (gate push on green)

**Files:** Create `supabase/tests/0014_dashboard_rls_test.sql`. Modify `docs/BUSINESS_LOGIC.md`.

- [ ] **Step 1: pgTAP** `supabase/tests/0014_dashboard_rls_test.sql` — valid hex UUIDs. Seed tenant A + B with branches; seed a tenant-B wash_order + payment as SUPERUSER. Under tenant-A claim (`set local role authenticated` + jwt claims A): insert a tenant-A wash_order (today) + payment. Assertions (~3):
  - a payments aggregate visible to tenant A counts only A's payment (sum = A's amount, not including B's);
  - an orders count for tenant A's branch = 1 (not B's);
  - (robustness) scope by tenant/branch, not a global count — i.e. selecting `wash_orders` as tenant A returns only A's row.
  Run `npx supabase test db` → ALL pass. (Remember: tests run against the LIVE DB — scope assertions by tenant/branch/row, never a bare global count.) Paste summary.

- [ ] **Step 2: Full suite** — `npx supabase test db`, `npm test`, `npm run build` all green. Paste output.

- [ ] **Step 3: Integration + edge cases** (browser; login `owner@demo.test`/`password123`):
  - Lands on `/app/dashboard`. With a branch selected, note current numbers. Create a wash (via /app/queue New Wash) + record a payment → return to dashboard, Refresh → revenue increased by the payment, washes-today incremented, status counts reflect it.
  - Advance a wash through statuses → Refresh → breakdown updates.
  - Switch branch → numbers change to that branch (a fresh/empty branch shows zeros / empty).
  - Confirm local-day boundary (today's data shows). Tenant isolation (only Demo Carwash).
  Label browser- vs API-verified. Report real bugs; small UI fixes you may apply + note.

- [ ] **Step 4: Responsive × RTL** — screenshot `/app/dashboard` at 375 + 820 in EN + AR. Verify cards stack on mobile, mirror in RTL, no overflow, numbers readable, Arabic Cairo. Fix + re-verify any break.

- [ ] **Step 5: Update `docs/BUSINESS_LOGIC.md`** — dashboard BUILT; **Plan 3 COMPLETE (3A–3D done)**; remaining roadmap = deferred modules (inventory, assets, payroll, analytics suite, etc.). Bump Last updated.

- [ ] **Step 6: Commit + GATED push** — `git add` the test + docs (+ any fix), commit `test(tenant): dashboard RLS; docs: 3D built (Plan 3 complete)`. Then run pgTAP + Vitest + build; **only push to dev if all three are green** (do not push unconditionally).

---

## Definition of Done
- `/app/dashboard` is the default landing; shows today's revenue, washes, and status breakdown for the selected branch; Refresh + branch-switch update it.
- i18n (en/ar parity), RTL-correct, responsive (cards stack + mirror; verified mobile+tablet, EN+AR).
- Vitest (sumPayments/summarizeStatuses/startOfDay + parity), pgTAP (0014 isolation), build — all green.
- `docs/BUSINESS_LOGIC.md` marks Plan 3 complete.
- Pushed to `dev` only after a green suite.
