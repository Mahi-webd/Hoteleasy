\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–15.
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
    (select r.id from rooms r where r.hotel_id = h.id and r.status = 'available' and r.room_type_id = (select id from room_types where hotel_id = h.id and name = 'Standard')
       and not exists (select 1 from reservations z where z.room_id = r.id and z.status in ('confirmed','checked_in') and daterange(z.check_in, z.check_out) && daterange(current_date, current_date + 2))
       order by r.room_number limit 1) room
  from hotels h where h.name = 'Olsupat Lodge';
alter table x add column token text;
update x set token = (select token from room_links where room_id = x.room);
grant select on x to anon, authenticated;
create temp table tt as select id, label from request_types where hotel_id = (select h from x);
grant select on tt to anon, authenticated;
create temp table k (n text primary key, v text);
grant select, insert on k to anon, authenticated;
select pg_temp.expect((select token from x) is not null and (select count(*) from request_types where hotel_id = (select h from x)) = 10, 'every room has a QR link; ten default request types');

-- nobody in the room yet
select pg_temp.as_user(null);
select pg_temp.expect((public.public_room((select token from x)))->>'occupied' = 'false', 'empty room: QR page says nobody is checked in');
select pg_temp.expect(public.public_room_unlock((select token from x), 'Anyone') ? 'error', 'cannot unlock an empty room');
select pg_temp.expect_fail($$select * from room_links$$, 'anon reading room links');
select pg_temp.expect_fail($$select * from stay_keys$$, 'anon reading stay keys');

-- guest checks in
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into guests (hotel_id, first_name, last_name, phone) select h, 'Akinyi', 'Van der Berg', '+254700888001' from x;
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night, adults)
  select h, (select id from guests where phone = '+254700888001'), std, room, current_date, current_date + 2, 5000, 2 from x;
create temp table res as select id from reservations where guest_id = (select id from guests where phone = '+254700888001');
grant select on res to anon, authenticated;
select status from public.check_in_reservation((select id from res));
select pg_temp.expect_fail($$select * from stay_keys$$, 'front desk reading stay keys directly');
insert into k select 'desk', public.stay_link_key((select id from res));

-- the guest scans the QR code
select pg_temp.as_user(null);
select pg_temp.expect((public.public_room((select token from x)))->>'occupied' = 'true' and (public.public_room((select token from x))) ? 'room'
  and not ((public.public_room((select token from x))) ? 'guest'), 'occupied room: shows the room, not who is in it');
select pg_temp.expect((public.public_room_unlock((select token from x), 'Smith'))->>'error' like 'That name doesn%', 'wrong name refused');
insert into k select 'qr', public.public_room_unlock((select token from x), '  van der  berg ')->>'key';
select pg_temp.expect((select v from k where n = 'qr') = (select v from k where n = 'desk'), 'last name (any case/spacing) unlocks the same stay key front desk can send');
select pg_temp.expect((public.public_stay((select v from k where n = 'qr')))->>'first_name' = 'Akinyi'
  and jsonb_array_length((public.public_stay((select v from k where n = 'qr')))->'types') = 10, 'guest page shows their name and what they can ask for');
select pg_temp.expect(public.public_stay('x' || (select v from k where n = 'qr')) is null, 'a made-up key shows nothing');

-- requests
select public.public_request((select v from k where n = 'qr'), (select id from tt where label = 'Extra towels'));
select public.public_request((select v from k where n = 'qr'), (select id from tt where label = 'Wake-up call'), null, now() + interval '10 hours');
select pg_temp.expect_fail($$select public.public_request((select v from k where n = 'qr'), (select id from tt where label = 'Something isn''t working'))$$, 'repair request without saying what');
select public.public_request((select v from k where n = 'qr'), (select id from tt where label = 'Something isn''t working'), 'Shower is cold');
select pg_temp.expect_fail($$select public.public_request((select v from k where n = 'qr'), (select id from tt where label = 'Wake-up call'), null, now() + interval '30 days')$$, 'wake-up call a month away');
select pg_temp.expect(jsonb_array_length((public.public_stay((select v from k where n = 'qr')))->'requests') = 3, 'guest sees their three requests');
reset role;
select pg_temp.expect((select count(*) from maintenance_tickets where room_id = (select room from x) and title = 'Guest: Shower is cold' and priority = 'high') = 1, 'repair request opened a maintenance ticket');
select pg_temp.expect((select count(*) from activity_log where kind = 'guest_page_fail' and entity_id = (select room from x)) = 2, 'failed name attempts are counted');

