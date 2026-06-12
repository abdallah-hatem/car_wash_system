# Reactive Data Layer + Custom Confirm Modals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Adopt TanStack Query so any add/edit/delete refreshes all related views automatically (no manual refresh), and replace native `window.confirm` with a custom on-brand confirmation modal.

**Architecture:** A `QueryClient` + provider; per-entity query hooks wrapping the EXISTING data functions; mutations invalidate affected query keys. `BranchProvider` becomes a `useBranches()` consumer so the navbar dropdown is reactive. A reusable `ConfirmDialog` (shadcn AlertDialog) replaces native confirms.

**Tech Stack:** React + Vite + TS, `@tanstack/react-query`, shadcn (v2), react-i18next, Vitest, pgTAP.

**Existing data functions (UNCHANGED — hooks wrap them):**
- `src/lib/tenant/branches.ts` (listBranches, createBranch, updateBranch, removeBranch)
- `packages.ts`, `employees.ts`, `customers.ts`, `vehicles.ts` (incl. searchVehiclesByPlate, listVehiclesByCustomer), `wash-orders.ts` (listQueue, create/start/complete/cancel), `payments.ts` (recordPayment), `dashboard.ts` (getTodayStats), `src/lib/admin.ts` (listBusinesses, setBusinessStatus, createBusiness).

**Consumers to convert:** `src/lib/tenant/branch-context.tsx`; pages `src/pages/tenant/{BranchesPage,PackagesPage,StaffPage,CustomersPage,QueuePage,DashboardPage}.tsx`, `src/pages/admin/BusinessesPage.tsx`; dialogs `src/components/tenant/{BranchDialog,PackageDialog,EmployeeDialog,CustomerDialog,CustomerDetailDialog,VehicleDialog,NewWashDialog,AssignStartDialog,PaymentDialog}.tsx`, `src/components/admin/CreateBusinessDialog.tsx`; `src/components/tenant/{WashCard,PlateSearch,BranchSelector}.tsx`.

**File structure:**
- Create: `src/lib/query.ts`, `src/lib/tenant/queries.ts`, `src/lib/admin-queries.ts`, `src/components/ui/confirm-dialog.tsx`
- Modify: `src/main.tsx`, `src/components/tenant/branch-context.tsx`, all the pages/dialogs above, `src/components/ui/alert-dialog.tsx` (RTL fix after shadcn add), `docs/BUSINESS_LOGIC.md`
- Install: `@tanstack/react-query`; shadcn `alert-dialog`

---

## Task 1: Foundation — QueryClient, provider, ConfirmDialog

**Files:** Create `src/lib/query.ts`, `src/components/ui/confirm-dialog.tsx`. Modify `src/main.tsx`, add+fix `src/components/ui/alert-dialog.tsx`.

- [ ] **Step 1: Install** `npm install @tanstack/react-query` and `npx shadcn@2.10.0 add alert-dialog`.

- [ ] **Step 2: RTL-fix alert-dialog** — grep `src/components/ui/alert-dialog.tsx` for physical utilities (`left-/right-/pl-/pr-/ml-/mr-/text-left/text-right/space-x-`) and convert to logical (`start-/end-/ps-/pe-/ms-/me-/text-start/gap-`) like the prior dialog fix (the centering `left-[50%] translate-x-[-50%]` is fine; footer `sm:space-x-2`→`sm:gap-2`).

- [ ] **Step 3: QueryClient** `src/lib/query.ts`
```ts
import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
})
```

- [ ] **Step 4: Provider** — in `src/main.tsx`, wrap the tree:
```tsx
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/query"
// ...
<QueryClientProvider client={queryClient}>
  <I18nDirection>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </I18nDirection>
</QueryClientProvider>
```

