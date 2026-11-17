\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–24. Guest website settings (booking_settings.site).
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
create temp table sctx as select id h from public.hotels where name='Olsupat Lodge';
grant select on sctx to authenticated, anon;

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update booking_settings set enabled = true, site = '{
  "theme": "custom", "colors": {"primary": "#123456", "accent": "#abcdef"}, "heading_font": "marcellus",
  "logo_url": "https://example.com/logo.png",
  "hero": {"photos": ["https://example.com/h1.jpg"], "tagline": "By the river", "waves": true},
  "sections": [{"key": "rooms", "on": true}, {"key": "about", "on": false}],
  "offers": [{"title": "Long weekend", "from_date": "2026-12-01", "to_date": "2027-01-31", "min_nights": 3, "price": 30000, "photo_url": "https://example.com/o.jpg"}],
  "marquee": ["Riverside", "Quiet"], "social": {"instagram": "https://instagram.com/x"},
  "notice": {"text": "Festive packages open", "link": "https://example.com/festive"},
  "seo": {"title": "Olsupat Lodge", "description": "Riverside lodge"}
}' where hotel_id = (select h from sctx);

select pg_temp.expect_fail($$update booking_settings set site = '{"theme": "neon"}' where hotel_id=(select h from sctx)$$, 'unknown theme');
select pg_temp.expect_fail($$update booking_settings set site = '{"colors": {"primary": "red;}body{display:none"}}' where hotel_id=(select h from sctx)$$, 'colour must be #rrggbb');
select pg_temp.expect_fail($$update booking_settings set site = '{"logo_url": "http://example.com/a.png"}' where hotel_id=(select h from sctx)$$, 'logo must be https');
select pg_temp.expect_fail($$update booking_settings set site = '{"social": {"instagram": "javascript:alert(1)"}}' where hotel_id=(select h from sctx)$$, 'social link must be https');
select pg_temp.expect_fail($$update booking_settings set site = '{"notice": {"text": "x", "link": "javascript:alert(1)"}}' where hotel_id=(select h from sctx)$$, 'notice link must be https');
select pg_temp.expect_fail($$update booking_settings set site = '{"hero": {"tagline": "javascript:alert(1)"}}' where hotel_id=(select h from sctx)$$, 'no script links anywhere');
select pg_temp.expect_fail($$update booking_settings set site = '{"offers": [{"text": "no title"}]}' where hotel_id=(select h from sctx)$$, 'offer needs a title');
select pg_temp.expect_fail($$update booking_settings set site = jsonb_build_object('marquee', to_jsonb(array_fill('w'::text, array[9]))) where hotel_id=(select h from sctx)$$, 'at most 8 marquee words');
select pg_temp.expect_fail($$update booking_settings set site = '[]' where hotel_id=(select h from sctx)$$, 'site must be an object');

-- Front desk cannot change it
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
update booking_settings set site = '{}' where hotel_id = (select h from sctx);

select pg_temp.as_user(null);
select pg_temp.expect(public.public_hotel('olsupat-lodge')->'site'->>'theme' = 'custom', 'site settings on the public page (front desk could not clear them)');
select pg_temp.expect(public.public_hotel('olsupat-lodge')->'site'->'offers'->0->>'title' = 'Long weekend', 'offers on the public page');
reset role;
