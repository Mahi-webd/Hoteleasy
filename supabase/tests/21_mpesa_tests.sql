\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–20. M-Pesa STK push: settings, prompts, Safaricom's answer, online deposits.
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
grant execute on all functions in schema pg_temp to anon, authenticated;
reset role;
create temp table rx as select h.id h,
  (select id from reservations where hotel_id = h.id and status = 'checked_in' order by created_at limit 1) inhouse
  from hotels h where h.name = 'Olsupat Lodge';
grant select on rx to authenticated;
create temp table ids (k text primary key, id uuid, token text);
grant select, insert on ids to authenticated, anon, service_role;
grant select on rx to service_role;

select pg_temp.expect(public.mpesa_phone('0712 345 678') = '254712345678' and public.mpesa_phone('+254 110 123456') = '254110123456'
  and public.mpesa_phone('712345678') = '254712345678' and public.mpesa_phone('0612345678') is null and public.mpesa_phone('12345') is null, 'phone numbers in any common format');

-- settings: managers only, secrets never readable
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_err($$select public.mpesa_settings_save((select h from rx), true, 'sandbox', 'paybill', '174379', null, 'none', 'k', 's', 'p')$$, 'manager', 'front desk changing M-Pesa settings');
select pg_temp.expect_err($$select public.mpesa_request_folio((select inhouse from rx), '0712345678', 100)$$, 'not set up', 'prompt before M-Pesa is set up');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_err($$select public.mpesa_settings_save((select h from rx), true, 'sandbox', 'paybill', '174379', null, 'none')$$, 'consumer key', 'switching on without keys');
select pg_temp.expect_err($$select public.mpesa_settings_save((select h from rx), false, 'sandbox', 'paybill', '12', null, 'none')$$, '5 to 7 digits', 'bad shortcode');
select public.mpesa_settings_save((select h from rx), true, 'sandbox', 'paybill', '174379', null, 'first_night', 'ck_test', 'cs_test', 'pk_test');
select pg_temp.expect((public.mpesa_settings_get((select h from rx)))->>'ready' = 'true'
  and not ((public.mpesa_settings_get((select h from rx))) ? 'consumer_key'), 'saved; settings show "set" flags, not the keys');
select public.mpesa_settings_save((select h from rx), true, 'sandbox', 'paybill', '174379', null, 'first_night');
select pg_temp.expect((public.mpesa_settings_get((select h from rx)))->>'has_passkey' = 'true', 'saving without keys keeps the old keys');
select pg_temp.expect_err($$select * from mpesa_credentials$$, 'permission denied', 'reading the keys table');
select pg_temp.expect_err($$select public.mpesa_job(gen_random_uuid(), 'x')$$, 'permission denied', 'calling the Edge Function''s functions');
select pg_temp.expect_err($$select public.mpesa_result('x', null, 0, 'ok', 'ABC1234567', 1, '254700000000')$$, 'permission denied', 'faking a Safaricom answer');

-- a prompt on a guest bill
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_err($$select public.mpesa_request_folio((select inhouse from rx), '0812345678', 100)$$, 'Safaricom number', 'not a mobile number');
select pg_temp.expect_err($$select public.mpesa_request_folio((select inhouse from rx), '0712345678', 100.5)$$, 'whole shillings', 'cents');
insert into ids select 'f', (j->>'id')::uuid, j->>'token' from (select public.mpesa_request_folio((select inhouse from rx), '0712 345 678', 1500) j) x;
select pg_temp.as_user('eeeeeeee-0000-0000-0000-000000000005');
select pg_temp.expect_err($$select public.mpesa_request_folio((select inhouse from rx), '0712345678', 100)$$, 'not found', 'maintenance sending a prompt');
select pg_temp.expect((select count(*) from mpesa_requests) = 0, 'maintenance cannot see prompts');
select pg_temp.as_user(null);
select pg_temp.expect(public.mpesa_status((select id from ids where k = 'f'), 'wrong') is null, 'status needs the token');
select pg_temp.expect(public.mpesa_status((select id from ids where k = 'f'), (select token from ids where k = 'f'))->>'status' = 'new', 'status with the token');

