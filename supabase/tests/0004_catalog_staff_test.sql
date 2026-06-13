begin;
select plan(2);
select has_table('public', 'packages', 'packages table exists');
select has_table('public', 'employees', 'employees table exists');
select * from finish();
rollback;
