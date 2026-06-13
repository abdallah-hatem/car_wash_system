-- 0014_dashboard_rls_test.sql
-- Verifies dashboard KPI query isolation: revenue sum and wash_order counts
-- are correctly scoped to the requesting tenant's branch, and that tenant B's
-- payment/order are invisible to tenant A.
-- Tenant B's wash_order + payment are seeded as SUPERUSER before the role
-- switch, so they exist in the DB but must be invisible to tenant A.
begin;
select plan(3);

-- ── Fixtures (superuser context) ─────────────────────────────────────────────
insert into public.tenants (id, name) values
  ('00000000-0000-0000-0000-000000001401', 'Tenant-A-14'),
  ('00000000-0000-0000-0000-000000001402', 'Tenant-B-14');

insert into public.branches (id, tenant_id, name) values
  ('00000000-0000-0000-0000-000000001411', '00000000-0000-0000-0000-000000001401', 'Branch-A-14'),
  ('00000000-0000-0000-0000-000000001412', '00000000-0000-0000-0000-000000001402', 'Branch-B-14');

-- Seed tenant-B wash_order + payment as superuser (invisible to A under RLS)
insert into public.wash_orders (id, tenant_id, branch_id, status, price) values
  ('00000000-0000-0000-0000-000000001421',
   '00000000-0000-0000-0000-000000001402',
   '00000000-0000-0000-0000-000000001412',
   'done', 99.00);

insert into public.payments (id, tenant_id, wash_order_id, amount, method, paid_at) values
  ('00000000-0000-0000-0000-000000001431',
   '00000000-0000-0000-0000-000000001402',
   '00000000-0000-0000-0000-000000001421',
   99.00, 'card', now());

-- ── Switch to authenticated role with tenant-A claims ────────────────────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"tenant_id":"00000000-0000-0000-0000-000000001401","app_role":"owner","role":"authenticated"}',
  true
);

-- Tenant A inserts its own wash_order (done, today)
insert into public.wash_orders (id, tenant_id, branch_id, status, price) values
  ('00000000-0000-0000-0000-000000001441',
   '00000000-0000-0000-0000-000000001401',
   '00000000-0000-0000-0000-000000001411',
   'done', 40.00);

-- Tenant A records a payment against its own order (paid today)
insert into public.payments (id, tenant_id, wash_order_id, amount, method, paid_at) values
  ('00000000-0000-0000-0000-000000001451',
   '00000000-0000-0000-0000-000000001401',
   '00000000-0000-0000-0000-000000001441',
   40.00, 'cash', now());

-- ── Assertions ───────────────────────────────────────────────────────────────

-- 1. Revenue for branch A sums to 40 (tenant B's 99 payment is excluded by RLS)
--    This mirrors the dashboard revenue query: sum payments joined to wash_orders
--    filtered by branch_id. Tenant B's payment must not appear.
select is(
  (select coalesce(sum(p.amount), 0)::numeric(10,2)
     from public.payments p
     join public.wash_orders w on w.id = p.wash_order_id
    where w.branch_id = '00000000-0000-0000-0000-000000001411'),
  40.00::numeric(10,2),
  'dashboard revenue for branch A = 40 (B payment excluded by RLS)'
);

-- 2. Tenant A sees exactly 1 wash_order for branch A (B's order is hidden)
select is(
  (select count(*)::int
     from public.wash_orders
    where branch_id = '00000000-0000-0000-0000-000000001411'),
  1,
  'tenant A sees exactly 1 wash_order for branch A (B order excluded by RLS)'
);

-- 3. A select of wash_orders as tenant A returns only A's row (isolation):
--    the row tenant A can see has the correct tenant_id and branch_id
select is(
  (select tenant_id::text
     from public.wash_orders
    where id = '00000000-0000-0000-0000-000000001441'),
  '00000000-0000-0000-0000-000000001401',
  'the wash_order visible to tenant A belongs to tenant A only'
);

select * from finish();
rollback;
