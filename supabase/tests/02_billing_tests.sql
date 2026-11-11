\set ON_ERROR_STOP 1
-- Run after 00 stub, both migrations, and 01 tests (reuses their users + hotel).
create or replace function pg_temp.as_user(_id uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(_id::text,''), false);
  execute case when _id is null then 'set role anon' else 'set role authenticated' end; end $$;
create or replace function pg_temp.expect_fail(_sql text, _label text) returns void language plpgsql as $$
begin
  begin execute _sql; exception when others then raise notice 'PASS (blocked) %: %', _label, sqlerrm; return; end;
  raise exception 'FAIL: % was allowed', _label;
end $$;
create or replace function pg_temp.expect(_cond boolean, _label text) returns void language plpgsql as $$
begin if not _cond then raise exception 'FAIL: %', _label; end if; raise notice 'PASS %', _label; end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
reset role;
create temp table b as select (select id from hotels where name='Olsupat Lodge') h1;
grant select on b to authenticated, anon;

-- Owner sets KRA PIN + levy 2%
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update hotels set kra_pin='P051234567X', tourism_levy_rate=0.02, mpesa_paybill='522522' where id=(select h1 from b);
select pg_temp.expect_fail($$update hotels set next_invoice_number=0 where id=(select h1 from b)$$, 'lower invoice counter');

-- Carol (front desk) books a 3-night stay starting yesterday in room 102 and checks in
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night)
  select h1, (select id from guests limit 1), rm.room_type_id, rm.id, current_date-1, current_date+2, 5000
  from b, (select * from rooms where room_number='102') rm;
create temp view rr as select id from public.reservations where room_id=(select id from public.rooms where room_number='102');
grant select on rr to authenticated;
select status from public.check_in_reservation((select id from rr)) ;
select pg_temp.expect((select count(*) from folio_charges where reservation_id=(select id from rr) and voided_at is null)=3, '3 room nights posted at check-in');
select pg_temp.expect((select sum(amount) from folio_charges where reservation_id=(select id from rr))=15000, 'room total 15,000');
-- VAT-inclusive split: 5000 / 1.18 = 4237.29 net, vat 677.97, levy 84.74
select pg_temp.expect((select net_amount=4237.29 and vat_amount=677.97 and levy_amount=84.74 from folio_charges where reservation_id=(select id from rr) limit 1), 'VAT 16% + levy 2% inclusive split');
select pg_temp.expect_fail($$insert into folio_charges(hotel_id,reservation_id,kind,description,stay_date,unit_price) select h1,(select id from rr),'room','fake',current_date+5,1 from b$$, 'manual room charge');
insert into folio_charges(hotel_id,reservation_id,kind,description,quantity,unit_price) select h1,(select id from rr),'drinks','Tusker x2',2,350 from b;
select pg_temp.expect_fail($$insert into folio_charges(hotel_id,reservation_id,kind,description,unit_price) select h1,(select id from rr),'food','neg',-100 from b$$, 'negative non-discount');
update folio_charges set unit_price=1;
select pg_temp.expect((select sum(amount) from folio_charges where reservation_id=(select id from rr))=15700, 'direct edits ignored; total 15,700 with drinks');
-- M-Pesa payment, bad code, duplicate code
select pg_temp.expect_fail($$insert into payments(hotel_id,reservation_id,method,amount,reference) select h1,(select id from rr),'mpesa',100,'bad' from b$$, 'malformed M-Pesa code');
insert into payments(hotel_id,reservation_id,method,amount,reference) select h1,(select id from rr),'mpesa',10000,'tf12abc3xy' from b;
select pg_temp.expect_fail($$insert into payments(hotel_id,reservation_id,method,amount,reference) select h1,(select id from rr),'mpesa',10,'TF12ABC3XY' from b$$, 'duplicate M-Pesa code');
select pg_temp.expect_fail($$insert into payments(hotel_id,reservation_id,method,amount) select h1,(select id from rr),'cash',-500 from b$$, 'front desk refund');
select pg_temp.expect((select balance from reservation_balances where reservation_id=(select id from rr))=5700, 'balance 5,700');
-- Extend stay by one night -> 4th room charge
update reservations set check_out = check_out + 1 where id=(select id from rr);
select pg_temp.expect((select count(*) from folio_charges where reservation_id=(select id from rr) and kind='room' and voided_at is null)=4, 'extension adds a night');
-- Checkout blocked while balance due (separate 1-night stay ending today, nothing paid)
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, rate_per_night)
  select h1, (select id from guests limit 1), rm.room_type_id, rm.id, current_date-1, current_date, 4000
  from b, (select * from rooms where room_number='103') rm;
select status from public.check_in_reservation((select id from public.reservations where room_id=(select id from public.rooms where room_number='103')));
select pg_temp.expect_fail($$select public.check_out_reservation((select id from public.reservations where room_id=(select id from public.rooms where room_number='103')))$$, 'checkout with balance due');
select status as company_bill_checkout from public.check_out_reservation((select id from public.reservations where room_id=(select id from public.rooms where room_number='103')), true);
-- Early checkout today: nights from today on are dropped (stay started yesterday => 1 night)
select status, check_out = current_date as ended_today from public.check_out_reservation((select id from rr));
select pg_temp.expect((select count(*) from folio_charges where reservation_id=(select id from rr) and kind='room' and voided_at is null)=1, 'early checkout bills 1 night');
select pg_temp.expect((select balance from reservation_balances where reservation_id=(select id from rr))=-4300, 'guest now in credit 4,300 (refund due)');
select pg_temp.expect((select count(*) from invoices where reservation_id=(select id from rr))=1, 'invoice issued at checkout');
select number, total, vat_total, levy_total, jsonb_array_length(lines) lines, hotel->>'kra_pin' kra from invoices;
-- Front desk cannot void someone else's / old entries; owner refunds and voids
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into payments(hotel_id,reservation_id,method,amount,notes) select h1,(select id from rr),'mpesa',-5000,'refund' from b where false; -- (needs code)
insert into payments(hotel_id,reservation_id,method,amount,notes) select h1,(select id from rr),'cash',-4300,'Refund for unused nights' from b;
select pg_temp.expect((select balance from reservation_balances where reservation_id=(select id from rr))=0, 'settled after refund');
select public.void_charge((select id from folio_charges where kind='drinks'), 'Comp: complaint');
select number from public.issue_invoice((select id from rr));
select pg_temp.expect((select count(*) from invoices where reservation_id=(select id from rr) and superseded_at is null)=1, 'reissue supersedes old invoice');
select number, total, superseded_at is not null superseded from invoices order by issued_at;
-- Dan (housekeeping) sees no money; Bob (other hotel) sees nothing
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000004');
select pg_temp.expect((select count(*) from folio_charges)=0 and (select count(*) from payments)=0 and (select count(*) from invoices)=0, 'housekeeping sees no billing');
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect((select count(*) from invoices)=0 and (select count(*) from reservation_balances)=0, 'other hotel sees no billing');
select pg_temp.expect_fail($$select public.void_payment((select id from payments limit 1),'x')$$, 'other hotel void (not visible)');
select pg_temp.expect_fail($$select public.issue_invoice((select id from rr))$$, 'other hotel issue invoice');
select pg_temp.as_user(null);
select pg_temp.expect_fail($$select count(*) from public.payments$$, 'anon payments');
