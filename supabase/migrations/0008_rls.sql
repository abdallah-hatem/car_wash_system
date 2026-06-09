-- helper used only on platform tables
create function public.is_platform_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- current tenant from the JWT claim
create function public.current_tenant_id() returns uuid
  language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::uuid;
$$;

-- tenant-isolated tables: identical policy on each
do $$
declare t text;
begin
  foreach t in array array[
    'branches','profiles','customers','vehicles',
    'packages','employees','wash_orders','payments'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($f$
      create policy tenant_isolation on public.%I
        for all
        using      (tenant_id = public.current_tenant_id())
        with check (tenant_id = public.current_tenant_id());
    $f$, t);
  end loop;
end $$;

-- tenants table: tenant users read their own row; platform admin manages all
alter table public.tenants enable row level security;
create policy tenant_self_read on public.tenants for select
  using (id = public.current_tenant_id() or public.is_platform_admin());
create policy tenant_admin_manage on public.tenants for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- audit_log: read within tenant or as platform admin; no client writes (trigger only)
alter table public.audit_log enable row level security;
create policy audit_read on public.audit_log for select
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());
