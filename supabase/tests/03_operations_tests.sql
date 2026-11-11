\set ON_ERROR_STOP 1
-- Run after 00, all migrations, 01 and 02.
create or replace function pg_temp.as_user(_id uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(_id::text,''), false);
  execute case when _id is null then 'set role anon' else 'set role authenticated' end; end $$;
create or replace function pg_temp.expect_fail(_sql text, _label text) returns void language plpgsql as $$
begin
  begin execute _sql; exception when others then raise notice 'PASS (blocked) %: %', _label, sqlerrm; return; end;
  raise exception 'FAIL: % was allowed', _label;
end $$;
create or replace function pg_temp.expect(_cond boolean, _label text) returns void language plpgsql as $$
begin if not _cond then raise exception 'FAIL: %', _label; end if; raise notice 'PASS %', _label; end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
reset role;
create temp view rm as select id, room_number, status from public.rooms where hotel_id=(select id from public.hotels where name='Olsupat Lodge');
grant select on rm to authenticated, anon;
create temp view hk as select * from public.housekeeping_tasks;
grant select on hk to authenticated;

-- Earlier tests checked out rooms 101 (now available by Dan), 102 and 103 (dirty) -> tasks back-filled
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');  -- Dan, housekeeping
select pg_temp.expect((select count(*) from housekeeping_tasks where status='pending' and task_type='checkout_clean')=2, 'dirty rooms got cleaning tasks');
-- Dan starts room 102 -> cleaning; finishes -> available
update housekeeping_tasks set status='in_progress', assigned_to=auth.uid() where room_id=(select id from rm where room_number='102') and status='pending';
select pg_temp.expect((select status from rm where room_number='102')='cleaning', 'start task -> room cleaning');
update housekeeping_tasks set status='done' where room_id=(select id from rm where room_number='102') and status='in_progress';
select pg_temp.expect((select status from rm where room_number='102')='available', 'finish task -> room available');
select pg_temp.expect((select completed_by from housekeeping_tasks where room_id=(select id from rm where room_number='102') and status='done' limit 1)=auth.uid(), 'completed_by recorded');
-- Dan reports a leak in 104 that blocks the room
insert into maintenance_tickets (hotel_id, room_id, title, category, priority, blocks_room)
  select (select id from hotels limit 1), id, 'Shower leaking', 'plumbing', 'high', true from rm where room_number='104';
select pg_temp.expect((select status from rm where room_number='104')='maintenance', 'blocking ticket -> room in maintenance');
select pg_temp.expect((select number from maintenance_tickets where title='Shower leaking')=1, 'ticket numbered #1');
-- Dan cannot resolve (not assigned / not maintenance role)
update maintenance_tickets set status='resolved' where title='Shower leaking';
select pg_temp.expect((select status from maintenance_tickets where title='Shower leaking')='open', 'housekeeper cannot resolve unassigned ticket');
-- Front desk cannot set 104 available while ticket open
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
update rooms set status='available' where id=(select id from rm where room_number='104');
select pg_temp.expect((select status from rm where room_number='104')='maintenance', 'cannot release room with open blocking ticket');
select pg_temp.expect((select count(*) from public.available_rooms((select id from hotels limit 1), current_date, current_date+1) where room_number='104')=0, 'room 104 not bookable');
-- Owner invites a technician; technician resolves -> room dirty -> cleaning task appears
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into hotel_invitations (hotel_id,email,role) select id,'tech@a.com','maintenance' from hotels where name='Olsupat Lodge';
reset role;
insert into auth.users (id,email,raw_user_meta_data) values ('eeeeeeee-0000-0000-0000-000000000005','tech@a.com','{"full_name":"Tom Tech"}');
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
select public.accept_pending_invitations() as tech_joined;
select pg_temp.expect((select count(*) from guests)=0, 'technician sees no guest data');
select pg_temp.expect((select count(*) from payments)=0, 'technician sees no payments');
update maintenance_tickets set status='in_progress', assigned_to=auth.uid() where title='Shower leaking';
update maintenance_tickets set status='resolved', resolution_notes='Replaced mixer', cost=3500 where title='Shower leaking';
select pg_temp.expect((select status from rm where room_number='104')='dirty', 'resolved -> room needs cleaning');
select pg_temp.expect((select count(*) from hk where room_id=(select id from rm where room_number='104') and status='pending')=1, 'cleaning task created after repair');
select pg_temp.expect((select count(*) from housekeeping_tasks)=0, 'technician cannot see housekeeping list');
select pg_temp.expect((select resolved_by from maintenance_tickets where title='Shower leaking')=auth.uid(), 'resolved_by recorded');
select pg_temp.expect_fail($$insert into housekeeping_tasks(hotel_id,room_id) select (select id from hotels limit 1), id from rm limit 1$$, 'technician creating cleaning tasks');
-- Occupied room: blocking ticket waits until checkout, then room goes to maintenance (not dirty)
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night)
  select r.hotel_id, (select id from guests limit 1), r.room_type_id, r.id, current_date, current_date+1, 100 from rooms r where room_number='105';
select status from public.check_in_reservation((select id from reservations where room_id=(select id from rm where room_number='105') and status='confirmed'));
insert into maintenance_tickets (hotel_id, room_id, title, blocks_room) select (select id from hotels limit 1), id, 'AC broken', true from rm where room_number='105';
select pg_temp.expect((select status from rm where room_number='105')='occupied', 'occupied room stays occupied');
select public.create_stayover_tasks((select id from hotels where name='Olsupat Lodge')) as stayovers;
insert into payments(hotel_id,reservation_id,method,amount) select hotel_id,id,'cash',100 from reservations where room_id=(select id from rm where room_number='105') and status='checked_in';
select status from public.check_out_reservation((select id from reservations where room_id=(select id from rm where room_number='105') and status='checked_in'));
select pg_temp.expect((select status from rm where room_number='105')='maintenance', 'after checkout room goes to maintenance');
select pg_temp.expect((select count(*) from hk where room_id=(select id from rm where room_number='105') and status='pending')=0, 'stayover task cancelled, no clean until fixed');
-- Other hotel sees nothing
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect((select count(*) from housekeeping_tasks)=0 and (select count(*) from maintenance_tickets)=0, 'other hotel sees no operations data');
select pg_temp.expect_fail($$select public.create_stayover_tasks((select id from hotels where name='Olsupat Lodge'))$$, 'other hotel creating tasks');
select pg_temp.as_user(null);
select pg_temp.expect_fail($$select count(*) from public.maintenance_tickets$$, 'anon tickets');
