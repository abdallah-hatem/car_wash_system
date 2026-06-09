create table public.wash_orders (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  branch_id            uuid not null references public.branches(id) on delete restrict,
  customer_id          uuid references public.customers(id) on delete set null,
  vehicle_id           uuid references public.vehicles(id) on delete set null,
  package_id           uuid references public.packages(id) on delete set null,
  assigned_employee_id uuid references public.employees(id) on delete set null,
  status               wash_status not null default 'waiting',
  price                numeric(10,2) not null,
  notes                text,
  created_at           timestamptz not null default now(),
  started_at           timestamptz,
  completed_at         timestamptz
);
create index wash_orders_queue_idx
  on public.wash_orders (tenant_id, branch_id, status, created_at);

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  wash_order_id uuid not null references public.wash_orders(id) on delete cascade,
  amount        numeric(10,2) not null,
  method        pay_method not null,
  paid_at       timestamptz not null default now()
);
create index payments_tenant_idx on public.payments (tenant_id, paid_at);
