# Cancellation Reason + Table Pagination — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Capture a required cancellation reason (+ `cancelled_at`) on wash cancel and show it in Washes; add server-side pagination (page size 20) to all list tables except the live Queue.

**Tech Stack:** React + Vite + TS, Tailwind v3 + shadcn (v2), react-i18next, supabase-js, @tanstack/react-query, Vitest, pgTAP.

**Existing context:**
- `wash_orders` (timestamps, status). `cancelWashOrder(id)` in `src/lib/tenant/wash-orders.ts`; wash mutations in `src/lib/tenant/queries.ts` (`useWashOrderMutations`). WashCard cancel currently uses `ConfirmDialog` + `cancel.mutateAsync(order.id)`.
- Washes: `src/lib/tenant/washes.ts` (`listWashes`, `WashRow`, `WASHES_LIMIT`), `useWashes` in queries.ts, `WashesPage.tsx`.
- List data fns (fetch-all): `listBranches/Packages/Employees/Customers` (`src/lib/tenant/*.ts`), `listBusinesses` (`src/lib/admin.ts`). Hooks `useBranches/usePackages/useEmployees/useCustomers` (queries.ts), `useBusinesses` (admin-queries.ts).
- List pages: `src/pages/admin/BusinessesPage.tsx`, `src/pages/tenant/{BranchesPage,PackagesPage,StaffPage,CustomersPage,WashesPage}.tsx`. shadcn Table/Select/Dialog/Button/Badge. Migrations latest `0012`; tests latest `0015`.
- `useBranches`/`usePackages`/`useEmployees` (fetch-all) MUST remain for the navbar branch context, dialog branch/package selects, and the assign-employee picker / Washes employee filter. Pagination adds *paged variants* for the list pages.

**File structure:**
- Create: `supabase/migrations/0013_cancel_reason.sql`, `supabase/tests/0016_cancel_reason_test.sql`
- Create: `src/components/tenant/CancelWashDialog.tsx`
- Create: `src/lib/pagination.ts` + `pagination.test.ts`, `src/components/ui/pager.tsx`
- Modify: `src/lib/tenant/wash-orders.ts` (cancelWashOrder reason), `washes.ts` (reason + paged), `queries.ts` (+paged hooks, cancel signature), `src/lib/admin.ts` + `admin-queries.ts` (paged businesses), `src/lib/tenant/{branches,packages,employees,customers}.ts` (+ paged variants), the 6 list pages, `WashCard.tsx`, `src/lib/database.types.ts` (regen), `src/i18n/locales/{en,ar}.json`, `docs/BUSINESS_LOGIC.md`

---

## Task 1: Migration — cancel reason + cancelled_at (TDD)

**Files:** Create `supabase/migrations/0013_cancel_reason.sql`, `supabase/tests/0016_cancel_reason_test.sql`. Regen `database.types.ts`.

- [ ] **Step 1: Failing test** `supabase/tests/0016_cancel_reason_test.sql`:
```sql
begin;
select plan(3);
select has_column('public', 'wash_orders', 'cancellation_reason', 'cancellation_reason exists');
select has_column('public', 'wash_orders', 'cancelled_at', 'cancelled_at exists');
insert into public.tenants (id,name) values ('00000000-0000-0000-0000-0000000ca001','C');
insert into public.branches (id,tenant_id,name) values ('00000000-0000-0000-0000-0000000cb001','00000000-0000-0000-0000-0000000ca001','B');
insert into public.wash_orders (id,tenant_id,branch_id,price,status)
  values ('00000000-0000-0000-0000-0000000cc001','00000000-0000-0000-0000-0000000ca001','00000000-0000-0000-0000-0000000cb001',50,'waiting');
update public.wash_orders set status='cancelled', cancellation_reason='customer left', cancelled_at=now()
  where id='00000000-0000-0000-0000-0000000cc001';
select is((select cancellation_reason from public.wash_orders where id='00000000-0000-0000-0000-0000000cc001'),
  'customer left', 'reason persists');
select * from finish();
rollback;
```

- [ ] **Step 2: `npx supabase test db` — FAIL** (columns missing).

- [ ] **Step 3: Migration** `supabase/migrations/0013_cancel_reason.sql`:
```sql
alter table public.wash_orders add column cancellation_reason text;
alter table public.wash_orders add column cancelled_at timestamptz;
```

