alter table public.wash_orders add column cancellation_reason text;
alter table public.wash_orders add column cancelled_at timestamptz;