-- what the Edge Function does (service role)
reset role; set role service_role;
select pg_temp.expect((public.mpesa_job((select id from ids where k = 'f'), (select token from ids where k = 'f')))->>'passkey' = 'pk_test', 'the function gets the keys');
select public.mpesa_mark_sent((select id from ids where k = 'f'), 'm-1', 'ws_CO_1', 'Success. Request accepted for processing');
select pg_temp.expect((public.mpesa_result('ws_CO_1', 'not-the-token', 0, 'ok', 'TKA1B2C3D4', 1500, '254712345678'))->>'ok' = 'false', 'callback with the wrong token ignored');
select pg_temp.expect((public.mpesa_result('ws_CO_1', (select token from ids where k = 'f'), 0, 'The service request is processed successfully.', 'tka1b2c3d4', 1500, '254712345678'))->>'status' = 'paid', 'paid');
select pg_temp.expect((public.mpesa_result('ws_CO_1', (select token from ids where k = 'f'), 0, 'again', 'TKA1B2C3D4', 1500, '254712345678'))->>'duplicate' = 'true', 'Safaricom sending it twice is fine');
reset role;
select pg_temp.expect((select count(*) from payments where reference = 'TKA1B2C3D4' and method = 'mpesa' and amount = 1500
  and reservation_id = (select inhouse from rx) and received_by = 'cccccccc-0000-0000-0000-000000000003') = 1, 'one payment on the bill, by the person who sent the prompt');
select pg_temp.expect((select payment_id is not null and receipt = 'TKA1B2C3D4' from mpesa_requests where id = (select id from ids where k = 'f')), 'prompt linked to the payment');
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_err($$insert into payments (hotel_id, reservation_id, method, amount, reference) select h, inhouse, 'mpesa', 10, 'TKA1B2C3D4' from rx$$, 'once|unique|already', 'the same M-Pesa code typed in by hand');

-- guest cancels on the phone / prompt times out
insert into ids select 'f2', (j->>'id')::uuid, j->>'token' from (select public.mpesa_request_folio((select inhouse from rx), '0712345678', 200) j) x;
insert into ids select 'f3', (j->>'id')::uuid, j->>'token' from (select public.mpesa_request_folio((select inhouse from rx), '0712345678', 300) j) x;
reset role; set role service_role;
select public.mpesa_mark_sent((select id from ids where k = 'f2'), 'm-2', 'ws_CO_2', 'ok');
select public.mpesa_mark_sent((select id from ids where k = 'f3'), 'm-3', 'ws_CO_3', 'ok');
select public.mpesa_result('ws_CO_2', (select token from ids where k = 'f2'), 1032, 'Request cancelled by user', null, null, null);
select public.mpesa_result('ws_CO_3', (select token from ids where k = 'f3'), 1037, 'DS timeout user cannot be reached', null, null, null);
reset role;
select pg_temp.expect((select status from mpesa_requests where id = (select id from ids where k = 'f2')) = 'cancelled'
  and (select status from mpesa_requests where id = (select id from ids where k = 'f3')) = 'expired', 'cancelled on the phone / timed out');
select pg_temp.expect((select count(*) from payments where reference is null and amount in (200, 300) and method = 'mpesa') = 0, 'no payment for those');

-- staff stop waiting, then Safaricom says paid after all: still recorded
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into ids select 'f4', (j->>'id')::uuid, j->>'token' from (select public.mpesa_request_folio((select inhouse from rx), '0712345678', 400) j) x;
reset role; set role service_role;
select public.mpesa_mark_sent((select id from ids where k = 'f4'), 'm-4', 'ws_CO_4', 'ok');
reset role;
select public.mpesa_cancel((select id from ids where k = 'f4'), (select token from ids where k = 'f4'));
set role service_role;
select public.mpesa_result('ws_CO_4', (select token from ids where k = 'f4'), 0, 'ok', 'TKB9Z8Y7X6', 400, '254712345678');
reset role;
select pg_temp.expect((select count(*) from payments where reference = 'TKB9Z8Y7X6') = 1, 'late "paid" after staff stopped waiting is still recorded');

-- POS order
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000006');
do $$ begin
  if not exists (select 1 from pos_shifts where user_id = auth.uid() and closed_at is null) then perform public.pos_open_shift((select h from rx), 0); end if;
