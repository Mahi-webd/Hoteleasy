\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–14.
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

update rooms set status = 'available' where status = 'dirty' and hotel_id = (select id from hotels where name = 'Olsupat Lodge');
create temp table x as
  select h.id h, (select id from room_types where hotel_id = h.id and name = 'Standard') std,
    (select id from pos_outlets where hotel_id = h.id and name = 'Restaurant') outlet,
    (select array_agg(id) from (select r.id from rooms r where r.hotel_id = h.id and r.status = 'available'
       and not exists (select 1 from reservations z where z.room_id = r.id and z.status in ('confirmed','checked_in') and daterange(z.check_in, z.check_out) && daterange(current_date, current_date + 2))
       order by r.room_number limit 2) s) rooms,
    (select id from rate_plans where hotel_id = h.id and code = 'HB') hb
  from hotels h where h.name = 'Olsupat Lodge';
grant select on x to authenticated;
select pg_temp.expect(array_length((select rooms from x), 1) = 2 and (select hb from x) is not null, 'two free rooms and the half-board plan');
create temp table ids (k text primary key, id uuid);
grant select, insert on ids to authenticated;

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update rate_plans set dinner_allowance = 1500, breakfast_allowance = null where id = (select hb from x);

-- a half-board couple and a room-only guest, checked in
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into guests (hotel_id, first_name, last_name, phone) select h, 'Board', 'Couple', '+254700777001' from x;
insert into guests (hotel_id, first_name, last_name, phone) select h, 'Room', 'Only', '+254700777002' from x;
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night, adults, rate_plan_id)
  select h, (select id from guests where phone = '+254700777001'), std, rooms[1], current_date, current_date + 1, 5000, 2, hb from x;
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night, adults)
  select h, (select id from guests where phone = '+254700777002'), std, rooms[2], current_date, current_date + 1, 5000, 1 from x;
insert into ids select 'hb', id from reservations where guest_id = (select id from guests where phone = '+254700777001');
insert into ids select 'ro', id from reservations where guest_id = (select id from guests where phone = '+254700777002');
select status from public.check_in_reservation((select id from ids where k='hb'));
select status from public.check_in_reservation((select id from ids where k='ro'));

-- ============================ dinner for the couple
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
select pg_temp.expect((select count(*) from jsonb_array_elements(public.board_guests((select h from x), 'dinner')) g
   where g->>'reservation_id' = (select id::text from ids where k='hb') and (g->>'used')::int = 0 and (g->>'allowance')::numeric = 1500) = 1, 'couple listed for dinner, allowance 1,500 each');
select pg_temp.expect((select count(*) from jsonb_array_elements(public.board_guests((select h from x), 'lunch')) g where g->>'reservation_id' = (select id::text from ids where k='hb')) = 0, 'not listed for lunch (half board)');
insert into pos_orders (hotel_id, outlet_id, guests) select h, outlet, 2 from x;
insert into ids select 'o1', id from pos_orders where hotel_id = (select h from x) order by number desc limit 1;
insert into pos_order_items (order_id, menu_item_id, quantity) select (select id from ids where k='o1'), id, 2 from menu_items where name = 'Vegetable curry' and hotel_id = (select h from x);
insert into pos_order_items (order_id, menu_item_id, quantity) select (select id from ids where k='o1'), id, 2 from menu_items where name = 'Chicken pilau' and hotel_id = (select h from x);
insert into pos_order_items (order_id, menu_item_id, quantity) select (select id from ids where k='o1'), id, 2 from menu_items where name = 'Tusker lager' and hotel_id = (select h from x);
select pg_temp.expect((select items_gross from pos_orders where id = (select id from ids where k='o1')) = 3400 + 700, 'bill: 3,400 food + 700 beer');
select pg_temp.expect_fail($$select public.pos_set_board((select id from ids where k='o1'), (select id from ids where k='hb'), 'lunch')$$, 'half board for lunch');
select pg_temp.expect_fail($$select public.pos_set_board((select id from ids where k='o1'), (select id from ids where k='ro'), 'dinner')$$, 'room-only guest as a board meal');
select pg_temp.expect_fail($$select public.pos_set_board((select id from ids where k='o1'), (select id from ids where k='hb'), 'dinner', 3)$$, 'three dinners for two guests');
select (public.pos_set_board((select id from ids where k='o1'), (select id from ids where k='hb'), 'dinner')).board_covers;
select pg_temp.expect((select board_covered from pos_orders where id = (select id from ids where k='o1')) = 3000, 'two dinners covered up to 3,000');
select pg_temp.expect((select sum(gross) from pos_order_items where order_id = (select id from ids where k='o1') and charge_kind = 'food') = 400
  and (select sum(gross) from pos_order_items where order_id = (select id from ids where k='o1') and charge_kind = 'drinks') = 700, 'only the 400 over the allowance and the beer are charged');
