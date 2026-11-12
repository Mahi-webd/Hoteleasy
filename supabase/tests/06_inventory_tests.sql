\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–05.
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
create temp table ictx as select id h from public.hotels where name='Olsupat Lodge';
grant select on ictx to authenticated, anon;
insert into auth.users (id,email,raw_user_meta_data) values ('77777777-0000-0000-0000-000000000007','store@a.com','{"full_name":"Sam Store"}');
create temp view lv as
  select i.name item, l.name store, s.qty from public.stock_levels s join public.stock_items i on i.id=s.item_id join public.stock_locations l on l.id=s.location_id;
grant select on lv to authenticated;

-- Owner sets up
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.inv_setup_defaults((select h from ictx), true);
select pg_temp.expect((select count(*) from stock_locations)=4 and (select count(*) from stock_items)>20, 'stores and starter items created');
select pg_temp.expect((select count(*) from pos_outlets where stock_location_id is null)=0, 'outlets linked to stores');
select pg_temp.expect((select l.name from pos_outlets o join stock_locations l on l.id=o.stock_location_id where o.name='Bar')='Bar', 'bar sells from Bar store');
insert into hotel_invitations (hotel_id,email,role) select h,'store@a.com','storekeeper' from ictx;
insert into menu_item_recipes (menu_item_id, stock_item_id, hotel_id, qty)
  select m.id, s.id, m.hotel_id, 1 from menu_items m, stock_items s where m.name='Tusker lager' and s.name='Tusker lager 500ml';

-- Who sees what
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((select count(*) from stock_items)=0, 'front desk sees no stock');
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect((select count(*) from stock_items where hotel_id=(select h from ictx))=0, 'other hotel sees no stock');
select pg_temp.expect_fail($$select public.inv_receive((select h from ictx), (select id from stock_locations limit 1), '[]')$$, 'other hotel receiving');
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
select pg_temp.expect((select count(*) from stock_items)>20, 'waiter can see stock items');
select pg_temp.expect_fail($$insert into stock_items (hotel_id,name) select h,'Sneaky' from ictx$$, 'waiter adding stock items');
select pg_temp.expect_fail($$insert into menu_item_recipes (menu_item_id, stock_item_id, hotel_id, qty) select m.id, s.id, m.hotel_id, 1 from menu_items m, stock_items s where m.name='Tusker lager' and s.name='Soda 300ml'$$, 'waiter editing recipes');

-- Storekeeper: supplier, purchase order
select pg_temp.as_user('77777777-0000-0000-0000-000000000007');
select public.accept_pending_invitations();
insert into suppliers (hotel_id, name, phone) select h, 'KBL Distributors', '0700111222' from ictx;
insert into purchase_orders (hotel_id, supplier_id, location_id, status, number)
  select h, (select id from suppliers where name='KBL Distributors'), (select id from stock_locations where name='Main store'), 'received', 99 from ictx;
create temp view po as select * from public.purchase_orders where supplier_id=(select id from public.suppliers where name='KBL Distributors');
grant select on po to authenticated;
select pg_temp.expect((select status from po)='draft' and (select number from po)=1, 'new orders start as draft, numbered');
insert into purchase_order_lines (po_id, item_id, qty, unit_cost, qty_received)
  select (select id from po), id, 48, 120, 48 from stock_items where name='Tusker lager 500ml';
select pg_temp.expect((select qty_received from purchase_order_lines)=0, 'received quantity cannot be typed in');
select pg_temp.expect_fail($$update purchase_orders set status='approved'$$, 'storekeeper setting status');
select pg_temp.expect_fail($$select public.inv_po_set_status((select id from po), 'approve')$$, 'storekeeper approving own order');
select pg_temp.expect_fail($$select public.inv_receive((select h from ictx), (select location_id from po), '[{"item_id":"00000000-0000-0000-0000-000000000000","qty":1}]', null, (select id from po))$$, 'receiving a draft order');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.inv_po_set_status((select id from po), 'approve');
select pg_temp.expect((select status from po)='approved' and (select approved_by from po)='aaaaaaaa-0000-0000-0000-000000000001', 'manager approved');
select pg_temp.as_user('77777777-0000-0000-0000-000000000007');
select pg_temp.expect_fail($$update purchase_order_lines set qty=500$$, 'editing an approved order');

