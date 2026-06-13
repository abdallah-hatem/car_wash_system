begin;
select plan(3);
select has_table('public', 'wash_orders', 'wash_orders table exists');
select has_table('public', 'payments', 'payments table exists');
select col_type_is('public', 'wash_orders', 'status', 'wash_status', 'status uses enum');
select * from finish();
rollback;
