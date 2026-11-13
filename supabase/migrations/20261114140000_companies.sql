-- =====================================================================
-- HotelEasy: corporate accounts (city ledger)
--  * companies with negotiated rates (fixed per room type, or a %
--    discount on the season price), credit limit and payment terms
--  * a stay can be billed to a company (room only, or everything), with
--    the company's order/LPO number
--  * at check-out the company's share moves off the guest's bill
--    (folio_transfers) onto the company account (company_ledger); it is
--    not counted as money received
--  * the company pays later; payments are matched to the oldest charges
--    for ageing; monthly statements; invoices show the company and PIN
-- =====================================================================

create table public.companies (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       uuid not null references public.hotels(id) on delete cascade,
  name           text not null check (length(trim(name)) between 1 and 120),
  kra_pin        text check (kra_pin is null or kra_pin ~ '^[A-Z][0-9]{9}[A-Z]$'),
  contact_name   text,
  email          text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone          text,
  address        text,
  credit_limit   numeric(14,2) check (credit_limit is null or credit_limit >= 0),
  terms_days     int not null default 30 check (terms_days between 0 and 180),
  discount_pct   numeric(5,2) check (discount_pct is null or discount_pct between 0 and 90),
  default_bill_to text not null default 'company_all' check (default_bill_to in ('company_room', 'company_all')),
  active         boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (hotel_id, name)
);
create trigger t_companies_upd before update on public.companies for each row execute function public.touch_updated_at();
create or replace function public.companies_pin_upper()
returns trigger language plpgsql as $$
begin new.kra_pin := nullif(upper(trim(new.kra_pin)), ''); new.email := nullif(lower(trim(new.email)), ''); return new; end $$;
create trigger companies_pin_upper before insert or update on public.companies for each row execute function public.companies_pin_upper();

create table public.company_rates (
  company_id    uuid not null references public.companies(id) on delete cascade,
  room_type_id  uuid not null references public.room_types(id) on delete cascade,
  hotel_id      uuid not null references public.hotels(id) on delete cascade,
  rate          numeric(12,2) not null check (rate >= 0),
  primary key (company_id, room_type_id)
);
create or replace function public.company_rate_hotel_ck()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select hotel_id from companies where id = new.company_id) is distinct from new.hotel_id
     or (select hotel_id from room_types where id = new.room_type_id) is distinct from new.hotel_id then
    raise exception 'Company and room type must belong to the same hotel';
  end if;
  return new;
end $$;
create trigger company_rate_hotel_ck before insert or update on public.company_rates for each row execute function public.company_rate_hotel_ck();

alter table public.reservations add column if not exists company_id uuid references public.companies(id) on delete restrict;
alter table public.reservations add column if not exists bill_to text not null default 'guest' check (bill_to in ('guest', 'company_room', 'company_all'));
alter table public.reservations add column if not exists company_ref text check (company_ref is null or length(company_ref) <= 60);
create index on public.reservations (company_id) where company_id is not null;
alter table public.guests add column if not exists company_id uuid references public.companies(id) on delete set null;

create or replace function public.reservation_company_ck()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.company_id is null then new.bill_to := 'guest'; new.company_ref := null; return new; end if;
  if (select hotel_id from companies where id = new.company_id) is distinct from new.hotel_id then
    raise exception 'Company not found';
  end if;
  if tg_op = 'INSERT' or new.company_id is distinct from old.company_id then
    if not (select active from companies where id = new.company_id) then raise exception 'This company account is closed'; end if;
  end if;
  return new;
end $$;
create trigger reservation_company_ck before insert or update of company_id, bill_to, company_ref on public.reservations
  for each row execute function public.reservation_company_ck();

-- ---------------------------------------------------------------------
-- Moving a stay's bill to a company
-- ---------------------------------------------------------------------
create table public.folio_transfers (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        uuid not null references public.hotels(id) on delete cascade,
  reservation_id  uuid not null references public.reservations(id) on delete restrict,
  company_id      uuid not null references public.companies(id) on delete restrict,
  amount          numeric(14,2) not null check (amount > 0),
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by       uuid references auth.users(id) on delete set null,
  void_reason     text
);
create index on public.folio_transfers (reservation_id);