- [ ] **Step 5: ConfirmDialog** `src/components/ui/confirm-dialog.tsx`
```tsx
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel, cancelLabel,
  destructive = false, loading = false, onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={onConfirm}
            className={cn(destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 6:** Add i18n keys if missing: `common.confirm`, `common.confirmDeleteTitle`, `common.confirmDeleteBody` (generic), reuse `common.cancel`, `common.delete`. Add to BOTH locales (real Arabic). Run `npm test` (parity green). `npm run build` clean. Commit `feat(data): react-query provider + ConfirmDialog (alert-dialog)`.

---

## Task 2: Query + mutation hooks

**Files:** Create `src/lib/tenant/queries.ts`, `src/lib/admin-queries.ts`.

- [ ] **Step 1: Tenant hooks** `src/lib/tenant/queries.ts` — wrap existing functions. Pattern:
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as branches from "./branches"
// ... import the other data modules

export const keys = {
  branches: ["branches"] as const,
  packages: ["packages"] as const,
  employees: ["employees"] as const,
  customers: ["customers"] as const,
  vehiclesByCustomer: (id: string) => ["vehicles", "byCustomer", id] as const,
  plateSearch: (term: string) => ["vehicles", "search", term] as const,
  queue: (branchId: string) => ["queue", branchId] as const,
  dashboard: (branchId: string) => ["dashboard", branchId] as const,
}

export function useBranches() {
  return useQuery({ queryKey: keys.branches, queryFn: branches.listBranches })
}
// usePackages, useEmployees, useCustomers — same shape.
export function useVehiclesByCustomer(customerId: string | null) {
  return useQuery({
    queryKey: keys.vehiclesByCustomer(customerId ?? ""),
    queryFn: () => vehicles.listVehiclesByCustomer(customerId!),
    enabled: !!customerId,
  })
}
export function usePlateSearch(term: string) {
  return useQuery({
    queryKey: keys.plateSearch(term.trim()),
    queryFn: () => vehicles.searchVehiclesByPlate(term),
    enabled: term.trim().length > 0,
  })
}
export function useQueue(branchId: string | null) {
  return useQuery({
    queryKey: keys.queue(branchId ?? ""),
    queryFn: () => washOrders.listQueue(branchId!),
    enabled: !!branchId,
  })
}
export function useDashboard(branchId: string | null) {
  return useQuery({
    queryKey: keys.dashboard(branchId ?? ""),
    queryFn: () => dashboard.getTodayStats(branchId!),
    enabled: !!branchId,
  })
}

// Mutations: each invalidates affected keys. Example for branches:
export function useBranchMutations() {
  const qc = useQueryClient()
  const inval = () => qc.invalidateQueries({ queryKey: keys.branches })
  return {
    create: useMutation({ mutationFn: (a: { tenantId: string; input: Parameters<typeof branches.createBranch>[1] }) => branches.createBranch(a.tenantId, a.input), onSuccess: inval }),
    update: useMutation({ mutationFn: (a: { id: string; input: Parameters<typeof branches.updateBranch>[1] }) => branches.updateBranch(a.id, a.input), onSuccess: inval }),
    remove: useMutation({ mutationFn: (id: string) => branches.removeBranch(id), onSuccess: inval }),
  }
}
```
Provide equivalent mutation hooks for packages (incl. setActive), employees (incl. setActive), customers (invalidate customers + vehicles), vehicles (invalidate vehicles + customers for counts). For wash-orders + payments, the mutations invalidate BOTH `keys.queue(branchId)` and `keys.dashboard(branchId)` — pass branchId into the hook so it can build the keys.
NOTE: keep the mutation `mutationFn` thin wrappers over the existing functions so thrown errors (e.g. `"duplicate"`, `"in_use"`, `23505`) still propagate to the dialog for mapping. Components call `mutateAsync(...)` in a try/catch to map errors.

- [ ] **Step 2: Admin hooks** `src/lib/admin-queries.ts` — `useBusinesses()` (query `["businesses"]` → listBusinesses) and `useBusinessMutations()` (`create` → createBusiness, `setStatus` → setBusinessStatus; both invalidate `["businesses"]`).

- [ ] **Step 3:** `npm run build` passes (types). Commit `feat(data): react-query hooks for all entities`.

---

## Task 3: Reactive branch context + selector

**Files:** Modify `src/components/tenant/branch-context.tsx`, `BranchSelector.tsx`.

- [ ] **Step 1: branch-context** — replace the one-time `listBranches()` with `useBranches()`. Keep `branchId` state + localStorage (`branchId`) logic, but derive validity/default reactively from the query data:
```tsx
const { data: branches = [], isLoading } = useBranches()
const [branchId, setBranchIdState] = useState<string | null>(() => localStorage.getItem("branchId"))
useEffect(() => {
  if (isLoading) return
  const valid = branchId && branches.some((b) => b.id === branchId)
  const next = valid ? branchId : (branches[0]?.id ?? null)
  if (next !== branchId) { setBranchIdState(next); if (next) localStorage.setItem("branchId", next) }
}, [branches, isLoading, branchId])
function setBranchId(id: string) { setBranchIdState(id); localStorage.setItem("branchId", id) }
// provide { branchId, setBranchId, branches, loading: isLoading }
```
Now creating/deleting a branch (which invalidates `["branches"]`) re-runs `useBranches()` → the provider's `branches` update → the navbar `BranchSelector` updates automatically; a deleted selected branch falls back to the first.

- [ ] **Step 2:** `npm run build` + `npm test` pass. Commit `feat(data): reactive branch context via useBranches`.

---

## Task 4: Convert tenant setup pages + dialogs (branches/packages/employees/customers/vehicles)

**Files:** Modify the 4 setup pages + their dialogs + CustomersPage/CustomerDetailDialog/PlateSearch.

