-- Restore Data API table privileges for the anon + authenticated roles.
--
-- The operational tables (branches, customers, vehicles, packages, employees,
-- wash_orders, payments, profiles, user_branches, tenants, platform_admins,
-- audit_log) were created relying on Supabase's historical default of
-- auto-granting privileges to anon/authenticated. That default was removed for
-- projects created after 2026-05-30 (see migration 0014's note), so on a fresh
-- local stack / new environment these tables have NO grants and the app — and the
-- RLS pgTAP suite — fail with "permission denied for table ...".
--
-- Cloud projects (staging/prod) were created before the flip and already carry
-- these grants, so this migration is a harmless idempotent no-op there.
--
-- SECURITY: every public table has RLS enabled, so row access is still fully
-- governed by RLS. These grants only restore table-level access so RLS can run.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- Preserve the one deliberate exception: platform_admins is revoked from the API
-- roles on purpose (migration 0008, regression-tested in 0008d) so the admin
-- roster is denied at the privilege level — a stronger guarantee than RLS alone.
-- The blanket grant above re-granted it, so revoke it again here.
revoke all on public.platform_admins from anon, authenticated;
