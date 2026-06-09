create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  phone       text,
  created_at  timestamptz not null default now()
);

create table public.vehicles (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  customer_id   uuid references public.customers(id) on delete set null,
  plate_number  text not null,
  make          text,
  model         text,
  color         text,
  created_at    timestamptz not null default now()
);
create index vehicles_tenant_plate_idx on public.vehicles (tenant_id, plate_number);
