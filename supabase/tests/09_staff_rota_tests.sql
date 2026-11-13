\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–08.
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
create temp table sctx as select id h, (now() at time zone timezone)::date t,
  (date_trunc('week', (now() at time zone timezone)))::date wk from public.hotels where name='Olsupat Lodge';
grant select on sctx to authenticated, anon;
create temp table sv (k text primary key, v uuid);
grant all on sv to authenticated, anon;
select pg_temp.expect((select count(*) from shift_templates where hotel_id=(select h from sctx))=4, 'starter shift templates');

-- Owner builds the team
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect(public.staff_import_members((select h from sctx)) >= 5, 'team members added as staff');
select pg_temp.expect(public.staff_import_members((select h from sctx)) = 0, 'not added twice');
select pg_temp.expect((select department from staff where user_id='ffffffff-0000-0000-0000-000000000006')='Restaurant & bar', 'waiter in Restaurant & bar');
insert into staff (hotel_id, full_name, department, job_title, employment) select h, 'Joseph Kamau', 'Security', 'Night guard', 'casual' from sctx;
insert into sv select 'guard', id from staff where full_name='Joseph Kamau';
insert into sv select 'waiter', id from staff where user_id='ffffffff-0000-0000-0000-000000000006';
insert into staff_pay (staff_id, hotel_id, pay_type, rate) select v, (select h from sctx), 'daily', 800 from sv where k='guard';
select pg_temp.expect_fail($$update staff set user_id='bbbbbbbb-0000-0000-0000-000000000002' where full_name='Joseph Kamau'$$, 'linking a login from another hotel');

-- Rota
insert into sv select 'night', id from shift_templates where name='Night' and hotel_id=(select h from sctx);
insert into sv select 's1', public.shift_save((select h from sctx), (select v from sv where k='guard'), (select t from sctx), '22:00', '06:00', 30, (select v from sv where k='night'));
select pg_temp.expect((select ends_at - starts_at from shifts where id=(select v from sv where k='s1'))='8 hours', 'night shift runs into the next morning');
select pg_temp.expect_fail($$select public.shift_save((select h from sctx), (select v from sv where k='guard'), (select t from sctx), '23:00', '03:00')$$, 'double-booking the guard');
insert into sv select 'w1', public.shift_save((select h from sctx), (select v from sv where k='waiter'),
  (now() at time zone 'Africa/Nairobi')::date, ((now() at time zone 'Africa/Nairobi') - interval '20 minutes')::time, ((now() at time zone 'Africa/Nairobi') + interval '4 hours')::time, 0);
select pg_temp.expect((select count(*) from shifts where not published)=2, 'new shifts are drafts');

-- Others see nothing until it is published
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
select pg_temp.expect((select count(*) from shifts)=0, 'waiter sees no draft rota');
select pg_temp.expect_fail($$select public.shift_save((select h from sctx), (select v from sv where k='waiter'), (select t from sctx) + 1, '08:00', '16:00')$$, 'waiter changing the rota');
select pg_temp.expect((select count(*) from staff_pay)=0, 'waiter sees no pay');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect(public.rota_publish((select h from sctx), (select t from sctx) - 1, (select t from sctx) + 1) = 2, 'published 2 shifts');
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
select pg_temp.expect((select count(*) from shifts)=2, 'waiter sees the published rota');

-- Clock in / out
select pg_temp.expect((public.clock((select h from sctx), 'in')->>'late_minutes')::int >= 19, 'waiter clocked in, about 20 minutes late');
select pg_temp.expect_fail($$select public.clock((select h from sctx), 'in')$$, 'clocking in twice');
select pg_temp.expect_fail($$select public.clock((select h from sctx), 'in', (select v from sv where k='guard'))$$, 'waiter clocking in someone else');
select pg_temp.expect_fail($$insert into time_entries (hotel_id, staff_id, clock_in) select h, (select v from sv where k='waiter'), now() - interval '9 hours' from sctx$$, 'writing time entries directly');
select public.clock((select h from sctx), 'out');
select pg_temp.expect((select count(*) from time_entries where clock_out is not null)=1, 'clocked out');
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((public.clock((select h from sctx), 'in', (select v from sv where k='guard'))->>'name')='Joseph Kamau', 'front desk clocks in the guard');
select pg_temp.expect((select source from time_entries where staff_id=(select v from sv where k='guard'))='supervisor', 'marked as supervisor entry');
select pg_temp.as_user('77777777-0000-0000-0000-000000000007');
select pg_temp.expect_fail($$select public.clock((select h from sctx), 'out', (select v from sv where k='guard'))$$, 'storekeeper clocking out the guard');

