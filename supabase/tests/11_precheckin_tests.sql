\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–10.
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

select pg_temp.expect((select count(*) from reservations r where r.status = 'confirmed' and r.check_out >= current_date and not exists (select 1 from prechecks p where p.reservation_id = r.id)) = 0,
  'every upcoming booking has a link');

create temp table ctx as
  select h.id h, (select rm.id from rooms rm where rm.hotel_id = h.id and rm.status = 'available'
                   and not exists (select 1 from reservations x where x.room_id = rm.id and x.status in ('confirmed','checked_in')
                                   and daterange(x.check_in, x.check_out) && daterange(current_date, current_date + 3)) limit 1) room
  from hotels h where h.name = 'Olsupat Lodge';
grant select on ctx to authenticated, anon;
select pg_temp.expect((select room from ctx) is not null, 'a free room to test with');

-- Front desk makes a booking for today: a link appears
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into guests (hotel_id, first_name, last_name, phone, id_number, date_of_birth)
  select h, 'Amina', 'Odhiambo', '+254711000222', 'OLD-ID-1', '1990-01-01' from ctx;
create temp table gid as select id from guests where id_number = 'OLD-ID-1' and hotel_id = (select h from ctx);
grant select on gid to anon, authenticated;
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night, adults)
  select c.h, (select id from gid), rm.room_type_id, rm.id, current_date, current_date + 2, 5000, 2
  from ctx c join rooms rm on rm.id = c.room;
create temp table t as select public.precheck_link((select id from reservations where guest_id = (select id from gid))) tok;
grant select on t to anon, authenticated;
select pg_temp.expect((select length(tok) from t) = 40, 'new booking has a 40-character link');
select pg_temp.expect_fail($$update prechecks set id_number = 'X' where token = (select tok from t)$$, 'front desk typing the guest''s answers');
update prechecks set shared_at = now() where token = (select tok from t);
select pg_temp.expect((select shared_at from prechecks where token = (select tok from t)) is not null, 'front desk marks the link as sent');

-- Other roles
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
select pg_temp.expect((select count(*) from prechecks) = 0, 'restaurant staff see no check-in details');
select pg_temp.expect_fail($$select public.precheck_link((select id from reservations limit 1))$$, 'restaurant staff making links');