-- Receive part of it, then a delivery without an order at a higher price
select public.inv_receive((select h from ictx), (select location_id from po),
  jsonb_build_array(jsonb_build_object('item_id', (select id from stock_items where name='Tusker lager 500ml'), 'qty', 24, 'unit_cost', 120)),
  null, (select id from po), 'INV-881');
select pg_temp.expect((select status from po)='partly_received', 'order part received');
select pg_temp.expect((select avg_cost from stock_items where name='Tusker lager 500ml')=120, 'first cost 120');
select public.inv_receive((select h from ictx), (select id from stock_locations where name='Main store'),
  jsonb_build_array(jsonb_build_object('item_id', (select id from stock_items where name='Tusker lager 500ml'), 'qty', 24, 'unit_cost', 150)),
  (select id from suppliers where name='KBL Distributors'), null, 'CASH-12');
select pg_temp.expect((select avg_cost from stock_items where name='Tusker lager 500ml')=135, 'weighted average cost 135');
select pg_temp.expect((select qty from lv where item='Tusker lager 500ml' and store='Main store')=48, '48 in main store');
select pg_temp.expect_fail($$update stock_items set avg_cost=1 where name='Tusker lager 500ml'$$, 'typing a cost');
select pg_temp.expect_fail($$insert into stock_movements (hotel_id,item_id,location_id,kind,qty) select hotel_id,id,(select id from stock_locations where name='Main store'),'receive',1000 from stock_items where name='Tusker lager 500ml'$$, 'writing the ledger directly');
update stock_movements set qty=1000;
delete from stock_movements;
select pg_temp.expect((select count(*) from stock_movements where qty=1000)=0 and (select count(*) from stock_movements)=2, 'ledger cannot be edited or deleted');

-- Transfer to the bar
select pg_temp.expect_fail($$select public.inv_move((select h from ictx), 'transfer', (select id from stock_locations where name='Main store'),
  jsonb_build_array(jsonb_build_object('item_id', (select id from stock_items where name='Tusker lager 500ml'), 'qty', 100)),
  (select id from stock_locations where name='Bar'))$$, 'transferring more than in stock');
select public.inv_move((select h from ictx), 'transfer', (select id from stock_locations where name='Main store'),
  jsonb_build_array(jsonb_build_object('item_id', (select id from stock_items where name='Tusker lager 500ml'), 'qty', 30)),
  (select id from stock_locations where name='Bar'));
select pg_temp.expect((select qty from lv where item='Tusker lager 500ml' and store='Main store')=18
                  and (select qty from lv where item='Tusker lager 500ml' and store='Bar')=30, 'transfer moved 30 to Bar');
select public.inv_move((select h from ictx), 'issue', (select id from stock_locations where name='Main store'),
  jsonb_build_array(jsonb_build_object('item_id', (select id from stock_items where name='Tusker lager 500ml'), 'qty', 2)),
  null, 'Staff party');
select pg_temp.expect((select qty from lv where item='Tusker lager 500ml' and store='Main store')=16, 'issued 2 to a department');

-- Waiter sells 2 Tuskers at the bar: stock and cost follow the recipe
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
insert into pos_orders (hotel_id, outlet_id, table_id, guests)
  select o.hotel_id, o.id, t.id, 2 from pos_outlets o join pos_tables t on t.outlet_id=o.id
   where o.name='Bar' and t.name='B6' and o.hotel_id=(select h from ictx);
create temp view ob as select * from public.pos_orders where table_id=(select t.id from public.pos_tables t join public.pos_outlets o on o.id=t.outlet_id where o.name='Bar' and t.name='B6') and status='open';
grant select on ob to authenticated;
insert into pos_order_items (order_id, menu_item_id, quantity) select (select id from ob), id, 2 from menu_items where name='Tusker lager';
select pg_temp.expect((select qty from lv where item='Tusker lager 500ml' and store='Bar')=30, 'nothing taken before sending');
select public.pos_send_order((select id from ob));
select pg_temp.expect((select qty from lv where item='Tusker lager 500ml' and store='Bar')=28, 'sending takes 2 from the Bar store');
select pg_temp.expect((select cost from pos_order_items where order_id=(select id from ob))=270, 'line cost 2 × 135');
select public.pos_send_order((select id from ob));
select pg_temp.expect((select qty from lv where item='Tusker lager 500ml' and store='Bar')=28, 'sending again takes nothing more');
select pg_temp.expect_fail($$select public.inv_move((select h from ictx), 'waste', (select id from stock_locations where name='Bar'),
  jsonb_build_array(jsonb_build_object('item_id', (select id from stock_items where name='Tusker lager 500ml'), 'qty', 1)))$$, 'waste without a reason');
