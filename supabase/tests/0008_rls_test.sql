begin;
select plan(2);

insert into public.tenants (id, name) values
  ('00000000-0000-0000-0000-00000000aaaa', 'A'),
  ('00000000-0000-0000-0000-00000000bbbb', 'B');
insert into public.customers (tenant_id, name) values
  ('00000000-0000-0000-0000-00000000aaaa', 'Alice'),
  ('00000000-0000-0000-0000-00000000bbbb', 'Bob');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"tenant_id":"00000000-0000-0000-0000-00000000aaaa","role":"owner"}',
  true
);

select is(
  (select count(*)::int from public.customers),
  1,
  'tenant A sees only its own customer'
);
select is(
  (select name from public.customers),
  'Alice',
  'the visible customer belongs to tenant A'
);

select * from finish();
rollback;
