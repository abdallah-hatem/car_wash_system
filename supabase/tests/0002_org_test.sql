begin;
select plan(3);
select has_table('public', 'branches', 'branches table exists');
select has_table('public', 'profiles', 'profiles table exists');
select col_type_is('public', 'profiles', 'role', 'tenant_role', 'profiles.role uses enum');
select * from finish();
rollback;
