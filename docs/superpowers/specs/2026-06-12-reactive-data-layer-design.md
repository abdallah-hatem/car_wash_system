# Reactive Data Layer (TanStack Query) + Custom Confirm Modals — Design

**Date:** 2026-06-12
**Status:** Approved
**Modifies:** the data-fetching across all tenant + admin pages, dialogs, and the branch
context; and replaces native browser confirms with custom modals.

## 1. Purpose

After any add/edit/delete, all related views update automatically — no manual refresh.
Driving example: creating a branch immediately updates the navbar branch dropdown (and the
employee dialog's branch select, and the branches list).

## 2. Approach (recommended, approved)

**TanStack Query (`@tanstack/react-query`).** Components subscribe to data by query key;
mutations invalidate the affected keys; every subscriber re-fetches and re-renders. This
delivers cross-component reactivity with one invalidation call per mutation, and replaces the
repetitive `useState + useEffect + manual refetch` pattern.

Rejected: Supabase Realtime (multi-user push — overkill for same-client reactivity; future
option for the live queue) and manual shared contexts (doesn't scale across entities).

## 3. Architecture

### 3.1 Provider
- `src/lib/query.ts`: a `QueryClient` (sensible defaults — `staleTime` ~30s, retry 1,
  `refetchOnWindowFocus` true so returning to the tab refreshes).
- `main.tsx`: wrap the tree in `<QueryClientProvider client={queryClient}>` (outside Router,
  inside it doesn't matter — place above AuthProvider).

### 3.2 Query keys (stable, hierarchical)
- `["branches"]`, `["packages"]`, `["employees"]`, `["customers"]`
- `["vehicles", "byCustomer", customerId]`, `["vehicles", "search", term]`
- `["queue", branchId]`, `["dashboard", branchId]`
- `["businesses"]` (admin)

### 3.3 Query hooks (wrap existing data functions — functions unchanged)
`src/lib/tenant/queries.ts` (+ `src/lib/admin-queries.ts` for businesses):
- `useBranches()`, `usePackages()`, `useEmployees()`, `useCustomers()`,
  `useVehiclesByCustomer(id)`, `usePlateSearch(term)` (enabled only when term non-empty),
  `useQueue(branchId)`, `useDashboard(branchId)`, `useBusinesses()`.
- Each is `useQuery({ queryKey, queryFn: existingFn, ... })`. `enabled` guards where a param
  is required (e.g. branchId/customerId present).

### 3.4 Mutation hooks (or inline `useMutation`)
Each mutation calls the existing create/update/delete fn, then on success
`queryClient.invalidateQueries({ queryKey: [...] })` for the affected keys:
- branch create/update/delete → invalidate `["branches"]` (refreshes list + navbar dropdown
  + employee branch-select).
- package create/update/delete/setActive → `["packages"]`.
- employee … → `["employees"]`.
- customer create/update/delete → `["customers"]` (and `["vehicles", …]` if needed).
- vehicle create/update/delete → `["vehicles"]` (broad) + `["customers"]` (vehicle counts).
- create wash order → `["queue", branchId]` + `["dashboard", branchId]`.
- start/complete/cancel wash → `["queue", branchId]` + `["dashboard", branchId]`.
- record payment → `["queue", branchId]` + `["dashboard", branchId]`.
- business create → `["businesses"]`; suspend/activate → `["businesses"]`.

### 3.5 Branch context becomes reactive
`BranchProvider` reads branches via `useBranches()` instead of a one-time `listBranches()`.
It keeps the selected-branch state + localStorage logic, and recomputes the default/validity
when the branches list changes. Result: creating/deleting a branch updates the navbar
dropdown immediately. If the selected branch is deleted, fall back to the first branch.

### 3.6 Page/dialog conversion
Replace per-page `useState(list)+useEffect(fetch)+manual refetch` with the query hooks; replace
post-mutation `onChanged()/fetchX()` calls with mutation hooks that invalidate. Loading/error
come from the query (`isLoading`, `isError`). Dialogs call mutation hooks; on success they
close — the list updates via invalidation, not a passed-down callback. Keep existing UI,
i18n, validation, RTL, and the icon buttons unchanged.

## 3.7 Custom confirmation modals (replace native `window.confirm`)

Today, destructive actions use the browser's native `window.confirm()` (delete in the table
action columns; cancel a wash in `WashCard`; the customer "this unlinks vehicles" warning).
Replace all of these with a **custom, on-brand modal**.

- Add shadcn **`alert-dialog`** (`npx shadcn@2.10.0 add alert-dialog`) and RTL-correct its
  primitives (logical utilities), matching the earlier dialog/table/select fixes.
- Build a reusable `src/components/ui/confirm-dialog.tsx` — a `ConfirmDialog` wrapping
  `AlertDialog` with props `{ open, onOpenChange, title, description, confirmLabel,
  cancelLabel, destructive?, onConfirm, loading? }`. Destructive variant styles the confirm
  button red.
- Optionally a tiny `useConfirm()` hook (promise-based) so call sites stay terse, OR each
  consuming component holds a small `confirmOpen` state — pick whichever keeps call sites
  clean; the component is the source of truth.
- Replace every `window.confirm(...)` call: table-row deletes (branches, packages, employees,
  customers, vehicles), the `WashCard` cancel confirm, and the customer-delete warning. Each
  uses `ConfirmDialog` with localized title/description/labels (`common.confirmDelete`,
  entity-specific warnings like `customers.deleteWarn`, `wash.cancelConfirm`) and a
  destructive confirm for deletes.
- Accessible (focus-trapped, ESC/overlay to cancel), i18n, RTL, responsive.

## 4. Error handling
Query errors → existing localized error states (from `isError`). Mutation errors → the
existing inline dialog error mapping (e.g. plate `duplicate`, `in_use`) preserved — mutation
hooks surface the thrown error to the caller for mapping. A failed invalidation never blocks
the UI.

## 5. Testing
- **Unchanged:** data-function unit tests (validators, normalize, dashboard math, etc.) and
  all pgTAP tests — the data functions and DB are untouched.
- **New (light):** a small unit test for query-key builders if we extract them (pure).
- **Acceptance (browser):** create a branch → the **navbar branch dropdown updates with no
  refresh**; create a package/employee → the New-Wash selects include it without refresh;
  record a payment / start a wash → the **dashboard updates without refresh**; delete the
  selected branch → selector falls back gracefully. A delete/cancel shows the **custom
  confirm modal** (not a native browser dialog), and confirming performs the action + the
  list updates reactively. Verify in EN + a quick RTL pass.
- Full local suite (pgTAP + Vitest + build) green; **gate the push on green.**

## 6. Out of scope
Supabase Realtime / multi-client live sync (future, esp. for a multi-operator queue);
optimistic updates (invalidation is sufficient and simpler); offline cache persistence.

## 7. Docs
Update `docs/BUSINESS_LOGIC.md` cross-cutting conventions: data fetching uses TanStack Query;
mutations invalidate related query keys so views stay in sync without manual refresh.
