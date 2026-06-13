# Cancellation Reason + Table Pagination — Design

**Date:** 2026-06-12
**Status:** Approved
**Builds on:** 3C operations (wash cancel), the reactive data layer (React Query), and the
list tables across tenant + admin.

## Part A — Cancellation reason

### A1. Schema (migration `0013_cancel_reason.sql`)
Add to `wash_orders` (both nullable):
- `cancellation_reason text` — why the wash was cancelled.
- `cancelled_at timestamptz` — when it was cancelled (rounds out the timing data for stats).

No backfill needed (existing cancelled rows just have nulls). Regenerate `database.types.ts`.

### A2. Flow
Replace the wash Cancel's plain `ConfirmDialog` with a new
`src/components/tenant/CancelWashDialog.tsx`:
- A **required** reason field (textarea) — the Cancel button is disabled until non-empty.
- Quick-pick preset chips that fill the field: *Customer left*, *Vehicle issue*,
  *Duplicate*, *Mistake* (localized; tapping one sets the reason, still editable).
- Confirm (destructive) calls the cancel mutation with the reason; on success the card
  leaves the board (queue refreshes via invalidation).

### A3. Data
`cancelWashOrder(id, reason)` → update `status='cancelled'`,
`cancellation_reason = reason.trim()`, `cancelled_at = now()`. The wash mutation hook still
invalidates queue + dashboard + washes.

### A4. Display
- `WashRow` + `listWashes` include `cancellation_reason`.
- The **Washes** history table gets a **Reason** column showing the reason for cancelled rows
  (`—` otherwise).

## Part B — Pagination (list tables)

### B1. Approach
Server-side via Supabase `.range(from, to)` + `{ count: 'exact' }`. **Page size 20.**

To avoid breaking selectors/context that need the FULL set, the existing "fetch all"
functions/hooks stay; pagination adds **paged variants** used only by the management list
pages:
- Keep (fetch-all, used by selects/context/filters): `listBranches`/`useBranches`
  (navbar branch context + dialog branch selects), `listPackages`/`usePackages` (New Wash
  package select), `listEmployees`/`useEmployees` (assign picker + Washes employee filter).
- Add (paged, used by the list page only): `listBranchesPaged`, `listPackagesPaged`,
  `listEmployeesPaged`, `listCustomersPaged`, `listBusinessesPaged`, each returning
  `{ rows, total }`; and convert `listWashes` to return `{ rows, total }` (replacing its
  200-cap). Add matching hooks `use<Entity>Paged(page)` / `useWashes(filters, page)` whose
  queryKey includes the page (and filters) so mutations still refresh the current page.

`listCustomers`/`useCustomers` and `listBusinesses`/`useBusinesses` (fetch-all) have no other
consumer, so they become the paged variants directly (or the old ones are removed if unused).

### B2. Shared UI
- `src/lib/pagination.ts` (pure, tested): `pageToRange(page, pageSize): { from, to }`
  (`from = page*pageSize`, `to = from + pageSize - 1`); `pagerInfo(page, pageSize, total):
  { fromItem, toItem, total, hasPrev, hasNext, pageCount }`.
- `src/components/ui/pager.tsx`: a `<Pager page total pageSize onPageChange>` — Prev / Next
  buttons + "X–Y of N" (localized), disabled at the ends. RTL-correct, responsive.

### B3. Pages
Each list page (Businesses, Branches, Packages, Staff, Customers, Washes) holds `page` state
(0-based), uses the paged hook, renders the table for `rows`, and a `<Pager>` below.
- **Clamp on delete:** if the current page becomes empty after a delete and `page > 0`,
  step back a page (so you're not stranded on an empty page).
- Changing a filter (Washes) resets to page 0.

### B4. Not paginated
- The **Queue** board (live, already bounded to today/active — paging doesn't fit).
- The per-customer vehicle list in `CustomerDetailDialog` (scoped to one customer, small).

## Cross-cutting
i18n keys for the cancel dialog (reason label/placeholder, the 4 presets, validation),
the Washes `Reason` column, and the pager ("X–Y of N", Prev, Next) — both locales,
parity-tested, real Arabic. RTL-correct logical utilities; responsive (pager wraps; presets
wrap). Reuses Button/Badge/Table/Select/Dialog patterns + the custom modal conventions.

## Error handling
Cancel: required-reason validation inline; mutation errors mapped to the existing generic
message; the modal stays open on error. Paged queries: existing loading/error/empty states
(from the hooks); empty page handled by the clamp.

## Testing
- **Vitest:** `pageToRange` (page 0/1/n → correct from/to), `pagerInfo` (item range, has
  prev/next at boundaries, page count, empty total), cancel-reason validation
  (`validateCancel(reason)` → required).
- **pgTAP** (`0016_cancel_reason_test.sql`): the new columns exist; updating a wash to
  cancelled with a reason + cancelled_at persists; tenant isolation already covered.
- **Browser:** seed >20 customers → Pager Prev/Next works and counts are right; delete the
  last item on page 2 → clamps to page 1; cancel a wash with a required reason → it appears
  in the Washes history with the reason; presets fill the field.
- Full local suite (pgTAP + Vitest + build) green; **gate the push on green**.

## Out of scope (deferred)
Infinite scroll, server-side column sorting, per-customer vehicle paging, configurable page
size, editing/clearing a cancellation reason after the fact.

## Docs
Update `docs/BUSINESS_LOGIC.md`: `wash_orders` gains `cancellation_reason` + `cancelled_at`;
cancel flow now captures a required reason (shown in Washes); list tables are paginated
(server-side, page size 20) except the live Queue.
