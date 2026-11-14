\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–13.
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
  select h.id h, (select id from room_types where hotel_id = h.id and name = 'Standard') std, (select id from room_types where hotel_id = h.id and name = 'Deluxe') dlx,
    (select slug from booking_settings where hotel_id = h.id) slug,
    (select r.id from rooms r where r.hotel_id = h.id and r.status = 'available' and r.room_type_id = (select id from room_types where hotel_id = h.id and name = 'Standard')
       and not exists (select 1 from reservations z where z.room_id = r.id and z.status in ('confirmed','checked_in') and daterange(z.check_in, z.check_out) && daterange(current_date, current_date + 4))
       order by r.room_number limit 1) room
  from hotels h where h.name = 'Olsupat Lodge';
grant select on x to anon, authenticated;
select pg_temp.expect((select room from x) is not null, 'a free Standard room');
delete from rate_seasons where hotel_id = (select h from x);   -- plain prices for this test
create temp table ids (k text primary key, id uuid);
grant select, insert on ids to anon, authenticated;

-- ============================ plans
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_fail($$insert into rate_plans (hotel_id, name, code) select h, 'X', 'X' from x$$, 'front desk creating plans');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into rate_plans (hotel_id, name, code, breakfast, dinner, adult_night, child_night, sort) select h, 'Half board', 'hb', true, true, 2500, 1250, 2 from x;
insert into rate_plans (hotel_id, name, code, breakfast, lunch, dinner, adult_night, child_night, adult_stay, stay_label, room_type_ids, min_nights, sort)
  select h, 'Safari package', 'SAF', true, true, true, 4000, 2000, 15000, 'two game drives & park fees', array[dlx], 2, 3 from x;
insert into rate_plans (hotel_id, name, code, breakfast, adult_night, online, sort) select h, 'Staff rate B&B', 'STF', true, 500, false, 9 from x;
insert into ids select 'hb', id from rate_plans where code = 'HB' and hotel_id = (select h from x);
insert into ids select 'saf', id from rate_plans where code = 'SAF' and hotel_id = (select h from x);
select pg_temp.expect_fail($$insert into rate_plans (hotel_id, name, code) select h, 'Again', 'HB' from x$$, 'duplicate code');
select pg_temp.expect_fail($$insert into rate_plans (hotel_id, name, code) select h, 'Bad', 'HALF BOARD' from x$$, 'code with a space');

-- ============================ pricing a stay
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into guests (hotel_id, first_name, last_name, phone) select h, 'Meal', 'Planner', '+254700555111' from x;
insert into reservations (hotel_id, guest_id, room_type_id, check_in, check_out, rate_per_night, adults, children, rate_plan_id)
  select h, (select id from guests where phone = '+254700555111'), std, current_date + 60, current_date + 62, 5000, 2, 1, (select id from ids where k='hb') from x;
insert into ids select 'r1', id from reservations where check_in = current_date + 60 and guest_id = (select id from guests where phone = '+254700555111');
select pg_temp.expect((select plan_night from reservations where id = (select id from ids where k='r1')) = 6250, 'half board: 2 adults × 2,500 + 1 child × 1,250 a night');
select pg_temp.expect((select total_amount from reservations where id = (select id from ids where k='r1')) = 22500, 'total = room 10,000 + meals 12,500');
update reservations set adults = 1 where id = (select id from ids where k='r1');
select pg_temp.expect((select total_amount from reservations where id = (select id from ids where k='r1')) = 17500, 'fewer guests, lower meal price');
select pg_temp.expect_fail($$update reservations set rate_plan_id = (select id from ids where k='saf') where id = (select id from ids where k='r1')$$, 'safari package on a Standard room');
update reservations set rate_plan_id = null where id = (select id from ids where k='r1');
select pg_temp.expect((select total_amount from reservations where id = (select id from ids where k='r1')) = 10000, 'room only again');

-- ============================ meal lines on the bill
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night, adults, rate_plan_id)
  select h, (select id from guests where phone = '+254700555111'), std, room, current_date, current_date + 3, 5000, 2, (select id from ids where k='hb') from x;
insert into ids select 'r2', id from reservations where check_in = current_date and guest_id = (select id from guests where phone = '+254700555111');
select status from public.check_in_reservation((select id from ids where k='r2'));
select pg_temp.expect((select count(*) from folio_charges where reservation_id = (select id from ids where k='r2') and kind = 'food' and voided_at is null and unit_price = 5000) = 3, 'three nights of half board (2 × 2,500) on the bill');
select pg_temp.expect((select description from folio_charges where reservation_id = (select id from ids where k='r2') and kind = 'food' and voided_at is null order by stay_date limit 1) like 'Half board (dinner & breakfast) – night of %, 2 adults', 'meal line says what it covers');
select pg_temp.expect((select balance from reservation_balances where reservation_id = (select id from ids where k='r2')) = 30000, 'bill = 15,000 room + 15,000 meals');