- [ ] **Step 4: Apply + regen types**
```bash
npx supabase db reset
npx supabase gen types typescript --local > src/lib/database.types.ts
```
(strip any stray stdout prefix). `npx supabase test db` → all pass. `npm run build` passes.

- [ ] **Step 5: Commit** `feat(db): wash_orders cancellation_reason + cancelled_at`

---

## Task 2: Cancel-with-reason flow

**Files:** Modify `src/lib/tenant/wash-orders.ts`, `src/lib/tenant/queries.ts`. Create `src/components/tenant/CancelWashDialog.tsx`. Modify `src/components/tenant/WashCard.tsx`. Add i18n keys. Add a pure validator.

- [ ] **Step 1: Data fn** — `cancelWashOrder` takes a reason:
```ts
export async function cancelWashOrder(id: string, reason: string): Promise<void> {
  const { error } = await supabase.from("wash_orders")
    .update({ status: "cancelled", cancellation_reason: reason.trim(), cancelled_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}
```
In `queries.ts` `useWashOrderMutations`, the `cancel` mutation's `mutationFn` becomes `(a: { id: string; reason: string }) => cancelWashOrder(a.id, a.reason)` (keep the queue+dashboard+washes invalidation).

- [ ] **Step 2: Validator** (pure, tested) in `src/lib/tenant/operations.ts`:
```ts
export function validateCancelReason(reason: string): boolean {
  return reason.trim().length > 0
}
```
Add a Vitest case (true for non-empty, false for empty/whitespace).

- [ ] **Step 3: i18n keys** (both locales, real Arabic): `wash.cancelTitle`, `wash.cancelReasonLabel`, `wash.cancelReasonPlaceholder`, `wash.cancelReasonRequired`, `wash.confirmCancel`; presets `wash.cancelPresets.customerLeft`, `.vehicleIssue`, `.duplicate`, `.mistake`; `washes.colReason`. Parity stays green.

- [ ] **Step 4: CancelWashDialog** `src/components/tenant/CancelWashDialog.tsx` — shadcn `Dialog` (not the generic ConfirmDialog): a `Textarea`/`Input` for the reason (required), a wrap of preset buttons that set the reason, and a destructive **Confirm cancel** button disabled until `validateCancelReason(reason)`. Props `{ open, onOpenChange, onConfirm: (reason: string) => void, loading? }`. All strings via `t`; logical utilities; fits 375px. (Add shadcn `textarea` if not present: `npx shadcn@2.10.0 add textarea`.)