-- Balances now take away what was moved to a company.
create or replace view public.reservation_balances with (security_invoker = true) as
select r.id as reservation_id,
       r.hotel_id,
       coalesce(c.total, 0)::numeric(14,2) as charges_total,
       coalesce(p.total, 0)::numeric(14,2) as payments_total,
       (coalesce(c.total, 0) - coalesce(p.total, 0) - coalesce(t.total, 0))::numeric(14,2) as balance,
       coalesce(t.total, 0)::numeric(14,2) as transferred_total
from public.reservations r
left join (select reservation_id, sum(amount) total from public.folio_charges where voided_at is null group by 1) c on c.reservation_id = r.id
left join (select reservation_id, sum(amount) total from public.payments where voided_at is null group by 1) p on p.reservation_id = r.id
left join (select reservation_id, sum(amount) total from public.folio_transfers where voided_at is null group by 1) t on t.reservation_id = r.id;

create or replace function public.reservation_balance(_reservation_id uuid)
returns numeric language sql stable security invoker set search_path = public as $$
  select coalesce((select sum(amount) from folio_charges where reservation_id = _reservation_id and voided_at is null), 0)
       - coalesce((select sum(amount) from payments where reservation_id = _reservation_id and voided_at is null), 0)
       - coalesce((select sum(amount) from folio_transfers where reservation_id = _reservation_id and voided_at is null), 0);
$$;

-- ---------------------------------------------------------------------
-- The company account (city ledger)
-- amount > 0: the company owes more (stays, adjustments)
-- amount < 0: the company paid or was credited
-- ---------------------------------------------------------------------
create table public.company_ledger (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        uuid not null references public.hotels(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete restrict,
  kind            text not null check (kind in ('stay', 'payment', 'credit', 'charge')),
  entry_date      date not null,
  amount          numeric(14,2) not null check (amount <> 0),
  description     text not null,
  reservation_id  uuid references public.reservations(id) on delete restrict,
  transfer_id     uuid references public.folio_transfers(id) on delete restrict,
  method          public.payment_method,
  reference       text,
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by       uuid references auth.users(id) on delete set null,
  void_reason     text,
  constraint company_ledger_sign check ((kind in ('stay', 'charge') and amount > 0) or (kind in ('payment', 'credit') and amount < 0))
);
create index on public.company_ledger (company_id, entry_date);
create unique index company_ledger_mpesa_once on public.company_ledger (hotel_id, reference) where method = 'mpesa' and voided_at is null;

alter table public.companies enable row level security;
alter table public.company_rates enable row level security;
alter table public.folio_transfers enable row level security;
alter table public.company_ledger enable row level security;
revoke all on public.companies, public.company_rates, public.folio_transfers, public.company_ledger from anon;
create policy co_sel on public.companies for select to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk','accountant']::public.hotel_role[]));
create policy co_ins on public.companies for insert to authenticated
  with check (public.has_hotel_role(hotel_id, array['owner','manager','accountant']::public.hotel_role[]));
create policy co_upd on public.companies for update to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','accountant']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager','accountant']::public.hotel_role[]));
create policy cr_sel on public.company_rates for select to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk','accountant']::public.hotel_role[]));
create policy cr_all on public.company_rates for all to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','accountant']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager','accountant']::public.hotel_role[]));
create policy ft_sel on public.folio_transfers for select to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk','accountant']::public.hotel_role[]));
create policy cl_sel on public.company_ledger for select to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','accountant']::public.hotel_role[]));
-- (transfers and ledger entries are written only by the functions below)

create or replace function public.company_balance(_company_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0) from company_ledger where company_id = _company_id and voided_at is null
$$;
revoke execute on function public.company_balance(uuid) from public, anon, authenticated;

-- What a company-billed stay would move to the company now.
create or replace function public.company_share(_reservation_id uuid)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare _r reservations; _bal numeric; _room numeric; _done numeric;
begin
  select * into _r from reservations where id = _reservation_id;
  if _r.company_id is null or _r.bill_to = 'guest' then return 0; end if;
  _bal := reservation_balance(_r.id);
  if _bal <= 0 then return 0; end if;
  if _r.bill_to = 'company_all' then return _bal; end if;
  select coalesce(sum(amount), 0) into _room from folio_charges where reservation_id = _r.id and voided_at is null and kind = 'room';
  select coalesce(sum(amount), 0) into _done from folio_transfers where reservation_id = _r.id and voided_at is null;
  return greatest(0, least(_bal, _room - _done));
end $$;
revoke execute on function public.company_share(uuid) from public, anon;
grant execute on function public.company_share(uuid) to authenticated;

