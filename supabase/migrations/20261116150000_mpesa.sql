-- M-Pesa STK push (Lipa na M-Pesa Online, Safaricom Daraja).
-- Each hotel uses its own paybill or till and its own Daraja app keys. Staff send a pay prompt to the guest's phone
-- from the bill or a POS order; online guests can pay a deposit from their booking page. The Edge Function
-- `mpesa` talks to Safaricom; when Safaricom confirms, the payment is posted here automatically (once).

-- ---------- settings (no secrets) ----------
create table if not exists public.mpesa_settings (
  hotel_id uuid primary key references public.hotels(id) on delete cascade,
  enabled boolean not null default false,
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  kind text not null default 'paybill' check (kind in ('paybill', 'till')),
  shortcode text check (shortcode ~ '^[0-9]{5,7}$'),          -- paybill number, or the store number for a till
  till_number text check (till_number ~ '^[0-9]{5,7}$'),      -- the till guests pay (Buy Goods) when kind = till
  online_deposit text not null default 'none' check (online_deposit in ('none', 'first_night', 'full')),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.mpesa_settings enable row level security;
drop policy if exists mps_sel on public.mpesa_settings;
create policy mps_sel on public.mpesa_settings for select to authenticated using (public.is_hotel_member(hotel_id));
grant select on public.mpesa_settings to authenticated;

-- ---------- secrets: never readable by the app, only by the Edge Function (service role) ----------
create table if not exists public.mpesa_credentials (
  hotel_id uuid primary key references public.hotels(id) on delete cascade,
  consumer_key text,
  consumer_secret text,
  passkey text,
  updated_at timestamptz not null default now()
);
alter table public.mpesa_credentials enable row level security;
revoke all on public.mpesa_credentials from anon, authenticated;

-- ---------- one row per pay prompt ----------
create table if not exists public.mpesa_requests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  kind text not null check (kind in ('folio', 'pos', 'online')),
  reservation_id uuid references public.reservations(id) on delete set null,
  pos_order_id uuid references public.pos_orders(id) on delete set null,
  phone text not null check (phone ~ '^254[17][0-9]{8}$'),
  amount numeric(14,2) not null check (amount >= 1 and amount = round(amount)),
  account_ref text not null,
  description text not null,
  token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'new' check (status in ('new', 'sent', 'paid', 'failed', 'cancelled', 'expired')),
  merchant_request_id text,
  checkout_request_id text unique,
  result_code int,
  result_desc text,
  receipt text,
  paid_amount numeric(14,2),
  paid_phone text,
  payment_id uuid,
  pos_payment_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  finished_at timestamptz
);
create index if not exists mpesa_requests_hotel on public.mpesa_requests (hotel_id, created_at desc);
create index if not exists mpesa_requests_res on public.mpesa_requests (reservation_id) where reservation_id is not null;
create index if not exists mpesa_requests_pos on public.mpesa_requests (pos_order_id) where pos_order_id is not null;
alter table public.mpesa_requests enable row level security;
drop policy if exists mpr_sel on public.mpesa_requests;
create policy mpr_sel on public.mpesa_requests for select to authenticated using (
  case when kind = 'pos' then public.pos_viewer(hotel_id)
       else public.has_hotel_role(hotel_id, array['owner','manager','front_desk','accountant']::hotel_role[], 'billing.view') end);
grant select on public.mpesa_requests to authenticated;

