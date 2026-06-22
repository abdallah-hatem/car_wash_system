# Wash Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only wash detail page at `/app/washes/:id` that shows all information about a single wash order, reachable by clicking the plate cell in the Washes history list.

**Architecture:** Add `getWash(id)` to `washes.ts` (new Supabase SELECT with full embeds including customer phone and payment method/paid_at). Add `useWash(id)` hook to `queries.ts`. Create `WashDetailPage.tsx` mirroring the `CustomerDetailPage` pattern (back link, header with plate + status badge, five detail sections, loading/error/not-found states). Register the route and make the plate cell in `WashesPage.tsx` a clickable link.

**Tech Stack:** React, TypeScript, react-router-dom `useParams`/`Link`/`useNavigate`, TanStack Query, Supabase JS client, Tailwind (logical utilities), shadcn/ui (`Badge`, `Table`), existing helpers (`statusBadgeClass`, `isPaid`/`amountPaid`/`remaining`, `formatDuration`/`diffMinutes`), react-i18next, existing skeleton components.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/lib/tenant/washes.ts` | Modify | Add `WashDetail` type + `getWash(id)` function |
| `src/lib/tenant/queries.ts` | Modify | Add `useWash(id)` hook |
| `src/pages/tenant/WashDetailPage.tsx` | **Create** | New detail page component |
| `src/routes.tsx` | Modify | Register `/app/washes/:id` route |
| `src/pages/tenant/WashesPage.tsx` | Modify | Make plate cell a clickable link |
| `src/i18n/locales/en.json` | Modify | Add new i18n keys under `washes.*` |
| `src/i18n/locales/ar.json` | Modify | Add same keys in Arabic (parity required) |
| `docs/BUSINESS_LOGIC.md` | Modify | One-line note + bump Last updated |

---

## Task 1: Add `getWash` to `src/lib/tenant/washes.ts`

**Files:**
- Modify: `src/lib/tenant/washes.ts`

- [ ] **Step 1.1: Read the current file to understand existing types**

  The existing `WashRow` type (lines 21–35) has only `{ amount: number }` in payments
  and no customer phone. `getWash` needs richer embeds. Define a superset type `WashDetail`.

- [ ] **Step 1.2: Add `WashDetail` type and `getWash` function**

  Append to the bottom of `src/lib/tenant/washes.ts`:

  ```typescript
  // ─── Single wash detail ───────────────────────────────────────────────────────

  export interface WashPayment {
    amount: number
    method: "cash" | "card" | "transfer"
    paid_at: string
  }

  export interface WashDetail {
    id: string
    status: WashStatus
    price: number
    notes: string | null
    created_at: string
    started_at: string | null
    completed_at: string | null
    cancelled_at: string | null
    cancellation_reason: string | null
    // vehicle
    plate_number: string | null
    vehicle_make: string | null
    vehicle_model: string | null
    vehicle_color: string | null
    // customer
    customer_id: string | null
    customer_name: string | null
    customer_phone: string | null
    // package / employee / branch
    package_name: string | null
    employee_name: string | null
    branch_name: string | null
    // payments (full detail)
    payments: WashPayment[]
  }

  const SELECT_DETAIL =
    "id,status,price,notes,created_at,started_at,completed_at,cancelled_at,cancellation_reason," +
    "customer_id," +
    "vehicles(plate_number,make,model,color)," +
    "customers(name,phone)," +
    "packages(name)," +
    "employees(name)," +
    "branches(name)," +
    "payments(amount,method,paid_at)"

  export async function getWash(id: string): Promise<WashDetail | null> {
    const { data, error } = await supabase
      .from("wash_orders")
      .select(SELECT_DETAIL)
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const o = data as unknown as {
      id: string
      status: WashStatus
      price: number
      notes: string | null
      created_at: string
      started_at: string | null
      completed_at: string | null
      cancelled_at: string | null
      cancellation_reason: string | null
      customer_id: string | null
      vehicles: { plate_number: string; make: string | null; model: string | null; color: string | null } | null
      customers: { name: string; phone: string | null } | null
      packages: { name: string } | null
      employees: { name: string } | null
      branches: { name: string } | null
      payments: { amount: number; method: "cash" | "card" | "transfer"; paid_at: string }[]
    }
    return {
      id: o.id,
      status: o.status,
      price: Number(o.price),
      notes: o.notes,
      created_at: o.created_at,
      started_at: o.started_at,
      completed_at: o.completed_at,
      cancelled_at: o.cancelled_at,
      cancellation_reason: o.cancellation_reason,
      customer_id: o.customer_id,
      plate_number: o.vehicles?.plate_number ?? null,
      vehicle_make: o.vehicles?.make ?? null,
      vehicle_model: o.vehicles?.model ?? null,
      vehicle_color: o.vehicles?.color ?? null,
      customer_name: o.customers?.name ?? null,
      customer_phone: o.customers?.phone ?? null,
      package_name: o.packages?.name ?? null,
      employee_name: o.employees?.name ?? null,
      branch_name: o.branches?.name ?? null,
      payments: (o.payments ?? []).map((p) => ({
        amount: Number(p.amount),
        method: p.method,
        paid_at: p.paid_at,
      })),
    }
  }
  ```

- [ ] **Step 1.3: Verify TypeScript compiles**

  Run: `npm run build 2>&1 | head -30`

  Expected: no errors in `washes.ts`.

---

## Task 2: Add `useWash` hook to `src/lib/tenant/queries.ts`

**Files:**
- Modify: `src/lib/tenant/queries.ts`

- [ ] **Step 2.1: Add the import and hook**

  At the top of `queries.ts`, the existing import line is:
  ```typescript
  import { listWashes, listCustomerWashes, type WashFilters } from "./washes"
  ```
  Change it to:
  ```typescript
  import { listWashes, listCustomerWashes, getWash, type WashFilters } from "./washes"
  ```

  Then after the `useCustomerWashes` function (around line 105), add:

  ```typescript
  export function useWash(id: string | null) {
    return useQuery({
      queryKey: ["washes", "detail", id] as const,
      queryFn: () => getWash(id!),
      enabled: !!id,
    })
  }
  ```

  The `["washes", "detail", id]` key is nested under `["washes"]`, so any wash or payment
  mutation that calls `invalidateQueries({ queryKey: keys.washes })` will cascade and
  refresh the detail page automatically.

- [ ] **Step 2.2: Verify compilation**

  Run: `npm run build 2>&1 | head -30`

  Expected: no errors.

---

## Task 3: Add i18n keys to `en.json` and `ar.json`

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/ar.json`

