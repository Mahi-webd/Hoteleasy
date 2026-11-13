\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–11.
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
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;
reset role;

create temp table x as
  select h.id h, (select id from room_types where hotel_id = h.id and name = 'Deluxe') dlx, (select id from room_types where hotel_id = h.id and name = 'Standard') std,
         (select slug from booking_settings where hotel_id = h.id) slug,
         current_date + 40 - extract(isodow from current_date + 40)::int + 1 as mon   -- a Monday about 6 weeks out
  from hotels h where h.name = 'Olsupat Lodge';
grant select on x to anon, authenticated, service_role;
update booking_settings set enabled = true, max_advance_days = 365, min_nights = 1 where hotel_id = (select h from x);

-- ============================ seasons
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_fail($$insert into rate_seasons (hotel_id, name, starts_on, ends_on, adjust_pct) select h, 'X', mon, mon + 3, 10 from x$$, 'front desk creating a season');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
-- all year: Friday and Saturday nights +10%
insert into rate_seasons (hotel_id, name, starts_on, ends_on, weekdays, adjust_pct, priority) select h, 'Weekend', current_date, current_date + 365, '{5,6}', 10, 0 from x;
-- high season week from that Monday: +20%, Deluxe fixed 12,000
insert into rate_seasons (hotel_id, name, starts_on, ends_on, adjust_pct, priority, min_nights) select h, 'High season', mon, mon + 13, 20, 5, 2 from x;
insert into rate_season_prices (season_id, room_type_id, hotel_id, rate) select s.id, x.dlx, x.h, 12000 from rate_seasons s, x where s.name = 'High season' and s.hotel_id = x.h;
-- a closed-to-arrival day on the Wednesday of week two
insert into rate_seasons (hotel_id, name, starts_on, ends_on, closed_to_arrival, priority, adjust_pct) select h, 'Gala', mon + 9, mon + 9, true, 10, 50 from x;
select pg_temp.expect_fail($$insert into rate_seasons (hotel_id, name, starts_on, ends_on, weekdays) select h, 'Bad', mon, mon, '{8}' from x$$, 'weekday 8');
select pg_temp.expect_fail($$insert into rate_season_prices (season_id, room_type_id, hotel_id, rate) select s.id, (select id from room_types where hotel_id <> x.h limit 1), x.h, 1 from rate_seasons s, x where s.name='High season' and s.hotel_id = x.h$$, 'price for another hotel''s room type');

create temp table q1 as select public.stay_quote((select std from x), (select mon - 3 from x), (select mon + 1 from x)) q;  -- Fri, Sat, Sun, Mon
select pg_temp.expect((select (q->'nights'->0->>'rate')::numeric from q1) = 7150 and (select q->'nights'->0->>'season' from q1) = 'Weekend', 'Friday night +10% (Weekend)');
select pg_temp.expect((select (q->'nights'->2->>'rate')::numeric from q1) = 6500, 'Sunday night at the normal rate');
select pg_temp.expect((select (q->'nights'->3->>'rate')::numeric from q1) = 7800 and (select q->'nights'->3->>'season' from q1) = 'High season', 'high season +20%');
select pg_temp.expect((select (q->>'total')::numeric from q1) = 7150 + 7150 + 6500 + 7800, 'total adds the nights');
select pg_temp.expect((select (q->>'min_nights')::int from q1) = 2, 'minimum stay from the season');
select pg_temp.expect((select (public.stay_quote((select dlx from x), (select mon + 4 from x), (select mon + 5 from x)))->'nights'->0->>'rate')::numeric = 12000, 'fixed season price beats both % rules (Friday in high season)');
select pg_temp.expect((public.stay_quote((select std from x), (select mon + 9 from x), (select mon + 11 from x)))->>'closed_to_arrival' = 'true', 'no arrivals on the gala day');
select pg_temp.expect((select (public.stay_quote((select std from x), (select mon + 8 from x), (select mon + 10 from x)))->'nights'->1->>'rate')::numeric = 9750, 'gala night +50% (highest priority)');
select pg_temp.expect(jsonb_array_length((select public.rate_calendar((select h from x), (select mon from x), 14))) >= 4, 'rate calendar lists room types');

-- ============================ stays keep nightly prices
create temp table rs as select id from reservations where false;
grant select, insert on rs to authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into guests (hotel_id, first_name, last_name, email) select h, 'Rate', 'Tester', 'rate.tester@example.com' from x;
with i as (
  insert into reservations (hotel_id, guest_id, room_type_id, check_in, check_out, rate_per_night, nightly_rates)
  select x.h, (select id from guests where email='rate.tester@example.com'), x.std, x.mon - 3, x.mon + 1, 7150,
         jsonb_build_object((x.mon-3)::text, 7150, (x.mon-2)::text, 7150, (x.mon-1)::text, 6500, x.mon::text, 7800) from x
  returning id) insert into rs select id from i;
