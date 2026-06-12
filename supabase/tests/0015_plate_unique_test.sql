-- 0015_plate_unique_test.sql
-- Per-tenant plate uniqueness:
--   1. Duplicate (same tenant, same plate_letters + plate_digits) is rejected with SQLSTATE 23505.
--   2. Same plate under a DIFFERENT tenant succeeds (per-tenant scope, not global).
--   3. Tenant A sees exactly 1 vehicle for that plate (RLS isolation from tenant B).
begin;
select plan(3);

-- ── Fixtures (superuser context) ─────────────────────────────────────────────
-- Use UUIDs that won't collide with any other test file.
insert into public.tenants (id, name) values
  ('00001500-0000-0000-0000-000000000001', 'Tenant-A-15'),
  ('00001500-0000-0000-0000-000000000002', 'Tenant-B-15');

-- Seed tenant-B vehicle with the SAME plate as A (أبج / 123) — as superuser, bypassing RLS.
-- This proves per-tenant isolation: the same plate can coexist across tenants.
insert into public.customers (id, tenant_id, name)
  values ('00001500-0000-0000-0000-000000000011', '00001500-0000-0000-0000-000000000002', 'B-Customer-15');

insert into public.vehicles (id, tenant_id, customer_id, plate_letters, plate_digits, plate_number)
  values ('00001500-0000-0000-0000-000000000021',
          '00001500-0000-0000-0000-000000000002',
          '00001500-0000-0000-0000-000000000011',
          'أبج', '123', 'أبج 123');

-- ── Switch to authenticated role acting as tenant A ──────────────────────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"tenant_id":"00001500-0000-0000-0000-000000000001","app_role":"owner","role":"authenticated"}',
  true
);

-- Tenant A inserts its customer and first vehicle (should succeed)
insert into public.customers (id, tenant_id, name)
  values ('00001500-0000-0000-0000-000000000012', '00001500-0000-0000-0000-000000000001', 'A-Customer-15');

insert into public.vehicles (id, tenant_id, customer_id, plate_letters, plate_digits, plate_number)
  values ('00001500-0000-0000-0000-000000000022',
          '00001500-0000-0000-0000-000000000001',
          '00001500-0000-0000-0000-000000000012',
          'أبج', '123', 'أبج 123');

-- ── Assertions ───────────────────────────────────────────────────────────────

-- 1. Duplicate plate under tenant A is rejected with 23505 (unique-violation).
--    Relax the message arg (pass NULL) — assert only the SQLSTATE code.
select throws_ok(
  $$
    insert into public.vehicles (id, tenant_id, customer_id, plate_letters, plate_digits, plate_number)
    values ('00001500-0000-0000-0000-000000000023',
            '00001500-0000-0000-0000-000000000001',
            '00001500-0000-0000-0000-000000000012',
            'أبج', '123', 'أبج 123')
  $$,
  '23505',
  NULL,
  'duplicate plate rejected per tenant (SQLSTATE 23505)'
);

-- 2. Tenant B's vehicle with the same plate exists (seeded as superuser above) — 1 row.
--    While we're acting as tenant A, switch back to superuser for this count,
--    because RLS would hide B's vehicle from tenant A's session.
--    We do this by resetting role to postgres for the check, then restore.
--    Actually the simplest approach: just assert count for tenant_id B directly
--    as superuser within the same transaction (reset role first).
set local role postgres;
select is(
  (select count(*)::int
     from public.vehicles
    where tenant_id = '00001500-0000-0000-0000-000000000002'
      and plate_letters = 'أبج'
      and plate_digits  = '123'),
  1,
  'same plate under tenant B coexists (per-tenant uniqueness, not global)'
);

-- 3. Restore tenant A claims and confirm A sees exactly 1 vehicle for that plate (isolation).
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"tenant_id":"00001500-0000-0000-0000-000000000001","app_role":"owner","role":"authenticated"}',
  true
);
select is(
  (select count(*)::int
     from public.vehicles
    where plate_letters = 'أبج'
      and plate_digits  = '123'),
  1,
  'tenant A sees only its own vehicle for that plate (RLS isolation from B)'
);

select * from finish();
rollback;
