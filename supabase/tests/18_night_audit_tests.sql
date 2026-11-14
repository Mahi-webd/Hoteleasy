\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–17. Uses a fresh hotel.
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

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
create temp table x as select public.create_hotel('Audit Test Camp', 'Naivasha', null, null, true) h;
grant select on x to authenticated;
reset role;
insert into hotel_members (hotel_id, user_id, role) select h, 'cccccccc-0000-0000-0000-000000000003', 'front_desk' from x;
alter table x add column today date, add column rt uuid, add column r1 uuid, add column r2 uuid;
update x set today = (now() at time zone (select timezone from hotels where id = x.h))::date,
             rt = (select id from room_types where hotel_id = x.h limit 1);
update x set r1 = (select id from rooms where room_type_id = x.rt order by room_number limit 1),
             r2 = (select id from rooms where room_type_id = x.rt order by room_number offset 1 limit 1);
create temp table ids (k text primary key, id uuid);
grant select, insert on ids to authenticated;

-- yesterday: one guest arrived and is staying two nights; one never came
insert into guests (hotel_id, first_name, last_name) select h, 'Night', 'Stayer' from x;
insert into guests (hotel_id, first_name, last_name) select h, 'Never', 'Came' from x;
select set_config('hotel_easy.rpc', 'on', false);
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night, status, checked_in_at)
  select h, (select id from guests where last_name = 'Stayer' and hotel_id = x.h), rt, r1, today - 1, today + 1, 5000, 'checked_in', ((today - 1)::timestamp + time '12:00') at time zone (select timezone from hotels where id = x.h) from x;
insert into ids select 'stay', id from reservations where hotel_id = (select h from x) and status = 'checked_in';
insert into reservations (hotel_id, guest_id, room_type_id, check_in, check_out, rate_per_night, status)
  select h, (select id from guests where last_name = 'Came' and hotel_id = x.h), rt, today - 1, today + 1, 5000, 'confirmed' from x;
insert into ids select 'noshow', id from reservations where hotel_id = (select h from x) and status = 'confirmed';
update rooms set status = 'occupied' where id = (select r1 from x);
select set_config('hotel_easy.rpc', '', false);
insert into payments (hotel_id, reservation_id, method, amount, reference, received_at)
  select h, (select id from ids where k = 'stay'), 'mpesa', 5000, 'QAZ1WSX2ED', ((today - 1)::timestamp + time '12:00') at time zone (select timezone from hotels where id = x.h) from x;
-- (room charges get posted when the day is closed)

select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
create temp table c1 as select public.day_checks((select h from x), (select today - 1 from x)) c;
select pg_temp.expect(not (select (c->>'can_close')::boolean from c1)
  and (select count(*) from c1, jsonb_array_elements(c->'blocking') b where b->>'key' = 'arrivals') = 1, 'cannot close with an arrival not checked in');
select pg_temp.expect((select count(*) from c1, jsonb_array_elements(c->'warnings') w where w->>'key' = 'room_charges') = 1, 'missing room night flagged');
select pg_temp.expect_fail($$select public.day_close((select h from x), (select today - 1 from x))$$, 'closing with blocking problems');
select pg_temp.expect((select (c->'blocking'->0->>'key') from (select public.day_checks((select h from x), (select today + 1 from x)) c) z) = 'future', 'cannot close a future day');

select status from public.cancel_reservation((select id from ids where k = 'noshow'), true);
select pg_temp.expect((public.day_checks((select h from x), (select today - 1 from x)))->>'can_close' = 'true', 'after marking the no-show, the day can close');
create temp table rep as select public.day_close((select h from x), (select today - 1 from x), 'Quiet night') r;
select pg_temp.expect((select (r->>'closed')::boolean from rep) and (select (r->>'in_house')::int from rep) = 1 and (select (r->>'no_shows')::int from rep) = 1
  and (select r->>'notes' from rep) = 'Quiet night', 'day closed with figures: 1 in house, 1 no-show');
select pg_temp.expect((select (p->>'amount')::numeric from rep, jsonb_array_elements(r->'payments') p where p->>'method' = 'mpesa') = 5000, 'money taken by method');
select pg_temp.expect((select (r->'kpis'->>'room_nights_sold')::int from rep) = 1, 'one room night sold');
select pg_temp.expect((select count(*) from folio_charges where reservation_id = (select id from ids where k = 'stay') and kind = 'room' and voided_at is null) = 2, 'closing posted the missing room nights');
select pg_temp.expect_fail($$select public.day_close((select h from x), (select today - 1 from x))$$, 'closing the same day twice');
select pg_temp.expect((public.day_checks((select h from x), (select today from x)))->>'next_to_close' = (select today::text from x), 'next day to close is today');

-- closed day is locked
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_fail($$select public.void_payment((select id from payments where reservation_id = (select id from ids where k = 'stay')), 'Wrong guest')$$, 'voiding a payment taken on a closed day');
select pg_temp.expect_fail($$select public.void_charge((select id from folio_charges where reservation_id = (select id from ids where k = 'stay') and stay_date = (select today - 1 from x)), 'Mistake')$$, 'voiding a closed night''s room charge');
update reservations set rate_per_night = 6000 where id = (select id from ids where k = 'stay');
select pg_temp.expect((select unit_price from folio_charges where reservation_id = (select id from ids where k = 'stay') and stay_date = (select today - 1 from x) and voided_at is null) = 5000
  and (select unit_price from folio_charges where reservation_id = (select id from ids where k = 'stay') and stay_date = (select today from x) and voided_at is null) = 6000, 'rate change: closed night keeps its price, tonight changes');
select public.void_charge((select id from folio_charges where reservation_id = (select id from ids where k = 'stay') and stay_date = (select today from x) and voided_at is null), 'Comp night');
select pg_temp.expect((select count(*) from folio_charges where reservation_id = (select id from ids where k = 'stay') and stay_date = (select today from x) and voided_at is not null) = 1, 'today''s charges can still be voided');

-- report and reopening
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((public.day_report((select h from x), (select today - 1 from x)))->>'closed' = 'true', 'closed day''s report is the stored one');
select pg_temp.expect((public.day_report((select h from x), (select today from x)))->>'closed' = 'false', 'today''s report is live');
select pg_temp.expect_fail($$select public.day_reopen((select h from x), (select today - 1 from x), 'oops')$$, 'front desk reopening a day');
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
select pg_temp.expect_fail($$select public.day_checks((select h from x), (select today from x))$$, 'other hotel''s staff checking the day');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_fail($$select public.day_reopen((select h from x), (select today - 1 from x), '')$$, 'reopening without a reason');
select public.day_reopen((select h from x), (select today - 1 from x), 'Payment entered on the wrong guest');
select public.void_payment((select id from payments where reservation_id = (select id from ids where k = 'stay')), 'Wrong guest');
select pg_temp.expect((select voided_at is not null from payments where reservation_id = (select id from ids where k = 'stay')), 'after reopening, the payment can be voided');
reset role;
