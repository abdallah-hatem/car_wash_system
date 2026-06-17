# Roles & Permissions — Branch-Scoped Sub-Users — Design Spec

> Status: **approved design, ready for implementation**. Created 2026-06-17.
> Supersedes `docs/FUTURE_FEATURES.md` §1. Built features → `docs/BUSINESS_LOGIC.md`.

## 1. Purpose

Today a tenant has exactly one human user: the **owner**, created during onboarding
(`profiles.role = 'owner'`). This feature lets an owner add **additional users** who:

- are **responsible for one or more branches** (multi-branch), and
- can **see/use only certain tabs**, at one of two levels per tab: **view** or **edit**.

The owner keeps full access to everything across all branches and is the only one who can
manage users and branches.

**Success criteria**
- An owner can create, edit, deactivate, and delete sub-users from a new **Users** screen.
- A sub-user logs in and sees **only the tabs they're granted**, **only their branches' data**,
  and can **only edit where granted `edit`** (otherwise read-only).
- The restriction is enforced **in the database (RLS)**, not just hidden in the UI — a forged
  client request cannot read other branches' data or write without `edit`.
- Multi-tenant isolation is preserved; existing owners are unaffected (full access).

## 2. Roles

| Role (`profiles.role`) | Branches | Tabs | Manages users/branches |
|---|---|---|---|
| `owner` (existing) | all | all | yes |
| `manager` (the "member"/sub-user) | the branches in `user_branches` | per `profiles.permissions` | no |

We **reuse the existing `tenant_role` enum** (`'owner' | 'manager'`) — `manager` is the
sub-user. No enum migration. "Owner" is detected by `app_role = 'owner'`; everyone else is
gated by their permission map + branch list.

## 3. Permission model

Each **gateable tab** has a level: `none` < `view` < `edit`. Stored as a JSON object on the
profile; a missing key means `none`.

```jsonc
// profiles.permissions example for a sub-user
{ "dashboard": "view", "analytics": "none", "queue": "edit",
  "washes": "view", "customers": "edit", "packages": "view", "staff": "none" }
```

| Tab key | Allowed levels | `view` shows | `edit` additionally allows |
|---|---|---|---|
| `dashboard` | none / view | branch dashboard (read-only) | — |
| `analytics` | none / view | branch analytics (read-only) | — |
| `queue` | none / view / edit | live queue (read-only) | create + start/complete/cancel washes, take payments |
| `washes` | none / view | wash history + detail (read-only) | — *(see note)* |
| `customers` | none / view / edit | customer list/search + detail | add/edit customers + vehicles |
| `packages` | none / view / edit | package list | add/edit/delete/activate packages |
| `staff` | none / view / edit | employee list | add/edit/delete employees |

