# Plan 3C — Operations (queue, wash orders, payments) — Design

**Date:** 2026-06-12
**Status:** Approved
**Part of:** Plan 3 (Tenant Operations), sub-plan 3C — the core daily workflow. Depends on 3A (shell, setup CRUD), 3B (customers/vehicles + plate search).

## 1. Purpose

The counter workflow: register a walk-in wash, run it through a live queue
(waiting → in progress → done), assign an employee, and record a manual payment.

## 2. Decisions (recommended defaults taken)

- **Branch context:** a branch selector in the tenant header, persisted to `localStorage`,
  defaulting to the first branch. The queue + new-wash are scoped to the selected branch.
- **Queue board** at `/app/queue` (enable the "Queue" nav): three status columns
  **Waiting / In Progress / Done (today)**, stacking on mobile, mirrored in RTL. No drag —
  cards advance via buttons. Scoped to current branch + today (`created_at::date = today`,
  plus any still-active orders). Refetch after each action (Realtime deferred).
- **New wash:** plate field with live search (reuse 3B) to link an existing vehicle/customer,
  OR create a vehicle on the fly (plate required; make/model/color optional; optional quick
  customer name/phone). Package required → auto-fills editable price. Optional notes.
- **Status transitions:** waiting→in_progress (set `started_at`, optional
  `assigned_employee_id`), in_progress→done (set `completed_at`), waiting|in_progress→cancelled.
  Enforced by a pure allowed-transitions helper on the client (DB has no status-machine
  constraint in MVP).
- **Payment:** done order → record one payment (amount defaults to price, editable; method
  cash/card/transfer). "Paid" = sum(payments) ≥ price. Over/partial allowed; UI shows
  paid/unpaid + remaining.

## 3. Components

### 3.1 Branch context
- `src/lib/tenant/branch-context.tsx`: a `BranchProvider` + `useBranch()` exposing
  `{ branchId, setBranchId, branches }`. Loads the tenant's branches once; persists the
  selected id in `localStorage` (`branchId`); defaults to the first branch; clears if invalid.
- `src/components/tenant/BranchSelector.tsx`: a shadcn `Select` in the `TenantLayout` header
  (hidden if 0–1 branches → just show the name). Mounted inside the provider.
- `TenantLayout` wraps its `<Outlet/>` subtree in `BranchProvider` so all tenant pages can
  read the current branch.

### 3.2 Data layer
- `src/lib/tenant/wash-orders.ts`:
  - `listQueue(branchId)` → today's + active orders for the branch, with embedded
    `vehicles(plate_number)`, `customers(name)`, `packages(name)`, `employees(name)`, and
    `payments(amount)` (to compute paid). Ordered by `created_at`.
  - `createWashOrder(tenantId, input)` → inserts a `wash_order` (status waiting, branch,
    price, optional vehicle/customer/package/notes). Returns id.
  - `startWashOrder(id, employeeId | null)` → status in_progress, `started_at=now()`,
    `assigned_employee_id`.
  - `completeWashOrder(id)` → status done, `completed_at=now()`.
  - `cancelWashOrder(id)` → status cancelled.
- `src/lib/tenant/payments.ts`: `recordPayment(tenantId, washOrderId, {amount, method})`;
  `listPaymentsFor(washOrderId)` (or rely on the embed in listQueue).
- `src/lib/tenant/operations.ts` (pure, unit-tested): `ALLOWED_TRANSITIONS` +
  `canTransition(from,to)`; `amountPaid(payments)`, `isPaid(price, payments)`,
  `remaining(price, payments)`; `validateNewWash(input)` (package required, price > 0).
- New-wash may create a customer/vehicle: reuse `createCustomer`/`createVehicle` from 3B.

### 3.3 Pages & components
- `src/pages/tenant/QueuePage.tsx`: header (title + branch-scoped) + "New Wash" button;
  three columns (Waiting/In Progress/Done) of `WashCard`s; loading/empty-per-column/error;
  refetch after actions. Uses `useBranch()`.
- `src/components/tenant/WashCard.tsx`: shows plate/vehicle, customer, package, price,
  status, assigned employee, paid badge; renders the relevant action buttons per status.
- `src/components/tenant/NewWashDialog.tsx`: the walk-in form (plate search/create, package
  select → price, notes). On submit creates customer/vehicle as needed + the wash order.
- `src/components/tenant/AssignStartDialog.tsx` (or inline on the card): pick employee
  (active employees; optional) → Start.
- `src/components/tenant/PaymentDialog.tsx`: amount (default price) + method → record.
- `SidebarNav`: turn "Queue" from coming-soon into a real link (`/app/queue`); keep
  Dashboard coming-soon.

## 4. Cross-cutting (standing rule)
i18n keys under `nav.queue` (already exists; now active), `queue.*`, `wash.*`,
`payment.*`, `status.*` (waiting/in_progress/done/cancelled), plus `common.*` reuse — both
locales, parity-tested, real Arabic. RTL-correct logical utilities; responsive (columns
stack on mobile, mirror in RTL); Cairo for Arabic. Follows the established Table/Dialog +
Card patterns.

## 5. Error handling
Validation inline; DB/RLS errors localized; actions confirm where destructive (cancel).
Guard illegal transitions with `canTransition` (defense-in-depth; UI only shows legal
actions). Branch selector handles the 0-branch edge (shouldn't happen — onboarding creates
Main Branch — but degrade gracefully).

## 6. Testing (required)
- **Vitest** (`operations.test.ts`): `canTransition` (all legal + illegal pairs),
  `amountPaid`/`isPaid`/`remaining` (no payments, partial, exact, over), `validateNewWash`
  (missing package, price ≤ 0, valid).
- **pgTAP** (`supabase/tests/0013_operations_rls_test.sql`): under a tenant-A claim, create a
  wash_order + payment (visible, count 1); tenant-B order/payment seeded as superuser is
  invisible; a status update (waiting→in_progress) persists; audit_log has rows for the
  wash_order INSERT and the payment INSERT (triggers exist from Plan 1).
- **Full-flow + edge cases:** walk-in with a NEW plate (creates vehicle) → appears in
  Waiting → assign employee + Start → In Progress → Complete → Done → Record payment
  (default price) → paid badge. Also: cancel from waiting and from in_progress; price
  override on new wash; partial payment (amount < price → still unpaid + remaining) then a
  second payment → paid; switch branch → queue filters; empty columns. Tenant isolation.
  Responsive/RTL at mobile + tablet, EN + AR (columns stack + mirror; dialogs fit).
- Full local suite (pgTAP + Vitest + build) green before pushing to `dev`.

## 7. Out of scope (later)
Realtime push updates, kanban drag-drop, wash/vehicle history view, ratings, editing/voiding
payments, multi-day queue history, per-employee performance. Dashboard is 3D.

## 8. Docs
Update `docs/BUSINESS_LOGIC.md` (operations queue + wash orders + payments now BUILT; 3C done,
3D dashboard next) as part of this work.
