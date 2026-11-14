\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–18. Custom roles & permissions on Olsupat Lodge.
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
create temp table rx as select (select id from hotels where name = 'Olsupat Lodge') h,
  (select id from hotel_members where user_id = 'eeeeeeee-0000-0000-0000-000000000005' and hotel_id = (select id from hotels where name = 'Olsupat Lodge')) mem,
  (select id from reservations where hotel_id = (select id from hotels where name = 'Olsupat Lodge') order by created_at limit 1) res,
  (select id from maintenance_tickets where hotel_id = (select id from hotels where name = 'Olsupat Lodge') order by created_at limit 1) tkt,
  null::uuid role_id;
grant select on rx to authenticated;
-- the maintenance user can update tickets with the built-in role
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
select pg_temp.expect((public.my_permissions((select h from rx)))->>'custom_role_name' is null
  and (public.my_permissions((select h from rx)))->'permissions' ? 'maintenance.edit'
  and not ((public.my_permissions((select h from rx)))->'permissions' ? 'billing.view'), 'built-in maintenance role: maintenance yes, billing no');
select pg_temp.expect((select count(*) from payments where hotel_id = (select h from rx)) = 0, 'maintenance cannot see payments');

-- only the owner manages roles
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_fail($$select public.role_save((select h from rx), null, 'Sneaky', null, 'front_desk', array['billing.void'])$$, 'front desk creating a role');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_fail($$select public.role_save((select h from rx), null, 'X', null, 'front_desk', array['billing.view'])$$, 'role name too short');
select pg_temp.expect_fail($$select public.role_save((select h from rx), null, 'Manager', null, 'front_desk', array['billing.view'])$$, 'role named like a built-in role');
select pg_temp.expect_fail($$select public.role_save((select h from rx), null, 'Night auditor', null, 'owner', array['billing.view'])$$, 'owner as job type');
select pg_temp.expect_fail($$select public.role_save((select h from rx), null, 'Night auditor', null, 'front_desk', array['billing.everything'])$$, 'unknown permission');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
create temp table nr as select * from public.role_save((select h from rx), null, 'Night auditor', 'Closes the day', 'front_desk',
  array['reservations.view', 'audit.view', 'audit.create', 'billing.view', 'billing.view']);
select pg_temp.expect((select array_length(permissions, 1) from nr) = 4, 'duplicate permissions removed');
select pg_temp.expect_fail($$select public.role_save((select h from rx), null, 'night AUDITOR', null, 'front_desk', '{}')$$, 'two roles with the same name');
select pg_temp.expect_fail($$update hotel_members set custom_role_id = (select id from nr) where id = (select mem from rx)$$, 'giving a custom role by editing the table');
select pg_temp.expect_fail($$select public.member_set_role((select id from hotel_members where user_id = auth.uid() and hotel_id = (select h from rx)), null, (select id from nr))$$, 'owner changing own role');
select public.member_set_role((select mem from rx), null, (select id from nr));
select pg_temp.expect((select role from hotel_members where id = (select mem from rx)) = 'front_desk'
  and (select custom_role_id from hotel_members where id = (select mem from rx)) = (select id from nr), 'member now on the custom role, job type front desk');
select pg_temp.expect((select custom_role_name from public.hotel_team((select h from rx)) where member_id = (select mem from rx)) = 'Night auditor', 'team list shows the role name');

-- what the custom role can and cannot do
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
select pg_temp.expect((public.my_permissions((select h from rx)))->>'custom_role_name' = 'Night auditor'
  and jsonb_array_length((public.my_permissions((select h from rx)))->'permissions') = 4, 'my_permissions lists the 4 ticked permissions');
select pg_temp.expect((select count(*) from payments where hotel_id = (select h from rx)) > 0, 'billing.view: can now see payments');
select pg_temp.expect((public.day_checks((select h from rx), (select (now() at time zone 'Africa/Nairobi')::date - 1))) ? 'can_close', 'audit.view: day checks open');
select pg_temp.expect_fail($$insert into payments (hotel_id, reservation_id, method, amount) select h, res, 'cash', 100 from rx$$, 'taking a payment without billing.create');
select pg_temp.expect_fail($$select public.check_in_reservation((select res from rx))$$, 'checking in without reservations.edit');
select pg_temp.expect_fail($$select public.inv_move((select h from rx), 'waste', null, '[]'::jsonb, null, null, 'x', null)$$, 'recording waste without inventory.waste');
with u as (update maintenance_tickets set priority = priority where id = (select tkt from rx) and assigned_to is distinct from auth.uid() returning 1)
select pg_temp.expect((select count(*) from u) = 0, 'maintenance.edit taken away: ticket update does nothing');
select pg_temp.expect(not public.pos_viewer((select h from rx)) and not public.has_perm((select h from rx), 'pos.view'), 'no POS access');
select pg_temp.expect(public.has_perm((select h from rx), 'audit.create|pos.view'), 'has_perm with alternatives');
select pg_temp.expect((select count(*) from hotel_roles where hotel_id = (select h from rx)) = 1, 'staff can read the role list of their hotel');

-- the owner ticks billing.create; the change applies at once
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.role_save((select h from rx), (select id from nr), 'Night auditor', 'Closes the day', 'housekeeping',
  array['reservations.view', 'audit.view', 'audit.create', 'billing.view', 'billing.create']);
select pg_temp.expect((select role from hotel_members where id = (select mem from rx)) = 'housekeeping', 'changing the job type moves the members');
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
insert into payments (hotel_id, reservation_id, method, amount) select h, res, 'cash', 100 from rx;
select pg_temp.expect(true, 'billing.create: payment taken');
select pg_temp.expect((select count(*) from housekeeping_tasks where hotel_id = (select h from rx)) = 0, 'job type housekeeping alone gives no housekeeping access');

-- invitations with a custom role: owner only, role follows the job type
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into hotel_invitations (hotel_id, email, role, custom_role_id, invited_by) select h, 'auditor@olsupat.ke', 'restaurant', (select id from nr), auth.uid() from rx;
select pg_temp.expect((select role from hotel_invitations where email = 'auditor@olsupat.ke') = 'housekeeping', 'invitation takes the job type of the custom role');
reset role;
-- deleting a role in use is refused; after moving the person back it works
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_fail($$select public.role_delete((select id from nr))$$, 'deleting a role that someone has');
select public.member_set_role((select mem from rx), 'maintenance', null);
select public.role_delete((select id from nr));
select pg_temp.expect((select count(*) from hotel_roles where id = (select id from nr)) = 0
  and (select count(*) from hotel_invitations where email = 'auditor@olsupat.ke') = 0, 'role deleted with its pending invitation');
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
select pg_temp.expect((public.my_permissions((select h from rx)))->'permissions' ? 'maintenance.edit', 'back on the built-in maintenance role');
-- built-in roles unchanged
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((public.my_permissions((select h from rx)))->'permissions' ? 'reservations.edit'
  and not ((public.my_permissions((select h from rx)))->'permissions' ? 'payroll.view'), 'front desk permissions as before');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect(jsonb_array_length((public.my_permissions((select h from rx)))->'permissions') = (select count(*) from permission_catalog), 'owner has every permission');
reset role;
