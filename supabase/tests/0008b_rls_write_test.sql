begin;
select plan(1);

insert into public.tenants (id, name) values
  ('00000000-0000-0000-0000-00000000aaaa', 'A'),
  ('00000000-0000-0000-0000-00000000bbbb', 'B');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"tenant_id":"00000000-0000-0000-0000-00000000aaaa","role":"owner"}',
  true
);

select throws_ok(
  $$insert into public.customers (tenant_id, name)
     values ('00000000-0000-0000-0000-00000000bbbb', 'Mallory')$$,
  '42501',
  'new row violates row-level security policy for table "customers"',
  'cannot write into another tenant'
);

select * from finish();
rollback;