**Owner-only (never assignable, not in the map):** `branches` (branch CRUD) and `users`
(this feature's management screen).

**Note on `washes`:** wash mutations (create/start/complete/cancel/pay) all hit `wash_orders`
and are driven from the **Queue**; RLS cannot distinguish "cancel" from "complete" (both are
UPDATEs). To keep enforcement honest and simple, **all `wash_orders`/payment writes are gated
by `queue = 'edit'`**, and the **Washes tab is view-only** (history). This is a small
refinement from the originally-sketched matrix (Washes had an edit level) — it removes an
unenforceable distinction. Flagged for the owner; revisit if a true "edit history" need appears.

Level helpers (frontend + DB): `owner` ⇒ always `edit` on every tab. For a `manager`, the
level is whatever the map says (default `none`).

## 4. Data model

Single new table + two columns on `profiles`. No "generalize single-row profiles" refactor —
`profiles` already keys on `user_id` (PK) with a `tenant_id` FK, so multiple users per tenant
already work.

### 4.1 `profiles` (extend) — migration

```sql
alter table public.profiles
  add column permissions jsonb   not null default '{}'::jsonb,
  add column is_active   boolean not null default true;
```
- `permissions` — the per-tab map (§3). Owners ignore it (full access).
- `is_active` — owner can deactivate a sub-user without deleting them. The auth hook withholds
  tenant claims when `is_active = false` (same shape as the suspended-tenant logic), so a
  deactivated user lands on `/no-access`.

### 4.2 `user_branches` (new join table) — migration

```sql
create table public.user_branches (
  tenant_id  uuid not null references public.tenants(id)  on delete cascade,
  user_id    uuid not null references auth.users(id)      on delete cascade,
  branch_id  uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);
create index user_branches_tenant_user_idx on public.user_branches (tenant_id, user_id);
alter table public.user_branches enable row level security;

-- tenant isolation + only owners manage assignments (writes also go through the
-- service_role edge function; this policy guards any direct client access).
create policy tenant_isolation on public.user_branches
  for all
  using  (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
```
- One row per (user, branch). Owners need **no** rows (they see all branches).
- `on delete cascade` from `branches` and `auth.users` keeps it clean (no stale IDs).
- Carries `tenant_id` (denormalized) so the standard `tenant_isolation` pattern + isolation
  test apply, per the project rule for every operational table.

### 4.3 `profiles` RLS (new)

Profiles currently has no client-facing select policy (claims come from the JWT, not a query;
`AuthProvider` does **not** read `profiles`). Add an **owner-only, tenant-scoped select** so the
Users screen can list members. All writes go through the edge function (service_role); no
client write policy.

```sql
create policy profiles_owner_select on public.profiles
  for select using (tenant_id = current_tenant_id() and current_app_role() = 'owner');
```

## 5. JWT claims & helpers

### 5.1 Auth hook (`custom_access_token_hook`) — extend (migration)

Building on `0011_auth_hook_app_role.sql`. When the profile is found **and `is_active`** and the
tenant is active, inject — in addition to today's `tenant_id` + `app_role`:

- `permissions` — `profiles.permissions` (jsonb object).
- `branch_ids` — `select coalesce(jsonb_agg(branch_id::text), '[]'::jsonb) from public.user_branches where user_id = uid` (jsonb array of branch UUID strings). Empty for owners.

Update the profile lookup to also select `permissions` and filter `p.is_active`. Grant
`supabase_auth_admin` `select` on `user_branches`.

```sql
-- inside the hook, after the existing tenant_id / app_role injection:
claims := jsonb_set(claims, '{permissions}', coalesce(prof.permissions, '{}'::jsonb));
claims := jsonb_set(claims, '{branch_ids}',
  (select coalesce(jsonb_agg(branch_id::text), '[]'::jsonb)
     from public.user_branches where user_id = uid));
```

### 5.2 SQL helper functions (migration)

```sql
-- app role from JWT (mirrors current_tenant_id())
create or replace function public.current_app_role() returns text
  language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'app_role', '') $$;

-- branch ids from JWT as uuid[]  (empty array when absent)
create or replace function public.current_branch_ids() returns uuid[]
  language sql stable as $$
  select coalesce(array(
    select (jsonb_array_elements_text(
      (current_setting('request.jwt.claims', true)::jsonb -> 'branch_ids')))::uuid
  ), '{}'::uuid[]) $$;

-- permission level for a tab from JWT (default 'none')
create or replace function public.current_permission(tab text) returns text
  language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'permissions') ->> tab,
    'none') $$;
```

Two convenience predicates used in policies:

```sql
-- can the caller see this branch's rows?
create or replace function public.can_access_branch(b uuid) returns boolean
  language sql stable as $$
  select public.current_app_role() = 'owner' or b = any(public.current_branch_ids()) $$;

-- does the caller have edit on this tab?
create or replace function public.can_edit(tab text) returns boolean
  language sql stable as $$
  select public.current_app_role() = 'owner' or public.current_permission(tab) = 'edit' $$;
```

### 5.3 Frontend claims (`src/auth/claims.ts`) — extend

```ts
export type PermLevel = "none" | "view" | "edit"
export type TabKey = "dashboard" | "analytics" | "queue" | "washes" | "customers" | "packages" | "staff"

export interface AppClaims {
  tenantId: string | null
  role: TenantRole | null            // "owner" | "manager"
  isPlatformAdmin: boolean
  branchIds: string[]                // [] for owner (means "all")
  permissions: Partial<Record<TabKey, PermLevel>>
}
```
`parseClaims` reads `branch_ids` (default `[]`) and `permissions` (default `{}`). New pure
helpers (unit-tested):
- `canView(claims, tab): boolean` — owner ⇒ true; else level is `view` or `edit`.
- `canEdit(claims, tab): boolean` — owner ⇒ true; else level is `edit`.
- `isOwner(claims): boolean` — `role === 'owner'`.
- `visibleBranchIds(claims, allBranches): Branch[]` — owner ⇒ all; else filter to `branchIds`.

## 6. Database enforcement (RLS) — the real boundary

All existing policies already scope by `current_tenant_id()`. We **add** branch + permission
predicates. Pattern per table:

| Table | Read (SELECT) extra predicate | Write (INSERT/UPDATE/DELETE) extra predicate |
|---|---|---|
| `wash_orders` | `can_access_branch(branch_id)` | `can_access_branch(branch_id) and can_edit('queue')` |
| `payments`¹ | branch via parent `wash_order` | `can_edit('queue')` (+ branch via parent) |
| `employees` | `can_access_branch(branch_id)` | `can_access_branch(branch_id) and can_edit('staff')` |
| `customers` | tenant-wide (unchanged) | `can_edit('customers')` |
| `vehicles` | tenant-wide (unchanged) | `can_edit('customers')` |
| `packages` | tenant-wide (unchanged) | `can_edit('packages')` |
| `branches` | tenant-wide (unchanged) | owner-only: `current_app_role() = 'owner'` |
| `profiles`, `user_branches` | owner-only / hook (§4) | edge function (service_role) |

¹ `payments` (`tenant_id, wash_order_id, amount, method, paid_at` — no `branch_id`) scopes
through its parent `wash_order`:
read `exists (select 1 from public.wash_orders wo where wo.id = payments.wash_order_id and public.can_access_branch(wo.branch_id))`;
write (take payment) additionally requires `can_edit('queue')`.

Owners satisfy every predicate (`can_access_branch`/`can_edit` short-circuit to true), so their
behavior is unchanged. A `manager` with `{}` permissions and no branches can read/write nothing
operational — a safe default.

**Implementation approach:** replace each affected table's existing `tenant_isolation`
(`FOR ALL`) policy with explicit `FOR SELECT` and `FOR INSERT/UPDATE/DELETE` policies carrying
the predicates above, keeping the `tenant_id = current_tenant_id()` base intact.

## 7. User management (owner-only)

### 7.1 `manage-users` edge function (service_role)

Mirrors `create-business`'s authoritative-gate pattern: verify from the **caller's JWT** that
they are an **active owner** of the tenant, re-checked server-side with a service_role query
(never trust client claims). Actions:

- `create` — input `{ email, password, full_name?, branch_ids[], permissions }`. Creates the
  auth user (`auth.admin.createUser`, email confirmed), inserts `profiles` row
  (`role='manager'`, permissions, `is_active=true`), inserts `user_branches` rows. All within
  the caller's tenant. Rolls back/cleans up the auth user on partial failure (as create-business does).
- `update` — `{ user_id, branch_ids?, permissions?, full_name? }` — replace branch rows / patch
  permissions for a member of the caller's tenant.
- `setActive` — `{ user_id, is_active }`.
- `delete` — `{ user_id }` — delete the auth user (profiles + user_branches cascade).
- `resetPassword` — `{ user_id, password }`.

Guards: target user must belong to the caller's tenant and have `role='manager'` (an owner can't
edit/delete another owner or themselves through this fn).