The locale parity test (`src/i18n/locales.test.ts`) will fail if en and ar key sets differ.
Both files must get exactly the same keys simultaneously.

- [ ] **Step 3.1: Identify existing `washes` keys to avoid duplication**

  Current `washes` keys in en.json (lines 226–255):
  - `title`, `dateRange`, `from`, `to`, `status`, `employee`, `branch`,
    `allStatuses`, `allEmployees`, `allBranches`,
    `colQueued`, `colPlate`, `colCustomer`, `colPackage`, `colBranch`,
    `colStatus`, `colEmployee`, `colWait`, `colService`, `colPrice`, `colPaid`, `colReason`,
    `platePlaceholder`, `empty`, `capped`, `errors.generic`

  We need to add under `washes`:
  - `back` — "Back to washes"
  - `notFound` — "Wash not found"
  - `sectionCustomer` — "Customer"
  - `sectionVehicle` — "Vehicle"
  - `sectionService` — "Service"
  - `sectionTimeline` — "Timeline"
  - `sectionPayments` — "Payments"
  - `queued` — "Queued"
  - `started` — "Started"
  - `completed` — "Completed"
  - `cancelledAt` — "Cancelled at"
  - `waitDuration` — "Wait"
  - `serviceDuration` — "Service duration"
  - `noPayments` — "No payments recorded"
  - `totalPaid` — "Total paid"

  We can reuse from other namespaces (do NOT add these, they already exist):
  - `status.*` — status labels (existing)
  - `payment.cash/card/transfer` — method labels (existing)
  - `wash.paid/unpaid/remaining` — paid/unpaid labels (existing)
  - `customers.phone` — phone (existing)
  - `vehicles.make/model/color` — vehicle fields (existing)
  - `wash.price` — price (existing)
  - `wash.notes` — notes (existing)
  - `wash.assignedTo` — "Assigned to" (existing)
  - `washes.colBranch` — "Branch" (existing, reuse)

