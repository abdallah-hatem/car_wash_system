# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the carwash SaaS foundation — scaffolded React/Vite/Tailwind/shadcn app, full Postgres schema with tenant-isolating RLS, audit triggers, a JWT auth hook that injects `tenant_id` + `role` claims, and login with role-based routing — with tenant isolation proven by tests.

**Architecture:** One Supabase backend (Postgres + Auth). Every operational table carries `tenant_id`; RLS policies derive the tenant from a custom JWT claim set by a `custom_access_token_hook`. A `platform_admins` table grants cross-tenant access only on platform tables. Frontend is a single React codebase with two guarded route trees (`/admin/*`, `/app/*`).

**Tech Stack:** React 18 + Vite + TypeScript, Tailwind + shadcn/ui, React Router, Supabase (supabase-js, CLI, pgTAP for DB tests), Vitest for client unit tests.

---

## File Structure

- `supabase/config.toml` — local Supabase config (auth hook registration)
- `supabase/migrations/*.sql` — schema, RLS, triggers, auth hook (one migration per concern)
- `supabase/tests/*.sql` — pgTAP tests for RLS isolation and the auth hook
- `src/lib/supabase.ts` — typed supabase-js client (anon key only)
- `src/lib/database.types.ts` — generated DB types
- `src/auth/AuthProvider.tsx` — session + claims context
- `src/auth/guards.tsx` — `RequireAuth`, `RequireRole` route guards
- `src/routes.tsx` — route tree (`/login`, `/admin/*`, `/app/*`)
- `src/pages/LoginPage.tsx` — email/password login
- `.env.local` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (gitignored)

---

## Task 1: Scaffold the Vite + React + TS project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Scaffold**

Run from the project root (the directory already contains `docs/` and `.git`):

```bash
npm create vite@latest . -- --template react-ts
npm install
```

If prompted that the directory is not empty, choose "Ignore files and continue".

- [ ] **Step 2: Verify dev server boots**

Run: `npm run dev` then open the printed URL.
Expected: Vite welcome page renders. Stop the server (Ctrl-C).

- [ ] **Step 3: Verify build & typecheck**

Run: `npm run build`
Expected: build completes with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold vite react-ts app"
```

---

## Task 2: Install Tailwind + shadcn/ui

**Files:**
- Create/Modify: `tailwind.config.js`, `postcss.config.js`, `src/index.css`, `components.json`, `tsconfig.json`, `vite.config.ts`

- [ ] **Step 1: Install Tailwind**

```bash
npm install -D tailwindcss@^3 postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Configure paths and base CSS**

Set `tailwind.config.js` `content` to:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

Replace `src/index.css` top with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Add path alias for shadcn**

In `tsconfig.json` add under `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

Install the Vite path resolver and register it:

```bash
npm install -D @types/node
```

In `vite.config.ts`:

```ts
import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
})
```

- [ ] **Step 4: Init shadcn and add a Button to prove it works**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button
```

Render the button in `src/App.tsx`:

```tsx
import { Button } from "@/components/ui/button"

export default function App() {
  return <Button>It works</Button>
}
```

- [ ] **Step 5: Verify**

Run: `npm run dev`
Expected: a styled shadcn button renders. Then `npm run build` passes.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: add tailwind and shadcn/ui"
```

---

## Task 3: Initialize Supabase local development

**Files:**
- Create: `supabase/config.toml` (and supporting files via CLI)

- [ ] **Step 1: Init Supabase**

```bash
npm install -D supabase
npx supabase init
```

- [ ] **Step 2: Start local stack**

Run: `npx supabase start`
Expected: prints local API URL, anon key, service_role key, and Studio URL. Docker must be running.

- [ ] **Step 3: Capture local env**

Create `.env.local` (already gitignored) using the values printed by `supabase start`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase start>
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: init supabase local stack"
```

---

## Task 4: Migration — enums and platform tables

**Files:**
- Create: `supabase/migrations/0001_platform.sql`
- Test: `supabase/tests/0001_platform_test.sql`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/0001_platform_test.sql`:

```sql
begin;
select plan(3);

select has_table('public', 'tenants', 'tenants table exists');
select has_table('public', 'platform_admins', 'platform_admins table exists');
select col_type_is('public', 'tenants', 'status', 'tenant_status', 'status uses enum');

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — relation "tenants" does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0001_platform.sql`:

```sql
create type tenant_status as enum ('active', 'suspended');
create type tenant_role   as enum ('owner', 'manager');
create type wash_status   as enum ('waiting', 'in_progress', 'done', 'cancelled');
create type pay_method    as enum ('cash', 'card', 'transfer');

