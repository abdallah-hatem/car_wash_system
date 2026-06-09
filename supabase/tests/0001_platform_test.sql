begin;
select plan(3);
select has_table('public', 'tenants', 'tenants table exists');
select has_table('public', 'platform_admins', 'platform_admins table exists');
select col_type_is('public', 'tenants', 'status', 'tenant_status', 'status uses enum');
select * from finish();
rollback;
