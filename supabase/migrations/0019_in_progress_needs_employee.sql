-- A wash cannot be `in_progress` without an assigned staff member.
-- Business rule: starting a wash (waiting -> in_progress) must assign an employee.
--
-- Added NOT VALID so the migration never fails on legacy rows that pre-date the
-- rule (e.g. an in_progress wash started before this with no employee). The
-- constraint is still enforced on every INSERT/UPDATE going forward, so no new
-- or transitioned row can be in_progress without an employee. Done/cancelled
-- rows are unaffected (they keep whatever employee they had).
alter table public.wash_orders
  add constraint wash_orders_in_progress_needs_employee
  check (status <> 'in_progress' or assigned_employee_id is not null)
  not valid;