-- who sees what
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select pg_temp.expect((select count(*) from guest_requests where reservation_id = (select id from res)) = 1, 'housekeeping sees only the towels');
select public.request_update((select id from guest_requests where reservation_id = (select id from res) and label = 'Extra towels'), 'acknowledged', 'On the way');
select pg_temp.expect_fail($$select public.request_update((select id from guest_requests where label = 'Wake-up call' and reservation_id = (select id from res)), 'done')$$, 'housekeeping closing a front-desk request');
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
select pg_temp.expect((select count(*) from guest_requests where reservation_id = (select id from res)) = 1, 'maintenance sees only the repair');
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
select pg_temp.expect((select count(*) from guest_requests) = 0, 'accountant sees no requests');
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((select count(*) from guest_requests where reservation_id = (select id from res)) = 3, 'front desk sees all three');
update guest_requests set status = 'done' where reservation_id = (select id from res);
select pg_temp.expect((select count(*) from guest_requests where reservation_id = (select id from res) and status = 'done') = 0, 'no direct edits (only through actions)');
select public.request_update((select id from guest_requests where label = 'Wake-up call' and reservation_id = (select id from res)), 'done', 'Called at 6:30');
select public.request_create_staff((select id from res), (select id from tt where label = 'Taxi or transfer'), 'Airport 5 pm, phoned in', now() + interval '6 hours');

-- guest sees the progress and can cancel only what nobody has picked up
select pg_temp.as_user(null);
select pg_temp.expect((select q->>'reply' from jsonb_array_elements((public.public_stay((select v from k where n = 'qr')))->'requests') q where q->>'label' = 'Extra towels') = 'On the way', 'guest sees the reply');
select pg_temp.expect_fail($$select public.public_request_cancel((select v from k where n = 'qr'), (select (q->>'id')::uuid from jsonb_array_elements((public.public_stay((select v from k where n = 'qr')))->'requests') q where q->>'label' = 'Extra towels'))$$, 'cancelling a request already being handled');
select public.public_request((select v from k where n = 'qr'), (select id from tt where label = 'Toiletries'), 'Toothbrush');
select public.public_request_cancel((select v from k where n = 'qr'), (select (q->>'id')::uuid from jsonb_array_elements((public.public_stay((select v from k where n = 'qr')))->'requests') q where q->>'label' = 'Toiletries'));

-- check-out: requests close and the old link stops working
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select status from public.check_out_reservation((select id from res), true);
select pg_temp.as_user(null);
select pg_temp.expect(public.public_stay((select v from k where n = 'qr')) is null, 'after check-out the stay link shows nothing');
select pg_temp.expect_fail($$select public.public_request((select v from k where n = 'qr'), (select id from tt where label = 'Extra towels'))$$, 'requests after check-out');
reset role;
select pg_temp.expect((select count(*) from guest_requests where reservation_id = (select id from res) and status in ('new', 'acknowledged')) = 0, 'open requests closed at check-out');
select pg_temp.expect((select key from stay_keys where reservation_id = (select id from res)) <> (select v from k where n = 'qr'), 'stay key changed at check-out');
-- a new code for the room (owner only)
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_fail($$select public.room_link_reset((select room from x))$$, 'front desk replacing a room QR code');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.room_link_reset((select room from x));
select pg_temp.as_user(null);
select pg_temp.expect(public.public_room((select token from x)) is null, 'old QR code stops working after a reset');
reset role;
