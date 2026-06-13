create table public.branches (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  address     text,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  role        tenant_role not null default 'manager',
  full_name   text,
  created_at  timestamptz not null default now()
);
create index profiles_tenant_idx on public.profiles (tenant_id);
