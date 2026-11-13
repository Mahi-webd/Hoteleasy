\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–12.
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

-- two free rooms for today → +3
create temp table x as
  select h.id h, (select id from room_types where hotel_id = h.id and name = 'Standard') std, (select id from room_types where hotel_id = h.id and name = 'Deluxe') dlx,
    (select array_agg(id) from (select r.id from rooms r where r.hotel_id = h.id and r.status = 'available'
       and not exists (select 1 from reservations z where z.room_id = r.id and z.status in ('confirmed','checked_in') and daterange(z.check_in, z.check_out) && daterange(current_date, current_date + 4))
       order by r.room_number limit 3) s) rooms
  from hotels h where h.name = 'Olsupat Lodge';
grant select on x to authenticated;
select pg_temp.expect(array_length((select rooms from x), 1) = 3, 'three free rooms to test with');
create temp table ids (k text primary key, id uuid);
grant select, insert, update on ids to authenticated;

-- ============================ companies
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_fail($$insert into companies (hotel_id, name) select h, 'Front Desk Ltd' from x$$, 'front desk adding companies');
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
select pg_temp.expect_fail($$insert into companies (hotel_id, name, kra_pin) select h, 'Bad Pin', '12345' from x$$, 'invalid KRA PIN');
insert into companies (hotel_id, name, kra_pin, email, credit_limit, terms_days, discount_pct, contact_name)
  select h, 'Safaricom PLC', 'p051234567x', 'Travel@Safaricom.example', 10000, 30, 10, 'Jane Travel Desk' from x;
insert into ids select 'co', id from companies where name = 'Safaricom PLC';
insert into company_rates (company_id, room_type_id, hotel_id, rate) select (select id from ids where k='co'), dlx, h, 8000 from x;
select pg_temp.expect((select kra_pin from companies where name='Safaricom PLC') = 'P051234567X' and (select email from companies where name='Safaricom PLC') = 'travel@safaricom.example', 'PIN upper-cased, email lower-cased');

-- negotiated quotes
select pg_temp.expect(((public.stay_quote((select dlx from x), current_date + 50, current_date + 52, false, (select id from ids where k='co')))->>'total')::numeric = 16000, 'fixed company rate for Deluxe');
select pg_temp.expect(((public.stay_quote((select std from x), current_date + 50, current_date + 51, false, (select id from ids where k='co')))->>'total')::numeric
  = round(((public.stay_quote((select std from x), current_date + 50, current_date + 51))->>'total')::numeric * 0.9), '10% off the normal price for other rooms');

-- ============================ a stay billed to the company (room only)
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into guests (hotel_id, first_name, last_name, phone, company_id) select h, 'Otieno', 'Business', '+254700999001', (select id from ids where k='co') from x;
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night, company_id, bill_to, company_ref)
  select h, (select id from guests where phone='+254700999001'), std, rooms[1], current_date, current_date + 2, 5000, (select id from ids where k='co'), 'company_room', 'LPO-778' from x;
insert into ids select 'r1', id from reservations where company_ref = 'LPO-778';
select status from public.check_in_reservation((select id from ids where k='r1'));
insert into folio_charges (hotel_id, reservation_id, kind, description, unit_price) select h, (select id from ids where k='r1'), 'drinks', 'Bar', 1500 from x;
select pg_temp.expect(public.company_share((select id from ids where k='r1')) = 10000, 'company share is the room nights');
update reservations set check_out = current_date + 1 where id = (select id from ids where k='r1');  -- leaves after one night
select pg_temp.expect(public.company_share((select id from ids where k='r1')) = 5000, 'share follows the room charges');
update reservations set check_out = current_date + 2 where id = (select id from ids where k='r1');
select pg_temp.expect_fail($$select public.check_out_reservation((select id from ids where k='r1'))$$, 'check-out with the bar bill unpaid');
reset role;
select pg_temp.expect((select count(*) from folio_transfers where reservation_id = (select id from ids where k='r1')) = 0, 'failed check-out moved nothing');
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into payments (hotel_id, reservation_id, method, amount) select h, (select id from ids where k='r1'), 'cash', 1500 from x;
select status from public.check_out_reservation((select id from ids where k='r1'));
select pg_temp.expect((select balance from reservation_balances where reservation_id = (select id from ids where k='r1')) = 0
  and (select transferred_total from reservation_balances where reservation_id = (select id from ids where k='r1')) = 5000, 'left early: one night (5,000) to the company, bar paid by the guest');
select pg_temp.expect((select coalesce(sum(amount),0) from payments where reservation_id = (select id from ids where k='r1') and voided_at is null) = 1500, 'company share is not counted as money received');
select pg_temp.expect((select bill_to->>'company' from invoices where reservation_id = (select id from ids where k='r1') and superseded_at is null) = 'Safaricom PLC'
  and (select bill_to->>'kra_pin' from invoices where reservation_id = (select id from ids where k='r1') and superseded_at is null) = 'P051234567X'
  and (select bill_to->>'order_ref' from invoices where reservation_id = (select id from ids where k='r1') and superseded_at is null) = 'LPO-778', 'invoice addressed to the company with PIN and LPO');
