\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–07.
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
create temp table ectx as select id h, (now() at time zone timezone)::date t, date_trunc('month', (now() at time zone timezone))::date m from public.hotels where name='Olsupat Lodge';
create temp table ids as select
  (select id from expense_categories where hotel_id=(select h from ectx) and name='Electricity') elec,
  (select id from expense_categories where hotel_id=(select h from ectx) and name='Salaries and wages') sal,
  (select id from expense_categories where hotel_id=(select h from ectx) and name='Food bought for the kitchen') food,
  (select id from expense_categories where hotel_id=(select h from ectx) and grp='stock') stock,
  (select id from expense_categories where hotel_id=(select h from ectx) and name='Rent') rent;
grant select on ectx, ids to authenticated, anon;
select pg_temp.expect((select count(*) from expense_categories where hotel_id=(select h from ectx)) >= 20, 'starter categories for existing hotels');

-- Who can see money
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((select count(*) from expense_categories)=0, 'front desk sees no expense categories');
select pg_temp.expect_fail($$insert into expenses (hotel_id, spent_on, category_id, payee, description, amount) select h, t, (select elec from ids), 'KPLC', 'Power', 100 from ectx$$, 'front desk adding expenses');
select pg_temp.expect_fail($$select public.pnl_report((select h from ectx), current_date - 30, current_date)$$, 'front desk reading P&L');
select pg_temp.as_user('77777777-0000-0000-0000-000000000007');
select pg_temp.expect_fail($$select public.pnl_report((select h from ectx), current_date - 30, current_date)$$, 'storekeeper reading P&L');

-- Accountant records expenses
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, vat_amount, reference, status, paid_method, paid_on)
  select h, t, (select elec from ids), 'KPLC', 'Electricity token', 11600, 1600, 'TKN-1', 'paid', 'mpesa', t from ectx;
insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, due_on, recurring)
  select h, m, (select sal from ids), 'Staff', 'November salaries', 150000, m + 27, true from ectx;
insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, status, paid_method)
  select h, t, (select food from ids), 'Wakulima market', 'Vegetables', 4000, 'paid', 'cash' from ectx;
select pg_temp.expect((select count(*) from expenses)=3 and (select max(number) from expenses)=3, 'numbered expenses');
select pg_temp.expect((select paid_on from expenses where description='Vegetables')=(select t from ectx), 'paid date defaults to spend date');
select pg_temp.expect((select net_amount from expenses where description='Electricity token')=10000, 'net of VAT');
select pg_temp.expect_fail($$insert into expenses (hotel_id, spent_on, category_id, description, amount) select h, t, (select elec from ids), 'No payee', 10 from ectx$$, 'expense without payee');
select pg_temp.expect_fail($$insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, vat_amount) select h, t, (select elec from ids), 'X', 'VAT too big', 10, 20 from ectx$$, 'VAT above amount');
select pg_temp.expect_fail($$update expenses set amount = 1 where description='Electricity token'$$, 'accountant editing a paid expense');
select pg_temp.expect_fail($$update expenses set status='void', void_reason='oops' where description='Vegetables'$$, 'accountant voiding');
delete from expenses where description='Vegetables';
select pg_temp.expect((select count(*) from expenses)=3, 'still 3 expenses');
-- pay the salaries
update expenses set status='paid', paid_method='bank_transfer', paid_on=(select t from ectx) where description='November salaries';
select pg_temp.expect((select status from expenses where description='November salaries')='paid', 'bill paid');
select pg_temp.expect_fail($$update expenses set status='unpaid' where description='November salaries'$$, 'accountant reopening a paid bill');
-- budgets are for managers
select pg_temp.expect_fail($$insert into budgets (hotel_id, month, category_id, amount) select h, m, (select elec from ids), 9000 from ectx$$, 'accountant setting budgets');

