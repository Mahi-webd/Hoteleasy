\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–29. Table QR: a diner calls the waiter from the table's QR code,
-- staff answer it; everything stays inside one hotel and follows the licence and the plan.
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

-- a restaurant with two tables and one menu item in the owner's hotel
create temp table q as select id h from public.hotels where name = 'Olsupat Lodge';
insert into pos_outlets (hotel_id, name, kind) values ((select h from q), 'QR Garden', 'restaurant');
insert into pos_tables (hotel_id, outlet_id, name) select (select h from q), id, x from pos_outlets, unnest(array['G1','G2']) x where name = 'QR Garden';
insert into menu_categories (hotel_id, name) values ((select h from q), 'QR Mains') on conflict do nothing;
insert into menu_items (hotel_id, category_id, name, price) select (select h from q), id, 'Nyama choma', 950 from menu_categories where hotel_id = (select h from q) and name = 'QR Mains';
create temp table qt as select l.token, t.id table_id, t.name from table_links l join pos_tables t on t.id = l.table_id join pos_outlets o on o.id = t.outlet_id where o.name = 'QR Garden';
grant select on q, qt to anon, authenticated;
select pg_temp.expect((select count(*) from qt) = 2, 'every new table gets a secret link');

-- The diner (no sign-in)
select pg_temp.as_user(null);
select pg_temp.expect(public.public_table('nonsense-token-123456') is null, 'unknown code shows nothing');
select pg_temp.expect((public.public_table((select token from qt where name = 'G1'))->>'table') = 'G1', 'table page opens with the token');
select pg_temp.expect(public.public_table((select token from qt where name = 'G1'))::text like '%Nyama choma%', 'menu with prices shown');
select pg_temp.expect_fail($$select * from table_calls$$, 'anon reading calls directly');
select pg_temp.expect_fail($$select * from table_links$$, 'anon reading tokens directly');
select public.public_table_call((select token from qt where name = 'G1'), 'waiter');
select public.public_table_call((select token from qt where name = 'G1'), 'bill', null, 'mpesa');
reset role;
select pg_temp.expect((select count(*) from table_calls where table_id = (select table_id from qt where name = 'G1') and status in ('open','on_way')) = 1, 'one open call per table (second tap updates it)');
select pg_temp.expect((select kind || '/' || pay_method from table_calls where table_id = (select table_id from qt where name = 'G1') and status = 'open') = 'bill/mpesa', 'call changed to the bill, paid by M-Pesa');
select pg_temp.as_user(null);
select pg_temp.expect_fail($$select public.public_table_call((select token from qt where name = 'G2'), 'pizza')$$, 'unknown request kind');

-- Staff of this hotel see and answer it
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect(public.table_qr_board((select h from q))::text like '%"kind": "bill"%', 'call appears on the live table map');
select public.table_call_update((select id from table_calls where table_id = (select table_id from qt where name = 'G1') and status = 'open'), 'on_way');
select pg_temp.as_user(null);
select pg_temp.expect((public.public_table((select token from qt where name = 'G1'))->'call'->>'status') = 'on_way', 'diner sees "on the way"');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.table_call_update((select id from table_calls where table_id = (select table_id from qt where name = 'G1') and status = 'on_way'), 'done');
select pg_temp.expect((public.table_qr_report((select h from q), current_date - 1, current_date + 1)->>'answered')::int >= 1, 'response-time report counts it');

-- Switches: table off, outlet off, new code
select public.table_qr_set_table((select table_id from qt where name = 'G2'), false);
select pg_temp.as_user(null);
select pg_temp.expect((public.public_table((select token from qt where name = 'G2'))->>'off')::boolean, 'switched-off table shows "not active"');
select pg_temp.expect_fail($$select public.public_table_call((select token from qt where name = 'G2'), 'waiter')$$, 'calling from a switched-off table');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.table_qr_set_outlet((select id from pos_outlets where name = 'QR Garden'), false);
select pg_temp.as_user(null);
select pg_temp.expect((public.public_table((select token from qt where name = 'G1'))->>'off')::boolean, 'switched-off outlet shows "not active"');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.table_qr_set_outlet((select id from pos_outlets where name = 'QR Garden'), true);
select public.table_link_reset((select table_id from qt where name = 'G1'));
select pg_temp.as_user(null);
select pg_temp.expect(public.public_table((select token from qt where name = 'G1')) is null, 'old sticker stops working after a new code');

-- Another hotel's staff can't see or touch it
reset role;
create temp table q2 as select id from public.hotels where name <> 'Olsupat Lodge' and id not in (select hotel_id from hotel_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') limit 1;
grant select on q2 to authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_fail($$select public.table_qr_board((select id from q2))$$, 'reading another hotel''s table map');
reset role;
