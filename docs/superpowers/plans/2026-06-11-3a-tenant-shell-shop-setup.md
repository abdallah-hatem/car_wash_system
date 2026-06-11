# Plan 3A — Tenant App Shell + Shop Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A left-sidebar tenant app shell at `/app` plus full CRUD for branches, packages, and employees (the setup data wash orders depend on), i18n/RTL/responsive, tenant-isolated.

**Architecture:** A `TenantLayout` (sidebar + top bar + Outlet) wraps the `/app` subtree under `RequireTenant`. Per-entity data modules call the supabase client (RLS auto-scopes to the tenant; inserts set `tenant_id` from the JWT claim). Pages follow the existing admin Table+Dialog pattern.

**Tech Stack:** React + Vite + TS, Tailwind v3 + shadcn (v2), react-i18next, supabase-js, Vitest, pgTAP.

**Existing context & patterns to reuse:**
- `src/routes.tsx`: `RequireAuth` → (AppHeader layout → `RequireAdmin`/`RequireTenant`). `/app` currently renders a placeholder inside `AppHeader`. `/admin` renders `BusinessesPage`.
- `src/components/AppHeader.tsx`: top bar with app name + `LanguageSwitcher` + sign-out (`supabase.auth.signOut()` then navigate `/login`).
- `src/components/LanguageSwitcher.tsx` (reuse as-is).
- Admin pattern: `src/pages/admin/BusinessesPage.tsx` (Table, loading/empty/error states, dialog wiring), `src/components/admin/CreateBusinessDialog.tsx` (form→submit, validate, error mapping), `src/lib/admin.ts` (data helpers + pure `validateCreate`). Mirror these.
- `useAuth()` (`src/auth/AuthProvider.tsx`) exposes `claims.tenantId`.
- shadcn primitives present: button, input, label, card, table, dialog, badge. (`select` may need adding.)
- i18n: `src/i18n/locales/{en,ar}.json`, parity test `src/i18n/locales.test.ts`. Standing UI rule in CLAUDE.md.
- Types: `src/lib/database.types.ts` (regenerate-free; `tenants`,`branches`,`packages`,`employees` rows available).

**File structure:**
- Create: `src/components/tenant/TenantLayout.tsx`, `src/components/tenant/SidebarNav.tsx`
- Create: `src/lib/tenant/branches.ts`, `packages.ts`, `employees.ts`, `validators.ts`, `validators.test.ts`
- Create: `src/pages/tenant/BranchesPage.tsx`, `PackagesPage.tsx`, `StaffPage.tsx`
- Create: `src/components/tenant/BranchDialog.tsx`, `PackageDialog.tsx`, `EmployeeDialog.tsx`
- Modify: `src/routes.tsx`, `src/i18n/locales/{en,ar}.json`
- Create: `supabase/tests/0010_tenant_setup_rls_test.sql`
- Modify: `docs/BUSINESS_LOGIC.md`

---

## Task 1: Validators (TDD) + i18n keys

**Files:** Create `src/lib/tenant/validators.ts`, `src/lib/tenant/validators.test.ts`. Modify `src/i18n/locales/{en,ar}.json`.

- [ ] **Step 1: Write failing test** `src/lib/tenant/validators.test.ts`
```ts
import { describe, it, expect } from "vitest"
import { validateBranch, validatePackage, validateEmployee } from "./validators"

describe("validateBranch", () => {
  it("requires a name", () => {
    expect(validateBranch({ name: "" })).toBe("name_required")
    expect(validateBranch({ name: "Main" })).toBeNull()
  })
})
describe("validatePackage", () => {
  it("requires name and positive price", () => {
    expect(validatePackage({ name: "", price: 10 })).toBe("name_required")
    expect(validatePackage({ name: "Basic", price: 0 })).toBe("price_invalid")
    expect(validatePackage({ name: "Basic", price: -5 })).toBe("price_invalid")
    expect(validatePackage({ name: "Basic", price: 25 })).toBeNull()
  })
})
describe("validateEmployee", () => {
  it("requires a name", () => {
    expect(validateEmployee({ name: "" })).toBe("name_required")
    expect(validateEmployee({ name: "Sam" })).toBeNull()
  })
})
```

- [ ] **Step 2: Run `npm test` — confirm FAIL** (module missing).