end $$;
insert into pos_orders (hotel_id, outlet_id, order_type, label) select h, o.id, 'takeaway', 'Mpesa test' from rx, pos_outlets o where o.hotel_id = rx.h and o.name = 'Bar';
insert into ids select 'o', id, null from pos_orders where label = 'Mpesa test';
insert into pos_order_items (order_id, menu_item_id, quantity) select (select id from ids where k = 'o'), id, 2 from menu_items where name = 'White Cap' and hotel_id = (select h from rx);
select pg_temp.expect_err($$select public.mpesa_request_pos((select id from ids where k = 'o'), '0712345678', 100)$$, 'unsent', 'POS prompt before sending items');
select public.pos_send_order((select id from ids where k = 'o'));
select pg_temp.expect_err($$select public.mpesa_request_pos((select id from ids where k = 'o'), '0712345678', 999999)$$, 'more than', 'POS prompt over the bill');
insert into ids select 'p', (j->>'id')::uuid, j->>'token'
  from (select public.mpesa_request_pos((select id from ids where k = 'o'), '0712345678', (select ceil(total) from pos_orders where id = (select id from ids where k = 'o'))) j) x;
reset role; set role service_role;
select public.mpesa_mark_sent((select id from ids where k = 'p'), 'm-5', 'ws_CO_5', 'ok');
select public.mpesa_result('ws_CO_5', (select token from ids where k = 'p'), 0, 'ok', 'TKC1C2C3C4', (select amount from mpesa_requests where id = (select id from ids where k = 'p')), '254712345678');
reset role;
select pg_temp.expect((select status from pos_orders where id = (select id from ids where k = 'o')) = 'paid'
  and (select count(*) from pos_payments where reference = 'TKC1C2C3C4' and shift_id is not null) = 1, 'POS bill paid by prompt, on the waiter''s shift');
select pg_temp.expect((select paid_total = total from pos_orders where id = (select id from ids where k = 'o')), 'paid exactly the bill (rounding up to whole shillings is not over-recorded)');

-- online deposit (first night)
reset role;
create temp table ob as select r.code, g.last_name, r.id, r.total_amount, r.nights, s.slug
  from reservations r join guests g on g.id = r.guest_id join booking_settings s on s.hotel_id = r.hotel_id
  where r.hotel_id = (select h from rx) and r.status = 'confirmed' and r.check_in > current_date
    and not exists (select 1 from payments p where p.reservation_id = r.id and p.voided_at is null)
  order by r.created_at limit 1;
grant select on ob to anon;
update booking_settings set enabled = true where hotel_id = (select h from rx);
select pg_temp.as_user(null);
select pg_temp.expect((select count(*) from ob) = 1, 'an upcoming unpaid booking to test with');
select pg_temp.expect((public.public_mpesa_info((select slug from ob), (select code from ob), (select last_name from ob)))->>'amount'
  = ceil((select total_amount / greatest(nights, 1) from ob))::text, 'deposit = first night, whole shillings');
select pg_temp.expect((public.public_mpesa_info((select slug from ob), (select code from ob), 'not-the-name'))->>'available' = 'false', 'wrong name: nothing shown');
insert into ids select 'w', (j->>'id')::uuid, j->>'token' from (select public.public_mpesa_request((select slug from ob), (select code from ob), (select last_name from ob), '0722000111') j) x;
reset role; set role service_role;
select public.mpesa_mark_sent((select id from ids where k = 'w'), 'm-6', 'ws_CO_6', 'ok');
select public.mpesa_result('ws_CO_6', (select token from ids where k = 'w'), 0, 'ok', 'TKD1D2D3D4', (select amount from mpesa_requests where id = (select id from ids where k = 'w')), '254722000111');
reset role;
select pg_temp.expect((select count(*) from payments where reference = 'TKD1D2D3D4' and reservation_id = (select id from ob) and received_by is null) = 1, 'online deposit on the booking');
select pg_temp.as_user(null);
select pg_temp.expect((public.public_mpesa_info((select slug from ob), (select code from ob), (select last_name from ob)))->>'available' = 'false', 'deposit paid: nothing more to pay online');
select pg_temp.expect_err($$select public.public_mpesa_request((select slug from ob), (select code from ob), (select last_name from ob), '0722000111')$$, 'Nothing to pay', 'paying the deposit twice');
reset role;