- [ ] **Step 3.2: Add keys to `en.json`**

  In `src/i18n/locales/en.json`, inside the `"washes"` object, after `"errors": { ... }` and
  before the closing `}` of the `washes` block, add:

  ```json
  "back": "Back to washes",
  "notFound": "Wash not found",
  "sectionCustomer": "Customer",
  "sectionVehicle": "Vehicle",
  "sectionService": "Service",
  "sectionTimeline": "Timeline",
  "sectionPayments": "Payments",
  "queued": "Queued",
  "started": "Started",
  "completed": "Completed",
  "cancelledAt": "Cancelled at",
  "waitDuration": "Wait",
  "serviceDuration": "Service duration",
  "noPayments": "No payments recorded",
  "totalPaid": "Total paid"
  ```

- [ ] **Step 3.3: Add same keys to `ar.json`**

  In `src/i18n/locales/ar.json`, inside the `"washes"` object, in the same position after `"errors"`, add:

  ```json
  "back": "العودة إلى سجل الغسيل",
  "notFound": "لم يتم العثور على الغسيل",
  "sectionCustomer": "العميل",
  "sectionVehicle": "المركبة",
  "sectionService": "الخدمة",
  "sectionTimeline": "التسلسل الزمني",
  "sectionPayments": "المدفوعات",
  "queued": "وقت الإضافة",
  "started": "وقت البدء",
  "completed": "وقت الاكتمال",
  "cancelledAt": "وقت الإلغاء",
  "waitDuration": "وقت الانتظار",
  "serviceDuration": "مدة الخدمة",
  "noPayments": "لا توجد مدفوعات مسجّلة",
  "totalPaid": "إجمالي المدفوع"
  ```

- [ ] **Step 3.4: Run parity test**

  Run: `npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|parity)"`

  Expected: `locale parity > en and ar have identical key sets` → PASS.

---

## Task 4: Create `src/pages/tenant/WashDetailPage.tsx`

**Files:**
- Create: `src/pages/tenant/WashDetailPage.tsx`

This is the main deliverable. Follow the `CustomerDetailPage` pattern exactly: `useParams`,
back link, loading/error/not-found states, then sections in cards.