select pg_temp.expect((select total_amount from reservations where id=(select id from rs)) = 28600, 'total = sum of nightly prices');
update reservations set rate_per_night = 7000 where id = (select id from rs);
select pg_temp.expect((select total_amount from reservations where id=(select id from rs)) = 28000
  and (select nightly_rates from reservations where id=(select id from rs)) is null, 'typing one rate replaces nightly prices');
select pg_temp.expect((select total_amount from reservations where code is not null and nightly_rates is null and id <> (select id from rs) limit 1)
  = (select nights * rate_per_night from reservations where code is not null and nightly_rates is null and id <> (select id from rs) limit 1), 'older stays unchanged');

-- room charges per night
reset role;
create temp table rin as select r.id rm from rooms r where r.room_type_id = (select std from x) and r.status = 'available'
  and not exists (select 1 from reservations z where z.room_id = r.id and z.status in ('confirmed','checked_in') and daterange(z.check_in, z.check_out) && daterange(current_date, current_date+2)) limit 1;
grant select on rin to authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
with i as (
  insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night, nightly_rates)
  select x.h, (select id from guests where email='rate.tester@example.com'), x.std, (select rm from rin), current_date, current_date + 2, 6000,
         jsonb_build_object(current_date::text, 5000, (current_date+1)::text, 7000) from x
  returning id) insert into rs select id from i;
select status from public.check_in_reservation((select id from reservations where check_in = current_date and guest_id = (select id from guests where email='rate.tester@example.com')));
select pg_temp.expect((select array_agg(unit_price order by stay_date) from folio_charges where kind='room' and voided_at is null
   and reservation_id = (select id from reservations where check_in = current_date and guest_id = (select id from guests where email='rate.tester@example.com'))) = '{5000,7000}', 'room charges use each night''s price');

-- ============================ booking page
select pg_temp.as_user(null);
select pg_temp.expect((select (o->>'total')::numeric from jsonb_array_elements(public.public_availability((select slug from x), (select mon - 3 from x), (select mon + 1 from x), 2)) o where o->>'name' = 'Standard') = 28600, 'booking page quotes seasonal prices');
select pg_temp.expect((select o->>'restriction' from jsonb_array_elements(public.public_availability((select slug from x), (select mon from x), (select mon + 1 from x), 2)) o where o->>'name' = 'Standard') like 'Minimum stay 2%', 'booking page shows the minimum stay');
select pg_temp.expect_fail($$select public.public_book((select slug from x), (select std from x), (select mon from x), (select mon + 1 from x), 1, 0, 'Min', 'Stay', 'min@example.com', '0711000001')$$, 'online booking shorter than minimum stay');
select pg_temp.expect_fail($$select public.public_book((select slug from x), (select std from x), (select mon + 9 from x), (select mon + 11 from x), 1, 0, 'No', 'Arrival', 'cta@example.com', '0711000002')$$, 'online arrival on a closed day');
create temp table bk as select public.public_book((select slug from x), (select std from x), (select mon - 3 from x), (select mon + 1 from x), 2, 0, 'Wanjiru', 'Season', 'wanjiru@example.com', '0711000003') b;
grant select on bk to anon, authenticated, service_role;
reset role;
select pg_temp.expect((select (b->>'total')::numeric from bk) = 28600 and (select nightly_rates->>((select mon from x))::text from reservations where code = (select b->>'code' from bk))::numeric = 7800, 'online booking stores the nightly prices');

-- ============================ emails queued
select pg_temp.expect((select count(*) from email_outbox where reservation_id = (select id from reservations where code = (select b->>'code' from bk)) and kind in ('confirmation','prearrival') and status='queued') = 2, 'confirmation and pre-arrival queued');
select pg_temp.expect((select send_after from email_outbox where kind='prearrival' and reservation_id = (select id from reservations where code = (select b->>'code' from bk)))
  = (((select mon - 3 from x) - 2)::timestamp + time '09:00') at time zone 'Africa/Nairobi', 'pre-arrival two days before at 09:00 hotel time');
select pg_temp.expect((select count(*) from email_outbox where reservation_id in (select id from reservations where check_in = current_date and guest_id = (select id from guests where email='rate.tester@example.com'))) = 0, 'no confirmation for a same-day stay');

select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_fail($$select public.email_claim(5)$$, 'front desk claiming emails');
update email_outbox set status = 'sent' where status = 'queued';
select pg_temp.expect((select count(*) from email_outbox where status = 'sent') = 0, 'front desk cannot mark emails sent');
select pg_temp.expect((public.email_preview((select id from reservations where code = (select b->>'code' from bk)), 'confirmation'))->>'subject' like 'Booking confirmed: Olsupat Lodge%', 'front desk previews the confirmation');
select pg_temp.expect((public.email_preview((select id from reservations where code = (select b->>'code' from bk)), 'prearrival'))->>'html' like '%/checkin/%', 'pre-arrival has the check-in link');
select pg_temp.expect_fail($$select public.email_send_test((select h from x), 'me@example.com')$$, 'front desk sending test emails');
select pg_temp.as_user(null);
select pg_temp.expect_fail($$select count(*) from email_outbox$$, 'anon reading the outbox');

