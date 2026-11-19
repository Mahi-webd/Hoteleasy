\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–32. Table QR: the diner follows each dish from the kitchen to the
-- table, and the waiters' map shows food that is ready to serve.
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

create temp table q as select id h from public.hotels where name = 'Olsupat Lodge';
insert into pos_outlets (hotel_id, name, kind, table_order_enabled) values ((select h from q), 'Kitchen Patio', 'restaurant', true);
insert into pos_tables (hotel_id, outlet_id, name) select (select h from q), id, 'K1' from pos_outlets where name = 'Kitchen Patio';
insert into menu_categories (hotel_id, name) values ((select h from q), 'Kitchen Mains') on conflict do nothing;
insert into menu_items (hotel_id, category_id, name, price) select (select h from q), id, 'Ugali fish', 900 from menu_categories where hotel_id = (select h from q) and name = 'Kitchen Mains';
create temp table qt as select l.token, t.id table_id from table_links l join pos_tables t on t.id = l.table_id join pos_outlets o on o.id = t.outlet_id where o.name = 'Kitchen Patio';
create temp table qm as select id from menu_items where name = 'Ugali fish' and hotel_id = (select h from q);
grant select on q, qt, qm to anon, authenticated;

-- order from the phone, waiter confirms → sent to the kitchen
select pg_temp.as_user(null);
select public.public_table_order((select token from qt), jsonb_build_array(jsonb_build_object('menu_item_id', (select id from qm), 'qty', 1)));
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.table_order_decide((select id from table_orders where table_id = (select table_id from qt) and status = 'pending'), true);
create temp table qi as select i.id from pos_order_items i join pos_orders o on o.id = i.order_id where o.table_id = (select table_id from qt) and o.status = 'open';
grant select on qi to anon, authenticated;

select pg_temp.as_user(null);
select pg_temp.expect((public.public_table((select token from qt))->'bill'->'lines'->0->>'status') = 'sent', 'diner sees: waiting for the kitchen');
-- the kitchen starts it
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.pos_set_item_status(array(select id from qi), 'preparing');
select pg_temp.as_user(null);
select pg_temp.expect((public.public_table((select token from qt))->'bill'->'lines'->0->>'status') = 'preparing', 'diner sees: being prepared');
-- the kitchen marks it ready → on the waiters' map
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.pos_set_item_status(array(select id from qi), 'ready');
select pg_temp.expect((select x->'kitchen'->'ready'->0->>'name' from jsonb_array_elements(public.table_qr_board((select h from q))) o, jsonb_array_elements(o->'tables') x
                        where x->>'name' = 'K1') = 'Ugali fish', 'waiters see the dish ready to serve');
select pg_temp.as_user(null);
select pg_temp.expect((public.public_table((select token from qt))->'bill'->'lines'->0->>'status') = 'ready', 'diner sees: ready, on its way');
select pg_temp.expect_fail($$select public.pos_set_item_status(array(select id from qi), 'served')$$, 'a diner marking food served');
-- the waiter serves it
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.pos_set_item_status(array(select id from qi), 'served');
select pg_temp.expect((select coalesce(x->'kitchen'->'ready', '[]'::jsonb) from jsonb_array_elements(public.table_qr_board((select h from q))) o, jsonb_array_elements(o->'tables') x
                        where x->>'name' = 'K1') = '[]'::jsonb, 'nothing left waiting at the pass');
select pg_temp.as_user(null);
select pg_temp.expect((public.public_table((select token from qt))->'bill'->'lines'->0->>'served_at') is not null, 'diner sees: served');
reset role;