select pg_temp.expect_fail($$update pos_orders set board_covered = 99999 where id = (select id from ids where k='o1')$$, 'editing the covered amount directly');
select pg_temp.expect((select (g->>'used')::int from jsonb_array_elements(public.board_guests((select h from x), 'dinner')) g where g->>'reservation_id' = (select id::text from ids where k='hb')) = 2, 'both dinners now used');
-- a second dinner bill for the same room is refused
insert into pos_orders (hotel_id, outlet_id, guests) select h, outlet, 1 from x;
insert into ids select 'o2', id from pos_orders where hotel_id = (select h from x) order by number desc limit 1;
select pg_temp.expect_fail($$select public.pos_set_board((select id from ids where k='o2'), (select id from ids where k='hb'), 'dinner')$$, 'a third dinner today');
-- pay the rest to the room
select public.pos_send_order((select id from ids where k='o1'));
select status from public.pos_charge_to_room((select id from ids where k='o1'), (select id from ids where k='hb'));
reset role;
select pg_temp.expect((select coalesce(sum(amount), 0) from folio_charges where pos_order_id = (select id from ids where k='o1') and voided_at is null)
  = (select total from pos_orders where id = (select id from ids where k='o1'))
  and (select total from pos_orders where id = (select id from ids where k='o1')) < 1300, 'room bill gets only the extras (no double charge for dinner)');

-- ============================ breakfast with no allowance: all food covered
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
insert into pos_order_items (order_id, menu_item_id, quantity) select (select id from ids where k='o2'), id, 2 from menu_items where name = 'Full English breakfast' and hotel_id = (select h from x);
select (public.pos_set_board((select id from ids where k='o2'), (select id from ids where k='hb'), 'breakfast')).board_covers;
select pg_temp.expect((select total from pos_orders where id = (select id from ids where k='o2')) = 0 and (select board_covered from pos_orders where id = (select id from ids where k='o2')) = 2400, 'breakfast fully covered');
select pg_temp.expect_fail($$select public.pos_close_board((select id from ids where k='o2'))$$, 'closing with unsent items');
select public.pos_send_order((select id from ids where k='o2'));
select status from public.pos_close_board((select id from ids where k='o2'));
reset role;
select pg_temp.expect((select status from pos_orders where id = (select id from ids where k='o2')) = 'paid', 'covered bill closed with nothing to pay');
-- un-marking a board meal brings the full price back
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
insert into pos_orders (hotel_id, outlet_id, guests) select h, outlet, 1 from x;
insert into ids select 'o3', id from pos_orders where hotel_id = (select h from x) order by number desc limit 1;
insert into pos_order_items (order_id, menu_item_id, quantity) select (select id from ids where k='o3'), id, 1 from menu_items where name = 'Spanish omelette' and hotel_id = (select h from x);
select pg_temp.expect_fail($$select public.pos_set_board((select id from ids where k='o3'), (select id from ids where k='hb'), 'breakfast')$$, 'more breakfasts than guests');
reset role;