-- The guest, signed out
select pg_temp.as_user(null);
select pg_temp.expect_fail($$select * from prechecks$$, 'anon reading the table');
select pg_temp.expect((public.public_precheck((select tok from t)))->>'state' = 'open', 'guest opens the link');
select pg_temp.expect((public.public_precheck((select tok from t)))#>>'{form,first_name}' = 'Amina', 'name prefilled');
select pg_temp.expect((public.public_precheck((select tok from t)))#>>'{form,id_number}' is null
  and (public.public_precheck((select tok from t)))#>>'{form,date_of_birth}' is null, 'old ID number and birth date are not shown');
select pg_temp.expect(public.public_precheck('nope') is null, 'bad token shows nothing');
select pg_temp.expect_fail($$select public.public_precheck_submit((select tok from t), '{"first_name":"Amina","last_name":"Odhiambo","nationality":"Kenyan","id_type":"National ID","id_number":"12345678","phone":"+254711000222","signed_name":"Amina Odhiambo","accept":true}')$$, 'submitting without a signature');
select pg_temp.expect_fail($$select public.public_precheck_submit((select tok from t), '{"first_name":"Amina","last_name":"Odhiambo","nationality":"Kenyan","id_type":"National ID","id_number":"12345678","phone":"+254711000222","signature":"data:image/png;base64,AAAA","signed_name":"Amina Odhiambo","accept":false}')$$, 'submitting without accepting the terms');
select pg_temp.expect_fail($$select public.public_precheck_submit((select tok from t), '{"first_name":"Amina","last_name":"Odhiambo","nationality":"Kenyan","id_type":"National ID","id_number":"12345678","email":"bad","signature":"data:image/png;base64,AAAA","signed_name":"Amina","accept":true}')$$, 'bad email');
select pg_temp.expect_fail($$select public.public_precheck_submit((select tok from t), '{"first_name":"Amina","last_name":"Odhiambo","nationality":"Kenyan","id_type":"National ID","id_number":"12345678","phone":"1","date_of_birth":"2999-01-01","signature":"data:image/png;base64,AAAA","signed_name":"Amina","accept":true}')$$, 'birth date in the future');
select public.public_precheck_submit((select tok from t), jsonb_build_object(
  'first_name', 'Amina', 'last_name', 'Odhiambo-Otieno', 'nationality', 'Kenyan', 'id_type', 'National ID', 'id_number', ' 12345678 ',
  'phone', '+254711000222', 'email', 'Amina@Example.com', 'date_of_birth', '1992-05-04', 'arrival_time', '15:30', 'purpose', 'leisure',
  'coming_from', 'Nairobi', 'going_to', 'Mombasa', 'vehicle_reg', 'kdq 123a', 'requests', 'Extra pillows',
  'companions', jsonb_build_array(jsonb_build_object('name', 'Brian Otieno', 'id_number', '87654321'), jsonb_build_object('name', ' ')),
  'signature', 'data:image/png;base64,iVBORw0KGgo=', 'signed_name', 'Amina Odhiambo-Otieno', 'accept', true, 'marketing_ok', true));
select pg_temp.expect((public.public_precheck((select tok from t)))->>'state' = 'submitted', 'state is submitted');
select pg_temp.expect((public.public_precheck((select tok from t)))#>>'{form,id_number}' = '12345678', 'guest sees their own answers again');
-- guest can correct before the hotel accepts
select public.public_precheck_submit((select tok from t), jsonb_build_object(
  'first_name', 'Amina', 'last_name', 'Odhiambo-Otieno', 'nationality', 'Kenyan', 'id_type', 'National ID', 'id_number', '12345678',
  'phone', '+254711000222', 'email', 'amina@example.com', 'date_of_birth', '1992-05-04', 'arrival_time', '16:00', 'requests', 'Extra pillows',
  'companions', jsonb_build_array(jsonb_build_object('name', 'Brian Otieno', 'id_number', '87654321')),
  'signature', 'data:image/png;base64,iVBORw0KGgo=', 'signed_name', 'Amina Odhiambo-Otieno', 'accept', true));
reset role;
select pg_temp.expect((select arrival_time from prechecks where token=(select tok from t)) = '16:00'
  and (select jsonb_array_length(companions) from prechecks where token=(select tok from t)) = 1
  and (select vehicle_reg from prechecks where token=(select tok from t)) is null, 'second submission replaces the first; blank companions dropped');
select pg_temp.expect((select count(*) from activity_log where kind='precheck' and message like 'Amina%') = 2, 'front desk notified on the dashboard');

-- Front desk accepts → guest record updated, notes on the reservation
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select public.precheck_accept((select id from prechecks where token=(select tok from t)));
select pg_temp.expect((select id_number from guests where id=(select id from gid)) = '12345678'
  and (select last_name from guests where id=(select id from gid)) = 'Odhiambo-Otieno'
  and (select email from guests where id=(select id from gid)) = 'amina@example.com', 'guest record updated');
select pg_temp.expect((select special_requests from reservations where guest_id=(select id from gid)) like '%Arriving about 16:00 · Extra pillows%', 'arrival time and requests on the booking');
select pg_temp.expect_fail($$select public.precheck_accept((select id from prechecks where token=(select tok from t)))$$, 'accepting twice');
select pg_temp.as_user(null);
select pg_temp.expect((public.public_precheck((select tok from t)))->>'state' = 'reviewed', 'guest sees the hotel has their details');
select pg_temp.expect_fail($$select public.public_precheck_submit((select tok from t), '{"first_name":"X"}')$$, 'guest changing details after acceptance');

-- Check-in closes the link
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select status from public.check_in_reservation((select reservation_id from prechecks where token=(select tok from t)));
select pg_temp.as_user(null);
select pg_temp.expect((public.public_precheck((select tok from t)))->>'state' = 'arrived', 'after check-in the link says you are checked in');

-- Booking page lookup (by code + last name) finds the link only for confirmed stays
reset role;
insert into booking_settings (hotel_id, enabled, slug) select h, true, 'olsupat-precheck' from ctx
  on conflict (hotel_id) do update set enabled = true;
create temp table bs as select slug from booking_settings where hotel_id = (select h from ctx);
grant select on bs to anon;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into reservations (hotel_id, guest_id, room_type_id, check_in, check_out, rate_per_night)
  select c.h, (select id from gid), rm.room_type_id, current_date + 30, current_date + 32, 5000
  from ctx c join rooms rm on rm.id = c.room;
reset role;
create temp table fx as select
  (select code from reservations where check_in = current_date + 30 and guest_id=(select id from gid)) future_code,
  (select token from prechecks where reservation_id = (select id from reservations where check_in = current_date + 30 and guest_id=(select id from gid))) future_tok,
  (select code from reservations where check_in = current_date and guest_id=(select id from gid)) past_code;
grant select on fx to anon;
select pg_temp.as_user(null);
select pg_temp.expect(public.public_precheck_find((select slug from bs), (select future_code from fx), 'ODHIAMBO-OTIENO') = (select future_tok from fx), 'booking page finds the check-in link');
select pg_temp.expect_fail($$select public.public_precheck_find((select slug from bs), (select past_code from fx), 'odhiambo-otieno')$$, 'no link for a stay already checked in');
select pg_temp.expect_fail($$select public.public_precheck_find((select slug from bs), 'XXXX', 'odhiambo-otieno')$$, 'wrong code');
reset role;
