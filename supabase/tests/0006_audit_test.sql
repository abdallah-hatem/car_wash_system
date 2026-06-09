begin;
select plan(4);
select has_table('public', 'audit_log', 'audit_log table exists');
insert into public.tenants (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'T1');
insert into public.branches (id, tenant_id, name)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'B1');
insert into public.wash_orders (id, tenant_id, branch_id, price)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 50);
select is(
  (select count(*)::int from public.audit_log
     where table_name = 'wash_orders' and action = 'INSERT'),
  1,
  'insert on wash_orders writes one audit row'
);

update public.wash_orders set price = 75
  where id = (select id from public.wash_orders
              where tenant_id = '00000000-0000-0000-0000-0000000000a1' limit 1);
select is(
  (select count(*)::int from public.audit_log
     where table_name = 'wash_orders' and action = 'UPDATE'),
  1, 'update on wash_orders writes one audit row');

delete from public.wash_orders
  where tenant_id = '00000000-0000-0000-0000-0000000000a1';
select is(
  (select count(*)::int from public.audit_log
     where table_name = 'wash_orders' and action = 'DELETE'),
  1, 'delete on wash_orders writes one audit row');

select * from finish();
rollback;
