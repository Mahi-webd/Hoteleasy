\set ON_ERROR_STOP 1
-- Run after 00, all migrations, 01, 02 and 03.
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
create temp table ctx as select id h from public.hotels where name='Olsupat Lodge';
grant select on ctx to authenticated, anon;
insert into auth.users (id,email,raw_user_meta_data) values ('ffffffff-0000-0000-0000-000000000006','waiter@a.com','{"full_name":"Wanda Waiter"}');

-- Owner: outlets + sample menu, 5% service charge in Restaurant, PIN
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.pos_setup_defaults((select h from ctx), true);
select pg_temp.expect((select count(*) from pos_outlets)=4 and (select count(*) from menu_items)>15, 'outlets and sample menu created');
update pos_outlets set service_charge_rate = 0.05 where name='Restaurant';
select public.set_my_pin((select h from ctx), '1234');
insert into hotel_invitations (hotel_id,email,role) select h,'waiter@a.com','restaurant' from ctx;

-- Waiter
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
select public.accept_pending_invitations();
select pg_temp.expect((select count(*) from guests)>0, 'waiter can look up guests');
select pg_temp.expect((select count(*) from payments)=0, 'waiter cannot see front desk payments');
select pg_temp.expect_fail($$update menu_items set price=1 where name='Tusker lager'$$, 'waiter editing price');
update menu_items set available=false where name='Guinness';
select pg_temp.expect((select not available from menu_items where name='Guinness'), 'waiter can mark item sold out');
select (public.pos_open_shift((select h from ctx), 2000)).opening_float as float;

insert into pos_orders (hotel_id, outlet_id, table_id, guests)
  select h, o.id, t.id, 2 from ctx, pos_outlets o join pos_tables t on t.outlet_id=o.id where o.name='Restaurant' and t.name='T1';
create temp view o1 as select * from public.pos_orders where number=1;
grant select on o1 to authenticated;
select pg_temp.expect_fail($$insert into pos_orders (hotel_id, outlet_id, table_id) select o.hotel_id, o.outlet_id, o.table_id from o1 o$$, 'second open bill on same table');
-- price tampering ignored: server sets 350
insert into pos_order_items (order_id, menu_item_id, quantity, unit_price, name) select (select id from o1), id, 2, 1, 'cheap' from menu_items where name='Tusker lager';
select pg_temp.expect((select unit_price from pos_order_items where name='Tusker lager')=350, 'server sets the menu price');
select pg_temp.expect_fail($$insert into pos_order_items (order_id, menu_item_id, quantity) select (select id from o1), id, 1 from menu_items where name='Guinness'$$, 'sold-out item');
select pg_temp.expect_fail($$insert into pos_order_items (order_id, menu_item_id, quantity) select (select id from o1), id, 1 from menu_items where name='Nyama choma (500 g)'$$, 'missing required options');
insert into pos_order_items (order_id, menu_item_id, quantity, modifiers)
  select (select id from o1), m.id, 1, jsonb_build_array(jsonb_build_object('id', (select id from modifier_options where name='Medium')), jsonb_build_object('id', (select id from modifier_options where name='Chapati (2)')))
  from menu_items m where m.name='Nyama choma (500 g)';
select pg_temp.expect((select unit_price from pos_order_items where name='Nyama choma (500 g)')=1500, 'modifier adds 100 → 1500');
select pg_temp.expect_fail($$update pos_order_items set unit_price=1 where name='Tusker lager'$$, 'edit line price');
select pg_temp.expect((select items_gross from o1)=2200, 'items 2,200');
select total, net_amount, vat_amount, levy_amount, service_charge from o1;
select pg_temp.expect((select abs(total - (2200 + service_charge + round(service_charge*0.16,2))) < 0.02 and service_charge = round(net_amount*0.05,2) from o1), '5% service charge on net, plus VAT');
select pg_temp.expect_fail($$select public.pos_pay((select id from o1), 'cash', 100)$$, 'pay before sending');
select public.pos_send_order((select id from o1)) as sent;
select pg_temp.expect((select station from pos_order_items where name='Tusker lager')='bar' and (select station from pos_order_items where name like 'Nyama%')='kitchen', 'lines routed to bar and kitchen');
select pg_temp.expect_fail($$delete from pos_order_items where name='Tusker lager'$$, 'delete sent item');
select pg_temp.expect((select public.pos_void_item((select id from pos_order_items where name='Tusker lager'), 'Spilled', '0000'))='wrong_pin', 'wrong PIN refused');
select pg_temp.expect((select count(*) from pos_order_items where status='void')=0, 'nothing voided on wrong PIN');
select pg_temp.expect((select public.pos_void_item((select id from pos_order_items where name='Tusker lager'), 'Spilled', '1234', false, 1))='ok', 'void 1 of 2 with manager PIN');
select pg_temp.expect((select items_gross from o1)=1850 and (select count(*) from pos_order_items where name='Tusker lager')=2, 'one Tusker voided, one stays');
select pg_temp.expect((select public.pos_void_item((select id from pos_order_items where name='Tusker lager' and status<>'void'), 'Spilled', '1234'))='ok', 'void the other');
select pg_temp.expect((select items_gross from o1)=1500, 'void removes Tuskers from bill');
select pg_temp.expect((select max(approved_by::text)::uuid from pos_order_items where name='Tusker lager')='aaaaaaaa-0000-0000-0000-000000000001', 'approver recorded');
select pg_temp.expect((select public.pos_set_discount((select id from o1), 'percent', 10, 'Returning guest', '1234'))='ok', 'discount 10% approved');
select pg_temp.expect((select discount_amount from o1)=150, 'discount 150');
select public.pos_set_item_status(array(select id from pos_order_items where name like 'Nyama%'), 'ready');
select pg_temp.expect((select status from pos_order_items where name like 'Nyama%')='ready', 'kitchen marks ready');
-- payments
select pg_temp.expect_fail($$select public.pos_pay((select id from o1), 'mpesa', 500, null, 'tf12abc3xy')$$, 'M-Pesa code already used at front desk');
select status from public.pos_pay((select id from o1), 'mpesa', 1000, null, 'QW12ER34TY');
select pg_temp.expect_fail($$select public.pos_pay((select id from o1), 'cash', 99999)$$, 'overpay');
select status, paid_total, total from public.pos_pay((select id from o1), 'cash', (select total - paid_total from o1), 2000);
select pg_temp.expect((select status from o1)='paid', 'bill paid');
select pg_temp.expect((select change_given from pos_payments where method='cash') = 2000 - (select amount from pos_payments where method='cash'), 'change recorded');
select pg_temp.expect_fail($$insert into pos_order_items (order_id, menu_item_id) select (select id from o1), id from menu_items where name='Kenyan tea'$$, 'add to paid bill');