- [ ] **Step 4.1: Create the file**

  Create `src/pages/tenant/WashDetailPage.tsx` with the following content:

  ```typescript
  import { useParams, Link } from "react-router-dom"
  import { useTranslation } from "react-i18next"
  import { ChevronLeft } from "lucide-react"
  import { Badge } from "@/components/ui/badge"
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
  import { PageSkeleton } from "@/components/ui/skeletons"
  import { useWash } from "@/lib/tenant/queries"
  import { statusBadgeClass } from "@/lib/tenant/status-style"
  import { isPaid, amountPaid, remaining } from "@/lib/tenant/operations"
  import { diffMinutes, formatDuration } from "@/lib/tenant/duration"

  function BackLink() {
    const { t } = useTranslation()
    return (
      <Link
        to="/app/washes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit min-h-[44px]"
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        {t("washes.back")}
      </Link>
    )
  }

  function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <section className="rounded-lg border bg-card p-4 flex flex-col gap-3">
        <h2 className="font-semibold text-base">{title}</h2>
        {children}
      </section>
    )
  }

  function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground shrink-0 min-w-[120px]">{label}</span>
        <span className="font-medium break-words">{value ?? "—"}</span>
      </div>
    )
  }

  export default function WashDetailPage() {
    const { t, i18n } = useTranslation()
    const { id = null } = useParams()

    const { data: wash, isLoading, isError } = useWash(id)

    if (isLoading) {
      return (
        <div className="flex flex-col gap-6">
          <BackLink />
          <PageSkeleton />
        </div>
      )
    }

    if (isError) {
      return (
        <div className="flex flex-col gap-6">
          <BackLink />
          <p role="alert" className="text-sm text-destructive">
            {t("washes.errors.generic")}
          </p>
        </div>
      )
    }

    if (!wash) {
      return (
        <div className="flex flex-col gap-6">
          <BackLink />
          <p className="text-sm text-muted-foreground">{t("washes.notFound")}</p>
        </div>
      )
    }

    const paid = isPaid(wash.price, wash.payments)
    const totalPaid = amountPaid(wash.payments)
    const rem = remaining(wash.price, wash.payments)
    const wait = formatDuration(diffMinutes(wash.created_at, wash.started_at))
    const serviceDur = formatDuration(diffMinutes(wash.started_at, wash.completed_at))

    function fmtDate(iso: string | null): string {
      if (!iso) return "—"
      return new Date(iso).toLocaleString(i18n.language)
    }

    return (
      <div className="flex flex-col gap-6">
        <BackLink />

        {/* Header: plate + status badge */}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold break-words">
            {wash.plate_number ?? "—"}
          </h1>
          <Badge variant="outline" className={statusBadgeClass(wash.status)}>
            {t(`status.${wash.status}`)}
          </Badge>
        </div>

        {/* Customer section */}
        <SectionCard title={t("washes.sectionCustomer")}>
          <DetailRow
            label={t("customers.name")}
            value={
              wash.customer_id && wash.customer_name ? (
                <Link
                  to={`/app/customers/${wash.customer_id}`}
                  className="hover:underline text-foreground"
                >
                  {wash.customer_name}
                </Link>
              ) : (
                wash.customer_name ?? "—"
              )
            }
          />
          {wash.customer_phone && (
            <DetailRow label={t("customers.phone")} value={wash.customer_phone} />
          )}
        </SectionCard>

        {/* Vehicle section */}
        <SectionCard title={t("washes.sectionVehicle")}>
          <DetailRow label={t("wash.plate")} value={wash.plate_number} />
          <DetailRow label={t("vehicles.make")} value={wash.vehicle_make} />
          <DetailRow label={t("vehicles.model")} value={wash.vehicle_model} />
          <DetailRow label={t("vehicles.color")} value={wash.vehicle_color} />
        </SectionCard>

        {/* Service section */}
        <SectionCard title={t("washes.sectionService")}>
          <DetailRow label={t("wash.package")} value={wash.package_name} />
          <DetailRow label={t("wash.price")} value={wash.price} />
          <DetailRow label={t("wash.assignedTo")} value={wash.employee_name} />
          <DetailRow label={t("washes.colBranch")} value={wash.branch_name} />
          {wash.notes && (
            <DetailRow label={t("wash.notes")} value={wash.notes} />
          )}
        </SectionCard>

        {/* Timeline section */}
        <SectionCard title={t("washes.sectionTimeline")}>
          <DetailRow label={t("washes.queued")} value={fmtDate(wash.created_at)} />
          <DetailRow label={t("washes.started")} value={fmtDate(wash.started_at)} />
          {wash.status === "cancelled" ? (
            <>
              <DetailRow label={t("washes.cancelledAt")} value={fmtDate(wash.cancelled_at)} />
              {wash.cancellation_reason && (
                <DetailRow label={t("washes.colReason")} value={wash.cancellation_reason} />
              )}
            </>
          ) : (
            <DetailRow label={t("washes.completed")} value={fmtDate(wash.completed_at)} />
          )}
          <DetailRow label={t("washes.waitDuration")} value={wait} />
          <DetailRow label={t("washes.serviceDuration")} value={serviceDur} />
        </SectionCard>

        {/* Payments section */}
        <SectionCard title={t("washes.sectionPayments")}>
          {wash.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("washes.noPayments")}</p>
          ) : (
            <div className="w-full min-w-0 overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">{t("payment.amount")}</TableHead>
                    <TableHead className="text-start">{t("payment.method")}</TableHead>
                    <TableHead className="text-start">{t("washes.queued")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wash.payments.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.amount}</TableCell>
                      <TableCell>{t(`payment.${p.method}`)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(p.paid_at).toLocaleString(i18n.language)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Summary row */}
          <div className="flex flex-wrap gap-4 text-sm pt-2 border-t">
            <span className="text-muted-foreground">
              {t("washes.totalPaid")}:{" "}
              <span className="font-medium text-foreground">{totalPaid}</span>
            </span>
            {!paid && (
              <span className="text-muted-foreground">
                {t("wash.remaining")}:{" "}
                <span className="font-medium text-destructive">{rem}</span>
              </span>
            )}
            <Badge variant={paid ? "default" : "destructive"}>
              {paid ? t("wash.paid") : t("wash.unpaid")}
            </Badge>
          </div>
        </SectionCard>
      </div>
    )
  }
  ```

  Note: the payments table header reuses `t("washes.queued")` for the "date" column — this is
  intentional since there's no separate `payment.date` key and "queued" / "paid at" share the
  same meaning in context. If that feels wrong, use a new key `washes.colPaidAt` instead and
  add it to both locales. The simpler option (reuse `payment.amount`, `payment.method`, and
  the date as `washes.colQueued` label renamed "Queued") keeps key count minimal — but since
  we already added the keys in Task 3, use `t("washes.queued")` directly.

  **Correction — use a proper column header.** In the payments table the third column
  represents the payment timestamp (`paid_at`), not the wash queue time. Use `t("washes.queued")`
  only makes sense for the Timeline. For the payments table, the header should be the date/time.
  Add key `washes.colPaidAt` in both locales:
  - en: `"colPaidAt": "Paid at"`
  - ar: `"colPaidAt": "وقت الدفع"`

  Update `en.json` and `ar.json` to include `"colPaidAt"` under `washes` and use
  `t("washes.colPaidAt")` in the payments table header.