- [ ] **Step 3: Implement** `src/lib/tenant/validators.ts`
```ts
export function validateBranch(input: { name?: string }): string | null {
  if (!input.name?.trim()) return "name_required"
  return null
}
export function validatePackage(input: { name?: string; price?: number }): string | null {
  if (!input.name?.trim()) return "name_required"
  if (input.price == null || Number.isNaN(input.price) || input.price <= 0) return "price_invalid"
  return null
}
export function validateEmployee(input: { name?: string }): string | null {
  if (!input.name?.trim()) return "name_required"
  return null
}
```

- [ ] **Step 4: Run `npm test` — PASS.**

- [ ] **Step 5: Add i18n keys** to BOTH `en.json` and `ar.json` (identical shape, real Arabic). Namespaces:
  - `nav`: `branches`, `packages`, `staff`, `queue`, `dashboard`, `comingSoon`, `menu` (hamburger aria-label).
  - `common` additions: `create`, `edit`, `delete`, `save`, `cancel`, `activate`, `deactivate`, `active`, `inactive`, `confirmDelete`, `loading`, `empty`, `retry`, `actions`, `optional`.
  - `branches`: `title`, `newBranch`, `name`, `address`, `created`, `errors.in_use`, `errors.generic`, `empty`.
  - `packages`: `title`, `newPackage`, `name`, `price`, `duration`, `minutes`, `status`, `errors.generic`, `empty`.
  - `staff`: `title`, `newEmployee`, `name`, `phone`, `branch`, `noBranch`, `status`, `errors.generic`, `empty`.
  - `validation`: `name_required`, `price_invalid`.
  Run `npm test` → locale parity test passes.

- [ ] **Step 6: Commit**
```bash
git add src/lib/tenant/validators.ts src/lib/tenant/validators.test.ts src/i18n/locales
git commit -m "feat(tenant): setup validators + i18n keys for shop setup"
```

---

## Task 2: Tenant app shell (TenantLayout + routing)

**Files:** Create `src/components/tenant/TenantLayout.tsx`, `src/components/tenant/SidebarNav.tsx`. Modify `src/routes.tsx`.

- [ ] **Step 1: SidebarNav** `src/components/tenant/SidebarNav.tsx` — nav links + disabled coming-soon items. Uses `NavLink` for active styling.
```tsx
import { NavLink } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

const linkBase = "block rounded-md px-3 py-2 text-sm font-medium min-h-[44px] flex items-center"

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const items = [
    { to: "/app/branches", label: t("nav.branches") },
    { to: "/app/packages", label: t("nav.packages") },
    { to: "/app/staff", label: t("nav.staff") },
  ]
  return (
    <nav className="space-y-1">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} onClick={onNavigate}
          className={({ isActive }) => cn(linkBase, isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
          {it.label}
        </NavLink>
      ))}
      <div className="pt-2 mt-2 border-t space-y-1">
        {[t("nav.queue"), t("nav.dashboard")].map((label) => (
          <span key={label} className={cn(linkBase, "cursor-not-allowed text-muted-foreground")}>
            {label} <span className="ms-2 text-xs">({t("nav.comingSoon")})</span>
          </span>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: TenantLayout** `src/components/tenant/TenantLayout.tsx` — top bar (app name, LanguageSwitcher, sign-out) + persistent sidebar on `lg`, drawer on mobile, + `<Outlet/>`. Use a simple `useState` for the mobile drawer (no new dep).
```tsx
import { useState } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { SidebarNav } from "./SidebarNav"
import { Menu } from "lucide-react"

