\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–31. Table QR: staff see WHO is on the way; diners never see staff names.
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

create temp table q as select id h from public.hotels where name = 'Olsupat Lodge';
insert into pos_outlets (hotel_id, name, kind) values ((select h from q), 'Names Terrace', 'restaurant');
insert into pos_tables (hotel_id, outlet_id, name) select (select h from q), id, 'N1' from pos_outlets where name = 'Names Terrace';
create temp table qt as select l.token, t.id table_id from table_links l join pos_tables t on t.id = l.table_id join pos_outlets o on o.id = t.outlet_id where o.name = 'Names Terrace';
update profiles set full_name = 'Ravi Otieno' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
grant select on q, qt to anon, authenticated;

select pg_temp.as_user(null);
select public.public_table_call((select token from qt), 'waiter');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
create temp table qb as select public.table_qr_board((select h from q)) b;
select pg_temp.expect((select b::text from qb) not like '%Ravi Otieno%', 'nobody named before someone answers');
select public.table_call_update((select id from table_calls where table_id = (select table_id from qt) and status = 'open'), 'on_way');
select pg_temp.expect((select x->'call'->>'by_name' from jsonb_array_elements(public.table_qr_board((select h from q))) o, jsonb_array_elements(o->'tables') x
                        where x->>'name' = 'N1') = 'Ravi Otieno', 'board says who is on the way');
select pg_temp.expect((select x->'call'->>'by_id' from jsonb_array_elements(public.table_qr_board((select h from q))) o, jsonb_array_elements(o->'tables') x
                        where x->>'name' = 'N1') = 'aaaaaaaa-0000-0000-0000-000000000001', 'board knows it is me');

select pg_temp.as_user(null);
select pg_temp.expect(public.public_table((select token from qt))::text not like '%Ravi%', 'the diner never sees staff names');
select pg_temp.expect_fail($$select public.staff_short_name('aaaaaaaa-0000-0000-0000-000000000001')$$, 'a visitor looking up staff names');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_fail($$select public.staff_short_name('aaaaaaaa-0000-0000-0000-000000000001')$$, 'staff calling the name lookup directly');
reset role;