- [ ] **Step 4.2: Add the missing `colPaidAt` key before creating the page**

  In `src/i18n/locales/en.json`, inside `"washes"`, add:
  ```json
  "colPaidAt": "Paid at"
  ```

  In `src/i18n/locales/ar.json`, inside `"washes"`, add:
  ```json
  "colPaidAt": "وقت الدفع"
  ```

  Then in the payments table header in `WashDetailPage.tsx`, replace the third `<TableHead>` with:
  ```tsx
  <TableHead className="text-start">{t("washes.colPaidAt")}</TableHead>
  ```

- [ ] **Step 4.3: Run parity test again to confirm**

  Run: `npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|parity)"`

  Expected: PASS.

- [ ] **Step 4.4: Verify TypeScript compilation of the new page**

  Run: `npm run build 2>&1 | head -40`

  Expected: no errors.

---

## Task 5: Register the route in `src/routes.tsx`

**Files:**
- Modify: `src/routes.tsx`

- [ ] **Step 5.1: Add the import**

  In `src/routes.tsx`, after the existing `import WashesPage` line:
  ```typescript
  import WashDetailPage from "./pages/tenant/WashDetailPage"
  ```

- [ ] **Step 5.2: Add the route**

  In `src/routes.tsx`, after the existing `{ path: "washes", element: <WashesPage /> }` entry,
  add:
  ```typescript
  {
    path: "washes/:id",
    element: <WashDetailPage />,
  },
  ```

  The full `/app/washes/:id` path resolves because this route is nested inside the
  `/app` + `RequireTenant` + `TenantLayout` path, identical to how `customers/:id` works.

- [ ] **Step 5.3: Verify build**

  Run: `npm run build 2>&1 | head -30`

  Expected: no errors.

---

## Task 6: Make plate cell in `WashesPage.tsx` a clickable link

**Files:**
- Modify: `src/pages/tenant/WashesPage.tsx`

