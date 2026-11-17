\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–25. Who may upload website photos (the storage policies use this check).
create or replace function pg_temp.as_user(_id uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(_id::text,''), false);
  execute case when _id is null then 'set role anon' else 'set role authenticated' end; end $$;
create or replace function pg_temp.expect(_cond boolean, _label text) returns void language plpgsql as $$
begin if not coalesce(_cond, false) then raise exception 'FAIL: %', _label; end if; raise notice 'PASS %', _label; end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
reset role;
create temp table pctx as select id h from public.hotels where name='Olsupat Lodge';
grant select on pctx to authenticated, anon;

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect(public.can_edit_site_photos((select h from pctx)::text || '/hero/a.webp'), 'owner may upload to own hotel folder');
select pg_temp.expect(not public.can_edit_site_photos(gen_random_uuid()::text || '/hero/a.webp'), 'owner may not upload to another hotel folder');
select pg_temp.expect(not public.can_edit_site_photos('not-a-uuid/a.webp'), 'folder must be a hotel id');
select pg_temp.expect(not public.can_edit_site_photos('a.webp'), 'file must be inside a hotel folder');

select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect(not public.can_edit_site_photos((select h from pctx)::text || '/hero/a.webp'), 'front desk may not upload website photos');
reset role;
