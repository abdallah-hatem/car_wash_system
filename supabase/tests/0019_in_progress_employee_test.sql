-- 0019_in_progress_employee_test.sql
-- A wash cannot be in_progress without an assigned staff member
-- (CHECK constraint wash_orders_in_progress_needs_employee, migration 0019).
-- Constraints apply regardless of role, so this runs in the default (superuser)
-- context — no RLS claims needed.
begin;
select plan(3);

insert into public.tenants (id, name) values
  ('00000000-0000-0000-0000-000000001901', 'Tenant-19');
insert into public.branches (id, tenant_id, name) values
  ('00000000-0000-0000-0000-000000001911', '00000000-0000-0000-0000-000000001901', 'Branch-19');
insert into public.employees (id, tenant_id, branch_id, name) values
  ('00000000-0000-0000-0000-000000001921', '00000000-0000-0000-0000-000000001901',
   '00000000-0000-0000-0000-000000001911', 'Worker-19');

-- A waiting wash with no employee is fine (constraint only bites at in_progress).
insert into public.wash_orders (id, tenant_id, branch_id, status, price) values
  ('00000000-0000-0000-0000-000000001931', '00000000-0000-0000-0000-000000001901',
   '00000000-0000-0000-0000-000000001911', 'waiting', 40.00);

-- 1. A waiting wash without an employee is allowed.
select is(
  (select status::text from public.wash_orders where id = '00000000-0000-0000-0000-000000001931'),
  'waiting',
  'a waiting wash without an assigned employee is allowed'
);

-- 2. Cannot advance to in_progress without an assigned employee (CHECK 23514).
select throws_ok(
  $$update public.wash_orders
       set status = 'in_progress', started_at = now()
     where id = '00000000-0000-0000-0000-000000001931'$$,
  '23514',
  null,
  'wash cannot go in_progress without an assigned employee'
);

-- 3. Can advance to in_progress once an employee is assigned.
select lives_ok(
  $$update public.wash_orders
       set status = 'in_progress', started_at = now(),
           assigned_employee_id = '00000000-0000-0000-0000-000000001921'
     where id = '00000000-0000-0000-0000-000000001931'$$,
  'wash can go in_progress with an assigned employee'
);

select * from finish();
rollback;
