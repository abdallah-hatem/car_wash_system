begin;
select plan(4);
select has_table('public', 'packages', 'packages table exists');
select has_table('public', 'employees', 'employees table exists');
select has_column('public', 'packages', 'description', 'packages has a description column');
select col_is_null('public', 'packages', 'description', 'packages.description is nullable');
select * from finish();
rollback;
