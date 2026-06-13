-- No-claim isolation: a role with NO tenant_id claim must see ZERO rows.
-- current_tenant_id() returns null, and `tenant_id = null` is never true,
-- so isolated tables must leak nothing to a claimless session.
begin;
select plan(3);

insert into public.tenants (id, name) values
  ('00000000-0000-0000-0000-00000000aaaa', 'A'),
  ('00000000-0000-0000-0000-00000000bbbb', 'B');
insert into public.customers (tenant_id, name) values
  ('00000000-0000-0000-0000-00000000aaaa', 'Alice'),
  ('00000000-0000-0000-0000-00000000bbbb', 'Bob');

set local role authenticated;

-- Case 1: no request.jwt.claims set at all -> current_tenant_id() is null.
select is(
  public.current_tenant_id(),
  null,
  'no claim yields null tenant'
);
select is(
  (select count(*)::int from public.customers),
  0,
  'claimless session sees zero customers'
);

-- Case 2: claims present but tenant_id empty string -> still null tenant.
select set_config(
  'request.jwt.claims',
  '{"tenant_id":"","role":"owner"}',
  true
);
select is(
  (select count(*)::int from public.customers),
  0,
  'empty tenant_id claim sees zero customers'
);

select * from finish();
rollback;