-- Sender: switched off → skipped
reset role;
set role service_role;
create temp table c1 as select public.email_claim(50) j;
reset role;
select pg_temp.expect((select status from email_outbox where kind='confirmation' and reservation_id = (select id from reservations where code = (select b->>'code' from bk))) = 'skipped'
  and (select last_error from email_outbox where kind='confirmation' and reservation_id = (select id from reservations where code = (select b->>'code' from bk))) = 'emails are switched off', 'nothing sent while emails are off');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update email_settings set enabled = true, from_name = 'Olsupat Reservations', reply_to = 'res@olsupat.example' where hotel_id = (select h from x);
select public.email_retry((select id from email_outbox where kind='confirmation' and reservation_id = (select id from reservations where code = (select b->>'code' from bk))));
select public.email_send_test((select h from x), 'owner@example.com');
reset role;
set role service_role;
create temp table c2 as select public.email_claim(50) j;
reset role;
select pg_temp.expect((select count(*) from c2, jsonb_array_elements(j) e where e->>'to' = 'wanjiru@example.com' and e->>'subject' like 'Booking confirmed%'
   and e->>'from_name' = 'Olsupat Reservations' and e->>'reply_to' = 'res@olsupat.example' and e->>'html' like '%28,600.00%') = 1, 'confirmation claimed with the total');
select pg_temp.expect((select count(*) from c2, jsonb_array_elements(j) e where e->>'to' = 'owner@example.com') = 1, 'test email claimed');
select pg_temp.expect((select bool_and(e ? 'id' and e ? 'to' and e ? 'html') from c2, jsonb_array_elements(j) e), 'each claimed email has its id, address and content');
select pg_temp.expect((select count(*) from c2, jsonb_array_elements(j) e where (e->>'html') like '%<script%') = 0, 'no raw HTML');
set role service_role;
select public.email_mark((e->>'id')::uuid, true, 'prov-1') from c2, jsonb_array_elements(j) e where e->>'to' = 'wanjiru@example.com';
select public.email_mark((e->>'id')::uuid, false, null, 'Domain not verified') from c2, jsonb_array_elements(j) e where e->>'to' = 'owner@example.com';
reset role;
select pg_temp.expect((select status from email_outbox where kind='confirmation' and reservation_id = (select id from reservations where code = (select b->>'code' from bk))) = 'sent'
  and (select shared_at from prechecks where reservation_id = (select id from reservations where code = (select b->>'code' from bk))) is not null, 'sent; check-in link marked as sent');
select pg_temp.expect((select status from email_outbox where kind='test' and to_email='owner@example.com') = 'queued'
  and (select send_after from email_outbox where kind='test' and to_email='owner@example.com') > now() + interval '5 minutes', 'failure retried later');
-- third failure gives up
update email_outbox set attempts = 3, status = 'sending' where kind='test' and to_email='owner@example.com';
set role service_role;
select public.email_mark((select id from email_outbox where kind='test' and to_email='owner@example.com'), false, null, 'Still failing');
reset role;
select pg_temp.expect((select status from email_outbox where kind='test' and to_email='owner@example.com') = 'failed', 'gives up after three tries');

-- Cancel → cancellation email, pre-arrival dropped; check-out → thank-you in 3 hours
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select status from public.cancel_reservation((select id from reservations where code = (select b->>'code' from bk)));
reset role;
select pg_temp.expect((select status from email_outbox where kind='prearrival' and reservation_id = (select id from reservations where code = (select b->>'code' from bk))) = 'cancelled'
  and (select status from email_outbox where kind='cancellation' and reservation_id = (select id from reservations where code = (select b->>'code' from bk))) = 'queued', 'cancellation queued, pre-arrival dropped');
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
update reservations set check_out = current_date + 1 where check_in = current_date and guest_id = (select id from guests where email='rate.tester@example.com');
select public.check_out_reservation((select id from reservations where check_in = current_date and guest_id = (select id from guests where email='rate.tester@example.com')), true);
reset role;
select pg_temp.expect((select send_after from email_outbox where kind='thankyou' and reservation_id = (select id from reservations where check_in = current_date and guest_id = (select id from guests where email='rate.tester@example.com'))) > now() + interval '2 hours', 'thank-you queued for later');
select pg_temp.expect((public.email_compose((select h from x), (select id from reservations where check_in = current_date and guest_id = (select id from guests where email='rate.tester@example.com')), 'thankyou'))->>'html' like '%/feedback/%', 'thank-you has the feedback link');
