begin;
select plan(3);

-- ── Fixtures ─────────────────────────────────────────────────
-- Active tenant + user
insert into public.tenants (id, name, status)
  values ('00000000-0000-0000-0000-00000000ac01', 'Active Co', 'active');

insert into auth.users (instance_id, id, aud, role, email)
  values (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-00000000af01',
    'authenticated', 'authenticated', 'active.user@test.local'
  );

insert into public.profiles (user_id, tenant_id, role)
  values ('00000000-0000-0000-0000-00000000af01', '00000000-0000-0000-0000-00000000ac01', 'owner');

-- Suspended tenant + user
insert into public.tenants (id, name, status)
  values ('00000000-0000-0000-0000-00000000ac02', 'Suspended Co', 'suspended');

insert into auth.users (instance_id, id, aud, role, email)
  values (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-00000000af02',
    'authenticated', 'authenticated', 'suspended.user@test.local'
  );

insert into public.profiles (user_id, tenant_id, role)
  values ('00000000-0000-0000-0000-00000000af02', '00000000-0000-0000-0000-00000000ac02', 'owner');

-- ── Test 1: active tenant user gets tenant_id injected ────────
select is(
  public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', '00000000-0000-0000-0000-00000000af01',
      'claims', '{}'::jsonb
    )
  ) -> 'claims' ->> 'tenant_id',
  '00000000-0000-0000-0000-00000000ac01',
  'active tenant user: hook injects tenant_id claim'
);

-- ── Test 2: suspended tenant user gets NULL tenant_id ─────────
select is(
  (
    public.custom_access_token_hook(
      jsonb_build_object(
        'user_id', '00000000-0000-0000-0000-00000000af02',
        'claims', '{}'::jsonb
      )
    ) -> 'claims'
  ) ->> 'tenant_id',
  null,
  'suspended tenant user: tenant_id claim is NULL'
);

-- ── Test 3: suspended tenant user gets is_platform_admin false ─
select is(
  public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', '00000000-0000-0000-0000-00000000af02',
      'claims', '{}'::jsonb
    )
  ) -> 'claims' ->> 'is_platform_admin',
  'false',
  'suspended tenant user: is_platform_admin claim is false'
);

select * from finish();
rollback;
