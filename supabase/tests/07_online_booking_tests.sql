\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–06.
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
create temp table bctx as select id h, (now() at time zone timezone)::date t from public.hotels where name='Olsupat Lodge';
grant select on bctx to authenticated, anon;
create temp table bk (label text, j jsonb);
grant all on bk to authenticated, anon;

select pg_temp.expect((select count(*) from booking_settings) = (select count(*) from hotels), 'every hotel has booking settings');
select pg_temp.expect((select slug from booking_settings where hotel_id=(select h from bctx))='olsupat-lodge', 'slug from hotel name');

-- Closed until the owner switches it on
select pg_temp.as_user(null);
select pg_temp.expect(public.public_hotel('olsupat-lodge') is null, 'disabled page shows nothing');
select pg_temp.expect_fail($$select public.public_availability('olsupat-lodge', current_date + 10, current_date + 12)$$, 'availability while disabled');
select pg_temp.expect_fail($$select * from guests$$, 'anonymous reading guests');
select pg_temp.expect_fail($$select * from booking_settings$$, 'anonymous reading settings');
select pg_temp.expect_fail($$select * from guest_feedback$$, 'anonymous reading feedback');

select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
update booking_settings set enabled = true;
select pg_temp.as_user(null);
select pg_temp.expect(public.public_hotel('olsupat-lodge') is null, 'front desk cannot switch it on');

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_fail($$update booking_settings set slug='Bad Slug!' where hotel_id=(select h from bctx)$$, 'invalid slug');
update booking_settings set enabled = true, free_cancel_days = 3, min_nights = 1, policies = 'No smoking' where hotel_id=(select h from bctx);
insert into room_types (hotel_id, name, base_rate, max_occupancy, online_rate) select h, 'Safari tent', 12000, 3, 11000 from bctx;
insert into rooms (hotel_id, room_type_id, room_number) select h, (select id from room_types where name='Safari tent'), 'T-1' from bctx;
insert into rooms (hotel_id, room_type_id, room_number) select h, (select id from room_types where name='Safari tent'), 'T-2' from bctx;
reset role;
create temp table tent as select id from public.room_types where name='Safari tent';
grant select on tent to anon, authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
-- one tent already taken by a phone booking without a room number
insert into guests (hotel_id, first_name, last_name) select h, 'Phone', 'Caller' from bctx;
insert into reservations (hotel_id, guest_id, room_type_id, check_in, check_out, source, rate_per_night)
  select h, (select id from guests where first_name='Phone'), (select id from tent), t + 20, t + 23, 'phone', 12000 from bctx;

-- Anonymous guest
select pg_temp.as_user(null);
select pg_temp.expect((select public.public_hotel('olsupat-lodge')->>'policies')='No smoking', 'public page shows policies');
select pg_temp.expect((select count(*) from jsonb_array_elements(public.public_hotel('olsupat-lodge')->'room_types') x where x->>'name'='Safari tent' and (x->>'rate')::numeric=11000)=1, 'online rate shown');
select pg_temp.expect((select (x->>'available')::int from jsonb_array_elements(public.public_availability('olsupat-lodge', (select t from bctx) + 21, (select t from bctx) + 22, 2)) x where x->>'name'='Safari tent')=1, 'one tent left on night 21');
select pg_temp.expect((select (x->>'total')::numeric from jsonb_array_elements(public.public_availability('olsupat-lodge', (select t from bctx) + 21, (select t from bctx) + 23, 2)) x where x->>'name'='Safari tent')=22000, '2 nights = 22,000');
select pg_temp.expect_fail($$select public.public_availability('olsupat-lodge', current_date - 1, current_date + 1)$$, 'past dates');
select pg_temp.expect_fail($$select public.public_availability('olsupat-lodge', current_date + 400, current_date + 401)$$, 'too far ahead');
select pg_temp.expect_fail($$select public.public_book('olsupat-lodge', (select id from tent), (select t from bctx) + 21, (select t from bctx) + 22, 2, 0, 'Bot', 'Bot', 'b@b.com', '0712345678', null, null, 'http://spam')$$, 'honeypot');
select pg_temp.expect_fail($$select public.public_book('olsupat-lodge', (select id from tent), (select t from bctx) + 21, (select t from bctx) + 22, 4, 0, 'Big', 'Group', 'g@g.com', '0712345678')$$, 'too many guests for a tent');
select pg_temp.expect_fail($$select public.public_book('olsupat-lodge', (select id from tent), (select t from bctx) + 21, (select t from bctx) + 22, 2, 0, 'No', 'Mail', 'not-an-email', '0712345678')$$, 'bad email');
insert into bk select 'a', public.public_book('olsupat-lodge', (select id from tent), (select t from bctx) + 21, (select t from bctx) + 22, 2, 1,
  'amina', 'wanjiru', 'Amina@Example.com', '+254 712 000 111', 'Kenyan', 'Late arrival');
