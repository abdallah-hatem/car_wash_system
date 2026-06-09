-- =============================================================
-- Seed: local dev logins
-- Applied by: npx supabase db reset
-- Idempotent: on conflict do nothing throughout
-- =============================================================

-- ── Platform admin user ───────────────────────────────────────
-- id: 00000000-0000-0000-0000-0000000ad617
-- email: admin@sudsly.test / password: admin123

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000ad617',
  'authenticated',
  'authenticated',
  'admin@sudsly.test',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  '',
  '',
  '',
  ''
) on conflict (id) do nothing;

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  gen_random_uuid(),
  'admin@sudsly.test',
  '00000000-0000-0000-0000-0000000ad617',
  jsonb_build_object('sub', '00000000-0000-0000-0000-0000000ad617', 'email', 'admin@sudsly.test'),
  'email',
  now(),
  now(),
  now()
) on conflict (provider_id, provider) do nothing;

insert into public.platform_admins (user_id)
values ('00000000-0000-0000-0000-0000000ad617')
on conflict (user_id) do nothing;

-- ── Demo tenant ───────────────────────────────────────────────
-- tenant id: 00000000-0000-0000-0000-00000000de70

insert into public.tenants (id, name, status)
values ('00000000-0000-0000-0000-00000000de70', 'Demo Carwash', 'active')
on conflict (id) do nothing;

-- ── Demo tenant owner ─────────────────────────────────────────
-- id: 00000000-0000-0000-0000-00000000be71
-- email: owner@demo.test / password: password123

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000be71',
  'authenticated',
  'authenticated',
  'owner@demo.test',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Demo Owner"}'::jsonb,
  '',
  '',
  '',
  ''
) on conflict (id) do nothing;

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  gen_random_uuid(),
  'owner@demo.test',
  '00000000-0000-0000-0000-00000000be71',
  jsonb_build_object('sub', '00000000-0000-0000-0000-00000000be71', 'email', 'owner@demo.test'),
  'email',
  now(),
  now(),
  now()
) on conflict (provider_id, provider) do nothing;

insert into public.profiles (user_id, tenant_id, role, full_name)
values (
  '00000000-0000-0000-0000-00000000be71',
  '00000000-0000-0000-0000-00000000de70',
  'owner',
  'Demo Owner'
) on conflict (user_id) do nothing;

-- ── Demo branch ───────────────────────────────────────────────

insert into public.branches (tenant_id, name)
select '00000000-0000-0000-0000-00000000de70', 'Main Branch'
where not exists (
  select 1 from public.branches
  where tenant_id = '00000000-0000-0000-0000-00000000de70'
    and name = 'Main Branch'
);
