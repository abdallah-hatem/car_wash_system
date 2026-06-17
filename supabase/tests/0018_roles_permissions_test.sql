-- 0018_roles_permissions_test.sql
-- Branch-scoped roles & permissions: user_branches table, JWT helpers, auth-hook
-- claim injection, branch-scoped reads, and edit-permission write gating.
-- Fixtures are seeded as SUPERUSER, then we switch to the authenticated role with
-- a crafted "manager" claim (one branch, mixed permissions) and assert RLS behavior.
begin;
select plan(21);

-- ── Fixtures (superuser) ─────────────────────────────────────────────────────
insert into public.tenants (id, name) values
  ('00000000-0000-0000-0000-000000001800', 'Tenant-18');

insert into public.branches (id, tenant_id, name) values
  ('00000000-0000-0000-0000-0000000018a0', '00000000-0000-0000-0000-000000001800', 'Branch-A-18'),
  ('00000000-0000-0000-0000-0000000018b0', '00000000-0000-0000-0000-000000001800', 'Branch-B-18');

-- member user (assigned to Branch A) + a deactivated user
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000018f1', 'authenticated', 'authenticated', 'member18@example.com'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000018f2', 'authenticated', 'authenticated', 'inactive18@example.com');

insert into public.profiles (user_id, tenant_id, role, permissions, is_active) values
  ('00000000-0000-0000-0000-0000000018f1', '00000000-0000-0000-0000-000000001800', 'manager',
   '{"queue":"edit","packages":"view","customers":"edit"}'::jsonb, true),
  ('00000000-0000-0000-0000-0000000018f2', '00000000-0000-0000-0000-000000001800', 'manager',
   '{}'::jsonb, false);

insert into public.user_branches (tenant_id, user_id, branch_id) values
  ('00000000-0000-0000-0000-000000001800', '00000000-0000-0000-0000-0000000018f1', '00000000-0000-0000-0000-0000000018a0');

-- one wash_order + employee per branch (Branch B's must be invisible to the member)
insert into public.wash_orders (id, tenant_id, branch_id, status, price) values
  ('00000000-0000-0000-0000-0000000018c1', '00000000-0000-0000-0000-000000001800', '00000000-0000-0000-0000-0000000018a0', 'waiting', 30),
  ('00000000-0000-0000-0000-0000000018c2', '00000000-0000-0000-0000-000000001800', '00000000-0000-0000-0000-0000000018b0', 'waiting', 40);
insert into public.employees (id, tenant_id, branch_id, name) values
  ('00000000-0000-0000-0000-0000000018e1', '00000000-0000-0000-0000-000000001800', '00000000-0000-0000-0000-0000000018a0', 'Emp-A'),
  ('00000000-0000-0000-0000-0000000018e2', '00000000-0000-0000-0000-000000001800', '00000000-0000-0000-0000-0000000018b0', 'Emp-B');

-- ── Part 1: structure ─────────────────────────────────────────────────────────
select has_table('public', 'user_branches', 'user_branches table exists');
select has_column('public', 'user_branches', 'branch_id', 'user_branches has branch_id');

-- ── Part 2: auth hook injects the new claims + respects is_active (superuser) ──
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '00000000-0000-0000-0000-0000000018f1', 'claims', '{}'::jsonb)) -> 'claims' ->> 'app_role',
  'manager', 'hook injects app_role=manager for the member');
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '00000000-0000-0000-0000-0000000018f1', 'claims', '{}'::jsonb)) -> 'claims' -> 'permissions' ->> 'queue',
  'edit', 'hook injects the member permission map');
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '00000000-0000-0000-0000-0000000018f1', 'claims', '{}'::jsonb)) -> 'claims' -> 'branch_ids',
  '["00000000-0000-0000-0000-0000000018a0"]'::jsonb, 'hook injects branch_ids from user_branches');
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '00000000-0000-0000-0000-0000000018f2', 'claims', '{}'::jsonb)) -> 'claims' ->> 'tenant_id',
  null, 'hook withholds tenant_id for a deactivated member');

-- ── Switch to the member (authenticated role, crafted manager claim) ──────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"tenant_id":"00000000-0000-0000-0000-000000001800","app_role":"manager",' ||
  '"branch_ids":["00000000-0000-0000-0000-0000000018a0"],' ||
  '"permissions":{"queue":"edit","packages":"view","customers":"edit"},"role":"authenticated"}',
  true);

-- ── Part 3: helper functions read the claim correctly ─────────────────────────
select is(public.current_app_role(), 'manager', 'current_app_role() reads app_role');
select is(public.current_branch_ids(), array['00000000-0000-0000-0000-0000000018a0']::uuid[], 'current_branch_ids() parses the JWT array');
select is(public.current_permission('queue'), 'edit', 'current_permission() reads a set tab');
select is(public.current_permission('staff'), 'none', 'current_permission() defaults missing tab to none');
select ok(public.can_access_branch('00000000-0000-0000-0000-0000000018a0'), 'can_access_branch true for an assigned branch');
select ok(not public.can_access_branch('00000000-0000-0000-0000-0000000018b0'), 'can_access_branch false for an unassigned branch');
select ok(public.can_edit('queue'), 'can_edit true where permission is edit');
select ok(not public.can_edit('packages'), 'can_edit false where permission is only view');

-- ── Part 4: branch-scoped reads ───────────────────────────────────────────────
select is((select count(*)::int from public.wash_orders), 1, 'member sees only their branch wash_orders');
select is((select count(*)::int from public.employees), 1, 'member sees only their branch employees');

-- ── Part 5: write-permission gating ───────────────────────────────────────────
select lives_ok(
  $$insert into public.wash_orders (tenant_id, branch_id, status, price)
    values ('00000000-0000-0000-0000-000000001800','00000000-0000-0000-0000-0000000018a0','waiting',15)$$,
  'member with queue:edit can create a wash in their branch');
select throws_ok(
  $$insert into public.wash_orders (tenant_id, branch_id, status, price)
    values ('00000000-0000-0000-0000-000000001800','00000000-0000-0000-0000-0000000018b0','waiting',15)$$,
  '42501', 'new row violates row-level security policy for table "wash_orders"',
  'member cannot create a wash in a branch they do not manage');
select throws_ok(
  $$insert into public.packages (tenant_id, name, price)
    values ('00000000-0000-0000-0000-000000001800','Sneaky',5)$$,
  '42501', 'new row violates row-level security policy for table "packages"',
  'member with packages:view cannot create a package');
select throws_ok(
  $$insert into public.employees (tenant_id, branch_id, name)
    values ('00000000-0000-0000-0000-000000001800','00000000-0000-0000-0000-0000000018a0','Nope')$$,
  '42501', 'new row violates row-level security policy for table "employees"',
  'member with staff:none cannot create an employee');
select lives_ok(
  $$insert into public.customers (tenant_id, name)
    values ('00000000-0000-0000-0000-000000001800','Walk-in')$$,
  'member with customers:edit can create a customer');

select * from finish();
rollback;
