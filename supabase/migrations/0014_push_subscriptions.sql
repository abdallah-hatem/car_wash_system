-- 0014_push_subscriptions.sql
-- Web push subscriptions (Phase 2 — PWA push notifications).
--
-- One row per browser/device push subscription. tenant_id and user_id are
-- filled server-side via column DEFAULTs (current_tenant_id() reads the JWT
-- tenant claim; auth.uid() the auth user) so the client only ever sends the
-- push fields (endpoint, p256dh, auth, lang, user_agent). RLS keeps each
-- tenant's subscriptions isolated; the notify-wash-event edge function reads
-- them with the service_role (bypassing RLS) to actually send pushes.

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  user_id     uuid not null default auth.uid(),
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  lang        text not null default 'en',
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index push_subscriptions_tenant_idx on public.push_subscriptions (tenant_id);

-- Tenant isolation (same shape as every other operational table).
alter table public.push_subscriptions enable row level security;
create policy tenant_isolation on public.push_subscriptions
  for all
  using      (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- New tables are no longer auto-exposed to the Data API roles (cloud default
-- flipped 2026-05-30), so grant explicitly. RLS above still scopes every row.
grant select, insert, update, delete on public.push_subscriptions to anon, authenticated;
