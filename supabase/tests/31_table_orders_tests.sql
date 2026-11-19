\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–30. Table QR step 2: diners order from the phone (a waiter confirms),
-- see the bill and pay it with an M-Pesa prompt. Everything stays inside one hotel.
create or replace function pg_temp.as_user(_id uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(_id::text,''), false);
  execute case when _id is null then 'set role anon' else 'set role authenticated' end; end $$;
create or replace function pg_temp.expect_fail(_sql text, _label text) returns void language plpgsql as $$
begin
  begin execute _sql; exception when others then raise notice 'PASS (blocked) %: %', _label, sqlerrm; return; end;
  raise exception 'FAIL: % was allowed', _label;
end $$;
create or replace function pg_temp.expect(_cond boolean, _label text) returns void language plpgsql as $$
begin if not coalesce(_cond, false) then raise exception 'FAIL: %', _label; end if; raise notice 'PASS %', _label; end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
reset role;

-- a restaurant with a table, two dishes (one needs a waiter's choice) and M-Pesa set up
create temp table q as select id h from public.hotels where name = 'Olsupat Lodge';
insert into pos_outlets (hotel_id, name, kind) values ((select h from q), 'Order Garden', 'restaurant');
insert into pos_tables (hotel_id, outlet_id, name) select (select h from q), id, 'O1' from pos_outlets where name = 'Order Garden';
insert into menu_categories (hotel_id, name) values ((select h from q), 'Order Mains') on conflict do nothing;
insert into menu_items (hotel_id, category_id, name, price) select (select h from q), id, 'Tilapia', 1200 from menu_categories where hotel_id = (select h from q) and name = 'Order Mains';
insert into menu_items (hotel_id, category_id, name, price) select (select h from q), id, 'Steak', 2000 from menu_categories where hotel_id = (select h from q) and name = 'Order Mains';
insert into modifier_groups (hotel_id, name, min_choices, max_choices) values ((select h from q), 'Cooked', 1, 1);
insert into modifier_options (group_id, name) select id, 'Medium' from modifier_groups where name = 'Cooked' and hotel_id = (select h from q);
insert into menu_item_modifier_groups (item_id, group_id) select i.id, g.id from menu_items i, modifier_groups g where i.name = 'Steak' and g.name = 'Cooked' and g.hotel_id = (select h from q);
insert into mpesa_settings (hotel_id, enabled, shortcode) values ((select h from q), true, '174379') on conflict (hotel_id) do update set enabled = true, shortcode = '174379';
insert into mpesa_credentials (hotel_id, consumer_key, consumer_secret, passkey) values ((select h from q), 'k', 's', 'p') on conflict (hotel_id) do update set consumer_key = 'k', consumer_secret = 's', passkey = 'p';
create temp table qt as select l.token, t.id table_id, o.id outlet_id from table_links l join pos_tables t on t.id = l.table_id join pos_outlets o on o.id = t.outlet_id where o.name = 'Order Garden';
create temp table qi as select id, name from menu_items where hotel_id = (select h from q) and name in ('Tilapia', 'Steak');
grant select on q, qt, qi to anon, authenticated;

-- Off by default
select pg_temp.as_user(null);
select pg_temp.expect(not (public.public_table((select token from qt))->>'can_order')::boolean, 'phone ordering is off by default');
select pg_temp.expect_fail($$select public.public_table_order((select token from qt), jsonb_build_array(jsonb_build_object('menu_item_id', (select id from qi where name = 'Tilapia'), 'qty', 1)))$$, 'ordering while switched off');
select pg_temp.expect_fail($$select public.table_qr_set_outlet_options((select outlet_id from qt), true, true)$$, 'a visitor switching ordering on');

-- The manager switches ordering and paying on
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.table_qr_set_outlet_options((select outlet_id from qt), true, true);

-- The diner orders; prices come from the menu, not from the phone
select pg_temp.as_user(null);
select pg_temp.expect((public.public_table((select token from qt))->>'can_pay')::boolean, 'paying from the phone is on (M-Pesa set up)');
select pg_temp.expect_fail($$select public.public_table_order((select token from qt), jsonb_build_array(jsonb_build_object('menu_item_id', (select id from qi where name = 'Steak'), 'qty', 1)))$$, 'an item that needs a waiter''s choice');
select pg_temp.expect_fail($$select public.public_table_order((select token from qt), jsonb_build_array(jsonb_build_object('menu_item_id', (select id from qi where name = 'Tilapia'), 'qty', 99)))$$, '99 of one item');
select public.public_table_order((select token from qt), jsonb_build_array(jsonb_build_object('menu_item_id', (select id from qi where name = 'Tilapia'), 'qty', 2, 'price', 1)), 'No chilli');
select pg_temp.expect((public.public_table((select token from qt))->'order'->>'total')::numeric = 2400, 'total from menu prices (the phone''s price is ignored)');
select pg_temp.expect_fail($$select public.public_table_order((select token from qt), jsonb_build_array(jsonb_build_object('menu_item_id', (select id from qi where name = 'Tilapia'), 'qty', 1)))$$, 'a second order while one is waiting');
select pg_temp.expect_fail($$select * from table_orders$$, 'anon reading orders directly');
select pg_temp.expect_fail($$select public.public_table_mpesa((select token from qt), '0712345678')$$, 'paying before there is a bill');

-- The waiter confirms: it lands on the table's POS bill and goes to the kitchen
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect(public.table_qr_board((select h from q))::text like '%Tilapia%', 'pending order on the live table map');
select public.table_order_decide((select id from table_orders where table_id = (select table_id from qt) and status = 'pending'), true);
select pg_temp.expect((select total from pos_orders where table_id = (select table_id from qt) and status = 'open') >= 2400, 'POS bill opened for the table');
select pg_temp.expect((select bool_and(i.status = 'sent') from pos_order_items i join pos_orders o on o.id = i.order_id where o.table_id = (select table_id from qt) and o.status = 'open'), 'items sent to the kitchen');
select pg_temp.expect_fail($$select public.table_order_decide((select id from table_orders where table_id = (select table_id from qt) order by created_at desc limit 1), true)$$, 'confirming the same order twice');

-- The diner sees the bill and pays with M-Pesa
select pg_temp.as_user(null);
select pg_temp.expect((public.public_table((select token from qt))->'bill'->>'due')::numeric >= 2400, 'diner sees the amount due');
select pg_temp.expect_fail($$select public.public_table_mpesa((select token from qt), '12345')$$, 'not a Safaricom number');
create temp table qp as select public.public_table_mpesa((select token from qt), '0712 345 678') p;
reset role;
select pg_temp.expect((select amount from mpesa_requests where id = (select (p->>'id')::uuid from qp)) = (select ceil(total - paid_total) from pos_orders where table_id = (select table_id from qt) and status = 'open'), 'prompt for the whole amount due');
update mpesa_requests set status = 'sent', checkout_request_id = 'ws_CO_TEST_TABLE' where id = (select (p->>'id')::uuid from qp);
select public.mpesa_result('ws_CO_TEST_TABLE', null, 0, 'ok', 'TBL1234567', (select amount from mpesa_requests where id = (select (p->>'id')::uuid from qp)), '254712345678');
select pg_temp.expect((select status from pos_orders where id = (select pos_order_id from mpesa_requests where id = (select (p->>'id')::uuid from qp))) = 'paid', 'bill paid by M-Pesa from the phone');

-- A rejected order, with a reason the diner sees
select pg_temp.as_user(null);
select public.public_table_order((select token from qt), jsonb_build_array(jsonb_build_object('menu_item_id', (select id from qi where name = 'Tilapia'), 'qty', 1)));
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.table_order_decide((select id from table_orders where table_id = (select table_id from qt) and status = 'pending'), false, 'Kitchen closed');
select pg_temp.as_user(null);
select pg_temp.expect((public.public_table((select token from qt))->'order'->>'reason') = 'Kitchen closed', 'diner sees why the order was refused');

-- Another hotel can't touch it
reset role;
create temp table q2 as select id from public.hotels where id not in (select hotel_id from hotel_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') limit 1;
grant select on q2 to authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_fail($$select public.table_qr_board((select id from q2))$$, 'reading another hotel''s table map');
reset role;