create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  status      tenant_status not null default 'active',
  created_at  timestamptz not null default now()
);

create table public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase test db`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_platform.sql supabase/tests/0001_platform_test.sql
git commit -m "feat(db): platform tables and enums"
```

---

## Task 5: Migration — org tables (branches, profiles)

**Files:**
- Create: `supabase/migrations/0002_org.sql`
- Test: `supabase/tests/0002_org_test.sql`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/0002_org_test.sql`:

```sql
begin;
select plan(3);

select has_table('public', 'branches', 'branches table exists');
select has_table('public', 'profiles', 'profiles table exists');
select col_type_is('public', 'profiles', 'role', 'tenant_role', 'profiles.role uses enum');

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — relation "branches" does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0002_org.sql`:

```sql
create table public.branches (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  address     text,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  role        tenant_role not null default 'manager',
  full_name   text,
  created_at  timestamptz not null default now()
);
create index profiles_tenant_idx on public.profiles (tenant_id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_org.sql supabase/tests/0002_org_test.sql
git commit -m "feat(db): org tables (branches, profiles)"
```

---

## Task 6: Migration — customers and vehicles

**Files:**
- Create: `supabase/migrations/0003_customers.sql`
- Test: `supabase/tests/0003_customers_test.sql`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/0003_customers_test.sql`:

```sql
begin;
select plan(3);

select has_table('public', 'customers', 'customers table exists');
select has_table('public', 'vehicles', 'vehicles table exists');
select has_index('public', 'vehicles', 'vehicles_tenant_plate_idx', 'plate search index exists');

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — relation "customers" does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0003_customers.sql`:

```sql
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  phone       text,
  created_at  timestamptz not null default now()
);

create table public.vehicles (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  customer_id   uuid references public.customers(id) on delete set null,
  plate_number  text not null,
  make          text,
  model         text,
  color         text,
  created_at    timestamptz not null default now()
);
create index vehicles_tenant_plate_idx on public.vehicles (tenant_id, plate_number);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_customers.sql supabase/tests/0003_customers_test.sql
git commit -m "feat(db): customers and vehicles with plate index"
```

---

## Task 7: Migration — catalog and staff (packages, employees)

**Files:**
- Create: `supabase/migrations/0004_catalog_staff.sql`
- Test: `supabase/tests/0004_catalog_staff_test.sql`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/0004_catalog_staff_test.sql`:

```sql
begin;
select plan(2);

select has_table('public', 'packages', 'packages table exists');
select has_table('public', 'employees', 'employees table exists');

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — relation "packages" does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0004_catalog_staff.sql`:

```sql
create table public.packages (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  name              text not null,
  price             numeric(10,2) not null,
  duration_minutes  int,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create table public.employees (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  name        text not null,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_catalog_staff.sql supabase/tests/0004_catalog_staff_test.sql
git commit -m "feat(db): packages and employees"
```

---

## Task 8: Migration — operations and money (wash_orders, payments)

**Files:**
- Create: `supabase/migrations/0005_operations.sql`
- Test: `supabase/tests/0005_operations_test.sql`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/0005_operations_test.sql`:

```sql
begin;
select plan(3);

select has_table('public', 'wash_orders', 'wash_orders table exists');
select has_table('public', 'payments', 'payments table exists');
select col_type_is('public', 'wash_orders', 'status', 'wash_status', 'status uses enum');

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — relation "wash_orders" does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0005_operations.sql`:

```sql
create table public.wash_orders (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  branch_id            uuid not null references public.branches(id) on delete restrict,
  customer_id          uuid references public.customers(id) on delete set null,
  vehicle_id           uuid references public.vehicles(id) on delete set null,
  package_id           uuid references public.packages(id) on delete set null,
  assigned_employee_id uuid references public.employees(id) on delete set null,
  status               wash_status not null default 'waiting',
  price                numeric(10,2) not null,
  notes                text,
  created_at           timestamptz not null default now(),
  started_at           timestamptz,
  completed_at         timestamptz
);
create index wash_orders_queue_idx
  on public.wash_orders (tenant_id, branch_id, status, created_at);

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  wash_order_id uuid not null references public.wash_orders(id) on delete cascade,
  amount        numeric(10,2) not null,
  method        pay_method not null,
  paid_at       timestamptz not null default now()
);
create index payments_tenant_idx on public.payments (tenant_id, paid_at);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_operations.sql supabase/tests/0005_operations_test.sql
git commit -m "feat(db): wash_orders and payments"
```

---

## Task 9: Migration — audit log and triggers

**Files:**
- Create: `supabase/migrations/0006_audit.sql`
- Test: `supabase/tests/0006_audit_test.sql`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/0006_audit_test.sql`. It inserts a wash order with the audit trigger active and asserts an audit row was written:

```sql
begin;
select plan(2);

select has_table('public', 'audit_log', 'audit_log table exists');

-- seed minimal parents, then insert a wash order
insert into public.tenants (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'T1');
insert into public.branches (id, tenant_id, name)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'B1');
insert into public.wash_orders (tenant_id, branch_id, price)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 50);

select is(
  (select count(*)::int from public.audit_log
     where table_name = 'wash_orders' and action = 'INSERT'),
  1,
  'insert on wash_orders writes one audit row'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — relation "audit_log" does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0006_audit.sql`:

```sql
create table public.audit_log (
  id          bigint generated always as identity primary key,
  tenant_id   uuid,
  table_name  text not null,
  row_id      uuid,
  action      text not null,
  actor       uuid,
  at          timestamptz not null default now()
);
create index audit_log_tenant_idx on public.audit_log (tenant_id, at);

create function public.write_audit() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  rec record;
begin
  rec := coalesce(new, old);
  insert into public.audit_log (tenant_id, table_name, row_id, action, actor)
  values (rec.tenant_id, tg_table_name, rec.id, tg_op, auth.uid());
  return coalesce(new, old);
end;
$$;

-- attach to the tables we care about
create trigger audit_wash_orders
  after insert or update or delete on public.wash_orders
  for each row execute function public.write_audit();

create trigger audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.write_audit();

create trigger audit_customers
  after insert or update or delete on public.customers
  for each row execute function public.write_audit();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_audit.sql supabase/tests/0006_audit_test.sql
git commit -m "feat(db): audit log and triggers"
```

---

## Task 10: Migration — auth hook (inject tenant_id + role claims)

**Files:**
- Create: `supabase/migrations/0007_auth_hook.sql`
- Modify: `supabase/config.toml`
- Test: `supabase/tests/0007_auth_hook_test.sql`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/0007_auth_hook_test.sql`. It calls the hook with a fake event for a user that has a profile, and asserts claims are added:

```sql
begin;
select plan(2);

select has_function('public', 'custom_access_token_hook', 'hook function exists');

-- seed a tenant + auth user + profile
insert into public.tenants (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'T1');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'u1@example.com');
insert into public.profiles (user_id, tenant_id, role)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'owner');

select is(
  public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', '00000000-0000-0000-0000-0000000000f1',
      'claims', '{}'::jsonb
    )
  ) -> 'claims' ->> 'tenant_id',
  '00000000-0000-0000-0000-0000000000a1',
  'hook injects tenant_id claim from profile'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — function custom_access_token_hook does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0007_auth_hook.sql`:

```sql
create function public.custom_access_token_hook(event jsonb)
  returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  claims    jsonb := event -> 'claims';
  uid       uuid  := (event ->> 'user_id')::uuid;
  prof      record;
  is_admin  boolean;
begin
  select tenant_id, role into prof from public.profiles where user_id = uid;
  if found then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(prof.tenant_id::text));
    claims := jsonb_set(claims, '{role}',      to_jsonb(prof.role::text));
  end if;

  select exists(select 1 from public.platform_admins where user_id = uid) into is_admin;
  claims := jsonb_set(claims, '{is_platform_admin}', to_jsonb(is_admin));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- the auth admin role must be able to execute the hook
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant usage  on schema public to supabase_auth_admin;
grant select on public.profiles, public.platform_admins to supabase_auth_admin;
```

- [ ] **Step 4: Register the hook in config.toml**

In `supabase/config.toml`, add under `[auth]`:

```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

- [ ] **Step 5: Restart and run tests**

```bash
npx supabase stop && npx supabase start
npx supabase test db
```

Expected: PASS (hook function exists; tenant_id claim injected).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0007_auth_hook.sql supabase/tests/0007_auth_hook_test.sql supabase/config.toml
git commit -m "feat(auth): custom access token hook injects tenant_id and role"
```

---

## Task 11: Migration — RLS policies and is_platform_admin helper

**Files:**
- Create: `supabase/migrations/0008_rls.sql`
- Test: `supabase/tests/0008_rls_test.sql`

This is the most important security task. The test proves a user from tenant A cannot read tenant B's data.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/0008_rls_test.sql`. It seeds two tenants, sets the JWT claim to tenant A, and asserts only tenant A's customers are visible:

```sql
begin;
select plan(2);

-- two tenants, one customer each
insert into public.tenants (id, name) values
  ('00000000-0000-0000-0000-00000000aaaa', 'A'),
  ('00000000-0000-0000-0000-00000000bbbb', 'B');
insert into public.customers (tenant_id, name) values
  ('00000000-0000-0000-0000-00000000aaaa', 'Alice'),
  ('00000000-0000-0000-0000-00000000bbbb', 'Bob');

-- act as an authenticated user whose JWT claims tenant A
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"tenant_id":"00000000-0000-0000-0000-00000000aaaa","role":"owner"}',
  true
);

select is(
  (select count(*)::int from public.customers),
  1,
  'tenant A sees only its own customer'
);
select is(
  (select name from public.customers),
  'Alice',
  'the visible customer belongs to tenant A'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — with RLS not yet enabled, the count is 2, not 1.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0008_rls.sql`:

```sql
-- helper used only on platform tables
create function public.is_platform_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- current tenant from the JWT claim
create function public.current_tenant_id() returns uuid
  language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::uuid;
$$;

-- tenant-isolated tables: identical policy on each
do $$
declare t text;
begin
  foreach t in array array[
    'branches','profiles','customers','vehicles',
    'packages','employees','wash_orders','payments'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($f$
      create policy tenant_isolation on public.%I
        for all
        using      (tenant_id = public.current_tenant_id())
        with check (tenant_id = public.current_tenant_id());
    $f$, t);
  end loop;
end $$;

-- tenants table: tenant users read their own row; platform admin manages all
alter table public.tenants enable row level security;
create policy tenant_self_read on public.tenants for select
  using (id = public.current_tenant_id() or public.is_platform_admin());
create policy tenant_admin_manage on public.tenants for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- audit_log: read within tenant or as platform admin; no client writes (trigger only)
alter table public.audit_log enable row level security;
create policy audit_read on public.audit_log for select
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase test db`
Expected: PASS — tenant A sees exactly one customer (Alice).

- [ ] **Step 5: Add a cross-tenant write-rejection test**

Append to `supabase/tests/0008_rls_test.sql` before `finish()` is not possible (plan count fixed); instead create `supabase/tests/0008b_rls_write_test.sql`:

```sql
begin;
select plan(1);

insert into public.tenants (id, name) values
  ('00000000-0000-0000-0000-00000000aaaa', 'A'),
  ('00000000-0000-0000-0000-00000000bbbb', 'B');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"tenant_id":"00000000-0000-0000-0000-00000000aaaa","role":"owner"}',
  true
);

-- attempting to insert a customer into tenant B must be blocked by WITH CHECK
select throws_ok(
  $$insert into public.customers (tenant_id, name)
     values ('00000000-0000-0000-0000-00000000bbbb', 'Mallory')$$,
  '42501',
  'new row violates row-level security policy for table "customers"',
  'cannot write into another tenant'
);

select * from finish();
rollback;
```

- [ ] **Step 6: Run both tests**

Run: `npx supabase test db`
Expected: PASS — isolation read + cross-tenant write rejection.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0008_rls.sql supabase/tests/0008_rls_test.sql supabase/tests/0008b_rls_write_test.sql
git commit -m "feat(db): RLS tenant isolation with proven tests"
```

---

## Task 12: Generate typed client and supabase-js wrapper

**Files:**
- Create: `src/lib/database.types.ts`, `src/lib/supabase.ts`

- [ ] **Step 1: Generate DB types**

```bash
npx supabase gen types typescript --local > src/lib/database.types.ts
```

- [ ] **Step 2: Install supabase-js and create the client**

```bash
npm install @supabase/supabase-js
```

Create `src/lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY")
}

export const supabase = createClient<Database>(url, anonKey)
```

- [ ] **Step 3: Verify typecheck/build**

Run: `npm run build`
Expected: passes with no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/database.types.ts src/lib/supabase.ts package.json package-lock.json
git commit -m "feat: typed supabase client"
```

---

## Task 13: Auth provider with claims parsing

**Files:**
- Create: `src/auth/claims.ts`, `src/auth/AuthProvider.tsx`
- Test: `src/auth/claims.test.ts`
- Modify: `package.json` (add vitest)

- [ ] **Step 1: Add Vitest**

```bash
npm install -D vitest
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing test**

Create `src/auth/claims.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { parseClaims } from "./claims"

describe("parseClaims", () => {
  it("extracts tenant_id, role, and admin flag from a decoded JWT payload", () => {
    const payload = {
      tenant_id: "00000000-0000-0000-0000-00000000aaaa",
      role: "owner",
      is_platform_admin: false,
    }
    expect(parseClaims(payload)).toEqual({
      tenantId: "00000000-0000-0000-0000-00000000aaaa",
      role: "owner",
      isPlatformAdmin: false,
    })
  })

  it("returns nulls when claims are absent", () => {
    expect(parseClaims({})).toEqual({
      tenantId: null,
      role: null,
      isPlatformAdmin: false,
    })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module "./claims".

- [ ] **Step 4: Implement claims parsing**

Create `src/auth/claims.ts`:

```ts
export type TenantRole = "owner" | "manager"

export interface AppClaims {
  tenantId: string | null
  role: TenantRole | null
  isPlatformAdmin: boolean
}

export function parseClaims(payload: Record<string, unknown>): AppClaims {
  return {
    tenantId: (payload.tenant_id as string) ?? null,
    role: (payload.role as TenantRole) ?? null,
    isPlatformAdmin: payload.is_platform_admin === true,
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 6: Implement AuthProvider**

Create `src/auth/AuthProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { parseClaims, type AppClaims } from "./claims"

interface AuthState {
  session: Session | null
  claims: AppClaims
  loading: boolean
}

const AuthContext = createContext<AuthState | undefined>(undefined)

function decodeClaims(session: Session | null): AppClaims {
  if (!session) return { tenantId: null, role: null, isPlatformAdmin: false }
  const payload = JSON.parse(atob(session.access_token.split(".")[1]))
  return parseClaims(payload)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, claims: decodeClaims(session), loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(auth): auth provider with JWT claims parsing"
```

---

## Task 14: Login page and role-based route guards

**Files:**
- Create: `src/pages/LoginPage.tsx`, `src/auth/guards.tsx`, `src/routes.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`
- Add: shadcn `input`, `card`, `label` components

- [ ] **Step 1: Install router and UI inputs**

```bash
npm install react-router-dom
npx shadcn@latest add input card label
```

- [ ] **Step 2: Build the guards**

Create `src/auth/guards.tsx`:

```tsx
import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "./AuthProvider"

export function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { claims, loading } = useAuth()
  if (loading) return null
  if (!claims.isPlatformAdmin) return <Navigate to="/app" replace />
  return <Outlet />
}

export function RequireTenant() {
  const { claims, loading } = useAuth()
  if (loading) return null
  if (!claims.tenantId) return <Navigate to="/admin" replace />
  return <Outlet />
}
```

- [ ] **Step 3: Build the login page**

Create `src/pages/LoginPage.tsx`:

```tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else navigate("/")
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email}
                   onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password}
                   onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full">Sign in</Button>
        </form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Wire the route tree**

Create `src/routes.tsx`:

```tsx
import { createBrowserRouter, Navigate } from "react-router-dom"
import LoginPage from "@/pages/LoginPage"
import { RequireAuth, RequireAdmin, RequireTenant } from "@/auth/guards"

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: "/admin",
        element: <RequireAdmin />,
        children: [{ index: true, element: <div className="p-6">Admin console (coming in Plan 2)</div> }],
      },
      {
        path: "/app",
        element: <RequireTenant />,
        children: [{ index: true, element: <div className="p-6">Tenant app (coming in Plan 3)</div> }],
      },
      { path: "/", element: <Navigate to="/app" replace /> },
    ],
  },
])
```

- [ ] **Step 5: Mount provider + router**

Replace `src/main.tsx`:

```tsx
import React from "react"
import ReactDOM from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { AuthProvider } from "@/auth/AuthProvider"
import { router } from "@/routes"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`. Visiting `/` while signed out redirects to `/login`.
Create a test user + profile to confirm routing, using Studio (`npx supabase start` printed the URL) or:

```bash
# create an auth user via the local API, then in Studio SQL editor:
# insert into public.tenants (id,name) values (gen_random_uuid(),'Demo') returning id;
# insert into public.profiles (user_id, tenant_id, role) values ('<user-id>','<tenant-id>','owner');
```

Expected: signing in as a tenant user lands on `/app`; a `platform_admins` user lands able to reach `/admin`.

- [ ] **Step 7: Build + test**

Run: `npm run build && npm test`
Expected: both pass.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(auth): login page and role-based route guards"
```

---

## Definition of Done

- `npx supabase test db` passes (schema, audit, auth hook, RLS isolation + write rejection).
- `npm test` passes (claims parsing).
- `npm run build` passes.
- Signed-out users are redirected to `/login`; tenant users reach `/app`; platform admins reach `/admin`.
- All work committed.

This foundation is the prerequisite for Plan 2 (Admin console) and Plan 3 (Tenant ops).
