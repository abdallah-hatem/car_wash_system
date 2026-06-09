# Carwash SaaS — MVP Design

**Date:** 2026-06-09
**Status:** Approved scope, pending spec review

## 1. Purpose & Scope

A multi-tenant SaaS for carwash businesses. Each business (tenant) runs daily
operations from a counter tablet; the platform owner manages all client
businesses from a separate admin console.

This MVP ships the smallest set of features a real carwash will use day one:
track cars in, assign a washer, take payment, see today's numbers — plus the
tenancy/security backbone that is expensive to retrofit.

### Locked decisions
- **Tenancy:** True multi-tenant SaaS. `tenant_id` JWT claim + Postgres RLS (Approach A).
- **Operators:** Counter-only. Owner/manager log in on a tablet. Washers are records, not users.
- **Payments:** Manual record (amount + method). No real processing.
- **Flow:** Walk-in only (live queue). No appointments.
- **Language:** English / LTR first. Strings externalized so Arabic/RTL can be added later.
- **Platform admin v1:** Manage businesses only (create/onboard, edit, activate/suspend).

## 2. System Shape

One Supabase backend (Postgres + Auth + RLS + Storage) serving two frontends
built from one React + Vite + Tailwind + shadcn codebase:

- **Tenant app** (`/app/*`) — counter-tablet PWA. Daily operations.
- **Admin console** (`/admin/*`) — platform owner manages client businesses.

Route trees are guarded by role (`platform_admin`, `owner`, `manager`).
PWA is installable; offline support is **not** in v1.

## 3. Actor Levels

| Level | Who | Sees | Enforcement |
|---|---|---|---|
| Platform admin | Platform owner | All tenants | `platform_admins` table + `is_platform_admin()`; policies only on platform tables |
| Tenant user | Carwash owner/manager | Own business + branches | `tenant_id` JWT claim |
| Employees | Washers | Not users; records only | n/a |

Tenant roles: **owner** (manage users, settings, everything) and **manager** (daily ops).

## 4. Data Model

See Section 8 for the concrete SQL DDL. Tables:

- **Platform:** `tenants`, `platform_admins`
- **Org:** `branches`, `profiles` (user ↔ tenant ↔ role)
- **Customers:** `customers`, `vehicles` (indexed plate search)
- **Catalog:** `packages`
- **Staff:** `employees`
- **Operations:** `wash_orders` (status: `waiting → in_progress → done → cancelled`)
- **Money:** `payments`
- **Audit:** `audit_log` (generic, trigger-based)

Every operational table carries `tenant_id`; branch-scoped tables also carry `branch_id`.

## 5. Core Flows

- **Onboard (platform admin):** create `tenant` + first `owner` user → owner receives login.
- **New wash (counter):** find/create customer → plate-search/create vehicle → pick package
  → enters queue (`waiting`) → assign employee + `in_progress` → `done` → record payment.
- **Dashboard (owner/manager):** today's revenue, washes by status, live queue, per-branch filter.

## 6. Cross-Cutting Concerns

- **Audit log:** Postgres triggers on insert/update/delete for key tables. Set up once, upfront.
- **Errors:** RLS denials surface as friendly "not allowed"; client-side validation with DB
  constraints as the source of truth.
- **Security:** No global cross-tenant bypass on operational tables. Admin policies confined to
  platform tables. `tenant_id` always derived from the JWT, never from client input.

## 7. Explicitly Out of v1 (deferred)

Inventory/chemicals · assets/machines/depreciation · payroll/commission · analytics suite ·
ratings/performance · appointments/booking · push notifications · Arabic/RTL · real payment
processing · admin usage-metrics, billing, and impersonation.

Schema is structured so these slot in without rewriting existing rows.

## 8. Database Schema (DDL)

> Illustrative DDL for the design. Final migrations are produced in the implementation plan.

```sql
-- ── Enums ────────────────────────────────────────────────────────────────
create type tenant_status as enum ('active', 'suspended');
create type tenant_role   as enum ('owner', 'manager');
create type wash_status   as enum ('waiting', 'in_progress', 'done', 'cancelled');
create type pay_method     as enum ('cash', 'card', 'transfer');

-- ── Platform tables ──────────────────────────────────────────────────────
create table tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  status      tenant_status not null default 'active',
  created_at  timestamptz not null default now()
);

create table platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ── Org tables ───────────────────────────────────────────────────────────
create table branches (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  address     text,
  created_at  timestamptz not null default now()
);

-- profiles links an auth user to a tenant + role
create table profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  role        tenant_role not null default 'manager',
  full_name   text,
  created_at  timestamptz not null default now()
);

-- ── Customers & vehicles ─────────────────────────────────────────────────
create table customers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  phone       text,
  created_at  timestamptz not null default now()
);

create table vehicles (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  customer_id   uuid references customers(id) on delete set null,
  plate_number  text not null,
  make          text,
  model         text,
  color         text,
  created_at    timestamptz not null default now()
);
-- fast plate search, scoped per tenant
create index vehicles_tenant_plate_idx on vehicles (tenant_id, plate_number);

-- ── Catalog & staff ──────────────────────────────────────────────────────
create table packages (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  name              text not null,
  price             numeric(10,2) not null,
  duration_minutes  int,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create table employees (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  branch_id   uuid references branches(id) on delete set null,
  name        text not null,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Operations ───────────────────────────────────────────────────────────
create table wash_orders (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  branch_id           uuid not null references branches(id) on delete restrict,
  customer_id         uuid references customers(id) on delete set null,
  vehicle_id          uuid references vehicles(id) on delete set null,
  package_id          uuid references packages(id) on delete set null,
  assigned_employee_id uuid references employees(id) on delete set null,
  status              wash_status not null default 'waiting',
  price               numeric(10,2) not null,
  notes               text,
  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  completed_at        timestamptz
);
create index wash_orders_queue_idx on wash_orders (tenant_id, branch_id, status, created_at);

-- ── Money ────────────────────────────────────────────────────────────────
create table payments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  wash_order_id uuid not null references wash_orders(id) on delete cascade,
  amount        numeric(10,2) not null,
  method        pay_method not null,
  paid_at       timestamptz not null default now()
);

-- ── Audit ────────────────────────────────────────────────────────────────
create table audit_log (
  id          bigint generated always as identity primary key,
  tenant_id   uuid,
  table_name  text not null,
  row_id      uuid,
  action      text not null,        -- INSERT | UPDATE | DELETE
  actor       uuid,                 -- auth.uid()
  at          timestamptz not null default now()
);
```

### RLS pattern (applied to every tenant table)

```sql
-- helper: platform admin check (SECURITY DEFINER, used only on platform tables)
create function is_platform_admin() returns boolean
  language sql security definer stable as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

-- enable + isolate (repeated per operational table, e.g. wash_orders)
alter table wash_orders enable row level security;

create policy tenant_isolation on wash_orders
  using      (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- tenants table: tenant users read their own row; platform admin manages all
alter table tenants enable row level security;

create policy tenant_self_read on tenants for select
  using (id = (auth.jwt() ->> 'tenant_id')::uuid or is_platform_admin());

create policy tenant_admin_manage on tenants for all
  using (is_platform_admin()) with check (is_platform_admin());
```

The `tenant_id` (and `role`) claims are injected by a Supabase **Custom Access Token
Auth Hook** that reads the user's `profiles` row at token-issue time.

## 9. Next Step

Proceed to the implementation plan (writing-plans skill): migration order,
auth hook setup, frontend route/guards, and feature build sequence.
