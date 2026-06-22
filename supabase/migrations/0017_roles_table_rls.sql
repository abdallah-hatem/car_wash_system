-- =============================================================================
-- Roles & permissions — operational table RLS
-- Replace each table's single tenant_isolation (FOR ALL) policy with explicit
-- per-command policies that add branch scoping (reads) and edit-permission gating
-- (writes). Owner short-circuits every predicate, so owner behavior is unchanged.
-- See docs/superpowers/specs/2026-06-17-roles-permissions-design.md §6
-- =============================================================================

-- ---- branches: owner sees all; member sees only assigned branches. Writes owner-only. ----
drop policy if exists tenant_isolation on public.branches;
create policy branches_select on public.branches for select
  using (tenant_id = public.current_tenant_id()
         and (public.current_app_role() = 'owner' or id = any(public.current_branch_ids())));
create policy branches_insert on public.branches for insert
  with check (tenant_id = public.current_tenant_id() and public.current_app_role() = 'owner');
create policy branches_update on public.branches for update
  using      (tenant_id = public.current_tenant_id() and public.current_app_role() = 'owner')
  with check (tenant_id = public.current_tenant_id() and public.current_app_role() = 'owner');
create policy branches_delete on public.branches for delete
  using (tenant_id = public.current_tenant_id() and public.current_app_role() = 'owner');

-- ---- customers: tenant-wide read; write requires can_edit('customers') ----
drop policy if exists tenant_isolation on public.customers;
create policy customers_select on public.customers for select
  using (tenant_id = public.current_tenant_id());
create policy customers_insert on public.customers for insert
  with check (tenant_id = public.current_tenant_id() and public.can_edit('customers'));
create policy customers_update on public.customers for update
  using      (tenant_id = public.current_tenant_id() and public.can_edit('customers'))
  with check (tenant_id = public.current_tenant_id() and public.can_edit('customers'));
create policy customers_delete on public.customers for delete
  using (tenant_id = public.current_tenant_id() and public.can_edit('customers'));

-- ---- vehicles: tenant-wide read; write requires can_edit('customers') ----
drop policy if exists tenant_isolation on public.vehicles;
create policy vehicles_select on public.vehicles for select
  using (tenant_id = public.current_tenant_id());
create policy vehicles_insert on public.vehicles for insert
  with check (tenant_id = public.current_tenant_id() and public.can_edit('customers'));
create policy vehicles_update on public.vehicles for update
  using      (tenant_id = public.current_tenant_id() and public.can_edit('customers'))
  with check (tenant_id = public.current_tenant_id() and public.can_edit('customers'));
create policy vehicles_delete on public.vehicles for delete
  using (tenant_id = public.current_tenant_id() and public.can_edit('customers'));

-- ---- packages: tenant-wide read; write requires can_edit('packages') ----
drop policy if exists tenant_isolation on public.packages;
create policy packages_select on public.packages for select
  using (tenant_id = public.current_tenant_id());
create policy packages_insert on public.packages for insert
  with check (tenant_id = public.current_tenant_id() and public.can_edit('packages'));
create policy packages_update on public.packages for update
  using      (tenant_id = public.current_tenant_id() and public.can_edit('packages'))
  with check (tenant_id = public.current_tenant_id() and public.can_edit('packages'));
create policy packages_delete on public.packages for delete
  using (tenant_id = public.current_tenant_id() and public.can_edit('packages'));

-- ---- employees: branch-scoped read; write requires branch access + can_edit('staff') ----
drop policy if exists tenant_isolation on public.employees;
create policy employees_select on public.employees for select
  using (tenant_id = public.current_tenant_id() and public.can_access_branch(branch_id));
create policy employees_insert on public.employees for insert
  with check (tenant_id = public.current_tenant_id()
              and public.can_access_branch(branch_id) and public.can_edit('staff'));
create policy employees_update on public.employees for update
  using      (tenant_id = public.current_tenant_id()
              and public.can_access_branch(branch_id) and public.can_edit('staff'))
  with check (tenant_id = public.current_tenant_id()
              and public.can_access_branch(branch_id) and public.can_edit('staff'));
create policy employees_delete on public.employees for delete
  using (tenant_id = public.current_tenant_id()
         and public.can_access_branch(branch_id) and public.can_edit('staff'));

-- ---- wash_orders: branch-scoped read; write requires branch access + can_edit('queue') ----
drop policy if exists tenant_isolation on public.wash_orders;
create policy wash_orders_select on public.wash_orders for select
  using (tenant_id = public.current_tenant_id() and public.can_access_branch(branch_id));
create policy wash_orders_insert on public.wash_orders for insert
  with check (tenant_id = public.current_tenant_id()
              and public.can_access_branch(branch_id) and public.can_edit('queue'));
create policy wash_orders_update on public.wash_orders for update
  using      (tenant_id = public.current_tenant_id()
              and public.can_access_branch(branch_id) and public.can_edit('queue'))
  with check (tenant_id = public.current_tenant_id()
              and public.can_access_branch(branch_id) and public.can_edit('queue'));
create policy wash_orders_delete on public.wash_orders for delete
  using (tenant_id = public.current_tenant_id()
         and public.can_access_branch(branch_id) and public.can_edit('queue'));

-- ---- payments: scoped through the parent wash_order's branch; write requires can_edit('queue') ----
drop policy if exists tenant_isolation on public.payments;
create policy payments_select on public.payments for select
  using (tenant_id = public.current_tenant_id() and exists (
    select 1 from public.wash_orders wo
     where wo.id = payments.wash_order_id and public.can_access_branch(wo.branch_id)));
create policy payments_insert on public.payments for insert
  with check (tenant_id = public.current_tenant_id() and public.can_edit('queue') and exists (
    select 1 from public.wash_orders wo
     where wo.id = payments.wash_order_id and public.can_access_branch(wo.branch_id)));
create policy payments_update on public.payments for update
  using      (tenant_id = public.current_tenant_id() and public.can_edit('queue') and exists (
    select 1 from public.wash_orders wo
     where wo.id = payments.wash_order_id and public.can_access_branch(wo.branch_id)))
  with check (tenant_id = public.current_tenant_id() and public.can_edit('queue') and exists (
    select 1 from public.wash_orders wo
     where wo.id = payments.wash_order_id and public.can_access_branch(wo.branch_id)));
create policy payments_delete on public.payments for delete
  using (tenant_id = public.current_tenant_id() and public.can_edit('queue') and exists (
    select 1 from public.wash_orders wo
     where wo.id = payments.wash_order_id and public.can_access_branch(wo.branch_id)));