- [ ] **Step 5: WashCard** — replace the cancel `ConfirmDialog` with `<CancelWashDialog>`; `handleCancel(reason)` calls `cancel.mutateAsync({ id: order.id, reason })` (keep the error mapping). Remove the old `cancelOpen` ConfirmDialog usage for cancel (keep ConfirmDialog import only if still used elsewhere in the file — it isn't, so drop it).

- [ ] **Step 6: Verify** `npm run build` + `npm test` pass. Commit `feat(washes): capture required cancellation reason`.

---

## Task 3: Show reason in Washes

**Files:** Modify `src/lib/tenant/washes.ts`, `src/pages/tenant/WashesPage.tsx`.

- [ ] **Step 1:** `washes.ts` — add `cancellation_reason: string | null` to `WashRow`; add `cancellation_reason` to the SELECT and the mapping.
- [ ] **Step 2:** `WashesPage.tsx` — add a **Reason** column (`t("washes.colReason")`) showing `row.cancellation_reason ?? "—"`.
- [ ] **Step 3:** `npm run build` + `npm test` pass. Commit `feat(washes): reason column`.

---

## Task 4: Pagination helpers + Pager (TDD)

**Files:** Create `src/lib/pagination.ts`, `pagination.test.ts`, `src/components/ui/pager.tsx`. Add i18n.

- [ ] **Step 1: Failing tests** `src/lib/pagination.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { pageToRange, pagerInfo } from "./pagination"

describe("pageToRange", () => {
  it("maps 0-based page + size to inclusive range", () => {
    expect(pageToRange(0, 20)).toEqual({ from: 0, to: 19 })
    expect(pageToRange(2, 20)).toEqual({ from: 40, to: 59 })
  })
})
describe("pagerInfo", () => {
  it("computes item range + boundaries", () => {
    expect(pagerInfo(0, 20, 45)).toEqual({ fromItem: 1, toItem: 20, total: 45, pageCount: 3, hasPrev: false, hasNext: true })
    expect(pagerInfo(2, 20, 45)).toEqual({ fromItem: 41, toItem: 45, total: 45, pageCount: 3, hasPrev: true, hasNext: false })
    expect(pagerInfo(0, 20, 0)).toEqual({ fromItem: 0, toItem: 0, total: 0, pageCount: 0, hasPrev: false, hasNext: false })
  })
})
```

- [ ] **Step 2: `npm test` — FAIL.**

- [ ] **Step 3: Implement** `src/lib/pagination.ts`:
```ts
export const PAGE_SIZE = 20
export function pageToRange(page: number, pageSize: number): { from: number; to: number } {
  const from = page * pageSize
  return { from, to: from + pageSize - 1 }
}
export interface PagerInfo { fromItem: number; toItem: number; total: number; pageCount: number; hasPrev: boolean; hasNext: boolean }
export function pagerInfo(page: number, pageSize: number, total: number): PagerInfo {
  const pageCount = Math.ceil(total / pageSize)
  const fromItem = total === 0 ? 0 : page * pageSize + 1
  const toItem = total === 0 ? 0 : Math.min(total, (page + 1) * pageSize)
  return { fromItem, toItem, total, pageCount, hasPrev: page > 0, hasNext: page < pageCount - 1 }
}
```

- [ ] **Step 4: `npm test` — PASS.**

- [ ] **Step 5: i18n** keys (both locales): `pager.range` (interpolates `{{from}}`,`{{to}}`,`{{total}}` → e.g. "{{from}}–{{to}} of {{total}}"), `pager.prev`, `pager.next`. Parity green.

- [ ] **Step 6: Pager** `src/components/ui/pager.tsx`:
```tsx
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { pagerInfo } from "@/lib/pagination"

export function Pager({ page, pageSize, total, onPageChange }: {
  page: number; pageSize: number; total: number; onPageChange: (p: number) => void
}) {
  const { t } = useTranslation()
  const info = pagerInfo(page, pageSize, total)
  if (total === 0) return null
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
      <span className="text-sm text-muted-foreground">
        {t("pager.range", { from: info.fromItem, to: info.toItem, total: info.total })}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" aria-label={t("pager.prev")} title={t("pager.prev")}
          disabled={!info.hasPrev} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label={t("pager.next")} title={t("pager.next")}
          disabled={!info.hasNext} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  )
}
```
(`rtl:rotate-180` flips the chevrons under RTL.)

- [ ] **Step 7: Commit** `feat(ui): pagination helpers + Pager component`

---

## Task 5: Paged list functions + hooks

**Files:** Modify `src/lib/tenant/{branches,packages,employees,customers}.ts`, `src/lib/admin.ts`, `src/lib/tenant/washes.ts`, `src/lib/tenant/queries.ts`, `src/lib/admin-queries.ts`.

- [ ] **Step 1: Paged data fns.** For branches/packages/employees/customers/businesses add a `list<Entity>Paged(page: number, pageSize = PAGE_SIZE): Promise<{ rows: <Row>[]; total: number }>` that mirrors the existing `list<Entity>` SELECT but with `{ count: "exact" }` and `.range(from, to)` (from `pageToRange`). Example (branches):
```ts
import { pageToRange, PAGE_SIZE } from "@/lib/pagination"
export async function listBranchesPaged(page: number, pageSize = PAGE_SIZE): Promise<{ rows: Branch[]; total: number }> {
  const { from, to } = pageToRange(page, pageSize)
  const { data, error, count } = await supabase
    .from("branches").select("id,name,address,created_at", { count: "exact" })
    .order("created_at", { ascending: false }).range(from, to)
  if (error) throw error
  return { rows: (data ?? []) as Branch[], total: count ?? 0 }
}
```
Keep the existing fetch-all `listBranches`/`listPackages`/`listEmployees` (used by selects/context). For customers + businesses, the fetch-all is only used by the list page → you may replace it with the paged variant or keep both; prefer keeping `listCustomers`/`listBusinesses` deleted-if-unused. (CustomersPage's `vehicle_count` embed must be preserved in the paged version.)
- [ ] **Step 2: `listWashes` → paged.** Change it to return `{ rows: WashRow[]; total: number }` using `{ count: "exact" }` + `.range(...)` instead of `.limit(WASHES_LIMIT)` (remove WASHES_LIMIT/its "capped" note). It already takes `filters`; add a `page` param.
- [ ] **Step 3: Hooks.** Add `use<Entity>Paged(page)` to `queries.ts`/`admin-queries.ts` with `queryKey: ["<entity>", "page", page]` → the paged fn. Change `useWashes(filters, page)` → `queryKey: ["washes", filters, page]`. Keep `useBranches/usePackages/useEmployees` (fetch-all) for selects/context. Ensure mutations invalidate the *base* key (e.g. `["branches"]`) so paged queries (which start with `["branches", ...]`) are also invalidated — React Query invalidation matches by key prefix, so `invalidateQueries({ queryKey: ["branches"] })` refreshes both the fetch-all and the paged queries. Verify the key shapes line up (paged keys must start with the same first element).
- [ ] **Step 4:** `npm run build` passes. Commit `feat(data): paged list functions + hooks`.

---

## Task 6: Apply pagination to the list pages

**Files:** Modify `src/pages/admin/BusinessesPage.tsx`, `src/pages/tenant/{BranchesPage,PackagesPage,StaffPage,CustomersPage,WashesPage}.tsx`.

- [ ] **Step 1:** Each list page: add `const [page, setPage] = useState(0)`; use the paged hook (`use<Entity>Paged(page)` / `useWashes(filters, page)`); render the table for `data.rows`; render `<Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />` below the table.
- [ ] **Step 2: Clamp on delete.** After a delete, if `data.rows.length === 1 && page > 0`, call `setPage(page - 1)` (so deleting the last row on a page steps back). Do this in the delete handler/onSuccess.
- [ ] **Step 3: Filters reset page.** WashesPage: any filter change → `setPage(0)`.
- [ ] **Step 4:** `npm run build` + `npm test` pass. Commit `feat(ui): paginate all list tables (size 20)`.

---

## Task 7: Verify + docs (gated push)

**Files:** Modify `docs/BUSINESS_LOGIC.md`.

- [ ] **Step 1: Full suite** — `npx supabase test db`, `npm test`, `npm run build` green. Paste.
- [ ] **Step 2: Browser** (login `owner@demo.test`/`password123`):
  - Seed/create **>20 customers** (REST loop) → `/app/customers` shows 20 + Pager "1–20 of N"; **Next** → page 2 shows the rest; **Prev** → back. Counts correct.
  - Delete the only row on the last page → clamps to the previous page.
  - Queue: **Cancel** a wash → the **CancelWashDialog** requires a reason (Confirm disabled until typed); a preset chip fills it; confirm → wash leaves the board.
  - `/app/washes` → the cancelled wash shows in the **Reason** column; filter change resets to page 1.
  - Quick RTL + mobile pass (pager chevrons flip; pager wraps).
  Report findings; fix real bugs.
- [ ] **Step 3: Docs** — update `docs/BUSINESS_LOGIC.md` (cancel reason + cancelled_at; required-reason cancel flow shown in Washes; list tables paginated server-side size 20 except the live Queue). Bump Last updated.
- [ ] **Step 4: Commit + GATED push** — commit `docs: cancel reason + pagination`. Controller runs pgTAP + Vitest + build and pushes only if all green.

---

## Definition of Done
- Cancelling a wash **requires** a reason (with quick presets); `cancellation_reason` + `cancelled_at` are stored and the reason shows in the Washes history.
- All list tables (Businesses, Branches, Packages, Staff, Customers, Washes) are **server-side paginated** (size 20) with a Pager; the live Queue is not paginated; delete clamps the page.
- Selects/context that need the full set (navbar branch, dialog selects, assign picker, Washes employee filter) still fetch all.
- Vitest (pageToRange/pagerInfo/validateCancelReason) + pgTAP (0016) + build green; pushed only after green.
- `docs/BUSINESS_LOGIC.md` updated.