-- kitchen counts: in house tonight → dinner today, breakfast tomorrow
select pg_temp.expect(((public.meal_counts((select h from x), current_date))->>'dinner')::int >= 2, 'dinner tonight counted');
select pg_temp.expect(((public.meal_counts((select h from x), current_date + 1))->>'breakfast')::int >= 2, 'breakfast tomorrow counted');
select pg_temp.expect((select count(*) from jsonb_array_elements((public.meal_counts((select h from x), current_date + 1))->'stays') s where s->>'guest' = 'Meal Planner' and (s->>'breakfast')::boolean and (s->>'dinner')::boolean) = 1, 'the stay is on tomorrow''s list');

-- changing the plan mid-stay swaps the meal lines
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into rate_plans (hotel_id, name, code, breakfast, adult_night) select h, 'Bed & breakfast', 'BB', true, 1000 from x;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
update reservations set rate_plan_id = (select id from rate_plans where code = 'BB' and hotel_id = (select h from x)) where id = (select id from ids where k='r2');
select pg_temp.expect((select count(*) from folio_charges where reservation_id = (select id from ids where k='r2') and kind = 'food' and voided_at is null) = 3
  and (select sum(amount) from folio_charges where reservation_id = (select id from ids where k='r2') and kind = 'food' and voided_at is null) = 6000
  and (select count(*) from folio_charges where reservation_id = (select id from ids where k='r2') and void_reason = 'Meal plan changed') = 3, 'switching to B&B replaces the half-board lines');
-- leaving early removes the unused nights' meals too
select status from public.check_out_reservation((select id from ids where k='r2'), true);
select pg_temp.expect((select count(*) from folio_charges where reservation_id = (select id from ids where k='r2') and voided_at is null and stay_date > current_date) = 0, 'early departure: unused nights and meals removed');
select pg_temp.expect((select total from invoices where reservation_id = (select id from ids where k='r2') and superseded_at is null) = 7000, 'invoice: one night room + B&B');

-- ============================ booking page
select pg_temp.as_user(null);
create temp table av as select public.public_availability((select slug from x), current_date + 70, current_date + 72, 2) a;
select pg_temp.expect((select jsonb_array_length(o->'plans') from av, jsonb_array_elements(a) o where o->>'name' = 'Deluxe') = 3
  and (select jsonb_array_length(o->'plans') from av, jsonb_array_elements(a) o where o->>'name' = 'Standard') = 2, 'online plans per room type (staff rate hidden, safari Deluxe only)');
select pg_temp.expect_fail($$select public.public_book((select slug from x), (select std from x), current_date + 70, current_date + 72, 2, 0, 'A', 'B', 'ab@example.com', '0711000101', null, null, null, (select id from ids where k='saf'))$$, 'safari on Standard online');
select pg_temp.expect_fail($$select public.public_book((select slug from x), (select dlx from x), current_date + 70, current_date + 71, 2, 0, 'A', 'B', 'ab@example.com', '0711000102', null, null, null, (select id from ids where k='saf'))$$, 'safari shorter than 2 nights');
select pg_temp.expect_fail($$select public.public_book((select slug from x), (select std from x), current_date + 70, current_date + 72, 2, 0, 'A', 'B', 'ab@example.com', '0711000103', null, null, null, (select id from rate_plans where code = 'STF'))$$, 'staff rate online');
create temp table bk as select public.public_book((select slug from x), (select dlx from x), current_date + 70, current_date + 72, 2, 0, 'Safari', 'Fan', 'safari@example.com', '0711000104', null, null, null, (select id from ids where k='saf')) b;
reset role;
select pg_temp.expect((select b->>'plan' from bk) = 'Safari package'
  and (select (b->>'total')::numeric from bk) = (select 2 * coalesce(online_rate, base_rate) from room_types where id = (select dlx from x)) + 2 * 2 * 4000 + 2 * 15000, 'online safari booking priced: room + full board + package');
select pg_temp.expect((public.email_compose((select h from x), (select id from reservations where code = (select b->>'code' from bk)), 'confirmation', null, true))->>'html' like '%Safari package – breakfast, lunch, dinner%', 'confirmation email shows the board');
reset role;