select pg_temp.expect((select count(*) from company_ledger) = 0, 'front desk cannot read the company ledger');
select pg_temp.expect((select (c->>'balance') is null and (c->>'over_limit')::boolean = false from jsonb_array_elements(public.company_accounts((select h from x))) c where c->>'name' = 'Safaricom PLC'), 'front desk sees the limit, not the balance');

-- ============================ credit limit
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night, company_id, bill_to)
  select h, (select id from guests where phone='+254700999001'), std, rooms[2], current_date, current_date + 3, 9000, (select id from ids where k='co'), 'company_all' from x;
insert into ids select 'r2', id from reservations where rate_per_night = 9000 and company_id = (select id from ids where k='co');
select status from public.check_in_reservation((select id from ids where k='r2'));
select pg_temp.expect_fail($$select public.check_out_reservation((select id from ids where k='r2'))$$, 'front desk going over the credit limit');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select status from public.check_out_reservation((select id from ids where k='r2'));
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
select pg_temp.expect((select sum(amount) from company_ledger where company_id = (select id from ids where k='co') and voided_at is null) = 14000, 'manager can go over the limit (owes 14,000)');
select pg_temp.expect((select (c->>'over_limit')::boolean from jsonb_array_elements(public.company_accounts((select h from x))) c where c->>'name' = 'Safaricom PLC'), 'shown as over the limit');

-- ============================ payments and ageing
reset role;
update company_ledger set entry_date = current_date - 75 where reservation_id = (select id from ids where k='r1');   -- due 45 days ago
update company_ledger set entry_date = current_date - 10 where reservation_id = (select id from ids where k='r2');   -- not due yet
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
select pg_temp.expect((public.company_statement((select id from ids where k='co'), current_date - 90, current_date))->'ageing'->>'d60' = '5000.00'
  or ((public.company_statement((select id from ids where k='co'), current_date - 90, current_date))->'ageing'->>'d60')::numeric = 5000, '5,000 is 31–60 days overdue');
select public.company_entry((select id from ids where k='co'), 'payment', 12000, current_date, 'mpesa', 'sgh7k2l9pq', null);
select pg_temp.expect_fail($$select public.company_entry((select id from ids where k='co'), 'payment', 100, current_date, 'mpesa', 'SGH7K2L9PQ', null)$$, 'same M-Pesa code twice');
select pg_temp.expect_fail($$select public.company_entry((select id from ids where k='co'), 'payment', 100, current_date + 1, 'cash', null, null)$$, 'payment dated in the future');
select pg_temp.expect_fail($$select public.company_entry((select id from ids where k='co'), 'credit', 100, null, null, null, '')$$, 'credit note without a reason');
create temp table st as select public.company_statement((select id from ids where k='co'), current_date - 90, current_date) s;
select pg_temp.expect((select (s->>'closing')::numeric from st) = 2000, 'balance after payment 2,000');
select pg_temp.expect((select (s->'ageing'->>'overdue')::numeric from st) = 0 and (select (s->'ageing'->>'current')::numeric from st) = 2000, 'payment cleared the oldest (overdue) stay first');
select pg_temp.expect((select (s->'entries'->-1->>'balance')::numeric from st) = 2000 and (select jsonb_array_length(s->'entries') from st) = 3, 'statement lists stays and payment with running balance');
select pg_temp.expect((select s->'entries'->0->>'invoice' from st) like '%-%', 'statement shows the hotel invoice number');
select pg_temp.expect(((public.company_statement((select id from ids where k='co'), current_date - 5, current_date))->>'opening')::numeric = 14000, 'opening balance carries forward');
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_fail($$select public.company_entry((select id from ids where k='co'), 'payment', 100, null, 'cash', null, null)$$, 'front desk recording company payments');
select pg_temp.expect_fail($$select public.company_statement((select id from ids where k='co'), current_date - 5, current_date)$$, 'front desk printing statements');

-- ============================ undo a stay → back on the guest's bill
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
select public.company_entry_void((select id from company_ledger where reservation_id = (select id from ids where k='r2')), 'Booked privately, not on the LPO');
select pg_temp.expect((select balance from reservation_balances where reservation_id = (select id from ids where k='r2')) = 9000
  and (select sum(amount) from company_ledger where company_id = (select id from ids where k='co') and voided_at is null) = -7000, 'undoing puts it back on the guest; company now in credit');
-- move it again by hand (e.g. a debtor the company agreed to pay)
select public.company_transfer((select id from ids where k='r2'), (select id from ids where k='co'), 6000);
select pg_temp.expect((select balance from reservation_balances where reservation_id = (select id from ids where k='r2')) = 3000, 'part of a debt moved to the company');
select pg_temp.expect_fail($$select public.company_transfer((select id from ids where k='r2'), (select id from ids where k='co'), 99999)$$, 'moving more than the guest owes');

-- other hotels can't see it
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect((select count(*) from companies where name = 'Safaricom PLC') = 0, 'other hotels cannot see the company');
select pg_temp.expect_fail($$select public.company_transfer((select id from ids where k='r2'), (select id from ids where k='co'), 1)$$, 'other hotel moving bills');
reset role;