select pg_temp.expect((select j->>'code' from bk where label='a') like 'HE-%' and (select (j->>'total')::numeric from bk where label='a')=11000, 'booked: code and total');
select pg_temp.expect_fail($$select public.public_book('olsupat-lodge', (select id from tent), (select t from bctx) + 21, (select t from bctx) + 22, 2, 0, 'Late', 'Comer', 'l@l.com', '0712999888')$$, 'last tent already taken');
select pg_temp.expect((select (x->>'available')::int from jsonb_array_elements(public.public_availability('olsupat-lodge', (select t from bctx) + 21, (select t from bctx) + 22)) x where x->>'name'='Safari tent')=0, 'sold out shows 0');
-- lookup and cancel
select pg_temp.expect_fail($$select public.public_booking('olsupat-lodge', (select j->>'code' from bk where label='a'), 'wrong@x.com')$$, 'lookup with wrong email');
select pg_temp.expect((select public.public_booking('olsupat-lodge', (select j->>'code' from bk where label='a'), 'WANJIRU')->>'can_cancel')='true', 'lookup by last name, can cancel');
-- limits: 3 a day per guest
insert into bk select 'b', public.public_book('olsupat-lodge', (select id from tent), (select t from bctx) + 30, (select t from bctx) + 31, 1, 0, 'Amina', 'Wanjiru', 'amina@example.com', '0712000111');
insert into bk select 'c', public.public_book('olsupat-lodge', (select id from tent), (select t from bctx) + 32, (select t from bctx) + 33, 1, 0, 'Amina', 'Wanjiru', 'amina@example.com', '0712000111');
select pg_temp.expect_fail($$select public.public_book('olsupat-lodge', (select id from tent), (select t from bctx) + 34, (select t from bctx) + 35, 1, 0, 'Amina', 'Wanjiru', 'amina@example.com', '0712000111')$$, 'fourth booking in a day');
select pg_temp.expect((select public.public_booking('olsupat-lodge', (select j->>'code' from bk where label='c'), 'amina@example.com', true)->>'status')='cancelled', 'guest cancelled online');

-- Staff side
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((select source::text from reservations where code=(select j->>'code' from bk where label='a'))='website'
                  and (select room_id from reservations where code=(select j->>'code' from bk where label='a')) is null, 'arrives as website booking without a room');
select pg_temp.expect(exists (select 1 from activity_log where kind='online' and message like 'Online booking%'), 'online booking in activity');
reset role;
-- close to arrival: no more online cancelling
update reservations set check_in = (select t from bctx) + 1, check_out = (select t from bctx) + 2 where code=(select j->>'code' from bk where label='b');
select pg_temp.as_user(null);
select pg_temp.expect((select public.public_booking('olsupat-lodge', (select j->>'code' from bk where label='b'), 'amina@example.com')->>'can_cancel')='false', 'inside 3 days: cannot cancel online');
select pg_temp.expect_fail($$select public.public_booking('olsupat-lodge', (select j->>'code' from bk where label='b'), 'amina@example.com', true)$$, 'cancelling inside the window');

-- Feedback: check the guest in and out
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
reset role;
update reservations set check_in = (select t from bctx), check_out = (select t from bctx) + 1 where code=(select j->>'code' from bk where label='b');
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select public.check_in_reservation((select id from reservations where code=(select j->>'code' from bk where label='b')),
  (select id from rooms where room_number='T-1'));
select public.check_out_reservation((select id from reservations where code=(select j->>'code' from bk where label='b')), true);
reset role;
create temp view fb as select f.* from public.guest_feedback f join public.reservations r on r.id=f.reservation_id where r.code=(select j->>'code' from bk where label='b');
grant select on fb to anon, authenticated;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((select count(*) from fb)=1, 'feedback link made at check-out');
select pg_temp.expect(public.feedback_link((select reservation_id from fb)) = (select token from fb), 'front desk can fetch the link');
insert into bk select 'tok', to_jsonb((select token from fb));
select pg_temp.expect_fail($$select public.feedback_link((select id from reservations where code=(select j->>'code' from bk where label='a')))$$, 'link for a guest not yet arrived');
select pg_temp.as_user(null);
select pg_temp.expect((select public.public_feedback((select j #>> '{}' from bk where label='tok'))->>'first_name')='Amina', 'feedback page knows the guest');
select pg_temp.expect(public.public_feedback('nonsense') is null, 'bad token');
select pg_temp.expect_fail($$select public.public_feedback_submit((select j #>> '{}' from bk where label='tok'), 7)$$, 'rating out of range');
select public.public_feedback_submit((select j #>> '{}' from bk where label='tok'), 4, 5, 4, 4, null, 3, 9, 'Lovely tent, slow breakfast', true);
select pg_temp.expect_fail($$select public.public_feedback_submit((select j #>> '{}' from bk where label='tok'), 1)$$, 'submitting twice');
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((select overall from fb)=4 and (select public_name from fb)='Amina W.', 'review saved with short name');
select pg_temp.expect_fail($$update guest_feedback set overall=5$$, 'staff changing a rating');
select pg_temp.expect_fail($$update guest_feedback set response='Thanks' where id=(select id from fb)$$, 'front desk replying');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update guest_feedback set response='Thank you, Amina! Breakfast is now served from 6:30.', published=true where id=(select id from fb);
select pg_temp.expect((select responded_by from fb)='aaaaaaaa-0000-0000-0000-000000000001', 'reply recorded');
select pg_temp.as_user(null);
select pg_temp.expect((select (public.public_hotel('olsupat-lodge')->'reviews'->>'average')::numeric)=4
                  and (select public.public_hotel('olsupat-lodge')->'reviews'->'recent'->0->>'name')='Amina W.', 'published review on booking page');

-- A review the guest didn't allow to be published
reset role;
insert into guest_feedback (hotel_id, reservation_id, submitted_at, overall, consent_publish, public_name)
  select hotel_id, id, now(), 2, false, 'X.' from reservations where status='checked_out' and id not in (select reservation_id from guest_feedback) limit 1;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_fail($$update guest_feedback set published=true where public_name='X.'$$, 'publishing without consent');

-- Other hotels
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect((select count(*) from guest_feedback where hotel_id=(select h from bctx))=0, 'other hotel sees no reviews');
update booking_settings set enabled=false where hotel_id=(select h from bctx);
select pg_temp.as_user(null);
select pg_temp.expect(public.public_hotel('olsupat-lodge') is not null, 'other hotel could not switch it off');

select 'ONLINE BOOKING TESTS DONE' as result;
