\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–19. Finer rights: check-in/out, room rate, refunds, discounts, new-permission marker.
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
grant execute on all functions in schema pg_temp to anon, authenticated;
reset role;
create temp table rx as select h.id h,
  (select id from hotel_members where user_id = 'eeeeeeee-0000-0000-0000-000000000005' and hotel_id = h.id) mem,
  (select id from room_types where hotel_id = h.id order by name limit 1) rt,
  (select id from guests where hotel_id = h.id order by created_at limit 1) g,
  (select id from reservations where hotel_id = h.id and status = 'checked_in' order by created_at limit 1) inhouse,
  (current_date + 200) d1, (current_date + 203) d2
  from hotels h where h.name = 'Olsupat Lodge';
grant select on rx to authenticated;
create temp table ids (k text primary key, id uuid);
grant select, insert on ids to authenticated;
select pg_temp.expect((select inhouse from rx) is not null, 'there is a guest in house to test with');

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids select 'role', id from public.role_save((select h from rx), null, 'Desk junior', null, 'front_desk',
  array['reservations.view','reservations.create','reservations.edit','reservations.checkin','billing.view','billing.create','pos.view','pos.create']);
select public.member_set_role((select mem from rx), null, (select id from ids where k = 'role'));
select pg_temp.expect(cardinality(public.roles_new_permissions((select h from rx))) = 0, 'no "new permissions" for a role made after they were added');

select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
create temp table q as select public.stay_quote((select rt from rx), (select d1 from rx), (select d2 from rx), false, null) q;
-- hand-set rate refused, season price accepted
select pg_temp.expect_err($$insert into reservations (hotel_id, guest_id, room_type_id, check_in, check_out, rate_per_night)
  select h, g, rt, d1, d2, 1 from rx$$, 'room rate', 'booking at a hand-set rate without reservations.rate');
insert into reservations (hotel_id, guest_id, room_type_id, check_in, check_out, rate_per_night, nightly_rates)
  select h, g, rt, d1, d2, (q->>'average')::numeric,
         case when (q->>'uniform')::boolean then null else (select jsonb_object_agg(n->>'date', (n->>'rate')::numeric) from jsonb_array_elements(q->'nights') n) end
  from rx, q;
insert into ids select 'res', id from reservations where hotel_id = (select h from rx) and check_in = (select d1 from rx) and guest_id = (select g from rx) order by created_at desc limit 1;
select pg_temp.expect((select id from ids where k = 'res') is not null, 'booking at the season price is fine');
select pg_temp.expect_err($$update reservations set rate_per_night = 10, nightly_rates = null where id = (select id from ids where k = 'res')$$, 'room rate', 'changing the rate later');
update reservations set special_requests = 'Late arrival' where id = (select id from ids where k = 'res');
select pg_temp.expect((select special_requests from reservations where id = (select id from ids where k = 'res')) = 'Late arrival', 'other edits still work');
-- check-out is its own right
select pg_temp.expect_err($$select public.check_out_reservation((select inhouse from rx), true)$$, 'permission', 'checking out without reservations.checkout');
-- refunds
insert into payments (hotel_id, reservation_id, method, amount) select h, inhouse, 'cash', 50 from rx;
select pg_temp.expect(true, 'payments still allowed');
select pg_temp.expect_err($$insert into payments (hotel_id, reservation_id, method, amount) select h, inhouse, 'cash', -50 from rx$$, 'row-level security', 'refund without billing.refund');
-- discounts need pos.discount or a PIN from someone who has it
select pg_temp.expect(public.approver((select h from rx), null, 'pos.discount') is null, 'no discount without approval');
select pg_temp.expect(public.approver((select h from rx), '1234', 'pos.discount') = 'aaaaaaaa-0000-0000-0000-000000000001', 'owner PIN approves the discount');
select pg_temp.expect(not ((public.my_permissions((select h from rx)))->'permissions' ? 'reports.export'), 'no spreadsheet downloads');

-- the owner ticks the rate and refunds
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.role_save((select h from rx), (select id from ids where k = 'role'), 'Desk junior', null, 'front_desk',
  array['reservations.view','reservations.create','reservations.edit','reservations.checkin','reservations.rate','billing.view','billing.create','billing.refund','pos.view','pos.create','pos.discount']);
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
update reservations set rate_per_night = 4000, nightly_rates = null where id = (select id from ids where k = 'res');
select pg_temp.expect((select rate_per_night from reservations where id = (select id from ids where k = 'res')) = 4000, 'reservations.rate: hand-set rate saved');
insert into payments (hotel_id, reservation_id, method, amount) select h, inhouse, 'cash', -50 from rx;
select pg_temp.expect(true, 'billing.refund: refund saved');
select pg_temp.expect(public.approver((select h from rx), null, 'pos.discount') = 'eeeeeeee-0000-0000-0000-000000000005', 'pos.discount: approves own discounts');
select pg_temp.expect(public.approver((select h from rx), null, 'pos.admin') is null, 'but still cannot approve voids');

-- built-in roles unchanged: front desk can do all of it
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((public.my_permissions((select h from rx)))->'permissions' @> '["reservations.checkin","reservations.checkout","reservations.rate"]'
  and not ((public.my_permissions((select h from rx)))->'permissions' ? 'billing.refund'), 'front desk: check-in/out and rate yes, refunds no (as before)');

-- "new permissions" marker
reset role;
update permission_catalog set added_at = now() where key = 'reports.export';
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect(public.roles_new_permissions((select h from rx)) = array['reports.export'], 'a permission added after the roles were made shows as new');
select public.roles_mark_reviewed((select h from rx));
select pg_temp.expect(cardinality(public.roles_new_permissions((select h from rx))) = 0, 'marked as seen');
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_err($$select public.roles_mark_reviewed((select h from rx))$$, 'owner', 'only the owner marks them seen');

-- tidy up: back to maintenance, role removed
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.member_set_role((select mem from rx), 'maintenance', null);
select public.role_delete((select id from ids where k = 'role'));
reset role;
