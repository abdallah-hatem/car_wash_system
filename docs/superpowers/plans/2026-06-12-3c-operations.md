# Plan 3C — Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The counter workflow — branch context, a walk-in New Wash form, a live status-board queue (Waiting/In Progress/Done) with assign/start/complete/cancel actions, and manual payments — i18n/RTL/responsive, tenant-isolated, tested.

**Architecture:** A `BranchProvider` supplies the current branch to tenant pages. Data modules wrap supabase (RLS-scoped; `tenant_id` from JWT claim). Pure helpers encode the status machine + payment math (unit-tested). Pages follow the established Card/Dialog patterns.

**Tech Stack:** React + Vite + TS, Tailwind v3 + shadcn (v2), react-i18next, supabase-js, Vitest, pgTAP.

**Existing context to reuse:**
- 3A/3B patterns: `src/lib/tenant/{branches,packages,employees,customers,vehicles,validators,plate}.ts`, `src/pages/tenant/*`, `src/components/tenant/*Dialog.tsx`, `PlateSearch.tsx`, `SidebarNav.tsx`, `TenantLayout.tsx`, `src/routes.tsx`.
- `useAuth().claims.tenantId`. shadcn: button,input,label,card,table,dialog,badge,select. lucide-react.
- i18n `src/i18n/locales/{en,ar}.json` + parity test. `nav.queue` key already exists.
- Schema: `wash_orders(id,tenant_id,branch_id,customer_id,vehicle_id,package_id,assigned_employee_id,status[waiting|in_progress|done|cancelled],price,notes,created_at,started_at,completed_at)`; `payments(id,tenant_id,wash_order_id,amount,method[cash|card|transfer],paid_at)`. Audit triggers on wash_orders + payments. Index `wash_orders_queue_idx (tenant_id,branch_id,status,created_at)`.
- 3B helpers: `createCustomer`, `createVehicle`, `searchVehiclesByPlate`, `normalizePlate`.

**File structure:**
- Create: `src/lib/tenant/operations.ts` + `operations.test.ts`, `src/lib/tenant/wash-orders.ts`, `src/lib/tenant/payments.ts`, `src/lib/tenant/branch-context.tsx`
- Create: `src/components/tenant/BranchSelector.tsx`, `WashCard.tsx`, `NewWashDialog.tsx`, `AssignStartDialog.tsx`, `PaymentDialog.tsx`
- Create: `src/pages/tenant/QueuePage.tsx`
- Modify: `src/components/tenant/TenantLayout.tsx`, `SidebarNav.tsx`, `src/routes.tsx`, `src/i18n/locales/{en,ar}.json`
- Create: `supabase/tests/0013_operations_rls_test.sql`
- Modify: `docs/BUSINESS_LOGIC.md`

---

## Task 1: Pure operations helpers (TDD) + i18n keys

**Files:** Create `src/lib/tenant/operations.ts`, `operations.test.ts`. Modify `src/i18n/locales/{en,ar}.json`.

- [ ] **Step 1: Failing tests** `src/lib/tenant/operations.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { canTransition, amountPaid, isPaid, remaining, validateNewWash } from "./operations"

describe("canTransition", () => {
  it("allows the legal moves", () => {
    expect(canTransition("waiting", "in_progress")).toBe(true)
    expect(canTransition("in_progress", "done")).toBe(true)
    expect(canTransition("waiting", "cancelled")).toBe(true)
    expect(canTransition("in_progress", "cancelled")).toBe(true)
  })
  it("rejects illegal moves", () => {
    expect(canTransition("done", "in_progress")).toBe(false)
    expect(canTransition("cancelled", "waiting")).toBe(false)
    expect(canTransition("waiting", "done")).toBe(false)
    expect(canTransition("done", "cancelled")).toBe(false)
  })
})
describe("payment math", () => {
  const p = (n: number) => ({ amount: n })
  it("sums payments", () => {
    expect(amountPaid([])).toBe(0)
    expect(amountPaid([p(10), p(15)])).toBe(25)
  })
  it("isPaid when sum >= price", () => {
    expect(isPaid(25, [])).toBe(false)
    expect(isPaid(25, [p(10)])).toBe(false)
    expect(isPaid(25, [p(25)])).toBe(true)
    expect(isPaid(25, [p(30)])).toBe(true)
    expect(isPaid(25, [p(10), p(20)])).toBe(true)
  })
  it("remaining never negative", () => {
    expect(remaining(25, [])).toBe(25)
    expect(remaining(25, [p(10)])).toBe(15)
    expect(remaining(25, [p(30)])).toBe(0)
  })
})
describe("validateNewWash", () => {
  it("requires a package and positive price", () => {
    expect(validateNewWash({ package_id: "", price: 10 })).toBe("package_required")
    expect(validateNewWash({ package_id: "p1", price: 0 })).toBe("price_invalid")
    expect(validateNewWash({ package_id: "p1", price: 25 })).toBeNull()
  })
})
```

