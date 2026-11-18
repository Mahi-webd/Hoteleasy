\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–28. Provider console: plans, registering a company, licence
-- dates, suspension, page limits and user limits, all enforced by the database.
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

-- a provider admin (the test stub's 4th user) and an owner-to-be
insert into auth.users (id, email) values ('dddddddd-0000-0000-0000-000000000004', 'provider@hoteleasy.test') on conflict do nothing;
insert into auth.users (id, email) values ('eeeeeeee-0000-0000-0000-000000000005', 'owner@xyz.test') on conflict do nothing;
insert into public.platform_admins (user_id) values ('dddddddd-0000-0000-0000-000000000004') on conflict do nothing;
create temp table lctx as select id h from public.hotels where name='Olsupat Lodge';
grant select on lctx to authenticated, anon;

select pg_temp.expect((select source from hotel_licenses where hotel_id = (select h from lctx)) in ('existing', 'self_signup'), 'existing hotels got a licence');

-- Not a provider: no console
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect(public.provider_companies() is null, 'hotel owner sees no provider data');
select pg_temp.expect_fail($$select public.provider_plan_save(null, 'Hack', null, 0, 'KES', 'month', 5, '{}', true)$$, 'hotel owner creating a plan');
select pg_temp.expect_fail($$select * from hotel_licenses$$, 'reading licences directly');

-- Provider: a plan with reservations + rooms only, then register XYZ
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
create temp table lplan as select public.provider_plan_save(null, 'Basic', 'Small lodges', 5000, 'KES', 'month', 2, array['reservations', 'rooms', 'guests'], true) id;
select pg_temp.expect_fail($$select public.provider_plan_save(null, 'Bad', null, 0, 'KES', 'month', 2, array['no_such_page'], true)$$, 'unknown page in a plan');
create temp table lxyz as select public.provider_create_company((select id from lplan),
  '{"name": "XYZ Hotel", "city": "Mombasa"}'::jsonb, '{"name": "Xavier", "email": "OWNER@xyz.test"}'::jsonb,
  jsonb_build_object('starts_on', current_date, 'ends_on', current_date + 30, 'staff_limit', 2), true) id;
select pg_temp.expect(not exists (select 1 from hotel_members where hotel_id = (select id from lxyz)), 'provider is not added to the hotel');
select pg_temp.expect((select count(*) from rooms where hotel_id = (select id from lxyz)) = 12, 'sample rooms added');
select pg_temp.expect((public.provider_company((select id from lxyz))->'owner_invite'->>'email') = 'owner@xyz.test', 'owner invited (email in lower case)');
select pg_temp.expect((public.provider_overview()->>'companies')::int >= 2, 'overview counts companies');
reset role;
grant select on lplan, lxyz to authenticated, anon;

-- Owner signs in: becomes owner, sees only the plan's pages
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
select public.accept_pending_invitations();
select pg_temp.expect(exists (select 1 from hotel_members where hotel_id = (select id from lxyz) and role = 'owner'), 'owner joined as owner');
select pg_temp.expect(public.has_perm((select id from lxyz), 'reservations.view'), 'page in the plan is allowed');
select pg_temp.expect(not public.has_perm((select id from lxyz), 'pos.view'), 'page not in the plan is refused, even for the owner');
select pg_temp.expect(public.has_perm((select id from lxyz), 'settings.view'), 'core pages always allowed');
select pg_temp.expect((public.hotel_license_info((select id from lxyz))->>'state') = 'active', 'licence active');
select pg_temp.expect_fail($$insert into hotel_invitations (hotel_id, email, role) values ((select id from lxyz), 'boss2@xyz.test', 'owner')$$, 'hotel inviting another owner');

-- User limit 2: owner + 1 invitation fits, the next is refused
insert into hotel_invitations (hotel_id, email, role) values ((select id from lxyz), 'desk1@xyz.test', 'front_desk');
select pg_temp.expect_fail($$insert into hotel_invitations (hotel_id, email, role) values ((select id from lxyz), 'desk2@xyz.test', 'front_desk')$$, 'invitation beyond the licence user limit');

-- Expiring soon: warning state
reset role;
update hotel_licenses set ends_on = public.hotel_today((select id from lxyz)) + 3 where hotel_id = (select id from lxyz);
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
select pg_temp.expect((public.hotel_license_info((select id from lxyz))->>'state') = 'expiring', 'licence ending in 3 days shows a warning');
select pg_temp.expect(public.is_hotel_member((select id from lxyz)), 'still usable while expiring');

-- Expired: everything refused, but the hotel still appears in my list with its state
reset role;
update hotel_licenses set ends_on = public.hotel_today((select id from lxyz)) - 1 where hotel_id = (select id from lxyz);
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
select pg_temp.expect(not public.is_hotel_member((select id from lxyz)), 'expired: membership checks fail');
select pg_temp.expect((select count(*) from rooms where hotel_id = (select id from lxyz)) = 0, 'expired: no data visible');
select pg_temp.expect((select x->'license'->>'state' from jsonb_array_elements(public.my_hotels()) x where x->>'hotel_id' = (select id::text from lxyz)) = 'expired', 'expired hotel still listed with its state');

-- Provider renews; then suspends
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select public.provider_license_save((select id from lxyz), (select id from lplan), current_date, current_date + 365, 2, 'active', null, 'renewed');
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
select pg_temp.expect(public.is_hotel_member((select id from lxyz)), 'renewed: usable again');
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select public.provider_license_save((select id from lxyz), (select id from lplan), current_date, current_date + 365, 2, 'suspended', null, 'suspended');
select pg_temp.expect((select count(*) from jsonb_array_elements(public.provider_company((select id from lxyz))->'history')) >= 3, 'history kept');
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
select pg_temp.expect(not public.is_hotel_member((select id from lxyz)), 'suspended: refused');

-- Self sign-up switched off: a new account can't create a hotel
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select public.provider_settings_save(false, 14, 5, null, 7, 'HotelEasy', 'help@hoteleasy.test', null);
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
select pg_temp.expect_fail($$select public.create_hotel('Sneaky Lodge')$$, 'self sign-up when the provider allows only registered companies');
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select public.provider_settings_save(true, 14, 5, null, 7, 'HotelEasy', 'help@hoteleasy.test', null);
reset role;