- [ ] **Step 1:** For each list page (BranchesPage, PackagesPage, StaffPage, CustomersPage): replace `useState(list)+useEffect(fetch)+manual refetch` with the query hook (`useBranches()`, etc.) — use `isLoading`/`isError` for the existing loading/error states; drop the local fetch + `onChanged` plumbing.
- [ ] **Step 2:** Each dialog (BranchDialog, PackageDialog, EmployeeDialog, CustomerDialog, VehicleDialog) calls the mutation hook's `mutateAsync` in its submit handler (keep validation + error mapping incl. `"duplicate"`/`"in_use"`); on success, close the dialog — the list refreshes via invalidation (remove the `onSaved/onChanged` refetch callbacks, or keep the prop but have it just close). The active-toggle (packages/employees) calls the setActive mutation.
- [ ] **Step 3:** Replace `window.confirm(...)` deletes with `<ConfirmDialog>` (destructive) — hold a small `confirmId`/`confirmOpen` state in each page; confirming calls the remove mutation. Use localized title/body (`common.confirmDeleteTitle`/`Body`, or entity warnings like `customers.deleteWarn`).
- [ ] **Step 4:** `PlateSearch` uses `usePlateSearch(term)` (the debounce becomes: debounce the term into state, hook does the rest); `CustomerDetailDialog` uses `useVehiclesByCustomer(customer.id)` + vehicle mutations; its vehicle-delete uses `ConfirmDialog`.
- [ ] **Step 5:** `npm run build` + `npm test` pass. Commit `feat(data): reactive tenant setup pages + custom delete modals`.

---

## Task 5: Convert queue + admin (cross-entity invalidation)

**Files:** Modify `QueuePage.tsx`, `WashCard.tsx`, `DashboardPage.tsx`, `BusinessesPage.tsx`, `CreateBusinessDialog.tsx`, `NewWashDialog.tsx`, `PaymentDialog.tsx`, `AssignStartDialog.tsx`.

- [ ] **Step 1: Queue** — `QueuePage` uses `useQueue(branchId)`; partition stays the same. `WashCard` actions call wash mutation hooks (start/complete/cancel) that invalidate `keys.queue(branchId)` + `keys.dashboard(branchId)`; the cancel confirm uses `<ConfirmDialog>` (not `window.confirm`). `NewWashDialog` create uses the create-wash mutation (+ customer/vehicle creation via their mutations) → invalidates queue + dashboard (+ customers/vehicles). `PaymentDialog` uses the payment mutation → invalidates queue + dashboard. Pass `branchId` to these hooks/dialogs so they can build the keys.
- [ ] **Step 2: Dashboard** — `DashboardPage` uses `useDashboard(branchId)`; the Refresh button calls `refetch()` from the query (keep it as a manual refresh affordance). Recording a payment / advancing a wash now updates it automatically via invalidation.
- [ ] **Step 3: Admin** — `BusinessesPage` uses `useBusinesses()`; suspend/activate uses the status mutation (invalidate `["businesses"]`). `CreateBusinessDialog` uses the create mutation (keep the temp-password success view) → invalidate `["businesses"]`. No native confirms here (status toggle has no confirm; leave as is or add one — not required).
- [ ] **Step 4:** `npm run build` + `npm test` pass. Commit `feat(data): reactive queue + dashboard + admin; cancel modal`.

---

## Task 6: Verify reactivity + suite + docs (gated push)

**Files:** Modify `docs/BUSINESS_LOGIC.md`.

- [ ] **Step 1: Full suite** — `npx supabase test db`, `npm test`, `npm run build` all green. Paste output.
- [ ] **Step 2: Browser acceptance** (login `owner@demo.test`/`password123`; dev server fresh `npm run dev` after `rm -rf node_modules/.vite`):
  - **Create a branch** (Branches page) → WITHOUT refreshing, the **navbar branch dropdown** now lists it (this is the headline ask). Delete a non-selected branch → dropdown updates; delete the selected branch → selector falls back to another.
  - Create a **package** and an **employee** → open New Wash → the new package/employee appear in the selects without refresh.
  - On the queue: **record a payment** → switch to Dashboard → revenue/counts reflect it **without** clicking Refresh (invalidation). Start/complete a wash → dashboard counts update.
  - A **delete** (any table) and the wash **Cancel** show the **custom modal** (not the native browser confirm); confirming performs the action and the list updates reactively.
  - Quick RTL pass: the confirm modal mirrors correctly.
  Label browser-verified. Fix any real bug; report.
- [ ] **Step 3: Docs** — update `docs/BUSINESS_LOGIC.md` §7 conventions: data fetching uses TanStack Query; mutations invalidate related keys so views stay in sync without manual refresh; destructive actions use a custom `ConfirmDialog` (no native confirms). Bump Last updated.
- [ ] **Step 4: Commit + GATED push** — commit `test(data): reactivity verified; docs`. Controller runs pgTAP + Vitest + build and pushes only if all green.

---

## Definition of Done
- Any create/edit/delete updates all related views with no manual refresh — verified by the branch-dropdown and dashboard-after-payment scenarios.
- `BranchProvider` is reactive (navbar dropdown updates on branch changes; graceful fallback when the selected branch is deleted).
- All native `window.confirm` replaced by a custom, on-brand, accessible `ConfirmDialog` (i18n/RTL/responsive).
- Existing validation/error mapping (duplicate plate, in-use branch) preserved.
- Vitest + pgTAP + build green; pushed only after a green suite.
- `docs/BUSINESS_LOGIC.md` updated.