-- Room charge: front desk checks a guest into 201; waiter charges a bar bill to the room
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night)
  select r.hotel_id, (select id from guests limit 1), r.room_type_id, r.id, current_date, current_date+2, 9500 from rooms r where room_number='201';
create temp view r201 as select * from public.reservations where room_id=(select id from public.rooms where room_number='201');
grant select on r201 to authenticated;
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
insert into pos_orders (hotel_id, outlet_id, order_type, label) select h, o.id, 'takeaway', 'Pool guest' from ctx, pos_outlets o where o.name='Bar';
create temp view o2 as select * from public.pos_orders where label='Pool guest';
grant select on o2 to authenticated;
insert into pos_order_items (order_id, menu_item_id, quantity) select (select id from o2), id, 3 from menu_items where name='White Cap';
insert into pos_order_items (order_id, menu_item_id, quantity) select (select id from o2), id, 1 from menu_items where name='Chips masala';
select public.pos_send_order((select id from o2));
select pg_temp.expect_fail($$select public.pos_charge_to_room((select id from o2), (select id from r201))$$, 'charge to guest not yet checked in');
reset role;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select status from public.check_in_reservation((select id from r201));
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
select status, total from public.pos_charge_to_room((select id from o2), (select id from r201));
reset role;
select pg_temp.expect((select sum(amount) from folio_charges where pos_order_id=(select id from o2))=(select total from o2), 'room bill lines add up exactly to POS total');
select kind, description, amount, vat_amount, levy_amount from folio_charges where pos_order_id=(select id from o2);
select pg_temp.expect((select count(*) from folio_charges where pos_order_id=(select id from o2) and kind='drinks')=1 and (select count(*) from folio_charges where pos_order_id=(select id from o2) and kind='food')=1, 'split into drinks and food on the room bill');
-- reopen by manager voids room charge
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect((select public.pos_reopen_order((select id from o2), 'Guest disputes'))='ok', 'manager reopens bill (no PIN needed)');
select pg_temp.expect((select count(*) from folio_charges where pos_order_id=(select id from o2) and voided_at is null)=0, 'room bill lines voided on reopen');
select pg_temp.expect((select status from o2)='open' and (select paid_total from o2)=0, 'bill open again');
-- split by item: move chips to a new bill
select public.pos_move_items(array(select id from pos_order_items where name='Chips masala'), null) is not null as moved;
select pg_temp.expect((select count(*) from pos_orders where label like 'Split from%')=1 and (select items_gross from o2)=1050, 'split by item');

-- PIN lockout: 5 wrong attempts are remembered even though each action fails
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
select public.pos_void_item((select id from pos_order_items where name='White Cap'), 'x', '9999') from generate_series(1,4);  -- 1 wrong earlier + 4 = 5
select pg_temp.expect_fail($$select public.pos_void_item((select id from pos_order_items where name='White Cap'), 'x', '1234')$$, 'locked out after 5 wrong PINs');

-- shift close
select expected_cash, counted_cash, variance from public.pos_close_shift((select id from pos_shifts where closed_at is null and user_id=auth.uid()), 3200);
select pg_temp.expect((select expected_cash from pos_shifts where user_id=auth.uid())= 2000 + (select amount from pos_payments where method='cash'), 'expected cash = float + cash taken');

-- isolation
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select pg_temp.expect((select count(*) from pos_orders)=0 and (select count(*) from menu_items)=0, 'housekeeping sees no POS');
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect((select count(*) from pos_orders)=0 and (select count(*) from pos_outlets)=0, 'other hotel sees no POS');
select pg_temp.expect_fail($$select public.pos_send_order((select id from o1))$$, 'other hotel sending order');
select pg_temp.as_user(null);
select pg_temp.expect_fail($$select count(*) from public.pos_orders$$, 'anon orders');
reset role;
select pg_temp.expect((select count(*) from staff_pins where pin_hash like '$2%')=1, 'PIN stored hashed');
