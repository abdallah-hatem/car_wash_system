-- 0012_customers_vehicles_rls_test.sql
-- Verifies RLS isolation for customers + vehicles per tenant,
-- plate ilike search visibility, and audit_log trigger on customer INSERT.
-- Tenant B is seeded as SUPERUSER before role-switch so it exists but must
-- be invisible to tenant A.
begin;
select plan(5);

-- ── Fixtures (superuser context) ─────────────────────────────────────────────
insert into public.tenants (id, name) values
  ('00000000-0000-0000-0000-000000001201', 'Tenant A'),
  ('00000000-0000-0000-0000-000000001202', 'Tenant B');

-- Seed tenant-B customer + vehicle as superuser (should be invisible to A)
insert into public.customers (id, tenant_id, name) values
  ('00000000-0000-0000-0000-000000001211', '00000000-0000-0000-0000-000000001202', 'Bob-B');

insert into public.vehicles (id, tenant_id, customer_id, plate_number) values
  ('00000000-0000-0000-0000-000000001221',
   '00000000-0000-0000-0000-000000001202',
   '00000000-0000-0000-0000-000000001211',
   'XYZ 999');  -- deliberately NOT containing 'ABC' so plate search doesn't cross-match

-- ── Switch to authenticated role with tenant-A claims ────────────────────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"tenant_id":"00000000-0000-0000-0000-000000001201","app_role":"owner","role":"authenticated"}',
  true
);

-- Tenant A inserts its own customer and vehicle (should succeed under RLS)
insert into public.customers (id, tenant_id, name, phone) values
  ('00000000-0000-0000-0000-000000001231',
   '00000000-0000-0000-0000-000000001201',
   'Ali',
   '0500000000');

insert into public.vehicles (id, tenant_id, customer_id, plate_number, make, model, color) values
  ('00000000-0000-0000-0000-000000001241',
   '00000000-0000-0000-0000-000000001201',
   '00000000-0000-0000-0000-000000001231',
   'ABC 123',
   'Toyota', 'Corolla', 'white');

-- ── Assertions ───────────────────────────────────────────────────────────────

-- 1. Tenant A sees exactly 1 customer (not B's)
select is(
  (select count(*)::int from public.customers),
  1,
  'tenant A sees exactly 1 customer'
);

-- 2. Tenant A sees exactly 1 vehicle
select is(
  (select count(*)::int from public.vehicles),
  1,
  'tenant A sees exactly 1 vehicle'
);

-- 3. Plate ilike search returns exactly 1 match for 'ABC' (A's plate 'ABC 123';
--    B's plate 'XYZ 999' must NOT appear)
select is(
  (select count(*)::int from public.vehicles where plate_number ilike '%ABC%'),
  1,
  'plate search for ABC returns exactly 1 vehicle (A only; B plate does not match)'
);

-- 4. The visible customer is tenant A's (name = 'Ali')
select is(
  (select name from public.customers),
  'Ali',
  'visible customer belongs to tenant A (Ali)'
);

-- 5. The customer INSERT triggered an audit_log row for tenant A
--    (write_audit runs as SECURITY DEFINER but still records tenant_id from the row;
--     the audit_read policy allows tenant A to see its own rows)
select cmp_ok(
  (select count(*)::int
     from public.audit_log
     where tenant_id = '00000000-0000-0000-0000-000000001201'
       and table_name = 'customers'
       and action = 'INSERT'),
  '>=',
  1,
  'customer INSERT wrote an audit_log row for tenant A'
);

select * from finish();
rollback;
