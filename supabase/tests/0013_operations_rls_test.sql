-- 0013_operations_rls_test.sql
-- Verifies RLS isolation for wash_orders + payments per tenant, plus status
-- update persistence and audit_log trigger coverage.
-- Tenant B's wash_order + payment are seeded as SUPERUSER before the role
-- switch, so they exist in the DB but must be invisible to tenant A.
begin;
select plan(5);

-- ── Fixtures (superuser context) ─────────────────────────────────────────────
insert into public.tenants (id, name) values
  ('00000000-0000-0000-0000-000000001301', 'Tenant-A-13'),
  ('00000000-0000-0000-0000-000000001302', 'Tenant-B-13');

-- Branches for both tenants (needed as NOT NULL FK on wash_orders)
insert into public.branches (id, tenant_id, name) values
  ('00000000-0000-0000-0000-000000001311', '00000000-0000-0000-0000-000000001301', 'Branch-A'),
  ('00000000-0000-0000-0000-000000001312', '00000000-0000-0000-0000-000000001302', 'Branch-B');

-- Seed tenant-B wash_order + payment as superuser (invisible to A under RLS)
insert into public.wash_orders (id, tenant_id, branch_id, status, price) values
  ('00000000-0000-0000-0000-000000001321',
   '00000000-0000-0000-0000-000000001302',
   '00000000-0000-0000-0000-000000001312',
   'waiting', 99.00);

insert into public.payments (id, tenant_id, wash_order_id, amount, method) values
  ('00000000-0000-0000-0000-000000001331',
   '00000000-0000-0000-0000-000000001302',
   '00000000-0000-0000-0000-000000001321',
   99.00, 'card');

-- ── Switch to authenticated role with tenant-A claims ────────────────────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"tenant_id":"00000000-0000-0000-0000-000000001301","app_role":"owner","role":"authenticated"}',
  true
);

-- Tenant A inserts its own wash_order (should succeed under RLS)
insert into public.wash_orders (id, tenant_id, branch_id, status, price) values
  ('00000000-0000-0000-0000-000000001341',
   '00000000-0000-0000-0000-000000001301',
   '00000000-0000-0000-0000-000000001311',
   'waiting', 50.00);

-- Tenant A records a payment against its own order
insert into public.payments (id, tenant_id, wash_order_id, amount, method) values
  ('00000000-0000-0000-0000-000000001351',
   '00000000-0000-0000-0000-000000001301',
   '00000000-0000-0000-0000-000000001341',
   50.00, 'cash');

-- Tenant A adds a staff member (a wash can't go in_progress without one — 0019)
insert into public.employees (id, tenant_id, branch_id, name) values
  ('00000000-0000-0000-0000-000000001361',
   '00000000-0000-0000-0000-000000001301',
   '00000000-0000-0000-0000-000000001311',
   'Worker-A');

-- Update: advance the order from waiting → in_progress (with assigned staff)
update public.wash_orders
   set status = 'in_progress', started_at = now(),
       assigned_employee_id = '00000000-0000-0000-0000-000000001361'
 where id = '00000000-0000-0000-0000-000000001341';

-- ── Assertions ───────────────────────────────────────────────────────────────

-- 1. Tenant A sees exactly 1 wash_order (B's must be hidden by RLS)
select is(
  (select count(*)::int from public.wash_orders),
  1,
  'tenant A sees exactly 1 wash_order (not B-13 row)'
);

-- 2. Tenant A sees exactly 1 payment (B's must be hidden by RLS)
select is(
  (select count(*)::int from public.payments),
  1,
  'tenant A sees exactly 1 payment (not B-13 row)'
);

-- 3. The status update from waiting → in_progress persisted
select is(
  (select status::text from public.wash_orders where id = '00000000-0000-0000-0000-000000001341'),
  'in_progress',
  'updating wash_order status waiting→in_progress persists'
);

-- 4. audit_log has a wash_orders INSERT row for tenant A
select cmp_ok(
  (select count(*)::int
     from public.audit_log
    where tenant_id = '00000000-0000-0000-0000-000000001301'
      and table_name = 'wash_orders'
      and action = 'INSERT'),
  '>=',
  1,
  'wash_orders INSERT wrote an audit_log row for tenant A'
);

-- 5. audit_log has a payments INSERT row for tenant A
select cmp_ok(
  (select count(*)::int
     from public.audit_log
    where tenant_id = '00000000-0000-0000-0000-000000001301'
      and table_name = 'payments'
      and action = 'INSERT'),
  '>=',
  1,
  'payments INSERT wrote an audit_log row for tenant A'
);

select * from finish();
rollback;
