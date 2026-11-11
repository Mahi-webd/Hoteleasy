\set ON_ERROR_STOP 1
-- Run after 00, all migrations, 01, 02, 03 and 04.
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
create temp table rctx as select id h, public.hotel_today(id) t from public.hotels where name='Olsupat Lodge';
grant select on rctx to authenticated, anon;

-- A past stay, 3 nights, 10 days ago, checked out (inserted directly as the database owner)
insert into auth.users (id,email,raw_user_meta_data) values ('99999999-0000-0000-0000-000000000009','acc@a.com','{"full_name":"Ann Accounts"}');
select set_config('hotel_easy.rpc', 'on', false);
insert into guests (hotel_id, first_name, last_name, nationality) select h, 'Past', 'Guest', 'German' from rctx;
insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, status, source, rate_per_night, created_at)
  select c.h, g.id, r.room_type_id, r.id, c.t - 10, c.t - 7, 'checked_out', 'booking_com', 8000, now() - interval '40 days'
    from rctx c, guests g, rooms r
   where g.first_name = 'Past' and r.hotel_id = c.h and r.room_number = (select min(room_number) from rooms where hotel_id = c.h);
insert into folio_charges (hotel_id, reservation_id, kind, description, stay_date, unit_price)
  select r.hotel_id, r.id, 'room', 'Night ' || g::date, g::date, 8000
    from reservations r, generate_series(r.check_in, r.check_out - 1, interval '1 day') g
   where r.source = 'booking_com' and r.rate_per_night = 8000;
-- A voided charge must not count
insert into folio_charges (hotel_id, reservation_id, kind, description, unit_price, voided_at, void_reason)
  select hotel_id, id, 'laundry', 'Voided laundry', 999, now(), 'test' from reservations where rate_per_night = 8000;
select set_config('hotel_easy.rpc', '', false);

-- Accountant joins
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into hotel_invitations (hotel_id,email,role) select h,'acc@a.com','accountant' from rctx;
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
select public.accept_pending_invitations();

-- Who can see reports
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_fail($$select public.report_period((select h from rctx), (select t from rctx) - 30, (select t from rctx))$$, 'front desk reading reports');
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
select pg_temp.expect_fail($$select public.report_period((select h from rctx), (select t from rctx) - 30, (select t from rctx))$$, 'waiter reading reports');
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_fail($$select public.report_period((select h from rctx), (select t from rctx) - 30, (select t from rctx))$$, 'other hotel owner reading reports');
select pg_temp.expect_fail($$select * from public.report_lines((select h from rctx), current_date - 30, current_date)$$, 'calling internal helper');

select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
create temp table rep as select public.report_period(h, t - 30, t + 5) j from rctx;
select pg_temp.expect((select (j->'kpis'->>'to')::date = (select t from rctx) from rep), 'period stops at today');
select pg_temp.expect_fail($$select public.report_period((select h from rctx), (select t from rctx) + 1, (select t from rctx) + 3)$$, 'future-only period');
select pg_temp.expect_fail($$select public.report_period((select h from rctx), (select t from rctx) - 400, (select t from rctx))$$, 'more than a year');
select pg_temp.expect_fail($$select public.report_period((select h from rctx), (select t from rctx), (select t from rctx) - 1)$$, 'start after end');

-- Cross-checks against the raw tables (as the database owner)
reset role;
create temp table want as
select
  (select count(*) from rooms where hotel_id = c.h) rooms,
  (select coalesce(sum(net_amount), 0) from folio_charges where hotel_id = c.h and voided_at is null and pos_order_id is null and kind = 'room'
     and stay_date between c.t - 30 and c.t) room_net,
  (select coalesce(sum(net_amount), 0) from folio_charges where hotel_id = c.h and voided_at is null and pos_order_id is null and kind <> 'room'
     and (posted_at at time zone 'Africa/Nairobi')::date between c.t - 30 and c.t) other_folio_net,
  (select coalesce(sum(net_amount + service_charge), 0) from pos_orders where hotel_id = c.h and status = 'paid') pos_net,
  (select coalesce(sum(total), 0) from pos_orders where hotel_id = c.h and status = 'paid') pos_total,
  (select coalesce(sum(amount), 0) from payments where hotel_id = c.h and voided_at is null)
    + (select coalesce(sum(amount), 0) from pos_payments where hotel_id = c.h and voided_at is null and method <> 'room') collected,
  (select coalesce(sum(least(check_out - 1, c.t) - greatest(check_in, c.t - 30) + 1), 0) from reservations
     where hotel_id = c.h and status in ('checked_in', 'checked_out') and check_in <= c.t and check_out > c.t - 30) nights