- [ ] **Step 6.1: Add `useNavigate` import**

  In `src/pages/tenant/WashesPage.tsx`, the import from `react-router-dom` is currently
  not present (the page doesn't navigate anywhere). Add it at the top with the other imports:

  ```typescript
  import { useNavigate } from "react-router-dom"
  ```

- [ ] **Step 6.2: Instantiate `useNavigate` inside `WashesPage`**

  Inside the `WashesPage` component body, after the existing `useTranslation` and `useBranch`
  hooks, add:

  ```typescript
  const navigate = useNavigate()
  ```

- [ ] **Step 6.3: Replace the plate `<TableCell>` with a clickable version**

  Find the existing plate cell (around line 216):
  ```tsx
  <TableCell>{row.plate_number ?? "—"}</TableCell>
  ```

  Replace with:
  ```tsx
  <TableCell>
    <button
      type="button"
      onClick={() => navigate(`/app/washes/${row.id}`)}
      className="hover:underline text-start font-medium min-h-[44px] flex items-center"
    >
      {row.plate_number ?? "—"}
    </button>
  </TableCell>
  ```

  This matches the customer-name clickable pattern from `CustomersPage`. Using a `<button>`
  (not `<a>`) keeps the table semantics clean and avoids nested interactive element issues;
  it navigates programmatically. `text-start` ensures RTL alignment, `min-h-[44px]` ensures
  the tap target is large enough, `font-medium` matches the existing plate styling.

- [ ] **Step 6.4: Verify build and test suite**

  Run: `npm run build 2>&1 | head -30`
  Then: `npm test 2>&1 | tail -20`

  Expected: build clean, all tests pass (locale parity + any other unit tests).

---

## Task 7: Update `docs/BUSINESS_LOGIC.md`

**Files:**
- Modify: `docs/BUSINESS_LOGIC.md`

- [ ] **Step 7.1: Add note to section 6.5 (Customers & Vehicles) or as new 6.x**

  Add a one-line note in section 6.5, after the wash history paragraph, or add as new
  section 6.11. The simplest approach (matching instruction: "add a one-line note") is to
  add after the wash-history bullet in 6.5, but since this is a Washes feature, place it
  under the Washes history mention in 8 (Build status). Find the `washes-history` plan
  mention and add:

  In the "Build status" section 8, after the `washes-history` item, add:
  ```
  - **Wash detail page (`/app/washes/:id`):** DONE. Read-only detail page for a single wash order — plate + status header, customer (name + phone, name links to `/app/customers/:id`), vehicle, service (package / price / employee / branch), timeline (queued / started / completed or cancelled-at + cancellation reason, wait and service durations), payments breakdown (table of amount + method + paid_at, total paid, remaining, paid/unpaid badge). Reachable by clicking the plate cell in the Washes history list.
  ```

- [ ] **Step 7.2: Bump the Last updated line**

  Update the `Last updated:` line at the top of `docs/BUSINESS_LOGIC.md`:
  ```
  Last updated: 2026-06-15 (wash detail page at /app/washes/:id, read-only; plate cell in Washes list navigates to it).
  ```

---

## Task 8: Full verification

- [ ] **Step 8.1: Run the full test suite**

  Run: `npm test 2>&1`

  Expected: all tests pass, including `locale parity > en and ar have identical key sets`.
  Any failure must be fixed before proceeding.

- [ ] **Step 8.2: Run the production build**

  Run: `npm run build 2>&1`

  Expected: exits 0, no TypeScript errors, no Vite errors.

  If any errors appear (e.g. unused import, type mismatch), fix them in the relevant file and
  re-run the build.

---

## Self-Review Checklist

After writing, these are verified against the spec:

- [x] `getWash(id)` returns `null` via `.maybeSingle()` when not found — ✓
- [x] `WashDetail` includes vehicle make/model/color, customer phone, payments with method + paid_at — ✓
- [x] `useWash` key is `["washes","detail", id]`, `enabled: !!id` — ✓
- [x] Back link to `/app/washes`, chevron with `rtl:rotate-180` — ✓
- [x] Header: plate h1 + status badge using `statusBadgeClass` + `status.*` — ✓
- [x] Customer section: name (link to `/app/customers/:customerId` when present) + phone — ✓
- [x] Vehicle section: plate, make, model, color — ✓
- [x] Service section: package, price, employee, branch, notes — ✓
- [x] Timeline: queued/started/completed or cancelled-at + reason; wait + service durations — ✓
- [x] Payments: table with amount/method/paid_at, total paid, remaining, paid/unpaid badge — ✓
- [x] Empty payments state — ✓
- [x] Loading: `PageSkeleton` — ✓
- [x] Error: `washes.errors.generic` — ✓
- [x] Not-found: `washes.notFound` + back link — ✓
- [x] Route registered as `washes/:id` nested under tenant layout — ✓
- [x] Plate cell in WashesPage is a clickable button → `navigate(/app/washes/${row.id})` — ✓
- [x] All strings from i18n keys, no hardcoded user-facing text — ✓
- [x] RTL logical utilities only (no `left-/right-/pl-/pr-`) — ✓
- [x] `colPaidAt` key added to both en + ar to avoid parity failure — ✓
- [x] `npm test` + `npm run build` verification steps included — ✓
- [x] Read-only page (no start/complete/cancel/payment actions) — ✓
- [x] Doesn't regress WashesPage (only adds navigate to plate cell) — ✓
- [x] `docs/BUSINESS_LOGIC.md` updated — ✓
