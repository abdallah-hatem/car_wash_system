begin;
select plan(5);
select has_table('public', 'customers', 'customers table exists');
select has_table('public', 'vehicles', 'vehicles table exists');
select has_index('public', 'vehicles', 'vehicles_tenant_plate_idx', 'plate search index exists');
select has_column('public', 'customers', 'branch_id', 'customers has a created-at branch_id column');
select col_is_null('public', 'customers', 'branch_id', 'customers.branch_id is nullable');
select * from finish();
rollback;