export function TenantLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  async function signOut() { await supabase.auth.signOut(); navigate("/login") }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="lg:hidden min-h-[44px]"
            aria-label={t("nav.menu")} onClick={() => setDrawerOpen((v) => !v)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold">{t("common.appName")}</span>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" onClick={() => void signOut()}>
            {t("common.signOut")}
          </Button>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block border-e p-3">
          <SidebarNav />
        </aside>

        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <div className="absolute inset-y-0 start-0 w-64 bg-background p-3 shadow-lg">
              <SidebarNav onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```
(`common.appName` and `common.signOut` already exist in the locales; `nav.menu` added in Task 1. `lucide-react` is already a dependency.)

- [ ] **Step 3: Wire routing** `src/routes.tsx` — keep `/admin` under the existing AppHeader; render the `/app` subtree under `TenantLayout`. Structure under `RequireAuth`:
  - `element: <RequireTenant/>` → `element: <TenantLayout/>` → children: `{ index: <Navigate to="/app/branches" replace/> }` (NOTE: index redirect — implement by making `/app` the layout path), `{ path: "branches", element: <BranchesPage/> }`, `{ path: "packages", element: <PackagesPage/> }`, `{ path: "staff", element: <StaffPage/> }`.
  - Replace the prior `/app` placeholder. Keep `RequireAdmin`/`/admin`/`BusinessesPage` and `/no-access` and `/`→`/app` intact.
  - Until Tasks 3-5 create the pages, temporarily import them; do this task AFTER or alongside — to keep the build green, you may stub the three page imports with minimal `export default function X(){return null}` placeholders, then flesh them out in Tasks 3-5. Prefer doing Task 2 routing wiring referencing pages created in Tasks 3-5; if building incrementally, create empty page components now and fill them in.

- [ ] **Step 4: Verify** `npm run build` passes (with stub or real pages). Manually: signing in as the demo owner reaches `/app/branches`; sidebar shows on desktop, hamburger drawer on mobile. Commit.
```bash
git add src/components/tenant/ src/routes.tsx
git commit -m "feat(tenant): app shell with sidebar + mobile drawer"
```

---

## Task 3: Branches CRUD

**Files:** Create `src/lib/tenant/branches.ts`, `src/components/tenant/BranchDialog.tsx`, `src/pages/tenant/BranchesPage.tsx`.

- [ ] **Step 1: Data module** `src/lib/tenant/branches.ts`
```ts
import { supabase } from "@/lib/supabase"

export interface Branch { id: string; name: string; address: string | null; created_at: string }

export async function listBranches(): Promise<Branch[]> {
  const { data, error } = await supabase.from("branches").select("id,name,address,created_at").order("created_at")
  if (error) throw error
  return data as Branch[]
}
export async function createBranch(tenantId: string, input: { name: string; address?: string | null }): Promise<void> {
  const { error } = await supabase.from("branches").insert({ tenant_id: tenantId, name: input.name.trim(), address: input.address?.trim() || null })
  if (error) throw error
}
export async function updateBranch(id: string, input: { name: string; address?: string | null }): Promise<void> {
  const { error } = await supabase.from("branches").update({ name: input.name.trim(), address: input.address?.trim() || null }).eq("id", id)
  if (error) throw error
}
export async function removeBranch(id: string): Promise<void> {
  const { error } = await supabase.from("branches").delete().eq("id", id)
  if (error) {
    if ((error as { code?: string }).code === "23503") throw new Error("in_use")
    throw error
  }
}
```

- [ ] **Step 2: BranchDialog** `src/components/tenant/BranchDialog.tsx` — shadcn Dialog handling BOTH create and edit. Props: `{ open, onOpenChange, branch?: Branch | null, onSaved: () => void }`. Fields name (required) + address (optional). Uses `validateBranch`; on save calls create or update (via `useAuth().claims.tenantId` for create); maps thrown `in_use`/generic to `t("branches.errors.*")`. All strings via t(); logical utilities; fits 375px.

- [ ] **Step 3: BranchesPage** `src/pages/tenant/BranchesPage.tsx` — mirrors `BusinessesPage`: load via `listBranches` (loading/empty/error states), header `t("branches.title")` + "New branch" button, responsive Table (name, address, created via `toLocaleDateString(i18n.language)`, actions: Edit, Delete-with-confirm). Edit opens BranchDialog with the row; Delete confirms then `removeBranch` (on `in_use` show `t("branches.errors.in_use")`). Refetch after save/delete. Wrap table in `overflow-x-auto`.

- [ ] **Step 4: Verify** `npm run build` + `npm test` pass. Commit.
```bash
git add src/lib/tenant/branches.ts src/components/tenant/BranchDialog.tsx src/pages/tenant/BranchesPage.tsx
git commit -m "feat(tenant): branches CRUD"
```

---

## Task 4: Packages CRUD

**Files:** Create `src/lib/tenant/packages.ts`, `src/components/tenant/PackageDialog.tsx`, `src/pages/tenant/PackagesPage.tsx`.

- [ ] **Step 1: Data module** `src/lib/tenant/packages.ts`
```ts
import { supabase } from "@/lib/supabase"

export interface Package { id: string; name: string; price: number; duration_minutes: number | null; is_active: boolean; created_at: string }

export async function listPackages(): Promise<Package[]> {
  const { data, error } = await supabase.from("packages").select("id,name,price,duration_minutes,is_active,created_at").order("created_at")
  if (error) throw error
  return (data as unknown as Package[])
}
export async function createPackage(tenantId: string, input: { name: string; price: number; duration_minutes: number | null; is_active: boolean }): Promise<void> {
  const { error } = await supabase.from("packages").insert({ tenant_id: tenantId, name: input.name.trim(), price: input.price, duration_minutes: input.duration_minutes, is_active: input.is_active })
  if (error) throw error
}
export async function updatePackage(id: string, input: { name: string; price: number; duration_minutes: number | null; is_active: boolean }): Promise<void> {
  const { error } = await supabase.from("packages").update({ name: input.name.trim(), price: input.price, duration_minutes: input.duration_minutes, is_active: input.is_active }).eq("id", id)
  if (error) throw error
}
export async function setPackageActive(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase.from("packages").update({ is_active }).eq("id", id)
  if (error) throw error
}
export async function removePackage(id: string): Promise<void> {
  const { error } = await supabase.from("packages").delete().eq("id", id)
  if (error) throw error
}
```

- [ ] **Step 2: PackageDialog** — create/edit; fields name (required), price (number, required > 0), duration_minutes (optional int), is_active (checkbox/switch). Uses `validatePackage`. Strings via t(); price input `inputMode="decimal"`.

- [ ] **Step 3: PackagesPage** — table (name, price as plain number, duration + `t("packages.minutes")`, status Badge active/inactive), New/Edit dialog, an Activate/Deactivate toggle (calls `setPackageActive`), Delete-with-confirm. Loading/empty/error; responsive.

- [ ] **Step 4: Verify** `npm run build` + `npm test` pass. Commit.
```bash
git add src/lib/tenant/packages.ts src/components/tenant/PackageDialog.tsx src/pages/tenant/PackagesPage.tsx
git commit -m "feat(tenant): packages CRUD"
```

---

## Task 5: Employees CRUD + branch select

**Files:** Create `src/lib/tenant/employees.ts`, `src/components/tenant/EmployeeDialog.tsx`, `src/pages/tenant/StaffPage.tsx`. Maybe add shadcn `select`.

- [ ] **Step 1: shadcn select** (if not present): `npx shadcn@2.10.0 add select`.

- [ ] **Step 2: Data module** `src/lib/tenant/employees.ts`
```ts
import { supabase } from "@/lib/supabase"

export interface Employee { id: string; name: string; phone: string | null; branch_id: string | null; is_active: boolean; created_at: string }

export async function listEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from("employees").select("id,name,phone,branch_id,is_active,created_at").order("created_at")
  if (error) throw error
  return data as Employee[]
}
export async function createEmployee(tenantId: string, input: { name: string; phone?: string | null; branch_id: string | null; is_active: boolean }): Promise<void> {
  const { error } = await supabase.from("employees").insert({ tenant_id: tenantId, name: input.name.trim(), phone: input.phone?.trim() || null, branch_id: input.branch_id, is_active: input.is_active })
  if (error) throw error
}
export async function updateEmployee(id: string, input: { name: string; phone?: string | null; branch_id: string | null; is_active: boolean }): Promise<void> {
  const { error } = await supabase.from("employees").update({ name: input.name.trim(), phone: input.phone?.trim() || null, branch_id: input.branch_id, is_active: input.is_active }).eq("id", id)
  if (error) throw error
}
export async function setEmployeeActive(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase.from("employees").update({ is_active }).eq("id", id)
  if (error) throw error
}
export async function removeEmployee(id: string): Promise<void> {
  const { error } = await supabase.from("employees").delete().eq("id", id)
  if (error) throw error
}
```

- [ ] **Step 3: EmployeeDialog** — create/edit; fields name (required), phone (optional), branch (a select populated from `listBranches()`, with a "no branch" option → `t("staff.noBranch")`), is_active. Uses `validateEmployee`. Strings via t().

- [ ] **Step 4: StaffPage** — table (name, phone, branch name resolved from the branch list, status Badge), New/Edit dialog, Activate/Deactivate toggle, Delete-with-confirm. To show branch names, load branches alongside employees and map `branch_id`→name. Loading/empty/error; responsive.

- [ ] **Step 5: Verify** `npm run build` + `npm test` pass. Commit.
```bash
git add src/lib/tenant/employees.ts src/components/tenant/EmployeeDialog.tsx src/pages/tenant/StaffPage.tsx src/components/ui/select.tsx 2>/dev/null; git add -A
git commit -m "feat(tenant): employees CRUD with branch select"
```

---

## Task 6: pgTAP isolation test + full verification + docs

**Files:** Create `supabase/tests/0010_tenant_setup_rls_test.sql`. Modify `docs/BUSINESS_LOGIC.md`.

- [ ] **Step 1: pgTAP test** `supabase/tests/0010_tenant_setup_rls_test.sql` — under a tenant-A `request.jwt.claims`, inserting a branch/package/employee for tenant A succeeds and is visible (count 1 each), while a tenant-B row seeded as superuser is NOT visible. Plan ~6 assertions. Pattern (valid UUIDs, `set local role authenticated`, `set_config('request.jwt.claims', ...)`):
```sql
begin;
select plan(4);
insert into public.tenants (id,name) values
  ('00000000-0000-0000-0000-00000000aa01','A'),
  ('00000000-0000-0000-0000-00000000bb02','B');
