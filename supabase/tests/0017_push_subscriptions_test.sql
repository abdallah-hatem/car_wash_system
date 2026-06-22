-- 0017_push_subscriptions_test.sql
-- Verifies push_subscriptions: server-side tenant_id/user_id defaults, RLS
-- tenant isolation, and the unique-endpoint constraint.
--
-- Tenant B's subscription is seeded as SUPERUSER (with an explicit tenant_id)
-- before the role switch, so it exists in the DB but must be invisible to the
-- tenant-A authenticated session. Assertions are scoped by endpoint / tenant
-- (never a global count) per the repo's pgTAP rules.
begin;
select plan(4);

-- ── Fixtures (superuser context) ─────────────────────────────────────────────
insert into public.tenants (id, name) values
  ('00000000-0000-0000-0000-000000001701', 'Tenant-A-17'),
  ('00000000-0000-0000-0000-000000001702', 'Tenant-B-17');

-- Tenant B's subscription, seeded as superuser (invisible to A under RLS).
insert into public.push_subscriptions (id, tenant_id, user_id, endpoint, p256dh, auth) values
  ('00000000-0000-0000-0000-000000001721',
   '00000000-0000-0000-0000-000000001702',
   '00000000-0000-0000-0000-0000000b1702',
   'https://push.example/endpoint-B-17', 'p256dh-B', 'auth-B');

-- ── Switch to authenticated role with tenant-A claims (incl. sub for auth.uid) ─
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"tenant_id":"00000000-0000-0000-0000-000000001701","sub":"00000000-0000-0000-0000-0000000a1701","app_role":"owner","role":"authenticated"}',
  true
);

-- Tenant A inserts a subscription supplying ONLY the push fields — tenant_id
-- and user_id must be filled by the column DEFAULTs (current_tenant_id/auth.uid).
insert into public.push_subscriptions (endpoint, p256dh, auth, lang, user_agent)
values ('https://push.example/endpoint-A-17', 'p256dh-A', 'auth-A', 'ar', 'pgTAP-UA');

-- 1. The defaulted tenant_id resolved to tenant A's id.
select is(
  (select tenant_id from public.push_subscriptions
    where endpoint = 'https://push.example/endpoint-A-17'),
  '00000000-0000-0000-0000-000000001701'::uuid,
  'tenant_id default resolves to current_tenant_id() (tenant A)'
);

-- 2. The defaulted user_id resolved to auth.uid() (the sub claim).
select is(
  (select user_id from public.push_subscriptions
    where endpoint = 'https://push.example/endpoint-A-17'),
  '00000000-0000-0000-0000-0000000a1701'::uuid,
  'user_id default resolves to auth.uid() (the sub claim)'
);

-- 3. RLS isolation: tenant A cannot see tenant B's subscription row.
select is(
  (select count(*)::int from public.push_subscriptions
    where endpoint = 'https://push.example/endpoint-B-17'),
  0,
  'tenant A cannot see tenant B''s subscription (RLS isolation)'
);

-- 4. Duplicate endpoint is rejected with unique_violation (SQLSTATE 23505).
select throws_ok(
  $$ insert into public.push_subscriptions (endpoint, p256dh, auth)
       values ('https://push.example/endpoint-A-17', 'dup-p256dh', 'dup-auth') $$,
  '23505',
  null,
  'duplicate endpoint is rejected (unique_violation 23505)'
);

select * from finish();
rollback;
