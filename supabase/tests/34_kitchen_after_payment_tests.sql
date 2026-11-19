\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–33. Paying first must not stop the kitchen; a cancelled bill must.
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
insert into pos_outlets (hotel_id, name, kind) values ((select h from q), 'Pay First Bar', 'bar');
insert into pos_tables (hotel_id, outlet_id, name) select (select h from q), id, 'PF1' from pos_outlets where name = 'Pay First Bar';
insert into pos_tables (hotel_id, outlet_id, name) select (select h from q), id, 'PF2' from pos_outlets where name = 'Pay First Bar';
insert into menu_categories (hotel_id, name) values ((select h from q), 'Pay First Food') on conflict do nothing;
insert into menu_items (hotel_id, category_id, name, price) select (select h from q), id, 'Samosa', 300 from menu_categories where hotel_id = (select h from q) and name = 'Pay First Food';
create temp table qt as select l.token, t.id table_id, t.name, t.outlet_id from table_links l join pos_tables t on t.id = l.table_id join pos_outlets o on o.id = t.outlet_id where o.name = 'Pay First Bar';
create temp table qm as select id from menu_items where name = 'Samosa' and hotel_id = (select h from q);
grant select on q, qt, qm to anon, authenticated;

-- the owner takes an order at PF1, sends it to the kitchen, and the guest pays straight away
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.pos_open_shift((select h from q), 0) where not exists (select 1 from pos_shifts where hotel_id = (select h from q) and user_id = auth.uid() and closed_at is null);
insert into pos_orders (hotel_id, outlet_id, table_id) select (select h from q), outlet_id, table_id from qt where name = 'PF1';
create temp table qo as select id from pos_orders where table_id = (select table_id from qt where name = 'PF1') and status = 'open';
insert into pos_order_items (order_id, menu_item_id, quantity, unit_price, name) select (select id from qo), (select id from qm), 2, 0, 'x';
select public.pos_send_order((select id from qo));
select public.pos_pay((select id from qo), 'cash', (select total from pos_orders where id = (select id from qo)));
select pg_temp.expect((select status from pos_orders where id = (select id from qo)) = 'paid', 'bill paid before the food came');
create temp table qi as select id from pos_order_items where order_id = (select id from qo);
grant select on qo, qi to anon, authenticated;

-- the kitchen carries on: start, ready, served
select public.pos_set_item_status(array(select id from qi), 'preparing');
select pg_temp.expect((select status from pos_order_items where id = (select id from qi)) = 'preparing', 'kitchen can start a paid bill');
select public.pos_set_item_status(array(select id from qi), 'ready');
select pg_temp.expect((select x->'kitchen'->'ready'->0->>'name' from jsonb_array_elements(public.table_qr_board((select h from q))) o, jsonb_array_elements(o->'tables') x
                        where x->>'name' = 'PF1') = 'Samosa', 'waiters see food ready for a paid bill');
select pg_temp.as_user(null);
select pg_temp.expect((public.public_table((select token from qt where name = 'PF1'))->'food'->0->>'status') = 'ready', 'diner still follows the food after paying');
select pg_temp.expect((public.public_table((select token from qt where name = 'PF1'))->'bill') = 'null'::jsonb, 'no open bill left to pay');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.pos_set_item_status(array(select id from qi), 'served');
select pg_temp.expect((select status from pos_order_items where id = (select id from qi)) = 'served', 'waiter can mark a paid bill served');

-- money stays locked on the paid bill
select pg_temp.expect_fail($$update pos_order_items set quantity = 5 where id = (select id from qi)$$, 'changing quantity on a paid bill');
select pg_temp.expect_fail($$update pos_order_items set unit_price = 1 where id = (select id from qi)$$, 'changing price on a paid bill');
select pg_temp.expect_fail($$insert into pos_order_items (order_id, menu_item_id, quantity, unit_price, name) select (select id from qo), (select id from qm), 1, 0, 'x'$$, 'adding to a paid bill');

-- a cancelled bill: nothing to cook
insert into pos_orders (hotel_id, outlet_id, table_id) select (select h from q), outlet_id, table_id from qt where name = 'PF2';
create temp table qv as select id from pos_orders where table_id = (select table_id from qt where name = 'PF2') and status = 'open';
insert into pos_order_items (order_id, menu_item_id, quantity, unit_price, name) select (select id from qv), (select id from qm), 1, 0, 'x';
select public.pos_send_order((select id from qv));
select public.pos_void_order((select id from qv), 'Guest left');
create temp table qvi as select id from pos_order_items where order_id = (select id from qv);
select pg_temp.expect_fail($$select public.pos_set_item_status(array(select id from qvi), 'preparing')$$, 'cooking for a cancelled bill');
reset role;