-- tenant B branch seeded as superuser (bypasses RLS)
insert into public.branches (tenant_id,name) values ('00000000-0000-0000-0000-00000000bb02','B-branch');

set local role authenticated;
select set_config('request.jwt.claims','{"tenant_id":"00000000-0000-0000-0000-00000000aa01","role":"owner"}', true);

insert into public.branches (tenant_id,name) values ('00000000-0000-0000-0000-00000000aa01','A-branch');
insert into public.packages (tenant_id,name,price) values ('00000000-0000-0000-0000-00000000aa01','Basic',25);
insert into public.employees (tenant_id,name) values ('00000000-0000-0000-0000-00000000aa01','Sam');

select is((select count(*)::int from public.branches), 1, 'tenant A sees only its own branch');
select is((select count(*)::int from public.packages), 1, 'tenant A sees its package');
select is((select count(*)::int from public.employees), 1, 'tenant A sees its employee');
select is((select name from public.branches), 'A-branch', 'the visible branch is A-branch');
select * from finish();
rollback;
```

- [ ] **Step 2: Run `npx supabase test db`** — all pass (prior + this). Paste summary.

- [ ] **Step 3: Full local suite** — `npx supabase test db`, `npm test`, `npm run build` all green. Paste output.

- [ ] **Step 4: Integration + responsive/RTL verification.** With local stack + `npm run dev`, log in as `owner@demo.test`/`password123`. For each of branches/packages/employees: create, edit, toggle active (packages/employees), delete; confirm persistence and that "Main Branch" (from onboarding) is listed. Screenshot the shell + each page at 375 + 820 in EN + AR; confirm sidebar→drawer on mobile, RTL mirrors, no overflow, Arabic in Cairo. Fix any breakage.

- [ ] **Step 5: Update `docs/BUSINESS_LOGIC.md`** — mark the tenant app shell + branches/packages/employees CRUD as BUILT (move from Planned), bump "Last updated", note 3A done and 3B next.

- [ ] **Step 6: Commit**
```bash
git add supabase/tests/0010_tenant_setup_rls_test.sql docs/BUSINESS_LOGIC.md
git commit -m "test(tenant): setup RLS isolation; docs: 3A built"
```

---

## Definition of Done
- `/app` renders the sidebar shell (drawer on mobile); signing in as a tenant lands on `/app/branches`.
- Full CRUD for branches, packages, employees works and is tenant-isolated; delete + deactivate behave per spec (branch-in-use surfaces a friendly error; packages/employees deletes are safe; active toggles work).
- All strings i18n (en/ar parity); RTL-correct; responsive at mobile + tablet in both directions (verified).
- Vitest (validators + parity + prior), pgTAP (incl. new 0010 isolation), and build all green.
- `docs/BUSINESS_LOGIC.md` updated.