create or replace function public.company_transfer_internal(_reservation_id uuid, _company_id uuid, _amount numeric, _override_limit boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare _r reservations; _c companies; _h hotels; _t uuid; _g text; _room text;
begin
  select * into _r from reservations where id = _reservation_id;
  select * into _c from companies where id = _company_id for update;
  select * into _h from hotels where id = _r.hotel_id;
  if _c.id is null or _c.hotel_id <> _r.hotel_id then raise exception 'Company not found'; end if;
  _amount := round(_amount, 2);
  if _amount <= 0 then raise exception 'Nothing to move to the company'; end if;
  if _amount > reservation_balance(_r.id) + 0.009 then raise exception 'You can only move what the guest still owes'; end if;
  if _c.credit_limit is not null and company_balance(_c.id) + _amount > _c.credit_limit + 0.009 and not _override_limit then
    raise exception 'CREDIT_LIMIT: % would go over its credit limit of % % (it owes % %). Ask a manager, or take payment from the guest.',
      _c.name, _h.currency, to_char(_c.credit_limit, 'FM999,999,990'), _h.currency, to_char(company_balance(_c.id), 'FM999,999,990');
  end if;
  insert into folio_transfers (hotel_id, reservation_id, company_id, amount) values (_r.hotel_id, _r.id, _c.id, _amount) returning id into _t;
  select trim(first_name || ' ' || last_name) into _g from guests where id = _r.guest_id;
  select room_number into _room from rooms where id = _r.room_id;
  insert into company_ledger (hotel_id, company_id, kind, entry_date, amount, description, reservation_id, transfer_id, reference)
  values (_r.hotel_id, _c.id, 'stay', least(_r.check_out, (now() at time zone _h.timezone)::date), _amount,
          format('%s, %s%s, %s – %s', _r.code, _g, coalesce(', room ' || _room, ''), to_char(_r.check_in, 'DD Mon'), to_char(_r.check_out, 'DD Mon YYYY')),
          _r.id, _t, _r.company_ref);
  perform log_activity(_r.hotel_id, 'billing', format('%s %s moved to %s''s account (%s)', _h.currency, to_char(_amount, 'FM999,999,990.00'), _c.name, _r.code), _r.id);
  return _t;
end $$;
revoke execute on function public.company_transfer_internal(uuid, uuid, numeric, boolean) from public, anon, authenticated;

-- Staff: move (part of) a stay's balance to a company account.
create or replace function public.company_transfer(_reservation_id uuid, _company_id uuid default null, _amount numeric default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _r reservations; _cid uuid; _amt numeric;
begin
  select * into _r from reservations where id = _reservation_id for update;
  if not found or not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk','accountant']::hotel_role[]) then raise exception 'Reservation not found'; end if;
  if _r.status not in ('checked_in', 'checked_out') then raise exception 'Bills move to a company account once the guest has checked in'; end if;
  _cid := coalesce(_company_id, _r.company_id);
  if _cid is null then raise exception 'Choose a company'; end if;
  _amt := coalesce(_amount, case when _cid = _r.company_id and _r.bill_to <> 'guest' then company_share(_r.id) else reservation_balance(_r.id) end);
  return company_transfer_internal(_r.id, _cid, _amt, has_hotel_role(_r.hotel_id, array['owner','manager','accountant']::hotel_role[]));
end $$;
grant execute on function public.company_transfer(uuid, uuid, numeric) to authenticated;

-- Record money from a company, a credit note, or an extra charge.
create or replace function public.company_entry(_company_id uuid, _kind text, _amount numeric, _entry_date date default null,
  _method public.payment_method default null, _reference text default null, _description text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _c companies; _id uuid; _ref text; _d date;
begin
  select * into _c from companies where id = _company_id;
  if not found or not has_hotel_role(_c.hotel_id, array['owner','manager','accountant']::hotel_role[]) then raise exception 'Company not found'; end if;
  if _kind not in ('payment', 'credit', 'charge') then raise exception 'Unknown entry'; end if;
  if coalesce(_amount, 0) <= 0 then raise exception 'Enter an amount above zero'; end if;
  _d := coalesce(_entry_date, (now() at time zone (select timezone from hotels where id = _c.hotel_id))::date);
  if _d > (now() at time zone (select timezone from hotels where id = _c.hotel_id))::date then raise exception 'The date cannot be in the future'; end if;
  _ref := nullif(trim(_reference), '');
  if _kind = 'payment' then
    if _method is null then raise exception 'Choose how they paid'; end if;
    if _method = 'mpesa' then
      _ref := upper(_ref);
      if _ref is null or _ref !~ '^[A-Z0-9]{10}$' then raise exception 'Enter the 10-character M-Pesa code'; end if;
      if exists (select 1 from payments where hotel_id = _c.hotel_id and method = 'mpesa' and reference = _ref and voided_at is null) then
        raise exception 'This M-Pesa code is already recorded on a guest bill';
      end if;
    end if;
  elsif coalesce(trim(_description), '') = '' then raise exception 'Say what this is for';
  end if;
  insert into company_ledger (hotel_id, company_id, kind, entry_date, amount, description, method, reference)
  values (_c.hotel_id, _c.id, _kind, _d, case when _kind = 'charge' then round(_amount, 2) else -round(_amount, 2) end,
          coalesce(nullif(trim(_description), ''), 'Payment received'), case when _kind = 'payment' then _method end, _ref)
  returning id into _id;
  perform log_activity(_c.hotel_id, case when _kind = 'payment' then 'payment' else 'billing' end,
    format('%s: %s %s %s', _c.name, case _kind when 'payment' then 'payment of' when 'credit' then 'credit note' else 'charge' end,
           (select currency from hotels where id = _c.hotel_id), to_char(_amount, 'FM999,999,990.00')), _id);
  return _id;
end $$;
grant execute on function public.company_entry(uuid, text, numeric, date, public.payment_method, text, text) to authenticated;

-- Undo an entry. Undoing a stay puts the amount back on the guest's bill.
create or replace function public.company_entry_void(_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare _e company_ledger;
begin
  select * into _e from company_ledger where id = _id for update;
  if not found or not has_hotel_role(_e.hotel_id, array['owner','manager','accountant']::hotel_role[]) then raise exception 'Entry not found'; end if;
  if _e.voided_at is not null then raise exception 'Already undone'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Give a reason'; end if;
  update company_ledger set voided_at = now(), voided_by = auth.uid(), void_reason = trim(_reason) where id = _id;
  if _e.transfer_id is not null then
    update folio_transfers set voided_at = now(), voided_by = auth.uid(), void_reason = trim(_reason) where id = _e.transfer_id;
  end if;
  perform log_activity(_e.hotel_id, 'billing', format('Company account entry undone: %s (%s)', _e.description, trim(_reason)), _e.reservation_id);
end $$;
grant execute on function public.company_entry_void(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Ageing: payments and credits clear the oldest charges first
-- ---------------------------------------------------------------------
create or replace function public.company_ageing_one(_company_id uuid, _as_of date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _c companies; _credit numeric; _e record; _open numeric; _days int;
  _cur numeric := 0; _b30 numeric := 0; _b60 numeric := 0; _b90 numeric := 0; _b90p numeric := 0; _oldest date;
begin
  select * into _c from companies where id = _company_id;
  select coalesce(-sum(amount), 0) into _credit from company_ledger where company_id = _company_id and voided_at is null and amount < 0 and entry_date <= _as_of;
  for _e in select entry_date, amount from company_ledger
             where company_id = _company_id and voided_at is null and amount > 0 and entry_date <= _as_of
             order by entry_date, created_at loop
    _open := greatest(0, _e.amount - _credit);
    _credit := greatest(0, _credit - _e.amount);
    if _open > 0 then
      _days := _as_of - (_e.entry_date + _c.terms_days);
      if _oldest is null then _oldest := _e.entry_date + _c.terms_days; end if;
      if _days <= 0 then _cur := _cur + _open;
      elsif _days <= 30 then _b30 := _b30 + _open;
      elsif _days <= 60 then _b60 := _b60 + _open;
      elsif _days <= 90 then _b90 := _b90 + _open;
      else _b90p := _b90p + _open; end if;
    end if;
  end loop;
  return jsonb_build_object('current', _cur, 'd30', _b30, 'd60', _b60, 'd90', _b90, 'd90p', _b90p,
    'overdue', _b30 + _b60 + _b90 + _b90p, 'unapplied_credit', _credit, 'oldest_due', _oldest);
end $$;
revoke execute on function public.company_ageing_one(uuid, date) from public, anon, authenticated;

-- Staff: every company with balance, ageing and limit. Front desk sees only names, limits and whether they're over.
create or replace function public.company_accounts(_hotel_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _today date; _money boolean;
begin
  if not has_hotel_role(_hotel_id, array['owner','manager','front_desk','accountant']::hotel_role[]) then raise exception 'Hotel not found'; end if;
  _money := has_hotel_role(_hotel_id, array['owner','manager','accountant']::hotel_role[]);
  _today := (now() at time zone (select timezone from hotels where id = _hotel_id))::date;
  return (select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) from (
    select to_jsonb(c) - case when _money then '{}'::text[] else array['notes'] end
      || jsonb_build_object(
        'balance', case when _money then company_balance(c.id) end,
        'over_limit', c.credit_limit is not null and company_balance(c.id) > c.credit_limit,
        'available', case when c.credit_limit is not null then c.credit_limit - company_balance(c.id) end,
        'ageing', case when _money then company_ageing_one(c.id, _today) end,
        'last_payment', case when _money then (select jsonb_build_object('date', entry_date, 'amount', -amount) from company_ledger
                          where company_id = c.id and kind = 'payment' and voided_at is null order by entry_date desc, created_at desc limit 1) end,
        'rates', (select coalesce(jsonb_object_agg(room_type_id, rate), '{}'::jsonb) from company_rates where company_id = c.id),
        'stays', (select count(*) from reservations r where r.company_id = c.id and r.status in ('confirmed', 'checked_in', 'checked_out'))
      ) x
    from companies c where c.hotel_id = _hotel_id) s);
end $$;
grant execute on function public.company_accounts(uuid) to authenticated;

-- A statement for a period, with running balance and ageing at the end date.
create or replace function public.company_statement(_company_id uuid, _from date, _to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _c companies; _h hotels; _open numeric;
begin
  select * into _c from companies where id = _company_id;
  if not found or not has_hotel_role(_c.hotel_id, array['owner','manager','accountant']::hotel_role[]) then raise exception 'Company not found'; end if;
  if _to < _from then raise exception 'The end date must be after the start date'; end if;
  select * into _h from hotels where id = _c.hotel_id;
  select coalesce(sum(amount), 0) into _open from company_ledger where company_id = _c.id and voided_at is null and entry_date < _from;
  return jsonb_build_object(
    'company', to_jsonb(_c),
    'hotel', jsonb_build_object('name', _h.name, 'address', _h.address, 'city', _h.city, 'phone', _h.phone, 'email', _h.email, 'kra_pin', _h.kra_pin,
       'currency', _h.currency, 'mpesa_paybill', _h.mpesa_paybill, 'mpesa_account', _h.mpesa_account, 'bank_details', _h.bank_details),
    'from', _from, 'to', _to, 'opening', _open,
    'entries', (select coalesce(jsonb_agg(to_jsonb(t) - 'created_at' order by t.date, t.created_at), '[]'::jsonb) from (
                  select e.id, e.entry_date as date, e.kind, e.description, e.reference, e.method, e.amount, e.reservation_id, e.created_at,
                         (select number from invoices i where i.reservation_id = e.reservation_id and i.superseded_at is null) as invoice,
                         case when e.amount > 0 then e.entry_date + _c.terms_days end as due,
                         _open + sum(e.amount) over (order by e.entry_date, e.created_at rows unbounded preceding) as balance
                    from company_ledger e where e.company_id = _c.id and e.voided_at is null and e.entry_date between _from and _to) t),
    'closing', _open + (select coalesce(sum(amount), 0) from company_ledger where company_id = _c.id and voided_at is null and entry_date between _from and _to),
    'ageing', company_ageing_one(_c.id, _to));
end $$;
grant execute on function public.company_statement(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------
-- Negotiated rates in quotes
-- ---------------------------------------------------------------------
drop function if exists public.stay_quote(uuid, date, date, boolean);
create or replace function public.stay_quote(_room_type_id uuid, _check_in date, _check_out date, _online boolean default false, _company_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _q jsonb; _c companies; _fixed numeric; _nights jsonb; _total numeric;
begin
  if not is_hotel_member((select hotel_id from room_types where id = _room_type_id)) then raise exception 'Room type not found'; end if;
  _q := stay_quote_internal(_room_type_id, _check_in, _check_out, _online);
  if _company_id is null then return _q; end if;
  select * into _c from companies where id = _company_id and hotel_id = (select hotel_id from room_types where id = _room_type_id);
  if not found then return _q; end if;
  select rate into _fixed from company_rates where company_id = _c.id and room_type_id = _room_type_id;
  if _fixed is null and coalesce(_c.discount_pct, 0) = 0 then return _q; end if;
  select jsonb_agg(n || jsonb_build_object('rate', coalesce(_fixed, round((n->>'rate')::numeric * (1 - _c.discount_pct / 100.0))),
                                            'season', _c.name, 'color', 'violet') order by n->>'date')
    into _nights from jsonb_array_elements(_q->'nights') n;
  select sum((n->>'rate')::numeric) into _total from jsonb_array_elements(_nights) n;
  return _q || jsonb_build_object('nights', _nights, 'total', _total, 'average', round(_total / (_q->>'count')::int, 2),
    'uniform', (select count(distinct (n->>'rate')) <= 1 from jsonb_array_elements(_nights) n),
    'seasons', jsonb_build_array(case when _fixed is not null then _c.name || ' rate' else format('%s (-%s%%)', _c.name, _c.discount_pct) end),
    'company_rate', true);
end $$;
grant execute on function public.stay_quote(uuid, date, date, boolean, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Invoices addressed to the company
-- ---------------------------------------------------------------------
alter table public.invoices add column if not exists bill_to jsonb;

create or replace function public.issue_invoice(_reservation_id uuid)
returns public.invoices
language plpgsql security definer set search_path = public as $$
declare
  _r reservations;
  _h hotels;
  _g guests;
  _c companies;
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

  select * into _h from hotels where id = _r.hotel_id for update;
  _num := _h.next_invoice_number;
  update hotels set next_invoice_number = _num + 1 where id = _h.id;

  select * into _g from guests where id = _r.guest_id;
  select * into _c from companies where id = _r.company_id;
  select room_number into _room from rooms where id = _r.room_id;
  select id into _old from invoices where reservation_id = _r.id and superseded_at is null;
  if _old is not null then
    update invoices set superseded_at = now() where id = _old;
  end if;

  insert into invoices (hotel_id, reservation_id, number, issued_by, hotel, guest, stay, lines,
                        net_total, vat_total, levy_total, total, bill_to)
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
         coalesce(sum(c.net_amount), 0), coalesce(sum(c.vat_amount), 0), coalesce(sum(c.levy_amount), 0), coalesce(sum(c.amount), 0),
         case when _c.id is not null and _r.bill_to <> 'guest' then
           jsonb_build_object('company', _c.name, 'kra_pin', _c.kra_pin, 'address', _c.address, 'email', _c.email, 'phone', _c.phone,
                              'order_ref', _r.company_ref, 'terms_days', _c.terms_days,
                              'scope', case _r.bill_to when 'company_room' then 'room' else 'all' end) end
  from folio_charges c
  where c.reservation_id = _r.id and c.voided_at is null
  returning * into _inv;

  if _old is not null then
    update invoices set superseded_by = _inv.id where id = _old;
  end if;

  perform log_activity(_r.hotel_id, 'invoice', format('Invoice %s issued (%s %s)', _inv.number, _h.currency, to_char(_inv.total, 'FM999,999,990')), _r.id);
  return _inv;
end $$;

-- ---------------------------------------------------------------------
-- Check-out moves the company's share before checking the balance
-- ---------------------------------------------------------------------
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
  _share numeric;
  _co text;
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

  if _r.check_out > greatest(_today, _r.check_in + 1) then
    update reservations set check_out = greatest(_today, _r.check_in + 1) where id = _r.id;
    select * into _r from reservations where id = _r.id;
  end if;

  -- Company-billed stays: the company's share goes to its account.
  _share := company_share(_r.id);
  if _share > 0.009 then
    perform company_transfer_internal(_r.id, _r.company_id, _share, has_hotel_role(_r.hotel_id, array['owner','manager']::hotel_role[]));
    select name into _co from companies where id = _r.company_id;
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
    format('%s checked out of room %s%s%s', _g, _num,
           case when _co is not null then format(' (%s %s billed to %s)', _cur, to_char(_share, 'FM999,999,990'), _co) else '' end,
           case when _bal > 0.009 then format(' with %s %s owing', _cur, to_char(_bal, 'FM999,999,990')) else '' end), _r.id);
  perform set_config('hotel_easy.rpc', 'off', true);

  if exists (select 1 from folio_charges where reservation_id = _r.id and voided_at is null) then
    perform issue_invoice(_r.id);
  end if;
  return _r;
end $$;
