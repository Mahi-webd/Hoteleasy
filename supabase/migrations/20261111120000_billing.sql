-- =====================================================================
-- HotelEasy phase 3: billing
-- Guest folios (charges + payments), automatic room charges, VAT and
-- tourism levy, M-Pesa / cash / card payments, numbered invoices,
-- settlement at check-out.
--
-- Run AFTER 20261111000000_core_multi_hotel.sql. Safe to run once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Hotel billing settings
-- ---------------------------------------------------------------------
alter table public.hotels
  add column kra_pin             text,
  add column prices_include_vat  boolean not null default true,
  add column tourism_levy_rate   numeric(5,4) not null default 0 check (tourism_levy_rate >= 0 and tourism_levy_rate < 0.2),
  add column invoice_prefix      text not null default 'INV' check (invoice_prefix ~ '^[A-Za-z0-9-]{1,12}$'),
  add column next_invoice_number int  not null default 1 check (next_invoice_number >= 1),
  add column mpesa_paybill       text,
  add column mpesa_account       text,
  add column mpesa_till          text,
  add column bank_details        text,
  add column invoice_footer      text;

-- Invoice numbers may only go forward.
create or replace function public.guard_invoice_counter()
returns trigger language plpgsql as $$
begin
  if new.next_invoice_number < old.next_invoice_number then
    raise exception 'The next invoice number cannot be lowered (it is %)', old.next_invoice_number;
  end if;
  return new;
end $$;
create trigger hotels_guard_invoice_counter
  before update of next_invoice_number on public.hotels
  for each row execute function public.guard_invoice_counter();

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.charge_kind as enum
  ('room', 'food', 'drinks', 'laundry', 'minibar', 'transport', 'spa', 'conference', 'service', 'other', 'discount');

create type public.payment_method as enum
  ('cash', 'mpesa', 'card', 'bank_transfer', 'cheque', 'other');

-- ---------------------------------------------------------------------
-- Charges on a guest's bill
-- ---------------------------------------------------------------------
create table public.folio_charges (
  id               uuid primary key default gen_random_uuid(),
  hotel_id         uuid not null references public.hotels(id) on delete cascade,
  reservation_id   uuid not null references public.reservations(id) on delete restrict,
  kind             public.charge_kind not null,
  description      text not null check (length(trim(description)) > 0),
  stay_date        date,                             -- the night, for room charges
  quantity         numeric(10,2) not null default 1 check (quantity > 0),
  unit_price       numeric(12,2) not null,
  -- worked out by trigger from the hotel's tax settings at posting time
  vat_rate         numeric(5,4) not null default 0,
  levy_rate        numeric(5,4) not null default 0,
  price_includes_tax boolean not null default true,
  net_amount       numeric(14,2) not null default 0,
  vat_amount       numeric(14,2) not null default 0,
  levy_amount      numeric(14,2) not null default 0,
  amount           numeric(14,2) not null default 0,  -- what the guest pays for this line
  posted_by        uuid references auth.users(id) on delete set null default auth.uid(),
  posted_at        timestamptz not null default now(),
  voided_at        timestamptz,
  voided_by        uuid references auth.users(id) on delete set null,
  void_reason      text,
  constraint folio_charges_discount_sign check ((kind = 'discount') = (unit_price < 0) or unit_price = 0),
  constraint folio_charges_room_date check (kind <> 'room' or stay_date is not null)
);
create index on public.folio_charges (reservation_id);
create index on public.folio_charges (hotel_id, posted_at);
create unique index folio_charges_one_room_night
  on public.folio_charges (reservation_id, stay_date) where kind = 'room' and voided_at is null;

create or replace function public.compute_charge_amounts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _h hotels;
  _line numeric;
  _tax numeric;
begin
  if tg_op = 'INSERT' then
    select * into _h from hotels where id = new.hotel_id;
    new.vat_rate := _h.vat_rate;
    new.levy_rate := _h.tourism_levy_rate;
    new.price_includes_tax := _h.prices_include_vat;
    if not exists (select 1 from reservations where id = new.reservation_id and hotel_id = new.hotel_id) then
      raise exception 'Reservation does not belong to this hotel';
    end if;
  end if;
  _line := round(new.quantity * new.unit_price, 2);
  _tax := new.vat_rate + new.levy_rate;
  if new.price_includes_tax then
    new.amount := _line;
    new.net_amount := round(_line / (1 + _tax), 2);
    new.vat_amount := round(new.net_amount * new.vat_rate, 2);
    new.levy_amount := new.amount - new.net_amount - new.vat_amount;
  else
    new.net_amount := _line;
    new.vat_amount := round(_line * new.vat_rate, 2);
    new.levy_amount := round(_line * new.levy_rate, 2);
    new.amount := new.net_amount + new.vat_amount + new.levy_amount;
  end if;
  return new;
