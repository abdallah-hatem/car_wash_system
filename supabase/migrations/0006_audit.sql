create table public.audit_log (
  id          bigint generated always as identity primary key,
  tenant_id   uuid,
  table_name  text not null,
  row_id      uuid,
  action      text not null,
  actor       uuid,
  at          timestamptz not null default now()
);
create index audit_log_tenant_idx on public.audit_log (tenant_id, at);

create function public.write_audit() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  rec record;
begin
  rec := coalesce(new, old);
  insert into public.audit_log (tenant_id, table_name, row_id, action, actor)
  values (rec.tenant_id, tg_table_name, rec.id, tg_op, auth.uid());
  return coalesce(new, old);
end;
$$;

create trigger audit_wash_orders
  after insert or update or delete on public.wash_orders
  for each row execute function public.write_audit();

create trigger audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.write_audit();

create trigger audit_customers
  after insert or update or delete on public.customers
  for each row execute function public.write_audit();