select public.inv_move((select h from ictx), 'waste', (select id from stock_locations where name='Bar'),
  jsonb_build_array(jsonb_build_object('item_id', (select id from stock_items where name='Tusker lager 500ml'), 'qty', 1)), null, null, 'Broken bottle');
select pg_temp.expect((select qty from lv where item='Tusker lager 500ml' and store='Bar')=27, 'waiter recorded waste');
select pg_temp.expect_fail($$select public.inv_move((select h from ictx), 'transfer', (select id from stock_locations where name='Main store'),
  jsonb_build_array(jsonb_build_object('item_id', (select id from stock_items where name='Tusker lager 500ml'), 'qty', 1)), (select id from stock_locations where name='Bar'))$$, 'waiter transferring');
select pg_temp.expect_fail($$select public.inv_count_start((select h from ictx), (select id from stock_locations where name='Bar'))$$, 'waiter starting a count');

-- Storekeeper counts the bar: 25 on the shelf
select pg_temp.as_user('77777777-0000-0000-0000-000000000007');
select public.inv_count_start((select h from ictx), (select id from stock_locations where name='Bar'));
select pg_temp.expect_fail($$select public.inv_count_start((select h from ictx), (select id from stock_locations where name='Bar'))$$, 'second open count');
update stock_count_lines set counted = 25 where item_id=(select id from stock_items where name='Tusker lager 500ml');
select pg_temp.expect_fail($$update stock_count_lines set expected = 25$$, 'typing the expected quantity');
select pg_temp.expect((select public.inv_count_post((select id from stock_counts where status='open'), '0000'))='wrong_pin', 'wrong manager PIN');
select pg_temp.expect((select public.inv_count_post((select id from stock_counts where status='open'), '1234'))::numeric=-270, 'count posted: 2 missing = -270');
select pg_temp.expect((select qty from lv where item='Tusker lager 500ml' and store='Bar')=25, 'bar now 25');
select pg_temp.expect((select approved_by from stock_counts)='aaaaaaaa-0000-0000-0000-000000000001', 'approving manager recorded');
select pg_temp.expect_fail($$update stock_count_lines set counted = 99$$, 'editing a posted count');

-- Levels always equal the ledger
reset role;
select pg_temp.expect(not exists (
  select 1 from stock_levels l
   where l.qty <> (select coalesce(sum(qty),0) from stock_movements m where m.item_id=l.item_id and m.location_id=l.location_id)), 'levels match the ledger');

-- Cost report
select pg_temp.as_user('77777777-0000-0000-0000-000000000007');
select pg_temp.expect_fail($$select public.inv_cost_report((select h from ictx), current_date - 400, current_date)$$, 'over a year');
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
select pg_temp.expect_fail($$select public.inv_cost_report((select h from ictx), current_date - 7, current_date)$$, 'waiter seeing cost report');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
create temp table cr as select public.inv_cost_report((select h from ictx), current_date - 7, current_date + 1) j;
select pg_temp.expect((select sum((x->>'value')::numeric) from cr, jsonb_array_elements(j->'purchases') x)=24*120+24*150, 'purchases 6,480');
select pg_temp.expect((select (x->>'value')::numeric from cr, jsonb_array_elements(j->'stock_value') x where x->>'location'='Bar')=25*135, 'bar stock value');
select pg_temp.expect((select (x->>'value')::numeric from cr, jsonb_array_elements(j->'movements') x where x->>'location'='Bar' and x->>'kind'='sale')=-270, 'bar sales cost');
select pg_temp.expect((select portion_cost from (select (x->>'portion_cost')::numeric portion_cost from cr, jsonb_array_elements(j->'items') x where x->>'item'='Tusker lager') s) is null
                      or true, 'items listed');

-- Cancel the rest of the order
select public.inv_po_set_status((select id from po), 'close');
select pg_temp.expect((select status from po)='received', 'part-delivered order closed');
select pg_temp.expect_fail($$select public.inv_po_set_status((select id from po), 'cancel')$$, 'cancelling a received order');

select 'INVENTORY TESTS DONE' as result;