end $$;

create trigger folio_charges_compute
  before insert or update of quantity, unit_price on public.folio_charges
  for each row execute function public.compute_charge_amounts();

-- ---------------------------------------------------------------------
-- Payments (negative amount = refund)
-- ---------------------------------------------------------------------
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        uuid not null references public.hotels(id) on delete cascade,
  reservation_id  uuid not null references public.reservations(id) on delete restrict,
  method          public.payment_method not null,
  amount          numeric(14,2) not null check (amount <> 0),
  reference       text,            -- M-Pesa code, card slip no., bank ref
  payer_phone     text,
  notes           text,
  received_by     uuid references auth.users(id) on delete set null default auth.uid(),
  received_at     timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by       uuid references auth.users(id) on delete set null,
  void_reason     text,
  constraint payments_mpesa_code check (method <> 'mpesa' or reference ~ '^[A-Z0-9]{10}$')
);
create index on public.payments (reservation_id);
create index on public.payments (hotel_id, received_at);
-- The same M-Pesa transaction can't be recorded twice in one hotel.
create unique index payments_mpesa_once
  on public.payments (hotel_id, reference) where method = 'mpesa' and voided_at is null;

create or replace function public.check_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.method = 'mpesa' then
    new.reference := upper(trim(new.reference));
  end if;
  if not exists (select 1 from reservations where id = new.reservation_id and hotel_id = new.hotel_id) then
    raise exception 'Reservation does not belong to this hotel';
  end if;
  return new;
end $$;
create trigger payments_check before insert on public.payments
  for each row execute function public.check_payment();

-- ---------------------------------------------------------------------
-- Balances
-- ---------------------------------------------------------------------
create view public.reservation_balances with (security_invoker = true) as
select r.id as reservation_id,
       r.hotel_id,
       coalesce(c.total, 0)::numeric(14,2) as charges_total,
       coalesce(p.total, 0)::numeric(14,2) as payments_total,
       (coalesce(c.total, 0) - coalesce(p.total, 0))::numeric(14,2) as balance
from public.reservations r
left join (select reservation_id, sum(amount) total from public.folio_charges where voided_at is null group by 1) c
  on c.reservation_id = r.id
left join (select reservation_id, sum(amount) total from public.payments where voided_at is null group by 1) p
  on p.reservation_id = r.id;

create or replace function public.reservation_balance(_reservation_id uuid)
returns numeric language sql stable security invoker set search_path = public as $$
  select coalesce((select sum(amount) from folio_charges where reservation_id = _reservation_id and voided_at is null), 0)
       - coalesce((select sum(amount) from payments where reservation_id = _reservation_id and voided_at is null), 0);
$$;

-- ---------------------------------------------------------------------
-- Invoices (a frozen copy of the bill at the time of issue)
-- ---------------------------------------------------------------------
create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        uuid not null references public.hotels(id) on delete cascade,
  reservation_id  uuid not null references public.reservations(id) on delete restrict,
  number          text not null,
  issued_at       timestamptz not null default now(),
  issued_by       uuid references auth.users(id) on delete set null,
  hotel           jsonb not null,   -- name, address, KRA PIN, paybill... as at issue
  guest           jsonb not null,
  stay            jsonb not null,
  lines           jsonb not null,
  net_total       numeric(14,2) not null,
  vat_total       numeric(14,2) not null,
  levy_total      numeric(14,2) not null,
  total           numeric(14,2) not null,
  superseded_at   timestamptz,
  superseded_by   uuid references public.invoices(id),
  unique (hotel_id, number)
);
create index on public.invoices (hotel_id, issued_at desc);
create unique index invoices_one_current_per_stay on public.invoices (reservation_id) where superseded_at is null;

