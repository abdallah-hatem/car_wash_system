begin;
select plan(3);
select has_column('public', 'wash_orders', 'cancellation_reason', 'cancellation_reason exists');
select has_column('public', 'wash_orders', 'cancelled_at', 'cancelled_at exists');
insert into public.tenants (id,name) values ('00000000-0000-0000-0000-0000000ca001','C');
insert into public.branches (id,tenant_id,name) values ('00000000-0000-0000-0000-0000000cb001','00000000-0000-0000-0000-0000000ca001','B');
insert into public.wash_orders (id,tenant_id,branch_id,price,status)
  values ('00000000-0000-0000-0000-0000000cc001','00000000-0000-0000-0000-0000000ca001','00000000-0000-0000-0000-0000000cb001',50,'waiting');
update public.wash_orders set status='cancelled', cancellation_reason='customer left', cancelled_at=now()
  where id='00000000-0000-0000-0000-0000000cc001';
select is((select cancellation_reason from public.wash_orders where id='00000000-0000-0000-0000-0000000cc001'),
  'customer left', 'reason persists');
select * from finish();
rollback;
