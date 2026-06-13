alter table public.vehicles add column plate_letters text;
alter table public.vehicles add column plate_digits  text;

-- Per-tenant uniqueness on the structured plate. Legacy rows have NULLs which
-- do not participate in the unique index. New rows must set both (app-enforced).
create unique index vehicles_tenant_plate_unique
  on public.vehicles (tenant_id, plate_letters, plate_digits);