-- =====================================================================
-- Room charges follow the stay automatically
-- =====================================================================
create or replace function public.sync_room_charges(_reservation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _r reservations;
  _num text;
  d date;
begin
  select * into _r from reservations where id = _reservation_id;
  if _r.status <> 'checked_in' then return; end if;
  select room_number into _num from rooms where id = _r.room_id;

  -- Nights no longer part of the stay
  update folio_charges
     set voided_at = now(), voided_by = auth.uid(), void_reason = 'Stay dates changed'
   where reservation_id = _r.id and kind = 'room' and voided_at is null
     and (stay_date < _r.check_in or stay_date >= _r.check_out);

  -- Rate changed
  update folio_charges
     set unit_price = _r.rate_per_night
   where reservation_id = _r.id and kind = 'room' and voided_at is null
     and unit_price <> _r.rate_per_night;

  -- Nights not yet charged (a night voided by staff on purpose stays voided)
  for d in select generate_series(_r.check_in, _r.check_out - 1, interval '1 day')::date loop
    if not exists (
      select 1 from folio_charges
      where reservation_id = _r.id and kind = 'room' and stay_date = d
        and (voided_at is null or void_reason is distinct from 'Stay dates changed')
    ) then
      insert into folio_charges (hotel_id, reservation_id, kind, description, stay_date, quantity, unit_price)
      values (_r.hotel_id, _r.id, 'room',
              format('Room %s – night of %s', coalesce(_num, '?'), to_char(d, 'Dy DD Mon YYYY')),
              d, 1, _r.rate_per_night);
    end if;
  end loop;
end $$;
revoke execute on function public.sync_room_charges(uuid) from public, anon, authenticated;

create or replace function public.reservations_sync_charges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'checked_in' and (
       old.status is distinct from new.status
    or old.check_in <> new.check_in or old.check_out <> new.check_out
    or old.rate_per_night <> new.rate_per_night
    or old.room_id is distinct from new.room_id) then
    perform sync_room_charges(new.id);
  end if;
  return new;
end $$;

create trigger reservations_sync_room_charges
  after update on public.reservations
  for each row execute function public.reservations_sync_charges();

-- =====================================================================
-- Invoices
-- =====================================================================
create or replace function public.issue_invoice(_reservation_id uuid)
returns public.invoices
language plpgsql security definer set search_path = public as $$
declare
  _r reservations;
  _h hotels;
  _g guests;
  _room text;
  _num int;
  _old uuid;
  _inv invoices;
begin
  select * into _r from reservations where id = _reservation_id;
  if not found then raise exception 'Reservation not found'; end if;
  if not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk','accountant']::hotel_role[]) then
    raise exception 'You do not have permission to issue invoices';
  end if;
  if not exists (select 1 from folio_charges where reservation_id = _r.id and voided_at is null) then
    raise exception 'There are no charges to invoice';
  end if;

  -- Lock the hotel row so numbers are handed out one at a time.
  select * into _h from hotels where id = _r.hotel_id for update;
  _num := _h.next_invoice_number;
  update hotels set next_invoice_number = _num + 1 where id = _h.id;

  select * into _g from guests where id = _r.guest_id;
  select room_number into _room from rooms where id = _r.room_id;
  select id into _old from invoices where reservation_id = _r.id and superseded_at is null;
  if _old is not null then
    update invoices set superseded_at = now() where id = _old;
  end if;

  insert into invoices (hotel_id, reservation_id, number, issued_by, hotel, guest, stay, lines,
                        net_total, vat_total, levy_total, total)
  select _r.hotel_id, _r.id,
         format('%s-%s-%s', _h.invoice_prefix, to_char(now() at time zone _h.timezone, 'YYYY'), lpad(_num::text, 5, '0')),
         auth.uid(),
         jsonb_build_object('name', _h.name, 'address', _h.address, 'city', _h.city, 'country', _h.country,
                            'phone', _h.phone, 'email', _h.email, 'kra_pin', _h.kra_pin, 'currency', _h.currency,
                            'mpesa_paybill', _h.mpesa_paybill, 'mpesa_account', _h.mpesa_account,
                            'mpesa_till', _h.mpesa_till, 'bank_details', _h.bank_details,
                            'footer', _h.invoice_footer, 'vat_rate', _h.vat_rate, 'levy_rate', _h.tourism_levy_rate),
         jsonb_build_object('name', trim(_g.first_name || ' ' || _g.last_name), 'phone', _g.phone, 'email', _g.email,
                            'id_type', _g.id_type, 'id_number', _g.id_number, 'address', _g.address),
         jsonb_build_object('code', _r.code, 'room', _room, 'check_in', _r.check_in, 'check_out', _r.check_out,
                            'nights', _r.nights, 'adults', _r.adults, 'children', _r.children),
         coalesce(jsonb_agg(jsonb_build_object('kind', c.kind, 'description', c.description, 'date', coalesce(c.stay_date, (c.posted_at at time zone _h.timezone)::date),
                            'quantity', c.quantity, 'unit_price', c.unit_price, 'net', c.net_amount, 'vat', c.vat_amount,
                            'levy', c.levy_amount, 'amount', c.amount)
                  order by coalesce(c.stay_date, (c.posted_at at time zone _h.timezone)::date), c.posted_at), '[]'::jsonb),
         coalesce(sum(c.net_amount), 0), coalesce(sum(c.vat_amount), 0), coalesce(sum(c.levy_amount), 0), coalesce(sum(c.amount), 0)
  from folio_charges c
  where c.reservation_id = _r.id and c.voided_at is null
  returning * into _inv;

  if _old is not null then
    update invoices set superseded_by = _inv.id where id = _old;
  end if;

  perform log_activity(_r.hotel_id, 'invoice', format('Invoice %s issued (%s %s)', _inv.number, _h.currency, to_char(_inv.total, 'FM999,999,990')), _r.id);
  return _inv;
end $$;

-- =====================================================================
-- Check-out now settles the bill and issues the invoice
-- =====================================================================
drop function public.check_out_reservation(uuid);

create or replace function public.check_out_reservation(_reservation_id uuid, _allow_balance boolean default false)
returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  _r reservations;
  _num text;
  _g text;
  _today date;
  _bal numeric;
  _cur text;
begin
  select * into _r from reservations where id = _reservation_id for update;
  if not found then raise exception 'Reservation not found'; end if;
  if not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[]) then
    raise exception 'You do not have permission to check guests out';
  end if;
  if _r.status <> 'checked_in' then
    raise exception 'Only checked-in guests can be checked out';
  end if;

  select (now() at time zone timezone)::date, currency into _today, _cur from hotels where id = _r.hotel_id;
  perform set_config('hotel_easy.rpc', 'on', true);

  -- Leaving early: only bill the nights stayed (minimum one night).
  if _r.check_out > greatest(_today, _r.check_in + 1) then
    update reservations set check_out = greatest(_today, _r.check_in + 1) where id = _r.id;
  end if;

  _bal := reservation_balance(_r.id);
  if _bal > 0.009 and not _allow_balance then
    perform set_config('hotel_easy.rpc', 'off', true);
    raise exception 'BALANCE_DUE: % % is still unpaid', _cur, to_char(_bal, 'FM999,999,990.00');
  end if;

  update reservations set status = 'checked_out', checked_out_at = now() where id = _r.id returning * into _r;
  update rooms set status = 'dirty' where id = _r.room_id returning room_number into _num;

  select trim(first_name || ' ' || last_name) into _g from guests where id = _r.guest_id;
  perform log_activity(_r.hotel_id, 'checkout',
    format('%s checked out of room %s%s', _g, _num,
           case when _bal > 0.009 then format(' with %s %s owing', _cur, to_char(_bal, 'FM999,999,990')) else '' end), _r.id);
  perform set_config('hotel_easy.rpc', 'off', true);

  if exists (select 1 from folio_charges where reservation_id = _r.id and voided_at is null) then
    perform issue_invoice(_r.id);
  end if;
  return _r;