from rctx c;
select * from want;
select j->'kpis' kpis from rep;

select pg_temp.expect((select (j->'kpis'->>'room_revenue')::numeric from rep) = (select room_net from want), 'room revenue = room nights on guest bills');
select pg_temp.expect((select (j->'kpis'->>'room_revenue')::numeric >= 3 * round(8000/1.18, 2) from rep), 'past stay included');
select pg_temp.expect((select (j->'kpis'->>'room_nights_sold')::int from rep) = (select nights from want), 'room nights sold');
select pg_temp.expect((select (j->'kpis'->>'room_nights_available')::int from rep) = (select rooms * 31 from want), 'available = rooms × 31 days');
select pg_temp.expect((select abs((j->'kpis'->>'adr')::numeric - round((select room_net from want) / (select nights from want), 2)) < 0.01 from rep), 'ADR = room revenue / nights');
select pg_temp.expect((select (j->'kpis'->>'total_revenue')::numeric from rep)
                      = (select room_net + other_folio_net + pos_net from want), 'total = guest bills + POS, POS room charges not doubled');
select pg_temp.expect((select (j->'kpis'->>'collected')::numeric from rep) = (select collected from want), 'collected excludes room-charge transfers');
select pg_temp.expect((select sum((x->>'gross')::numeric) from rep, jsonb_array_elements(j->'departments') x where x->>'grp' = 'fnb')
                      >= (select pos_total from want), 'F&B gross covers every POS bill');
select pg_temp.expect((select sum((x->>'net')::numeric) from rep, jsonb_array_elements(j->'departments') x)
                      = (select (j->'kpis'->>'total_revenue')::numeric from rep), 'departments add up to total');
select pg_temp.expect((select sum((x->>'room_revenue')::numeric) from rep, jsonb_array_elements(j->'daily') x)
                      = (select (j->'kpis'->>'room_revenue')::numeric from rep), 'daily rows add up');
select pg_temp.expect((select jsonb_array_length(j->'daily') from rep) = 31, 'one row per day');
select pg_temp.expect((select sum((x->>'nights')::int) from rep, jsonb_array_elements(j->'sources') x)
                      = (select nights from want), 'sources add up to nights sold');
select pg_temp.expect((select (x->>'nights')::int = 3 and (x->>'adr')::numeric = round(8000/1.18, 2) from rep, jsonb_array_elements(j->'sources') x where x->>'source' = 'booking_com'), 'Booking.com: 3 nights at net rate');
select pg_temp.expect((select count(*) from rep, jsonb_array_elements(j->'nationalities') x where x->>'nationality' = 'German' and (x->>'nights')::int = 3) = 1, 'nationality counted');
select pg_temp.expect((select sum((x->>'total')::numeric) from rep, jsonb_array_elements(j->'outlets') x) = (select pos_total from want), 'outlets add up to POS bills');
select pg_temp.expect((select (j->'kpis'->>'vat')::numeric > 0 from rep), 'VAT reported');
select pg_temp.expect((select count(*) from rep, jsonb_array_elements(j->'debtors') x where (x->>'balance')::numeric > 0)
                      = (select count(*) from reservation_balances b join reservations r on r.id = b.reservation_id
                          where r.hotel_id = (select h from rctx) and r.status in ('checked_in','checked_out') and b.balance > 0.009), 'debtors list');
select pg_temp.expect((select (j->'previous'->>'to')::date = (select t from rctx) - 31 from rep), 'previous period is the 31 days before');
select pg_temp.expect((select j->'kpis'->>'room_revenue' from rep) is not null and not exists (
  select 1 from rep, jsonb_array_elements(j->'departments') x where x->>'dept' = 'laundry' and (x->>'net')::numeric >= 999), 'voided charge left out');

select pg_temp.expect(not exists (select 1 from folio_charges where levy_amount < 0 or vat_amount < 0)
                      and not exists (select 1 from pos_order_items where levy < 0 or vat < 0), 'no negative tax lines');
select 'REPORT TESTS DONE' as result;
