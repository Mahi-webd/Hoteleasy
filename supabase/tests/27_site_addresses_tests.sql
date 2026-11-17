\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–26. Website addresses: old addresses redirect, reserved words, own domains.
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
create temp table actx as select id h from public.hotels where name='Olsupat Lodge';
grant select on actx to authenticated, anon;

select pg_temp.expect(public.booking_slug_for('Demo', gen_random_uuid()) <> 'demo', 'new hotels never get a reserved address');

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_fail($$update booking_settings set slug = 'admin' where hotel_id=(select h from actx)$$, 'reserved address');
update booking_settings set enabled = true, slug = 'olsupat-river-lodge' where hotel_id = (select h from actx);

select pg_temp.as_user(null);
select pg_temp.expect(public.public_hotel('olsupat-lodge')->>'redirect' = 'olsupat-river-lodge', 'old address sends guests to the new one');
select pg_temp.expect(public.public_hotel('olsupat-river-lodge')->>'name' = 'Olsupat Lodge', 'new address shows the hotel');
select pg_temp.expect(public.public_hotel('no-such-hotel-xyz') is null, 'unknown address shows nothing');

-- Another hotel cannot take the old address
reset role;
select pg_temp.expect_fail($$update booking_settings set slug = 'olsupat-lodge' where hotel_id <> (select h from actx) and hotel_id = (select hotel_id from booking_settings where hotel_id <> (select h from actx) limit 1)$$, 'another hotel taking an old address');

-- Going back to its own old address is fine
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update booking_settings set slug = 'olsupat-lodge' where hotel_id = (select h from actx);
select pg_temp.as_user(null);
select pg_temp.expect(public.public_hotel('olsupat-lodge')->>'name' = 'Olsupat Lodge', 'back on its old address');
select pg_temp.expect(public.public_hotel('olsupat-river-lodge')->>'redirect' = 'olsupat-lodge', 'the address in between now redirects');

-- Own domain
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update booking_settings set custom_domain = 'https://WWW.Olsupat-Lodge.co.ke/rooms' where hotel_id = (select h from actx);
select pg_temp.expect((select custom_domain from booking_settings where hotel_id=(select h from actx)) = 'olsupat-lodge.co.ke', 'domain is tidied');
select pg_temp.expect_fail($$update booking_settings set custom_domain = 'not a domain' where hotel_id=(select h from actx)$$, 'invalid domain');
select pg_temp.as_user(null);
select pg_temp.expect(public.public_site_for_host('www.olsupat-lodge.co.ke:443') = 'olsupat-lodge', 'web address finds the hotel');
select pg_temp.expect(public.public_site_for_host('elsewhere.example.com') is null, 'unknown web address finds nothing');
select pg_temp.expect_fail($$select * from booking_slug_history$$, 'anonymous reading address history');

-- Front desk cannot change the address or domain
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
update booking_settings set slug = 'front-desk-was-here', custom_domain = null where hotel_id = (select h from actx);
select pg_temp.as_user(null);
select pg_temp.expect(public.public_site_for_host('olsupat-lodge.co.ke') = 'olsupat-lodge', 'front desk could not change the address or domain');
reset role;