end $$;

-- =====================================================================
-- Voiding (no deletes, ever)
-- =====================================================================
create or replace function public.void_charge(_charge_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare _c folio_charges;
begin
  select * into _c from folio_charges where id = _charge_id for update;
  if not found or not is_hotel_member(_c.hotel_id) then raise exception 'Charge not found'; end if;
  if _c.voided_at is not null then raise exception 'Already voided'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Give a reason for voiding'; end if;
  if not (has_hotel_role(_c.hotel_id, array['owner','manager','accountant']::hotel_role[])
          or (_c.posted_by = auth.uid() and _c.posted_at > now() - interval '15 minutes'
              and has_hotel_role(_c.hotel_id, array['front_desk']::hotel_role[]))) then
    raise exception 'Only a manager or accountant can void this charge (staff can void their own entries within 15 minutes)';
  end if;
  update folio_charges set voided_at = now(), voided_by = auth.uid(), void_reason = trim(_reason) where id = _c.id;
  perform log_activity(_c.hotel_id, 'billing', format('Voided charge "%s" (%s): %s', _c.description, to_char(_c.amount, 'FM999,999,990'), trim(_reason)), _c.reservation_id);
end $$;

create or replace function public.void_payment(_payment_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare _p payments;
begin
  select * into _p from payments where id = _payment_id for update;
  if not found or not is_hotel_member(_p.hotel_id) then raise exception 'Payment not found'; end if;
  if _p.voided_at is not null then raise exception 'Already voided'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Give a reason for voiding'; end if;
  if not (has_hotel_role(_p.hotel_id, array['owner','manager','accountant']::hotel_role[])
          or (_p.received_by = auth.uid() and _p.received_at > now() - interval '15 minutes'
              and has_hotel_role(_p.hotel_id, array['front_desk']::hotel_role[]))) then
    raise exception 'Only a manager or accountant can void this payment (staff can void their own entries within 15 minutes)';
  end if;
  update payments set voided_at = now(), voided_by = auth.uid(), void_reason = trim(_reason) where id = _p.id;
  perform log_activity(_p.hotel_id, 'billing', format('Voided %s payment of %s: %s', _p.method, to_char(_p.amount, 'FM999,999,990'), trim(_reason)), _p.reservation_id);
end $$;

-- Log payments for the dashboard feed
create or replace function public.log_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare _g text; _cur text;
begin
  select trim(g.first_name || ' ' || g.last_name) into _g
    from reservations r join guests g on g.id = r.guest_id where r.id = new.reservation_id;
  select currency into _cur from hotels where id = new.hotel_id;
  perform log_activity(new.hotel_id, 'payment',
    format('%s %s %s %s %s', case when new.amount < 0 then 'Refund of' else 'Payment of' end, _cur,
           to_char(abs(new.amount), 'FM999,999,990'), case when new.amount < 0 then 'to' else 'from' end,
           _g || ' (' || replace(new.method::text, '_', ' ') || coalesce(' ' || new.reference, '') || ')'), new.reservation_id);
  return new;
end $$;
create trigger payments_log after insert on public.payments
  for each row execute function public.log_payment();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.folio_charges enable row level security;
alter table public.payments      enable row level security;
alter table public.invoices      enable row level security;
revoke all on public.folio_charges, public.payments, public.invoices, public.reservation_balances from anon;

create policy charges_select on public.folio_charges for select to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk','accountant']::public.hotel_role[]));
create policy charges_insert on public.folio_charges for insert to authenticated
  with check (public.has_hotel_role(hotel_id, array['owner','manager','front_desk','accountant']::public.hotel_role[])
              and voided_at is null and kind <> 'room'
              and posted_by = auth.uid());
-- no update / delete policies: use void_charge()

create policy payments_select on public.payments for select to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk','accountant']::public.hotel_role[]));
create policy payments_insert on public.payments for insert to authenticated
  with check (public.has_hotel_role(hotel_id, array['owner','manager','front_desk','accountant']::public.hotel_role[])
              and voided_at is null and received_by = auth.uid()
              -- refunds only by managers / accountants
              and (amount > 0 or public.has_hotel_role(hotel_id, array['owner','manager','accountant']::public.hotel_role[])));

create policy invoices_select on public.invoices for select to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk','accountant']::public.hotel_role[]));

revoke execute on function public.issue_invoice(uuid) from public, anon;
revoke execute on function public.check_out_reservation(uuid, boolean) from public, anon;
revoke execute on function public.void_charge(uuid, text) from public, anon;
revoke execute on function public.void_payment(uuid, text) from public, anon;
revoke execute on function public.reservation_balance(uuid) from public, anon;
grant execute on function public.issue_invoice(uuid) to authenticated;
grant execute on function public.check_out_reservation(uuid, boolean) to authenticated;
grant execute on function public.void_charge(uuid, text) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;
grant execute on function public.reservation_balance(uuid) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.folio_charges, public.payments;
  end if;
end $$;