- [ ] **Step 2: Run `npm test` — FAIL.**

- [ ] **Step 3: Implement** `src/lib/tenant/operations.ts`:
```ts
export type WashStatus = "waiting" | "in_progress" | "done" | "cancelled"

export const ALLOWED_TRANSITIONS: Record<WashStatus, WashStatus[]> = {
  waiting: ["in_progress", "cancelled"],
  in_progress: ["done", "cancelled"],
  done: [],
  cancelled: [],
}
export function canTransition(from: WashStatus, to: WashStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}
export function amountPaid(payments: { amount: number }[]): number {
  return payments.reduce((sum, p) => sum + Number(p.amount), 0)
}
export function isPaid(price: number, payments: { amount: number }[]): boolean {
  return amountPaid(payments) >= Number(price)
}
export function remaining(price: number, payments: { amount: number }[]): number {
  return Math.max(0, Number(price) - amountPaid(payments))
}
export function validateNewWash(input: { package_id?: string; price?: number }): string | null {
  if (!input.package_id) return "package_required"
  if (input.price == null || Number.isNaN(input.price) || input.price <= 0) return "price_invalid"
  return null
}
```

- [ ] **Step 4: Run `npm test` — PASS.**

- [ ] **Step 5: i18n keys** (BOTH locales, identical, real Arabic):
  - `nav.queue` exists — it becomes an active link (no key change).
  - `status`: `waiting`, `in_progress`, `done`, `cancelled`.
  - `queue`: `title`, `newWash`, `waiting`, `inProgress`, `done`, `emptyWaiting`, `emptyInProgress`, `emptyDone`, `branch`, `errors.generic`.
  - `wash`: `plate`, `findOrAddVehicle`, `newVehicle`, `customer`, `customerName`, `customerPhone`, `package`, `price`, `notes`, `assignEmployee`, `noEmployee`, `start`, `complete`, `cancel`, `cancelConfirm`, `unpaid`, `paid`, `remaining`, `assignedTo`, `create`, `errors.generic`, `errors.package_required`, `errors.price_invalid`, `errors.plate_required`.
  - `payment`: `title`, `amount`, `method`, `cash`, `card`, `transfer`, `record`, `errors.generic`.
  Run `npm test` → parity passes.

- [ ] **Step 6: Commit** `feat(tenant): operations helpers (transitions, payment math) + i18n`

---

## Task 2: Branch context + selector

**Files:** Create `src/lib/tenant/branch-context.tsx`, `src/components/tenant/BranchSelector.tsx`. Modify `src/components/tenant/TenantLayout.tsx`.

- [ ] **Step 1:** `src/lib/tenant/branch-context.tsx`
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { listBranches, type Branch } from "@/lib/tenant/branches"

