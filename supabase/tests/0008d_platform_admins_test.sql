-- Privilege-escalation regression: an authenticated user with a tenant claim but
-- NO platform_admins row must NOT be able to insert itself as a platform admin,
-- and must NOT be able to read the admin roster.
begin;
select plan(2);

insert into public.tenants (id, name) values
  ('00000000-0000-0000-0000-00000000aaaa', 'A');

-- Seed a real auth.users row + an existing platform admin so the roster is non-empty.
insert into auth.users (instance_id, id, aud, role, email)
  values (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000f9',
    'authenticated',
    'authenticated',
    'realadmin@example.com'
  );
insert into public.platform_admins (user_id)
  values ('00000000-0000-0000-0000-0000000000f9');

-- Also seed the would-be attacker's auth.users row so the FK would otherwise succeed;
-- RLS, not the FK, must be what blocks the insert.
insert into auth.users (instance_id, id, aud, role, email)
  values (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000fa',
    'authenticated',
    'authenticated',
    'mallory@example.com'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"tenant_id":"00000000-0000-0000-0000-00000000aaaa","role":"owner"}',
  true
);

-- Exploit attempt: self-escalation to platform admin must be rejected by RLS.
select throws_ok(
  $$insert into public.platform_admins (user_id)
     values ('00000000-0000-0000-0000-0000000000fa')$$,
  '42501',
  null,
  'non-admin cannot insert itself as a platform admin'
);

-- A non-admin must not be able to read the roster. The table-level revoke means
-- even SELECT is denied (42501) before RLS is evaluated -- a strictly stronger
-- guarantee than "sees zero rows".
select throws_ok(
  $$select * from public.platform_admins$$,
  '42501',
  null,
  'non-admin cannot read the platform_admins roster'
);

select * from finish();
rollback;