-- ---------- helpers ----------
-- Any common way of writing a Kenyan mobile number → 2547XXXXXXXX / 2541XXXXXXXX (null if it isn't one)
create or replace function public.mpesa_phone(_p text) returns text language sql immutable as $$
  select case
    when d ~ '^254[17][0-9]{8}$' then d
    when d ~ '^0[17][0-9]{8}$' then '254' || substr(d, 2)
    when d ~ '^[17][0-9]{8}$' then '254' || d
  end
  from (select regexp_replace(coalesce(_p, ''), '[^0-9]', '', 'g') d) x;
$$;

create or replace function public.mpesa_ready(_hotel_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from mpesa_settings s join mpesa_credentials c using (hotel_id)
    where s.hotel_id = _hotel_id and s.enabled and s.shortcode is not null and (s.kind = 'paybill' or s.till_number is not null)
      and coalesce(c.consumer_key, '') <> '' and coalesce(c.consumer_secret, '') <> '' and coalesce(c.passkey, '') <> '');
$$;
grant execute on function public.mpesa_ready(uuid) to authenticated, anon;

-- ---------- settings: owner/manager ----------
create or replace function public.mpesa_settings_get(_hotel_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enabled', coalesce(s.enabled, false), 'environment', coalesce(s.environment, 'sandbox'), 'kind', coalesce(s.kind, 'paybill'),
    'shortcode', s.shortcode, 'till_number', s.till_number, 'online_deposit', coalesce(s.online_deposit, 'none'),
    'has_consumer_key', coalesce(c.consumer_key, '') <> '', 'has_consumer_secret', coalesce(c.consumer_secret, '') <> '',
    'has_passkey', coalesce(c.passkey, '') <> '', 'ready', public.mpesa_ready(_hotel_id),
    'can_edit', public.has_hotel_role(_hotel_id, array['owner','manager']::hotel_role[], 'settings.edit'))
  from (select _hotel_id id) h left join mpesa_settings s on s.hotel_id = h.id left join mpesa_credentials c on c.hotel_id = h.id
  where public.is_hotel_member(_hotel_id);
$$;

create or replace function public.mpesa_settings_save(_hotel_id uuid, _enabled boolean, _environment text, _kind text,
  _shortcode text, _till_number text, _online_deposit text,
  _consumer_key text default null, _consumer_secret text default null, _passkey text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not has_hotel_role(_hotel_id, array['owner','manager']::hotel_role[], 'settings.edit') then raise exception 'Only a manager can change M-Pesa settings'; end if;
  _shortcode := nullif(regexp_replace(coalesce(_shortcode, ''), '\s', '', 'g'), '');
  _till_number := nullif(regexp_replace(coalesce(_till_number, ''), '\s', '', 'g'), '');
  if _shortcode is not null and _shortcode !~ '^[0-9]{5,7}$' then raise exception 'The paybill or store number should be 5 to 7 digits'; end if;
  if _till_number is not null and _till_number !~ '^[0-9]{5,7}$' then raise exception 'The till number should be 5 to 7 digits'; end if;
  if _kind = 'till' and _enabled and _till_number is null then raise exception 'Enter the till number guests pay to'; end if;
  insert into mpesa_settings (hotel_id, enabled, environment, kind, shortcode, till_number, online_deposit, updated_at, updated_by)
  values (_hotel_id, coalesce(_enabled, false), coalesce(_environment, 'sandbox'), coalesce(_kind, 'paybill'), _shortcode,
          case when _kind = 'till' then _till_number end, coalesce(_online_deposit, 'none'), now(), auth.uid())
  on conflict (hotel_id) do update set enabled = excluded.enabled, environment = excluded.environment, kind = excluded.kind,
    shortcode = excluded.shortcode, till_number = excluded.till_number, online_deposit = excluded.online_deposit,
    updated_at = now(), updated_by = auth.uid();
  insert into mpesa_credentials (hotel_id) values (_hotel_id) on conflict do nothing;
  update mpesa_credentials set
    consumer_key = coalesce(nullif(btrim(_consumer_key), ''), consumer_key),
    consumer_secret = coalesce(nullif(btrim(_consumer_secret), ''), consumer_secret),
    passkey = coalesce(nullif(btrim(_passkey), ''), passkey),
    updated_at = now()
  where hotel_id = _hotel_id;
  if _enabled and not mpesa_ready(_hotel_id) then
    raise exception 'To switch M-Pesa on, fill in the shortcode, consumer key, consumer secret and passkey';
  end if;
  perform log_activity(_hotel_id, 'settings', case when _enabled then 'M-Pesa prompts switched on' else 'M-Pesa settings saved' end);
  return mpesa_settings_get(_hotel_id);
end $$;
grant execute on function public.mpesa_settings_get(uuid),
  public.mpesa_settings_save(uuid, boolean, text, text, text, text, text, text, text, text) to authenticated;

-- ---------- staff: a prompt for a guest bill ----------
create or replace function public.mpesa_request_folio(_reservation_id uuid, _phone text, _amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _r reservations; _ph text; _q mpesa_requests; _h hotels;
begin
  select * into _r from reservations where id = _reservation_id;
  if not found or not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk','accountant']::hotel_role[], 'billing.create') then
    raise exception 'Booking not found';
  end if;
  if not mpesa_ready(_r.hotel_id) then raise exception 'M-Pesa prompts are not set up for this hotel'; end if;
  if _r.status in ('cancelled', 'no_show') then raise exception 'This booking is %', replace(_r.status::text, '_', '-'); end if;
  _ph := mpesa_phone(_phone);
  if _ph is null then raise exception 'Enter a Safaricom number like 0712 345 678'; end if;
  if _amount is null or _amount < 1 or _amount <> round(_amount) then raise exception 'M-Pesa takes whole shillings: enter an amount of at least 1'; end if;
  if _amount > 250000 then raise exception 'M-Pesa allows at most 250,000 per payment'; end if;
  select * into _h from hotels where id = _r.hotel_id;
  insert into mpesa_requests (hotel_id, kind, reservation_id, phone, amount, account_ref, description)
  values (_r.hotel_id, 'folio', _r.id, _ph, _amount, left(regexp_replace(_r.code, '[^A-Za-z0-9]', '', 'g'), 12),
          left('Bill ' || _r.code, 13))
  returning * into _q;
  return jsonb_build_object('id', _q.id, 'token', _q.token, 'phone', _q.phone, 'amount', _q.amount);
end $$;

-- ---------- staff: a prompt for a POS order ----------
create or replace function public.mpesa_request_pos(_order_id uuid, _phone text, _amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _o pos_orders; _ph text; _q mpesa_requests; _due numeric;
begin
  select * into _o from pos_orders where id = _order_id;
  if not found or not pos_staff(_o.hotel_id) then raise exception 'Order not found'; end if;
  if not mpesa_ready(_o.hotel_id) then raise exception 'M-Pesa prompts are not set up for this hotel'; end if;
  if _o.status <> 'open' then raise exception 'This bill is closed'; end if;
  if exists (select 1 from pos_order_items where order_id = _order_id and status = 'new') then
    raise exception 'Send or remove unsent items before taking payment';
  end if;
  if not exists (select 1 from pos_shifts where hotel_id = _o.hotel_id and user_id = auth.uid() and closed_at is null) then
    raise exception 'NO_SHIFT: Open your cash shift before taking payment';
  end if;
  _ph := mpesa_phone(_phone);
  if _ph is null then raise exception 'Enter a Safaricom number like 0712 345 678'; end if;
  _due := _o.total - _o.paid_total;
  if _amount is null or _amount < 1 or _amount <> round(_amount) then raise exception 'M-Pesa takes whole shillings: enter an amount of at least 1'; end if;
  if _amount > ceil(_due) then raise exception 'That is more than the % still due', to_char(_due, 'FM999,999,990.00'); end if;
  insert into mpesa_requests (hotel_id, kind, pos_order_id, phone, amount, account_ref, description)
  values (_o.hotel_id, 'pos', _o.id, _ph, _amount, 'POS' || _o.number, left('Bill ' || _o.number, 13))
  returning * into _q;
  return jsonb_build_object('id', _q.id, 'token', _q.token, 'phone', _q.phone, 'amount', _q.amount);
end $$;
grant execute on function public.mpesa_request_folio(uuid, text, numeric), public.mpesa_request_pos(uuid, text, numeric) to authenticated;

-- ---------- online guests: the booking deposit ----------
create or replace function public.mpesa_online_amount(_r reservations) returns numeric language sql stable security definer set search_path = public as $$
  select greatest(0, ceil(case s.online_deposit
           when 'full' then _r.total_amount
           when 'first_night' then _r.total_amount / greatest(_r.nights, 1)
           else 0 end
         - coalesce((select sum(amount) from payments where reservation_id = _r.id and voided_at is null), 0)))
  from mpesa_settings s where s.hotel_id = _r.hotel_id;
$$;

create or replace function public.public_mpesa_request(_slug text, _code text, _email_or_last_name text, _phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _s booking_settings; _r reservations; _k text; _ph text; _amt numeric; _q mpesa_requests;
begin
  select * into _s from booking_settings where slug = lower(trim(_slug)) and enabled;
  if not found then raise exception 'This booking page is not available'; end if;
  _k := lower(trim(coalesce(_email_or_last_name, '')));
  select r.* into _r from reservations r join guests g on g.id = r.guest_id
   where r.hotel_id = _s.hotel_id and upper(r.code) = upper(trim(_code))
     and _k <> '' and (lower(g.email) = _k or lower(g.last_name) = _k);
  if not found then raise exception 'No booking matches that code and email or last name'; end if;
  if _r.status <> 'confirmed' then raise exception 'This booking can''t be paid online'; end if;
  if not mpesa_ready(_r.hotel_id) then raise exception 'This hotel doesn''t take M-Pesa online'; end if;
  _amt := mpesa_online_amount(_r);
  if coalesce(_amt, 0) < 1 then raise exception 'Nothing to pay online for this booking'; end if;
  if (select count(*) from mpesa_requests where reservation_id = _r.id and kind = 'online' and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many payment attempts. Please try again later.';
  end if;
  _ph := mpesa_phone(_phone);
  if _ph is null then raise exception 'Enter a Safaricom number like 0712 345 678'; end if;
  insert into mpesa_requests (hotel_id, kind, reservation_id, phone, amount, account_ref, description, created_by)
  values (_r.hotel_id, 'online', _r.id, _ph, _amt, left(regexp_replace(_r.code, '[^A-Za-z0-9]', '', 'g'), 12), left('Deposit ' || _r.code, 13), null)
  returning * into _q;
  return jsonb_build_object('id', _q.id, 'token', _q.token, 'phone', _q.phone, 'amount', _q.amount);
end $$;
grant execute on function public.public_mpesa_request(text, text, text, text) to anon, authenticated;

-- What happened to a prompt (anyone holding its token: the staff screen or the guest's browser)
create or replace function public.mpesa_status(_id uuid, _token text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'status', status, 'amount', amount, 'phone', phone, 'receipt', receipt,
    'paid_amount', paid_amount, 'result_desc', result_desc, 'sent_at', sent_at, 'finished_at', finished_at)
  from mpesa_requests where id = _id and token = _token;
$$;
grant execute on function public.mpesa_status(uuid, text) to anon, authenticated;

-- Staff walked away from a prompt that never came back. A late "paid" from Safaricom is still recorded.
create or replace function public.mpesa_cancel(_id uuid, _token text) returns void language plpgsql security definer set search_path = public as $$
begin
  update mpesa_requests set status = 'cancelled', result_desc = coalesce(result_desc, 'Stopped waiting'), finished_at = now()
   where id = _id and token = _token and status in ('new', 'sent');
end $$;
grant execute on function public.mpesa_cancel(uuid, text) to anon, authenticated;

-- ---------- for the Edge Function only (service role) ----------
create or replace function public.mpesa_job(_id uuid, _token text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', q.id, 'hotel_id', q.hotel_id, 'status', q.status, 'phone', q.phone, 'amount', q.amount,
    'account_ref', q.account_ref, 'description', q.description, 'token', q.token, 'checkout_request_id', q.checkout_request_id,
    'environment', s.environment, 'kind', s.kind, 'shortcode', s.shortcode, 'till_number', s.till_number,
    'consumer_key', c.consumer_key, 'consumer_secret', c.consumer_secret, 'passkey', c.passkey, 'ready', mpesa_ready(q.hotel_id))
  from mpesa_requests q left join mpesa_settings s on s.hotel_id = q.hotel_id left join mpesa_credentials c on c.hotel_id = q.hotel_id
  where q.id = _id and q.token = _token;
$$;

create or replace function public.mpesa_hotel_keys(_hotel_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('environment', s.environment, 'kind', s.kind, 'shortcode', s.shortcode, 'till_number', s.till_number,
    'consumer_key', c.consumer_key, 'consumer_secret', c.consumer_secret, 'passkey', c.passkey)
  from mpesa_settings s join mpesa_credentials c using (hotel_id) where s.hotel_id = _hotel_id;
$$;

create or replace function public.mpesa_mark_sent(_id uuid, _merchant text, _checkout text, _desc text) returns void
language sql security definer set search_path = public as $$
  update mpesa_requests set status = 'sent', merchant_request_id = _merchant, checkout_request_id = _checkout,
         result_desc = _desc, sent_at = now() where id = _id and status = 'new';
$$;

create or replace function public.mpesa_mark_failed(_id uuid, _code int, _desc text) returns void
language sql security definer set search_path = public as $$
  update mpesa_requests set status = case when _code = 1032 then 'cancelled' when _code = 1037 then 'expired' else 'failed' end,
         result_code = _code, result_desc = left(_desc, 300), finished_at = now()
   where id = _id and status in ('new', 'sent', 'cancelled');
$$;

-- Safaricom says how it went. Paid: post the payment once (bill or POS order). Safe to call twice.
create or replace function public.mpesa_result(_checkout text, _token text, _code int, _desc text,
  _receipt text, _amount numeric, _phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _q mpesa_requests; _o pos_orders; _due numeric; _amt numeric; _pid uuid; _shift uuid; _cur text;
begin
  select * into _q from mpesa_requests where checkout_request_id = _checkout and (_token is null or token = _token) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'unknown request'); end if;
  if _q.status = 'paid' then return jsonb_build_object('ok', true, 'status', 'paid', 'duplicate', true); end if;
  if _code <> 0 then
    perform mpesa_mark_failed(_q.id, _code, _desc);
    return jsonb_build_object('ok', true, 'status', 'failed');
  end if;
  _receipt := upper(btrim(coalesce(_receipt, '')));
  if _receipt !~ '^[A-Z0-9]{10}$' then return jsonb_build_object('ok', false, 'error', 'bad receipt'); end if;
  _amt := coalesce(_amount, _q.amount);
  select currency into _cur from hotels where id = _q.hotel_id;
  perform set_config('hotel_easy.rpc', 'on', true);
  if mpesa_code_used(_q.hotel_id, _receipt) then
    null;  -- already recorded by hand: just mark the prompt paid
  elsif _q.kind = 'pos' then
    select * into _o from pos_orders where id = _q.pos_order_id for update;
    _due := greatest(0, _o.total - _o.paid_total);
    select id into _shift from pos_shifts where hotel_id = _q.hotel_id and user_id = _q.created_by and closed_at is null;
    if _o.status = 'open' and _due > 0 then
      insert into pos_payments (hotel_id, order_id, shift_id, method, amount, reference, received_by)
      values (_q.hotel_id, _o.id, _shift, 'mpesa', least(_amt, _due), _receipt, _q.created_by) returning id into _pid;
      update pos_orders set paid_total = paid_total + least(_amt, _due),
             status = case when paid_total + least(_amt, _due) >= total - 0.009 then 'paid'::pos_order_status else 'open'::pos_order_status end,
             closed_at = case when paid_total + least(_amt, _due) >= total - 0.009 then now() end
       where id = _o.id;
      update mpesa_requests set pos_payment_id = _pid where id = _q.id;
    elsif _q.reservation_id is null and _o.reservation_id is not null then
      -- the bill was settled another way meanwhile: keep the money on the guest's room bill
      insert into payments (hotel_id, reservation_id, method, amount, reference, payer_phone, notes, received_by)
      values (_q.hotel_id, _o.reservation_id, 'mpesa', _amt, _receipt, _phone, 'M-Pesa prompt for POS bill ' || _o.number || ' paid after the bill was closed', _q.created_by)
      returning id into _pid;
      update mpesa_requests set payment_id = _pid where id = _q.id;
    end if;
  else
    insert into payments (hotel_id, reservation_id, method, amount, reference, payer_phone, notes, received_by)
    values (_q.hotel_id, _q.reservation_id, 'mpesa', _amt, _receipt, _phone,
            case when _q.kind = 'online' then 'Online deposit (M-Pesa prompt)' else 'M-Pesa prompt' end, _q.created_by)
    returning id into _pid;
    update mpesa_requests set payment_id = _pid where id = _q.id;
  end if;
  update mpesa_requests set status = 'paid', result_code = 0, result_desc = left(_desc, 300), receipt = _receipt,
         paid_amount = _amt, paid_phone = _phone, finished_at = now() where id = _q.id;
  perform set_config('hotel_easy.rpc', '', true);
  perform log_activity(_q.hotel_id, 'payment', format('M-Pesa %s %s received from %s (%s)%s', _cur, to_char(_amt, 'FM999,999,990'),
    coalesce(_phone, _q.phone), _receipt, case when _q.kind = 'online' then ', online deposit' else '' end),
    coalesce(_q.reservation_id, _q.pos_order_id));
  return jsonb_build_object('ok', true, 'status', 'paid');
end $$;

revoke all on function public.mpesa_job(uuid, text), public.mpesa_hotel_keys(uuid), public.mpesa_mark_sent(uuid, text, text, text),
  public.mpesa_mark_failed(uuid, int, text), public.mpesa_result(text, text, int, text, text, numeric, text),
  public.mpesa_online_amount(reservations) from public, anon, authenticated;
grant execute on function public.mpesa_job(uuid, text), public.mpesa_hotel_keys(uuid), public.mpesa_mark_sent(uuid, text, text, text),
  public.mpesa_mark_failed(uuid, int, text), public.mpesa_result(text, text, int, text, text, numeric, text) to service_role;

-- ---------- the booking page shows what can be paid ----------
create or replace function public.public_mpesa_info(_slug text, _code text, _email_or_last_name text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _s booking_settings; _r reservations; _k text; _paid numeric;
begin
  select * into _s from booking_settings where slug = lower(trim(_slug)) and enabled;
  if not found then return jsonb_build_object('available', false); end if;
  _k := lower(trim(coalesce(_email_or_last_name, '')));
  select r.* into _r from reservations r join guests g on g.id = r.guest_id
   where r.hotel_id = _s.hotel_id and upper(r.code) = upper(trim(_code)) and _k <> '' and (lower(g.email) = _k or lower(g.last_name) = _k);
  if not found then return jsonb_build_object('available', false); end if;
  select coalesce(sum(amount), 0) into _paid from payments where reservation_id = _r.id and voided_at is null;
  return jsonb_build_object(
    'available', _r.status = 'confirmed' and mpesa_ready(_r.hotel_id) and coalesce(mpesa_online_amount(_r), 0) >= 1,
    'amount', coalesce(mpesa_online_amount(_r), 0), 'paid', _paid,
    'deposit', (select online_deposit from mpesa_settings where hotel_id = _r.hotel_id));
end $$;
grant execute on function public.public_mpesa_info(text, text, text) to anon, authenticated;
