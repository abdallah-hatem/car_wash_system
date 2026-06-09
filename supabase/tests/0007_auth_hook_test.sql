begin;
select plan(4);

select has_function('public', 'custom_access_token_hook', 'hook function exists');

insert into public.tenants (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'T1');
insert into auth.users (instance_id, id, aud, role, email)
  values (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000f1',
    'authenticated',
    'authenticated',
    'u1@example.com'
  );
insert into public.profiles (user_id, tenant_id, role)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'owner');

select is(
  public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', '00000000-0000-0000-0000-0000000000f1',
      'claims', '{}'::jsonb
    )
  ) -> 'claims' ->> 'tenant_id',
  '00000000-0000-0000-0000-0000000000a1',
  'hook injects tenant_id claim from profile'
);

select is(
  public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', '00000000-0000-0000-0000-0000000000f1',
      'claims', '{}'::jsonb
    )
  ) -> 'claims' ->> 'role',
  'owner',
  'hook injects role claim from profile'
);

-- Edge case: a user with NO profile (e.g. a platform admin).
-- The hook must still return a valid event with is_platform_admin set
-- and simply omit tenant_id/role.
insert into auth.users (instance_id, id, aud, role, email)
  values (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000f2',
    'authenticated',
    'authenticated',
    'admin@example.com'
  );
insert into public.platform_admins (user_id)
  values ('00000000-0000-0000-0000-0000000000f2');

select is(
  public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', '00000000-0000-0000-0000-0000000000f2',
      'claims', '{}'::jsonb
    )
  ) -> 'claims' ->> 'is_platform_admin',
  'true',
  'hook sets is_platform_admin for profile-less platform admin'
);

select * from finish();
rollback;