-- Owner: budgets, void, recurring
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into budgets (hotel_id, month, category_id, amount) select h, m, (select elec from ids), 9000 from ectx;
insert into budgets (hotel_id, month, revenue_grp, amount) select h, m, 'rooms', 500000 from ectx;
select pg_temp.expect_fail($$insert into budgets (hotel_id, month, category_id, amount) select h, m + 3, (select elec from ids), 1 from ectx$$, 'budget not on the 1st');
select pg_temp.expect_fail($$update expenses set status='void' where description='Vegetables'$$, 'void without reason');
insert into expenses (hotel_id, spent_on, category_id, payee, description, amount) select h, t, (select rent from ids), 'Landlord', 'Typo entry', 99999 from ectx;
update expenses set status='void', void_reason='Entered twice' where description='Typo entry';
select pg_temp.expect_fail($$update expenses set status='unpaid' where description='Typo entry'$$, 'reviving a void expense');
select pg_temp.expect((select public.expense_copy_recurring((select h from ectx), ((select m from ectx) + interval '1 month')::date))=1, 'salaries copied to next month');
select pg_temp.expect((select public.expense_copy_recurring((select h from ectx), ((select m from ectx) + interval '1 month')::date))=0, 'not copied twice');
select pg_temp.expect((select status from expenses where description='November salaries' and spent_on > (select t from ectx) + 1)='unpaid', 'copy is an unpaid bill');

-- Bill from a delivery (storekeeper can create it)
select pg_temp.as_user('77777777-0000-0000-0000-000000000007');
create temp table rb as select public.inv_receive((select h from ectx), (select id from stock_locations where name='Main store'),
  jsonb_build_array(jsonb_build_object('item_id', (select id from stock_items where name='Rice'), 'qty', 25, 'unit_cost', 140)),
  (select id from suppliers where name='KBL Distributors'), null, 'INV-RICE') b;
select public.expense_from_receipt((select b from rb), (select t from ectx) + 30);
select pg_temp.expect_fail($$select public.expense_from_receipt((select b from rb))$$, 'second bill for the same delivery');
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
select pg_temp.expect((select amount from expenses where reference='INV-RICE')=3500 and (select status from expenses where reference='INV-RICE')='unpaid', 'supplier bill 3,500 unpaid');

-- P&L
create temp table p as select public.pnl_report((select h from ectx), (select m from ectx), (select t from ectx)) j;
create temp view pl as select x->>'section' sec, x->>'line' line, x->>'category' cat, (x->>'actual')::numeric actual, (x->>'budget')::numeric budget
  from p, jsonb_array_elements(j->'lines') x;
select pg_temp.expect((select actual from pl where cat='Electricity')=10000 and (select budget from pl where cat='Electricity')=9000, 'electricity actual 10,000 (net) vs budget 9,000');
select pg_temp.expect((select actual from pl where cat='Salaries and wages')=150000, 'salaries');
select pg_temp.expect((select sec from pl where cat='Food bought for the kitchen')='cost_of_sales', 'food purchases in cost of sales');
select pg_temp.expect(not exists (select 1 from pl where cat like 'Stock purchases%'), 'stock bills stay out of P&L');
select pg_temp.expect(not exists (select 1 from pl where cat='Rent'), 'void expense left out');
select pg_temp.expect((select budget from pl where sec='revenue' and line='rooms')=500000, 'room revenue target');
select pg_temp.expect((select actual from pl where sec='revenue' and line='rooms')
                      = (select (public.report_period((select h from ectx), (select m from ectx), (select t from ectx))->'kpis'->>'room_revenue')::numeric), 'revenue matches Reports');
select pg_temp.expect(exists (select 1 from pl where line='stock_sold'), 'stock used from recipes in cost of sales');
select pg_temp.expect((select (j->'vat'->>'input')::numeric from p)=1600, 'input VAT 1,600');
select pg_temp.expect((select (j->'payables'->>'total')::numeric from p)=3500 + 150000, 'bills to pay: rice + next month salaries');
select pg_temp.expect((select sum((x->>'amount')::numeric) from p, jsonb_array_elements(j->'paid_out') x)=11600+150000+4000, 'paid out by method');

-- Other hotels
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect((select count(*) from expenses where hotel_id=(select h from ectx))=0, 'other hotel sees no expenses');
select pg_temp.expect_fail($$select public.pnl_report((select h from ectx), current_date - 30, current_date)$$, 'other hotel P&L');
select pg_temp.expect_fail($$insert into expenses (hotel_id, spent_on, category_id, payee, description, amount) select (select id from hotels where name<>'Olsupat Lodge' limit 1), current_date, (select elec from ids), 'X', 'cross-hotel category', 10$$, 'using another hotel''s category');

select 'EXPENSES TESTS DONE' as result;
