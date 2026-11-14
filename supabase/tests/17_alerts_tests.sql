\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–16.
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
create or replace function pg_temp.has_alert(_hotel uuid, _key text) returns boolean language sql as $$
  select exists (select 1 from jsonb_array_elements(public.hotel_alerts(_hotel)) a where a->>'key' = _key) $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
reset role;

create temp table x as
  select h.id h, (select id from room_types where hotel_id = h.id and name = 'Deluxe') dlx,
    (select r.id from rooms r where r.hotel_id = h.id and r.status = 'available' and r.room_type_id = (select id from room_types where hotel_id = h.id and name = 'Deluxe')
       and not exists (select 1 from reservations z where z.room_id = r.id and z.status in ('confirmed','checked_in') and daterange(z.check_in, z.check_out) && daterange(current_date - 5, current_date + 2))
       order by r.room_number limit 1) room
  from hotels h where h.name = 'Olsupat Lodge';
grant select on x to authenticated;
select pg_temp.expect((select room from x) is not null, 'a free Deluxe room');

-- make things that need attention
select set_config('hotel_easy.rpc', 'on', false);
insert into guests (hotel_id, first_name, last_name) select h, 'Alert', 'Overstay' from x;
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night, status)
  select h, (select id from guests where last_name = 'Overstay'), dlx, room, current_date - 3, current_date - 1, 9000, 'checked_in' from x;
insert into reservations (hotel_id, guest_id, room_type_id, check_in, check_out, rate_per_night, status)
  select h, (select id from guests where last_name = 'Overstay'), dlx, current_date - 2, current_date + 1, 9000, 'confirmed' from x;
insert into reservations (hotel_id, guest_id, room_type_id, check_in, check_out, rate_per_night, status)
  select h, (select id from guests where last_name = 'Overstay'), dlx, current_date, current_date + 1, 9000, 'confirmed' from x;
insert into expenses (hotel_id, spent_on, category_id, description, amount, due_on, status, payee)
  select h, current_date - 20, (select id from expense_categories where hotel_id = x.h limit 1), 'Electricity (KPLC)', 18000, current_date - 2, 'unpaid', 'Kenya Power' from x;
insert into stock_items (hotel_id, name, unit, reorder_level) select h, 'Alert test flour', 'kg', 10 from x;
insert into guest_requests (hotel_id, reservation_id, label, department, created_at)
  select h, (select id from reservations where guest_id = (select id from guests where last_name = 'Overstay') and status = 'checked_in'), 'Extra towels', 'housekeeping', now() - interval '40 minutes' from x;
select set_config('hotel_easy.rpc', '', false);

-- owner sees all of it, most urgent first
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect(pg_temp.has_alert((select h from x), 'overstay') and pg_temp.has_alert((select h from x), 'noshow')
  and pg_temp.has_alert((select h from x), 'unassigned') and pg_temp.has_alert((select h from x), 'bills_overdue')
  and pg_temp.has_alert((select h from x), 'low_stock') and pg_temp.has_alert((select h from x), 'requests_waiting'), 'owner sees overstay, no-show, unassigned arrival, overdue bill, low stock, waiting request');
select pg_temp.expect((public.hotel_alerts((select h from x)))->0->>'severity' = 'high', 'most urgent first');
select pg_temp.expect(not ((public.hotel_alerts((select h from x)))->0 ? 'roles'), 'alerts don''t leak the role lists');
select pg_temp.expect((select a->>'title' from jsonb_array_elements(public.hotel_alerts((select h from x))) a where a->>'key' = 'bills_overdue') like '%KES 18,000%', 'overdue bill shows the amount');

-- each team sees its own
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect(pg_temp.has_alert((select h from x), 'overstay') and not pg_temp.has_alert((select h from x), 'bills_overdue') and not pg_temp.has_alert((select h from x), 'low_stock'), 'front desk: guests yes, bills and stock no');
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select pg_temp.expect(pg_temp.has_alert((select h from x), 'requests_waiting') and not pg_temp.has_alert((select h from x), 'overstay') and not pg_temp.has_alert((select h from x), 'bills_overdue'), 'housekeeping: waiting request yes, front desk and money no');
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
select pg_temp.expect(pg_temp.has_alert((select h from x), 'bills_overdue') and not pg_temp.has_alert((select h from x), 'overstay'), 'accountant: bills yes, guests no');
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
select pg_temp.expect(not pg_temp.has_alert((select h from x), 'requests_waiting'), 'maintenance is not told about a housekeeping request');
select pg_temp.as_user('77777777-0000-0000-0000-000000000007');
select pg_temp.expect(pg_temp.has_alert((select h from x), 'low_stock') and not pg_temp.has_alert((select h from x), 'bills_overdue'), 'storekeeper: low stock only');
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_fail($$select public.hotel_alerts((select h from x))$$, 'another hotel''s alerts');

-- fixing the problem clears the alert
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
create temp table before as select coalesce((select (a->>'count')::int from jsonb_array_elements(public.hotel_alerts((select h from x))) a where a->>'key' = 'low_stock'), 0) n;
reset role;
update stock_items set reorder_level = 0 where name = 'Alert test flour';
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select pg_temp.expect(coalesce((select (a->>'count')::int from jsonb_array_elements(public.hotel_alerts((select h from x))) a where a->>'key' = 'low_stock'), 0) = (select n from before) - 1, 'alert count drops when fixed');

-- owner overview
create temp table ov as select public.owner_overview() o;
select pg_temp.expect((select count(*) from ov, jsonb_array_elements(o) e where e->>'name' = 'Olsupat Lodge') = 1, 'owner overview lists the hotel');
select pg_temp.expect((select (e->>'in_house')::int >= 1 and (e->>'rooms')::int > 0 and e->'mtd' ? 'total_revenue' and jsonb_array_length(e->'next_7_days') = 7
   and (e->>'alerts_high')::int >= 1 from ov, jsonb_array_elements(o) e where e->>'name' = 'Olsupat Lodge'), 'overview has rooms, in-house, month to date, next 7 days and alerts');
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect(jsonb_array_length(public.owner_overview()) = 0, 'front desk gets no owner overview');
reset role;