### 7.2 Users screen (`/app/users`, owner-only)

- Route guarded by `isOwner(claims)` (redirect members away).
- Sidebar shows **Users** only for owners.
- List of tenant users (name, email, role, branches, active) via the owner select on `profiles`
  joined to `user_branches` (a `listUsers()` lib fn / view).
- **Add/Edit dialog** (matches the design bar — cards, teal, RTL, i18n):
  - email + password (create only; "reset password" action on edit),
  - full name,
  - **branch multi-select** (the tenant's branches),
  - **permission grid**: a row per tab (§3) with a `none/view/edit` segmented control
    (`view`-only tabs show `none/view`).
- Row actions: edit, activate/deactivate, delete (ConfirmDialog).
- All writes call `manage-users`; React Query invalidates the users list.

## 8. App-wide UI gating

- **Sidebar** (`SidebarNav`): render each nav item only if `canView(claims, tab)`; **Branches**
  + **Users** only if `isOwner`.
- **Route guards**: a `RequirePermission(tab)` wrapper around tab routes → redirect to the first
  visible tab (or `/no-access`) if `!canView`. `RequireOwner` for `/app/branches` + `/app/users`.
- **Edit controls**: New/Edit/Delete/Activate buttons and operational actions (New Wash,
  start/complete/cancel, take payment) are hidden or disabled unless `canEdit(claims, tab)`.
  Read-only users still see the data.
- **Branch switcher** (`BranchSelector`): for a member, list only `visibleBranchIds`; if exactly
  one, render it static (no dropdown). New Wash defaults to an allowed branch.
- The UI gate is **defense-in-depth / UX**; RLS (§6) is the security boundary.

## 9. Error handling

- Edge function: 401 (not authed), 403 (not an owner / target outside tenant), 409 (email
  exists), 400 (validation) — JSON `{ error: code }`; the dialog maps codes to i18n strings.
- RLS denials surface as empty reads / failed writes; the UI already has error states (toasts/
  alerts) and shouldn't expose another branch's data because reads are filtered, not errored.
- Stale claims: permission/branch changes take effect on the user's **next token refresh /
  re-login** (same as today's `app_role`). The edit dialog notes this.

## 10. Testing strategy

**pgTAP (DB):**
- `user_branches` exists; `tenant_isolation` policy present; cross-tenant isolation test.
- Helper correctness: `current_branch_ids()`, `current_permission()`, `can_access_branch()`,
  `can_edit()` return expected values under a crafted `request.jwt.claims` GUC.
- Branch-scoped reads: with claims `{app_role:'manager', branch_ids:[A]}`, selecting
  `wash_orders`/`employees` returns only branch A; not branch B.
- Write gating: `manager` with `packages:'view'` cannot insert/update/delete `packages`; with
  `packages:'edit'` can. Same for `staff`→employees, `customers`→customers/vehicles,
  `queue`→wash_orders.
- Owner (`app_role:'owner'`) sees all branches and writes everywhere.
- Assertions scoped by row/tenant per the project's superuser-test rule.

**Vitest (frontend):**
- `parseClaims` reads `branch_ids` + `permissions` (and tolerates absence).
- `canView`/`canEdit`/`isOwner`/`visibleBranchIds` truth tables (owner, member with each level,
  missing key).
- Sidebar visibility derivation from claims.
- i18n en/ar parity for all new keys.

**Deno (edge fn):** `manage-users` authorization — non-owner rejected; owner creates a member
with correct profile/branches/permissions; can't target another owner; email-exists → 409.

**Full-flow (the gate):** owner creates a member (email/pw, 1–2 branches, mixed permissions) →
member logs in → sidebar shows only granted tabs → branch switcher limited → operational data
limited to their branch(es) → edit blocked where `view` → owner changes permissions →
member re-login reflects change → owner deactivates → member hits `/no-access`.

## 11. Build phases

- **Phase A — DB + claims (security core):** migrations (profiles cols, `user_branches`, helpers,
  RLS rewrites, hook), frontend claims + helpers. pgTAP + Vitest. *Ship green to dev.*
- **Phase B — User management:** `manage-users` edge function + `/app/users` screen + lib/queries
  + i18n. Deno + Vitest + full create/edit/delete flow.
- **Phase C — App-wide gating:** sidebar, route guards, edit-control gating across pages, branch
  switcher limiting. Full-flow test.

Each phase: develop + full suite locally green (pgTAP + Vitest + build), update
`docs/BUSINESS_LOGIC.md`, push to `dev`. Staging DB gets each migration applied (or the testing
site breaks). Production only on explicit go-ahead.

## 12. Decisions locked (from brainstorming)

1. **Multi-branch per user** (join table), permissions are **per-user** (one map, applies across
   all their branches) — not per-branch-per-feature.
2. **Customers & packages stay tenant-wide** (shared); only **wash_orders + employees** are
   branch-filtered.
3. **Branches + Users management are owner-only.**
4. **User creation = owner sets email + temp password** via the `manage-users` edge function
   (no email provider). Email-invite is a future enhancement.
5. **Washes tab is view-only**; all wash mutations gated by `queue:'edit'` (§3 note).

## 13. Out of scope (future)

Email-invite onboarding; per-branch-per-feature permission matrices; custom role presets/naming;
self-service password reset email; audit of permission changes (the existing `audit_log` may
capture user-management actions — confirmed in Phase B).
