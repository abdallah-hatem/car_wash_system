begin;
select plan(3);
select has_table('public', 'customers', 'customers table exists');
select has_table('public', 'vehicles', 'vehicles table exists');
select has_index('public', 'vehicles', 'vehicles_tenant_plate_idx', 'plate search index exists');
select * from finish();
rollback;
