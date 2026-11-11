\set ON_ERROR_STOP 1
-- helpers
create or replace function pg_temp.as_user(_id uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(_id::text,''), false);
  execute case when _id is null then 'set role anon' else 'set role authenticated' end; end $$;
create or replace function pg_temp.expect_fail(_sql text, _label text) returns void language plpgsql as $$
begin
  begin execute _sql; exception when others then raise notice 'PASS (blocked) %: %', _label, sqlerrm; return; end;
  raise exception 'FAIL: % was allowed', _label;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001','alice@a.com','{"full_name":"Alice Owner"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002','bob@b.com','{"full_name":"Bob Other"}'),
 ('cccccccc-0000-0000-0000-000000000003','carol@a.com','{"full_name":"Carol Desk"}'),
 ('dddddddd-0000-0000-0000-000000000004','dan@a.com','{"full_name":"Dan House"}');

-- Alice creates hotel with samples; invites Carol & Dan
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
create temp table ids as select public.create_hotel('Olsupat Lodge','Nairobi',null,null,true) as h1;
grant select on ids to authenticated, anon;
insert into hotel_invitations (hotel_id,email,role) select h1,'Carol@A.com','front_desk' from ids;
insert into hotel_invitations (hotel_id,email,role) select h1,'dan@a.com','housekeeping' from ids;
select pg_temp.expect_fail($$insert into hotel_members(hotel_id,user_id,role) select h1,'bbbbbbbb-0000-0000-0000-000000000002','owner' from ids$$, 'direct membership insert');
select count(*) as rooms_h1 from rooms;

-- Bob makes his own hotel and must not see Alice's
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select public.create_hotel('Bob Inn') is not null as bob_hotel;
select count(*) as bob_sees_rooms, (select count(*) from hotels) as bob_sees_hotels from rooms;
select pg_temp.expect_fail($$insert into rooms(hotel_id,room_number,room_type_id) select h1,'999',(select id from room_types limit 1) from ids$$, 'Bob adding room to Alice hotel');
do $$ begin if (select count(*) from public.available_rooms((select h1 from ids), current_date, current_date+2)) <> 0 then raise exception 'FAIL Bob sees availability'; end if; end $$;
select pg_temp.expect_fail($$select public.check_in_reservation(gen_random_uuid())$$, 'random checkin');

-- Anonymous sees nothing
select pg_temp.as_user(null);
select pg_temp.expect_fail($$select count(*) from public.rooms$$, 'anon read rooms');

-- Carol accepts invite, creates guest + reservation
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select public.accept_pending_invitations() as carol_accepted;
insert into guests (hotel_id, first_name, last_name, phone) select h1,'Wanjiku','Kamau','+254700111222' from ids;
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night)
   select h1, (select id from guests limit 1), rm.room_type_id, rm.id, current_date, current_date+3, 6500
   from ids, (select * from rooms where room_number='101') rm;
create temp view r as select id from public.reservations where check_in = current_date;
grant select on r to authenticated;
select code, nights, total_amount, status from reservations;
-- double booking same room overlapping
select pg_temp.expect_fail($$insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night)
   select h1, (select id from guests limit 1), rm.room_type_id, rm.id, current_date+2, current_date+5, 6500 from ids, (select * from rooms where room_number='101') rm$$, 'double booking');
-- back-to-back is fine
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night)
   select h1, (select id from guests limit 1), rm.room_type_id, rm.id, current_date+3, current_date+4, 6500 from ids, (select * from rooms where room_number='101') rm;
select count(*) as avail_tonight_excl_101 from public.available_rooms((select h1 from ids), current_date, current_date+1) where room_number='101';
select pg_temp.expect_fail($$update reservations set status='checked_in' where id=(select id from r)$$, 'direct status change');
select pg_temp.expect_fail($$insert into reservations (hotel_id, guest_id, room_type_id, check_in, check_out, rate_per_night) select h1,(select id from guests limit 1),(select id from room_types limit 1), current_date+5, current_date+5, 1 from ids$$, 'zero nights');
select status from public.check_in_reservation((select id from r));
select room_number, status from rooms where room_number='101';

-- Dan (housekeeping) cannot see guests, cannot check out, can set room status
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select public.accept_pending_invitations() as dan_accepted;
select count(*) as dan_sees_guests from guests;
select pg_temp.expect_fail($$select public.check_out_reservation((select id from reservations where status='checked_in'))$$, 'housekeeping checkout');
select pg_temp.expect_fail($$insert into guests(hotel_id,first_name) select h1,'X' from ids$$, 'housekeeping add guest');
-- Carol checks out; room becomes dirty; Dan cleans
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select status from public.check_out_reservation((select id from reservations where status='checked_in'), true);
select pg_temp.expect_fail($$update reservations set check_out = check_out + 1 where status='checked_out'$$, 'edit closed reservation');
update hotel_members set role='owner';
select role as carol_role_after_tamper from hotel_members where user_id=auth.uid();
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
update rooms set status='available' where room_number='101' and status='dirty';
select room_number, status from rooms where room_number='101';
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select status from public.cancel_reservation((select id from reservations where status='confirmed' limit 1));
select kind, message from activity_log order by id;
select full_name, email, role from public.hotel_team((select h1 from ids));
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select count(*) as bob_sees_team from public.hotel_team((select h1 from ids));
select count(*) as bob_sees_activity from activity_log where hotel_id=(select h1 from ids);
