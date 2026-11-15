\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–21. Calendar sync with Booking.com / Airbnb (iCal).
create or replace function pg_temp.as_user(_id uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(_id::text,''), false);
  execute case when _id is null then 'set role anon' else 'set role authenticated' end; end $$;
create or replace function pg_temp.expect_err(_sql text, _pattern text, _label text) returns void language plpgsql as $$
begin
  begin execute _sql; exception when others then
    if sqlerrm ~* _pattern then raise notice 'PASS (blocked) %: %', _label, sqlerrm; return; end if;
    raise exception 'FAIL: % failed with the wrong error: %', _label, sqlerrm;
  end;
  raise exception 'FAIL: % was allowed', _label;
end $$;
create or replace function pg_temp.expect(_cond boolean, _label text) returns void language plpgsql as $$
begin if not coalesce(_cond, false) then raise exception 'FAIL: %', _label; end if; raise notice 'PASS %', _label; end $$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;
reset role;
-- a room with nothing booked in the far future
create temp table rx as select h.id h, r.id room, r.room_number, r.room_type_id rt, current_date + 300 d,
  (select id from guests where hotel_id = h.id order by created_at limit 1) g
  from hotels h join rooms r on r.hotel_id = h.id where h.name = 'Olsupat Lodge' order by r.room_number limit 1;
create temp table ids (k text primary key, id uuid, token text);
grant select on rx to authenticated, service_role; grant select, insert on ids to authenticated, service_role;
create or replace function pg_temp.ev(_uid text, _from int, _to int, _summary text default 'Reserved') returns jsonb language sql as $$
  select jsonb_build_object('uid', _uid, 'start', (select d from rx) + _from, 'end', (select d from rx) + _to, 'summary', _summary) $$;
grant execute on function pg_temp.ev(text, int, int, text) to service_role;

-- links: managers only
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_err($$select public.channel_link_save((select h from rx), null, 'airbnb', null, (select room from rx), 'https://www.airbnb.com/calendar/ical/1.ics?s=x', false, true)$$, 'manager', 'front desk adding a link');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_err($$select public.channel_link_save((select h from rx), null, 'airbnb', null, (select room from rx), 'http://evil', false, true)$$, 'https://', 'not an https link');
insert into ids select 'air', id, export_token from public.channel_link_save((select h from rx), null, 'airbnb', 'Garden room', (select room from rx),
  'https://www.airbnb.com/calendar/ical/123.ics?s=abc', false, true);
insert into ids select 'bkg', id, export_token from public.channel_link_save((select h from rx), null, 'booking_com', null, (select room from rx),
  'https://ical.booking.com/v1/export?t=abc', false, true);
select pg_temp.expect_err($$select public.channel_link_save((select h from rx), null, 'airbnb', null, (select room from rx), null, false, true)$$, 'already has', 'second Airbnb link for the same room');
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select pg_temp.expect((select count(*) from channel_links) = 0, 'housekeeping cannot see calendar links');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_err($$select public.channel_export((select token from ids where k = 'air'))$$, 'permission denied', 'app users reading a feed through the database');
select pg_temp.expect_err($$select public.channel_apply((select id from ids where k = 'air'), '[]', true, null)$$, 'permission denied', 'app users faking an import');

-- one of our own bookings on the room
reset role;
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, adults, status, rate_per_night)
  select h, g, rt, room, d + 10, d + 12, 2, 'confirmed', 5000 from rx;
insert into ids select 'own', id, code from reservations where room_id = (select room from rx) and check_in = (select d + 10 from rx);

-- export
set role service_role;
create temp table f1 as select public.channel_export((select token from ids where k = 'air')) ics;
reset role;
select pg_temp.expect((select ics like 'BEGIN:VCALENDAR%END:VCALENDAR' || E'\r\n' from f1), 'a calendar');
select pg_temp.expect((select position('DTSTART;VALUE=DATE:' || to_char((select d + 10 from rx), 'YYYYMMDD') in ics) > 0
  and position('DTEND;VALUE=DATE:' || to_char((select d + 12 from rx), 'YYYYMMDD') in ics) > 0 from f1), 'our booking is closed on the site');
select pg_temp.expect((select position((select last_name from guests where id = (select g from rx)) in ics) = 0 and ics !~* 'guest' from f1), 'no guest names in the feed');

-- import from Airbnb: a booking, a block, a past stay, a clash with our booking
set role service_role;
create temp table a1 as select public.channel_apply((select id from ids where k = 'air'),
  jsonb_build_array(pg_temp.ev('HM-1@airbnb.com', 50, 53), pg_temp.ev('blk@airbnb.com', 60, 62, 'Airbnb (Not available)'),
                    jsonb_build_object('uid', 'old@airbnb.com', 'start', current_date - 10, 'end', current_date - 8, 'summary', 'Reserved'),
                    pg_temp.ev('HM-2@airbnb.com', 11, 13)), true, null) r;
