create type tenant_status as enum ('active', 'suspended');
create type tenant_role   as enum ('owner', 'manager');
create type wash_status   as enum ('waiting', 'in_progress', 'done', 'cancelled');
create type pay_method    as enum ('cash', 'card', 'transfer');

create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  status      tenant_status not null default 'active',
  created_at  timestamptz not null default now()
);

create table public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
