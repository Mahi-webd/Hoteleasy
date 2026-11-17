\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–23. Guest website content: gallery, feature blocks, room galleries.
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
create temp table gctx as select id h from public.hotels where name='Olsupat Lodge';
grant select on gctx to authenticated, anon;

-- Owner fills in the content
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update booking_settings set enabled = true,
  gallery = array['https://example.com/a.jpg', 'https://example.com/b.jpg'],
  features = '[{"title":"Restaurant","text":"Local food","photo_url":"https://example.com/r.jpg"},{"title":"Pool"}]'
 where hotel_id = (select h from gctx);
update room_types set gallery = array['https://example.com/t1.jpg'] where name = 'Safari tent' and hotel_id = (select h from gctx);

select pg_temp.expect_fail($$update booking_settings set gallery = array['http://example.com/a.jpg'] where hotel_id=(select h from gctx)$$, 'gallery link must be https');
select pg_temp.expect_fail($$update booking_settings set gallery = array_fill('https://example.com/x.jpg'::text, array[13]) where hotel_id=(select h from gctx)$$, 'at most 12 gallery photos');
select pg_temp.expect_fail($$update booking_settings set features = '[{"title":"a"},{"title":"b"},{"title":"c"},{"title":"d"}]' where hotel_id=(select h from gctx)$$, 'at most 3 feature blocks');
select pg_temp.expect_fail($$update booking_settings set features = '[{"text":"no title"}]' where hotel_id=(select h from gctx)$$, 'feature block needs a title');
select pg_temp.expect_fail($$update booking_settings set features = '[{"title":"Pool","photo_url":"javascript:alert(1)"}]' where hotel_id=(select h from gctx)$$, 'feature photo must be https');
select pg_temp.expect_fail($$update room_types set gallery = array['ftp://example.com/x.jpg'] where name='Safari tent'$$, 'room gallery link must be https');

-- Front desk cannot change the page
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
update booking_settings set gallery = '{}' where hotel_id = (select h from gctx);

-- Anonymous visitor sees it
select pg_temp.as_user(null);
select pg_temp.expect(jsonb_array_length(public.public_hotel('olsupat-lodge')->'gallery') = 2, 'gallery on the public page (front desk could not clear it)');
select pg_temp.expect(public.public_hotel('olsupat-lodge')->'features'->0->>'title' = 'Restaurant', 'feature blocks on the public page');
select pg_temp.expect((select x->'gallery'->>0 from jsonb_array_elements(public.public_hotel('olsupat-lodge')->'room_types') x where x->>'name'='Safari tent') = 'https://example.com/t1.jpg', 'room gallery on the public page');
reset role;
