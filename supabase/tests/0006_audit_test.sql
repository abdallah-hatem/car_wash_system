begin;
select plan(2);
select has_table('public', 'audit_log', 'audit_log table exists');
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