reset role;
select pg_temp.expect((select (r->>'added')::int = 1 and (r->>'skipped')::int = 1 and (r->>'conflicts')::int = 1 from a1), '1 new, 1 block skipped, 1 double booking');
select pg_temp.expect((select count(*) from reservations x join guests gg on gg.id = x.guest_id
  where x.channel_uid = 'HM-1@airbnb.com' and x.room_id = (select room from rx) and x.source = 'airbnb' and x.rate_per_night = 0
    and gg.first_name = 'Airbnb' and x.status = 'confirmed') = 1, 'Airbnb booking on the room, price to be filled in');
select pg_temp.expect((select room_id is null and special_requests ~ 'DOUBLE BOOKING' from reservations where channel_uid = 'HM-2@airbnb.com'), 'double booking kept without a room and flagged');
select pg_temp.expect((select status from channel_events where uid = 'HM-2@airbnb.com') = 'conflict'
  and (select last_sync_ok from channel_links where id = (select id from ids where k = 'air')) = false, 'link shows the problem');
select pg_temp.expect((select count(*) from reservations where channel_uid in ('old@airbnb.com', 'blk@airbnb.com')) = 0, 'no bookings for past stays or blocks');

-- the Airbnb booking closes the room on Booking.com, but is not sent back to Airbnb
set role service_role;
create temp table f2 as select public.channel_export((select token from ids where k = 'air')) a, public.channel_export((select token from ids where k = 'bkg')) b;
reset role;
select pg_temp.expect((select position(to_char((select d + 50 from rx), 'YYYYMMDD') in b) > 0 and position(to_char((select d + 50 from rx), 'YYYYMMDD') in a) = 0 from f2),
  'Airbnb booking blocks Booking.com, not echoed to Airbnb');

-- dates changed on Airbnb, then cancelled
set role service_role;
create temp table a2 as select public.channel_apply((select id from ids where k = 'air'),
  jsonb_build_array(pg_temp.ev('HM-1@airbnb.com', 51, 54), pg_temp.ev('HM-2@airbnb.com', 11, 13)), true, null) r;
reset role;
select pg_temp.expect((select (r->>'changed')::int = 1 and (r->>'added')::int = 0 from a2)
  and (select check_in = (select d + 51 from rx) from reservations where channel_uid = 'HM-1@airbnb.com'), 'date change follows');
-- the site can't be reached: nothing is cancelled
set role service_role;
select public.channel_apply((select id from ids where k = 'air'), '[]', false, 'The site answered 503');
reset role;
select pg_temp.expect((select status from reservations where channel_uid = 'HM-1@airbnb.com') = 'confirmed'
  and (select last_sync_message from channel_links where id = (select id from ids where k = 'air')) = 'The site answered 503', 'site down: bookings kept, error shown');
set role service_role;
create temp table a3 as select public.channel_apply((select id from ids where k = 'air'), jsonb_build_array(pg_temp.ev('HM-2@airbnb.com', 11, 13)), true, null) r;
reset role;
select pg_temp.expect((select (r->>'cancelled')::int = 1 from a3) and (select status from reservations where channel_uid = 'HM-1@airbnb.com') = 'cancelled', 'gone from the feed: cancelled');
-- comes back (re-booked on the same uid)
set role service_role;
select public.channel_apply((select id from ids where k = 'air'), jsonb_build_array(pg_temp.ev('HM-1@airbnb.com', 51, 54), pg_temp.ev('HM-2@airbnb.com', 11, 13)), true, null);
reset role;
select pg_temp.expect((select status from reservations where channel_uid = 'HM-1@airbnb.com') = 'confirmed', 'back in the feed: confirmed again');

-- sync permissions for the Edge Function
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect(public.channel_can_sync((select id from ids where k = 'air')), 'front desk can press "Sync now"');
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select pg_temp.expect(not public.channel_can_sync((select id from ids where k = 'air')), 'housekeeping cannot');
reset role; set role service_role;
select pg_temp.expect((select array_agg(id) from public.channel_due(10, (select h from rx))) = array[(select id from ids where k = 'bkg')], 'due: only the link never read (Airbnb was just read)');
reset role;

-- removing the link cancels its upcoming imported bookings
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect(public.channel_link_delete((select id from ids where k = 'air')) = 2, 'link removed, its 2 upcoming bookings cancelled');
select pg_temp.expect((select status from reservations where id = (select id from ids where k = 'own')) = 'confirmed', 'our own booking untouched');
select public.channel_link_delete((select id from ids where k = 'bkg'));
reset role;
begin; select set_config('hotel_easy.rpc', 'on', true); update reservations set status = 'cancelled' where id = (select id from ids where k = 'own'); commit;
