-- Track which branch a customer was first registered at (informational).
-- Customers remain TENANT-WIDE (visible across all branches) — this column does
-- not branch-scope them; it just records where they were created and is shown in
-- the customers list. Nullable: existing rows and customers created without a
-- branch stay NULL. `on delete set null` keeps the customer if its branch is removed.
-- The existing customers RLS (tenant-wide read, edit-gated write) is unchanged.
alter table public.customers
  add column branch_id uuid references public.branches(id) on delete set null;