-- Leave
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
insert into leave_requests (hotel_id, staff_id, kind, from_date, to_date, status, note)
  select h, (select v from sv where k='waiter'), 'annual', t + 10, t + 12, 'approved', 'Family wedding' from sctx;
select pg_temp.expect((select status from leave_requests)='requested', 'own request stays "requested"');
select pg_temp.expect_fail($$insert into leave_requests (hotel_id, staff_id, kind, from_date, to_date) select h, (select v from sv where k='guard'), 'annual', t + 1, t + 2 from sctx$$, 'asking leave for someone else');
select pg_temp.expect_fail($$update leave_requests set status='approved'$$, 'approving own leave');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into sv select 'w2', public.shift_save((select h from sctx), (select v from sv where k='waiter'), (select t from sctx) + 11, '08:00', '16:00');
update leave_requests set status='approved';
select pg_temp.expect((select decided_by from leave_requests)='aaaaaaaa-0000-0000-0000-000000000001', 'approval recorded');
select pg_temp.expect(not exists (select 1 from shifts where id=(select v from sv where k='w2')), 'shift on leave day removed');
select pg_temp.expect_fail($$select public.shift_save((select h from sctx), (select v from sv where k='waiter'), (select t from sctx) + 11, '08:00', '16:00')$$, 'scheduling someone on leave');

-- Copy the week forward
select pg_temp.expect((public.rota_copy_week((select h from sctx), (select t from sctx) - 3)->>'copied')::int >= 2, 'week copied forward');
select pg_temp.expect((select count(*) from shifts where starts_at > now() + interval '6 days' and not published) >= 2, 'copies are drafts');

-- Hours report
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
create temp table hr as select public.staff_hours_report((select h from sctx), (select t from sctx) - 1, (select t from sctx) + 1) j;
select pg_temp.expect((select (x->>'late')::int from hr, jsonb_array_elements(j) x where x->>'name' = (select full_name from staff where id=(select v from sv where k='waiter')))=1, 'late counted');
select pg_temp.expect((select (x->>'worked_days')::int from hr, jsonb_array_elements(j) x where x->>'name'='Joseph Kamau')=1
                  and (select (x->>'pay_estimate')::numeric from hr, jsonb_array_elements(j) x where x->>'name'='Joseph Kamau')=800, 'guard: 1 day × 800');
select pg_temp.expect((select (x->>'open')::int from hr, jsonb_array_elements(j) x where x->>'name'='Joseph Kamau')=1, 'still clocked in shows as open');
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
select pg_temp.expect_fail($$select public.staff_hours_report((select h from sctx), current_date - 7, current_date)$$, 'waiter reading the hours report');

-- Manager fixes a forgotten clock-out
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_fail($$select public.time_entry_fix((select id from time_entries where staff_id=(select v from sv where k='guard')), now() - interval '1 hour', now(), '')$$, 'fix without a reason');
select public.time_entry_fix((select id from time_entries where staff_id=(select v from sv where k='guard')), now() - interval '8 hours', now(), 'Forgot to clock out');
select pg_temp.expect((select edited_by from time_entries where staff_id=(select v from sv where k='guard'))='aaaaaaaa-0000-0000-0000-000000000001', 'edit recorded');

-- Other hotels
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect((select count(*) from staff where hotel_id=(select h from sctx))=0, 'other hotel sees no staff');
select pg_temp.expect_fail($$select public.shift_save((select h from sctx), (select v from sv where k='guard'), current_date + 3, '08:00', '16:00')$$, 'other hotel changing the rota');

select 'STAFF TESTS DONE' as result;
