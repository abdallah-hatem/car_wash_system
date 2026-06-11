-- 0010_tenant_setup_rls_test.sql
-- Verifies that branches, packages, and employees are RLS-isolated per tenant.
-- Tenant A inserts its own rows; tenant B's row is seeded as superuser.
-- Under tenant-A claims, only tenant-A rows are visible.
begin;
select plan(4);

-- ── Fixtures (superuser context) ─────────────────────────────────────────────
insert into public.tenants (id, name) values
  ('00000000-0000-0000-0000-00000000aa01', 'A'),
  ('00000000-0000-0000-0000-00000000bb02', 'B');

-- Seed a tenant-B branch as superuser so it exists but should be invisible to A
insert into public.branches (tenant_id, name)
  values ('00000000-0000-0000-0000-00000000bb02', 'B-branch');

-- ── Switch to authenticated role with tenant-A claims ────────────────────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"tenant_id":"00000000-0000-0000-0000-00000000aa01","role":"owner"}',
  true
);

-- Tenant A inserts its own data (should succeed under RLS)
insert into public.branches (tenant_id, name)
  values ('00000000-0000-0000-0000-00000000aa01', 'A-branch');

insert into public.packages (tenant_id, name, price)
  values ('00000000-0000-0000-0000-00000000aa01', 'Basic', 25);

insert into public.employees (tenant_id, name)
  values ('00000000-0000-0000-0000-00000000aa01', 'Sam');

-- ── Assertions ───────────────────────────────────────────────────────────────
select is(
  (select count(*)::int from public.branches),
  1,
  'tenant A sees only its own branch'
);

select is(
  (select count(*)::int from public.packages),
  1,
  'tenant A sees its package'
);

select is(
  (select count(*)::int from public.employees),
  1,
  'tenant A sees its employee'
);

select is(
  (select name from public.branches),
  'A-branch',
  'visible branch is A-branch'
);

select * from finish();
rollback;
