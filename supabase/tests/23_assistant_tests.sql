\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–22. "Ask HotelEasy": who may ask, limits, the log and feedback.
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
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;
reset role;
create temp table rx as select id h from hotels where name = 'Olsupat Lodge';
create temp table ids (k text primary key, id uuid);
grant select on rx to authenticated, service_role; grant select, insert on ids to authenticated, service_role;

select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((public.assistant_begin((select h from rx)))->>'ok' = 'true'
  and (public.assistant_begin((select h from rx)))->>'role' = 'front_desk'
  and (public.assistant_begin((select h from rx)))->'permissions' ? 'reservations.checkin'
  and not ((public.assistant_begin((select h from rx)))->'permissions' ? 'billing.refund'), 'front desk may ask; the assistant knows their role and rights');
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_err($$select public.assistant_begin((select h from rx))$$, 'not a member', 'someone from another hotel');
select pg_temp.as_user(null);
select pg_temp.expect_err($$select public.assistant_begin((select h from rx))$$, 'not a member|permission denied', 'not signed in');

-- answers are recorded by the Edge Function only
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_err($$select public.assistant_record((select h from rx), auth.uid(), 'pos', 'q', 'a', 1, 1)$$, 'permission denied', 'staff writing to the log');
reset role; set role service_role;
insert into ids select 'fd', public.assistant_record((select h from rx), 'cccccccc-0000-0000-0000-000000000003', 'reservations', 'How do I check out a guest?', 'Steps…', 9000, 120);
insert into ids select 'hk', public.assistant_record((select h from rx), 'dddddddd-0000-0000-0000-000000000004', 'housekeeping', 'How do I mark a room clean?', 'Steps…', 9000, 80);
reset role;

-- feedback on your own answers only
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select public.assistant_feedback((select id from ids where k = 'fd'), false);
select public.assistant_feedback((select id from ids where k = 'hk'), true);
reset role;
select pg_temp.expect((select helpful from assistant_log where id = (select id from ids where k = 'fd')) is null
  and (select helpful from assistant_log where id = (select id from ids where k = 'hk')), 'feedback only on your own answers');

-- who sees the questions
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((select count(*) from assistant_log) = 1, 'staff see only their own questions');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect((select count(*) from assistant_log where hotel_id = (select h from rx)) = 2, 'the owner sees what the team asks (training gaps)');

-- limits: 40 questions an hour per person
reset role;
insert into assistant_log (hotel_id, user_id, question) select (select h from rx), 'cccccccc-0000-0000-0000-000000000003', 'q' || g from generate_series(1, 39) g;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((public.assistant_begin((select h from rx)))->>'ok' = 'false', '40 questions in an hour: asked to wait');
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select pg_temp.expect((public.assistant_begin((select h from rx)))->>'ok' = 'true', 'others can still ask');
-- switched off for the hotel
reset role;
update hotels set assistant_enabled = false where id = (select h from rx);
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select pg_temp.expect((public.assistant_begin((select h from rx)))->>'message' ~ 'switched off', 'hotel switched it off');
reset role;
update hotels set assistant_enabled = true where id = (select h from rx);
delete from assistant_log;
