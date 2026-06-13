-- Guard: every ordinary table in schema public MUST have RLS enabled, so a future
-- table can't silently ship unprotected (as platform_admins originally did).
begin;
select plan(1);

select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity = false),
  0,
  'every public table has RLS enabled'
);

select * from finish();
rollback;