interface BranchState { branchId: string | null; setBranchId: (id: string) => void; branches: Branch[]; loading: boolean }
const Ctx = createContext<BranchState | undefined>(undefined)
const KEY = "branchId"

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listBranches().then((bs) => {
      setBranches(bs)
      const stored = localStorage.getItem(KEY)
      const valid = stored && bs.some((b) => b.id === stored) ? stored : (bs[0]?.id ?? null)
      setBranchIdState(valid)
      if (valid) localStorage.setItem(KEY, valid)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function setBranchId(id: string) { setBranchIdState(id); localStorage.setItem(KEY, id) }
  return <Ctx.Provider value={{ branchId, setBranchId, branches, loading }}>{children}</Ctx.Provider>
}
export function useBranch(): BranchState {
  const c = useContext(Ctx)
  if (!c) throw new Error("useBranch must be used within BranchProvider")
  return c
}
```

- [ ] **Step 2:** `src/components/tenant/BranchSelector.tsx` — a shadcn `Select` bound to `useBranch()`. If `branches.length <= 1`, render the single branch name (or nothing) instead of a select. Labelled (`t("queue.branch")`), `min-h-[44px]`, logical utilities.

- [ ] **Step 3:** In `TenantLayout.tsx`, wrap the layout body (or the whole return) in `<BranchProvider>` and render `<BranchSelector/>` in the header (before the LanguageSwitcher). Ensure `BranchProvider` is inside the tenant-only subtree (it calls listBranches which needs a tenant claim). Build passes.

- [ ] **Step 4: Commit** `feat(tenant): branch context + header branch selector`

---

## Task 3: Data layer (wash orders + payments)

**Files:** Create `src/lib/tenant/wash-orders.ts`, `src/lib/tenant/payments.ts`.

- [ ] **Step 1:** `src/lib/tenant/wash-orders.ts`
```ts
import { supabase } from "@/lib/supabase"

export interface QueueOrder {
  id: string; status: "waiting" | "in_progress" | "done" | "cancelled"; price: number; notes: string | null
  created_at: string; assigned_employee_id: string | null
  plate_number: string | null; customer_name: string | null; package_name: string | null
  employee_name: string | null; payments: { amount: number }[]
}

const SELECT =
  "id,status,price,notes,created_at,assigned_employee_id," +
  "vehicles(plate_number),customers(name),packages(name),employees(name),payments(amount)"

export async function listQueue(branchId: string): Promise<QueueOrder[]> {
  // active orders (waiting/in_progress) regardless of day + today's done/cancelled
  const { data, error } = await supabase.from("wash_orders").select(SELECT)
    .eq("branch_id", branchId).order("created_at", { ascending: true })
  if (error) throw error
  return (data ?? []).map((o: any) => ({
    id: o.id, status: o.status, price: Number(o.price), notes: o.notes, created_at: o.created_at,
    assigned_employee_id: o.assigned_employee_id,
    plate_number: o.vehicles?.plate_number ?? null, customer_name: o.customers?.name ?? null,
    package_name: o.packages?.name ?? null, employee_name: o.employees?.name ?? null,
    payments: (o.payments ?? []).map((p: any) => ({ amount: Number(p.amount) })),
  }))
}
export async function createWashOrder(tenantId: string, input: {
  branch_id: string; price: number; package_id: string | null; vehicle_id: string | null
  customer_id: string | null; notes: string | null
}): Promise<string> {
  const { data, error } = await supabase.from("wash_orders").insert({
    tenant_id: tenantId, branch_id: input.branch_id, price: input.price, status: "waiting",
    package_id: input.package_id, vehicle_id: input.vehicle_id, customer_id: input.customer_id, notes: input.notes,
  }).select("id").single()
  if (error) throw error
  return data.id
}
export async function startWashOrder(id: string, employeeId: string | null): Promise<void> {
  const { error } = await supabase.from("wash_orders")
    .update({ status: "in_progress", started_at: new Date().toISOString(), assigned_employee_id: employeeId }).eq("id", id)
  if (error) throw error
}
export async function completeWashOrder(id: string): Promise<void> {
  const { error } = await supabase.from("wash_orders")
    .update({ status: "done", completed_at: new Date().toISOString() }).eq("id", id)
  if (error) throw error
}
export async function cancelWashOrder(id: string): Promise<void> {
  const { error } = await supabase.from("wash_orders").update({ status: "cancelled" }).eq("id", id)
  if (error) throw error
}
```
NOTE: For MVP the query fetches all branch orders ordered by created_at; the page filters to the three visible buckets (waiting, in_progress, and done/cancelled-from-today) client-side. If volume becomes a concern, add a date filter later. `new Date().toISOString()` is fine at runtime (this is app code, not a workflow script).

- [ ] **Step 2:** `src/lib/tenant/payments.ts`
```ts
import { supabase } from "@/lib/supabase"

export async function recordPayment(tenantId: string, washOrderId: string, input: { amount: number; method: "cash" | "card" | "transfer" }): Promise<void> {
  const { error } = await supabase.from("payments").insert({
    tenant_id: tenantId, wash_order_id: washOrderId, amount: input.amount, method: input.method,
  })
  if (error) throw error
}
```

- [ ] **Step 3:** `npm run build` passes. Commit `feat(tenant): wash-orders + payments data layer`.

---

## Task 4: Queue page + WashCard + status actions

**Files:** Create `src/pages/tenant/QueuePage.tsx`, `src/components/tenant/WashCard.tsx`, `src/components/tenant/AssignStartDialog.tsx`. Modify `SidebarNav.tsx`, `src/routes.tsx`.

- [ ] **Step 1: SidebarNav** — change the Queue item from a disabled "coming soon" span to a real `NavLink` to `/app/queue` (`t("nav.queue")`). Keep Dashboard coming-soon.

- [ ] **Step 2: Route** — add `{ path: "queue", element: <QueuePage/> }` under `TenantLayout` children.

- [ ] **Step 3: AssignStartDialog** `src/components/tenant/AssignStartDialog.tsx` — props `{ open, onOpenChange, onConfirm: (employeeId|null) => void }`. A select of ACTIVE employees (`listEmployees()` filtered `is_active`), plus a "no employee" option (`t("wash.noEmployee")`); Start button calls `onConfirm`. Strings via t().

- [ ] **Step 4: WashCard** `src/components/tenant/WashCard.tsx` — props `{ order, onChanged }`. Shows plate (or "—"), customer, package, price, status badge, assigned employee, and a paid/unpaid badge (`isPaid(order.price, order.payments)` + `remaining`). Action buttons by status using the data-layer fns + `canTransition` guard:
  - waiting: **Start** (opens AssignStartDialog → `startWashOrder(id, empId)`), **Cancel** (confirm → `cancelWashOrder`).
  - in_progress: **Complete** (`completeWashOrder`), **Cancel**.
  - done: if not paid, **Record payment** (opens PaymentDialog — Task 5). 
  After any action, call `onChanged()` to refetch. Localized; logical utilities; `min-h-[44px]`.

- [ ] **Step 5: QueuePage** `src/pages/tenant/QueuePage.tsx` — uses `useBranch()`. If no branchId (loading/none) show a sensible state. Header: `t("queue.title")` + "New Wash" button (opens NewWashDialog — Task 5). Loads `listQueue(branchId)`; partitions into Waiting / In Progress / Done buckets (done = today's done; ignore cancelled or show separately — keep cancelled out of the board for MVP). Render three responsive columns (`grid lg:grid-cols-3 gap-4`, stacking on mobile) each a titled list of `WashCard`s with per-column empty states. Refetch on branch change + after actions. `New Wash` and the columns are scoped to the current branch.

- [ ] **Step 6: Verify** `npm run build` + `npm test` pass. (PaymentDialog + NewWashDialog come in Task 5; temporarily wire buttons to open them once they exist, or build Task 5 first. To keep build green, you may stub the two dialogs minimally then complete in Task 5 — prefer implementing Task 5 alongside.) Commit `feat(tenant): queue board + wash cards + status actions`.

---

## Task 5: New Wash dialog + Payment dialog

**Files:** Create `src/components/tenant/NewWashDialog.tsx`, `src/components/tenant/PaymentDialog.tsx`.

- [ ] **Step 1: PaymentDialog** `src/components/tenant/PaymentDialog.tsx` — props `{ open, onOpenChange, order, onRecorded }`. Fields: amount (number, defaults to `remaining(order.price, order.payments)` or price; editable), method (select cash/card/transfer). On submit → `recordPayment(claims.tenantId, order.id, {amount, method})` → `onRecorded()`. Validate amount > 0. Strings via t().

- [ ] **Step 2: NewWashDialog** `src/components/tenant/NewWashDialog.tsx` — props `{ open, onOpenChange, branchId, onCreated }`. The walk-in form:
  - **Vehicle:** a `PlateSearch`-style lookup OR direct entry. Simplest robust approach: an input bound to a plate term that queries `searchVehiclesByPlate`; show matches to pick (sets `vehicle_id` + `customer_id` + fills plate). A "use new vehicle" path: if the user doesn't pick a match, on submit create a vehicle from the typed plate (+ optional make/model/color fields shown under an "add details" toggle) — `plate_number` required if creating. Optional customer: a quick name + phone; if name given, `createCustomer` then link.
  - **Package:** a select of ACTIVE packages (`listPackages()` filtered is_active). Selecting one sets `price` from the package (editable number input).
  - **Notes:** optional.
  - Validation via `validateNewWash({package_id, price})` (+ plate required if creating a new vehicle and none selected). On submit: optionally `createCustomer` → `createVehicle` (linking customer) → `createWashOrder(claims.tenantId, {branch_id: branchId, price, package_id, vehicle_id, customer_id, notes})` → `onCreated()`.
  - Keep it usable on a 375px screen; all strings via t(); logical utilities.

- [ ] **Step 3: Wire** NewWashDialog into QueuePage's "New Wash" button and PaymentDialog into WashCard's "Record payment" button (replace any stubs).

- [ ] **Step 4: Verify** `npm run build` + `npm test` pass. Commit `feat(tenant): new-wash + payment dialogs`.

---

## Task 6: pgTAP + full verification + docs

**Files:** Create `supabase/tests/0013_operations_rls_test.sql`. Modify `docs/BUSINESS_LOGIC.md`.

- [ ] **Step 1: pgTAP** `supabase/tests/0013_operations_rls_test.sql` — valid hex UUIDs. Seed tenant A + B, each with a branch (B's order as superuser). Under tenant-A claim (`set local role authenticated` + jwt claims tenant A): insert a wash_order (waiting) + a payment; assert:
  - tenant A sees exactly 1 wash_order (not B's), 1 payment;
  - updating that order waiting→in_progress persists (status reads back in_progress);
  - `audit_log` has a wash_orders INSERT row and a payments INSERT row for tenant A.
  ~5 assertions. Seed prerequisite rows (tenant, branch) appropriately; wash_orders requires branch_id (NOT NULL) and price (NOT NULL). Run `npx supabase test db` → all pass; paste summary.

- [ ] **Step 2: Full suite** — `npx supabase test db`, `npm test`, `npm run build` green. Paste output.

- [ ] **Step 3: Integration + EDGE CASES** (browser; login `owner@demo.test`/`password123`; ensure a package + an employee exist — create via /app/packages and /app/staff if needed, or seed):
  - On `/app/queue`: click **New Wash** → type a new plate "WASH 1", pick a package (price auto-fills), submit → card appears in **Waiting** (creates the vehicle).
  - **Start** the card → choose the employee → moves to **In Progress** with assignee shown.
  - **Complete** → moves to **Done**, shows **unpaid**.
  - **Record payment** with the default amount → card shows **paid**.
  - Edge cases: create a wash, **Cancel** from Waiting; start another, **Cancel** from In Progress; new wash with a **price override**; a **partial payment** (amount < price → still unpaid + remaining shown) then a second payment → paid; **switch branch** (create a 2nd branch in /app/branches first) → queue filters to the selected branch; **empty-column** states show. Tenant isolation (only Demo Carwash data).
  Label browser-verified vs API-verified. Report real bugs (don't silently fix logic); small UI fixes you may apply + note.

- [ ] **Step 4: Responsive × RTL** — screenshot `/app/queue` (with cards in each column + the New Wash dialog + a Payment dialog) at 375 + 820 in EN + AR. Verify columns stack on mobile, mirror in RTL, no overflow, dialogs fit, Arabic Cairo, branch selector usable. Fix + re-verify any break.

- [ ] **Step 5: Update `docs/BUSINESS_LOGIC.md`** — operations (queue, wash orders, status flow, payments, branch context) BUILT; 3C done, 3D (dashboard) next; bump Last updated.

- [ ] **Step 6: Commit** `test(tenant): operations RLS; docs: 3C built`.

---

## Definition of Done
- Branch selector in the header scopes the queue + new wash; persists across reloads.
- New Wash registers a walk-in (linking or creating vehicle/customer), defaulting price from the package.
- Queue board shows Waiting/In Progress/Done; cards advance via Start(+assign)/Complete/Cancel with the transition guard; done orders take a payment; paid/unpaid + remaining shown.
- i18n (en/ar parity), RTL-correct, responsive (columns stack + mirror; verified mobile+tablet, EN+AR).
- Vitest (operations + parity), pgTAP (0013 isolation + status update + audit), build — all green.
- `docs/BUSINESS_LOGIC.md` updated.
