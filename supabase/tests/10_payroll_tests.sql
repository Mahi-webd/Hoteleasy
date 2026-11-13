\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–09.
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
-- PAYE on known figures (KES 100,000 gross → taxable 89,750 → PAYE 19,308.35)
select pg_temp.expect(public.paye_on(89750, (select paye_bands from payroll_rates limit 1)) - 2400 = 19308.35, 'PAYE on 89,750 taxable');
select pg_temp.expect(public.paye_on(24000, (select paye_bands from payroll_rates limit 1)) = 2400, 'first band fully offset by relief');
select pg_temp.expect(public.paye_on(900000, (select paye_bands from payroll_rates limit 1)) = 2400 + 2083.25 + 140300.10 + 97500 + 35000, 'top band 35%');

create temp table pctx as select id h, date_trunc('month', (now() at time zone timezone))::date m from public.hotels where name='Olsupat Lodge';
grant select on pctx to authenticated, anon;

-- Owner sets pay: Mercy-like monthly 100,000 (waiter), guard casual daily 800 (from test 09)
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into staff_pay (staff_id, hotel_id, pay_type, rate, kra_pin, pay_method, pay_account)
  select id, hotel_id, 'monthly', 100000, 'A123456789Z', 'mpesa', '0712000111' from staff where user_id='ffffffff-0000-0000-0000-000000000006';
insert into staff (hotel_id, full_name, department, employment) select h, 'Low Earner', 'Housekeeping', 'permanent' from pctx;
insert into staff_pay (staff_id, hotel_id, pay_type, rate) select id, hotel_id, 'monthly', 15000 from staff where full_name='Low Earner';
update staff_pay set statutory = false where staff_id = (select id from staff where full_name='Joseph Kamau');

-- Front desk and storekeeper can't touch payroll
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_fail($$select public.payroll_generate((select h from pctx), (select m from pctx))$$, 'front desk running payroll');
select pg_temp.expect((select count(*) from payroll_rates)=0, 'front desk sees no rates');

-- Accountant prepares
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
create temp table pr as select public.payroll_generate((select h from pctx), (select m from pctx)) id;
create temp view sl as select ps.* from public.payslips ps where ps.run_id = (select id from pr);
grant select on sl to authenticated;
select pg_temp.expect((select count(*) from sl) >= 3, 'payslips for everyone with a pay rate');
select pg_temp.expect((select nssf_tier1 from sl where rate=100000)=540 and (select nssf_tier2 from sl where rate=100000)=5460, 'NSSF 540 + 5,460');
select pg_temp.expect((select shif from sl where rate=100000)=2750 and (select ahl from sl where rate=100000)=1500, 'SHIF 2,750, housing levy 1,500');
select pg_temp.expect((select taxable from sl where rate=100000)=89750, 'taxable 89,750');
select pg_temp.expect((select paye from sl where rate=100000)=19308.35, 'PAYE 19,308.35');
select pg_temp.expect((select net from sl where rate=100000)=100000-6000-2750-1500-19308.35, 'net pay');
select pg_temp.expect((select employer_nssf from sl where rate=100000)=6000 and (select employer_ahl from sl where rate=100000)=1500, 'employer NSSF and levy');
select pg_temp.expect((select paye from sl where full_name='Low Earner')=0 and (select shif from sl where full_name='Low Earner')=412.5, 'low earner: no PAYE, SHIF 412.50');
select pg_temp.expect((select shif from sl where full_name='Joseph Kamau')=0 and (select basic from sl where full_name='Joseph Kamau')=800 * (select days_worked from sl where full_name='Joseph Kamau'), 'casual: days × rate, no statutory');
-- adjustments
update payslips set overtime_hours = 10, bonus = 5000, advances = 2000 where run_id = (select id from pr) and rate = 100000;
select pg_temp.expect((select overtime_pay from sl where rate=100000)=round(100000/225.0*10*1.5, 2), 'overtime at 1.5× (monthly/225)');
select pg_temp.expect((select gross from sl where rate=100000)=100000 + round(100000/225.0*10*1.5, 2) + 5000, 'gross with overtime and bonus');
select pg_temp.expect_fail($$update payslips set rate = 1 where run_id = (select id from pr) and rate = 100000$$, 'accountant changing a pay rate');
update payslips set paye = 0, net = 999999 where run_id = (select id from pr) and rate = 100000;
select pg_temp.expect((select paye from sl where rate=100000) > 19308.35, 'PAYE recalculated, not typed');
select pg_temp.expect_fail($$update payslips set advances = 999999 where run_id = (select id from pr) and rate = 100000$$, 'advance bigger than pay');
select pg_temp.expect_fail($$select public.payroll_set_status((select id from pr), 'approve')$$, 'accountant approving');
-- staff can't see drafts
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
select pg_temp.expect((select count(*) from payslips)=0, 'waiter sees no draft payslip');

-- Owner approves; staff see own payslip only
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.payroll_set_status((select id from pr), 'approve');
select pg_temp.expect_fail($$update payslips set bonus = 1 where run_id = (select id from pr)$$, 'editing an approved payroll');
select pg_temp.expect_fail($$select public.payroll_generate((select h from pctx), (select m from pctx))$$, 'regenerating an approved payroll');
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
select pg_temp.expect((select count(*) from payslips)=1 and (select rate from payslips)=100000, 'waiter sees only her payslip');
select pg_temp.expect((select count(*) from payroll_runs)=1, 'and the run it belongs to');
select pg_temp.expect((select count(*) from staff_pay)=0, 'but not pay rates');

-- Paid → expenses and statutory bills
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
select public.payroll_set_status((select id from pr), 'paid', current_date);
select pg_temp.expect((select status from payroll_runs where id=(select id from pr))='paid', 'payroll paid');
create temp view pex as select e.* from public.expenses e where e.description like '%' || to_char((select m from pctx), 'FMMonth YYYY');
grant select on pex to authenticated;
select pg_temp.expect((select amount from pex where description like 'Net wages%')=(select sum(net) from sl), 'net wages expense paid');
select pg_temp.expect((select amount from pex where description like 'PAYE%')=(select sum(paye) from sl) and (select status from pex where description like 'PAYE%')='unpaid', 'PAYE bill to pay');
select pg_temp.expect((select extract(day from due_on) from pex where description like 'PAYE%')=9, 'due on the 9th');
select pg_temp.expect((select sum(amount) from pex) = (select sum(gross + employer_nssf + employer_ahl + nita - advances - other_deductions) from sl), 'total staff cost recorded (advances already paid out)');
select pg_temp.expect_fail($$select public.payroll_set_status((select id from pr), 'paid')$$, 'paying twice');

-- Rates: owner only
select pg_temp.expect_fail($$insert into payroll_rates (hotel_id, effective_from, paye_bands) select h, '2027-01-01', '[]' from pctx$$, 'accountant changing tax rates');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into payroll_rates (hotel_id, effective_from, paye_bands, note)
  select h, '2027-01-01', '[{"upto":32333,"rate":0.0},{"upto":500000,"rate":0.30},{"upto":800000,"rate":0.325},{"upto":null,"rate":0.35}]', 'test' from pctx;
select pg_temp.expect((select count(*) from payroll_rates where hotel_id=(select h from pctx))=2, 'new rate table added');

select 'PAYROLL TESTS DONE' as result;
