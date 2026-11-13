-- =====================================================================
-- HotelEasy: seasonal rates
--  * seasons (date range + which weekdays) set a price per room type, or a
--    % change on the normal rate, plus a minimum stay and "no arrivals"
--  * every night of a stay is priced on its own; the stay keeps the
--    nightly prices (reservations.nightly_rates) and room charges use them
--  * the booking page and front desk both quote from the same rules
-- =====================================================================

create table public.rate_seasons (
  id                 uuid primary key default gen_random_uuid(),
  hotel_id           uuid not null references public.hotels(id) on delete cascade,
  name               text not null check (length(trim(name)) between 1 and 60),
  starts_on          date not null,
  ends_on            date not null,               -- last night included
  weekdays           int[] not null default '{1,2,3,4,5,6,7}',   -- ISO: 1 = Monday … 7 = Sunday (the night of)
  adjust_pct         numeric(6,2) check (adjust_pct is null or adjust_pct between -90 and 500),
  min_nights         int check (min_nights is null or min_nights between 1 and 30),
  closed_to_arrival  boolean not null default false,
  priority           int not null default 0 check (priority between 0 and 100),
  color              text not null default 'amber' check (color in ('amber','rose','emerald','sky','violet','slate','orange','teal')),
  active             boolean not null default true,
  note               text,
  created_at         timestamptz not null default now(),
  constraint rate_seasons_dates_ck check (ends_on >= starts_on and ends_on - starts_on <= 800),
  constraint rate_seasons_weekdays_ck check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}')
);
create index on public.rate_seasons (hotel_id, starts_on, ends_on);

create table public.rate_season_prices (
  season_id     uuid not null references public.rate_seasons(id) on delete cascade,
  room_type_id  uuid not null references public.room_types(id) on delete cascade,
  hotel_id      uuid not null references public.hotels(id) on delete cascade,
  rate          numeric(12,2) not null check (rate >= 0),
  primary key (season_id, room_type_id)
);

create or replace function public.rate_price_hotel_ck()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select hotel_id from rate_seasons where id = new.season_id) is distinct from new.hotel_id
     or (select hotel_id from room_types where id = new.room_type_id) is distinct from new.hotel_id then
    raise exception 'Season and room type must belong to the same hotel';
  end if;
  return new;
end $$;
create trigger rate_price_hotel_ck before insert or update on public.rate_season_prices for each row execute function public.rate_price_hotel_ck();

alter table public.rate_seasons enable row level security;
alter table public.rate_season_prices enable row level security;
revoke all on public.rate_seasons, public.rate_season_prices from anon;
create policy rs_sel on public.rate_seasons for select to authenticated using (public.is_hotel_member(hotel_id));
create policy rs_all on public.rate_seasons for all to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]));
create policy rsp_sel on public.rate_season_prices for select to authenticated using (public.is_hotel_member(hotel_id));
create policy rsp_all on public.rate_season_prices for all to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]));

-- ---------------------------------------------------------------------
-- Pricing
-- ---------------------------------------------------------------------
-- The season that decides a night: highest priority, then the shortest
-- (most specific) range, then the newest.
create or replace function public.season_for(_hotel_id uuid, _d date)
returns public.rate_seasons language sql stable security definer set search_path = public as $$
  select s.* from rate_seasons s
   where s.hotel_id = _hotel_id and s.active and _d between s.starts_on and s.ends_on
     and extract(isodow from _d)::int = any (s.weekdays)
   order by s.priority desc, (s.ends_on - s.starts_on), s.created_at desc
   limit 1
$$;

create or replace function public.night_rate(_t public.room_types, _d date, _online boolean default false)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare _s rate_seasons; _base numeric; _p numeric;
begin
  _base := case when _online then coalesce(_t.online_rate, _t.base_rate) else _t.base_rate end;
  _s := season_for(_t.hotel_id, _d);
  if _s.id is null then return _base; end if;
  select rate into _p from rate_season_prices where season_id = _s.id and room_type_id = _t.id;
  if _p is not null then return _p; end if;
  if _s.adjust_pct is not null then return round(_base * (1 + _s.adjust_pct / 100.0)); end if;
  return _base;
end $$;

-- A quote for a stay: each night's price and season, the total, and the
-- season rules (minimum stay, no arrivals) that apply.
create or replace function public.stay_quote_internal(_room_type_id uuid, _check_in date, _check_out date, _online boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _t room_types; _nights jsonb := '[]'; _total numeric := 0; _min int := 1; _cta boolean := false; _cta_name text;
  d date; _s rate_seasons; _r numeric; _names text[] := '{}';
begin
  select * into _t from room_types where id = _room_type_id;
  if not found then raise exception 'Room type not found'; end if;
  if _check_out <= _check_in then raise exception 'Choose a check-out date after check-in'; end if;
  if _check_out - _check_in > 400 then raise exception 'Stays are limited to 400 nights'; end if;
  for d in select generate_series(_check_in, _check_out - 1, interval '1 day')::date loop
    _s := season_for(_t.hotel_id, d);
    _r := night_rate(_t, d, _online);
    _total := _total + _r;
    _nights := _nights || jsonb_build_object('date', d, 'rate', _r, 'season', _s.name, 'color', _s.color);
    if _s.id is not null then
      _min := greatest(_min, coalesce(_s.min_nights, 1));
      if not (_s.name = any (_names)) then _names := _names || _s.name; end if;
      if d = _check_in and _s.closed_to_arrival then _cta := true; _cta_name := _s.name; end if;
    end if;
  end loop;
  return jsonb_build_object('nights', _nights, 'count', _check_out - _check_in, 'total', _total,
    'average', round(_total / (_check_out - _check_in), 2), 'min_nights', _min,
    'closed_to_arrival', _cta, 'closed_season', _cta_name, 'seasons', to_jsonb(_names),
    'uniform', (select count(distinct (n->>'rate')) <= 1 from jsonb_array_elements(_nights) n));
end $$;
revoke execute on function public.stay_quote_internal(uuid, date, date, boolean) from public, anon, authenticated;
revoke execute on function public.night_rate(public.room_types, date, boolean) from public, anon, authenticated;
revoke execute on function public.season_for(uuid, date) from public, anon, authenticated;

-- Staff: quote a stay (front desk rate, or the online rate with _online).
create or replace function public.stay_quote(_room_type_id uuid, _check_in date, _check_out date, _online boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_hotel_member((select hotel_id from room_types where id = _room_type_id)) then raise exception 'Room type not found'; end if;
  return stay_quote_internal(_room_type_id, _check_in, _check_out, _online);
end $$;
grant execute on function public.stay_quote(uuid, date, date, boolean) to authenticated;

-- Staff: prices and free rooms per room type per night, for the rate calendar.
create or replace function public.rate_calendar(_hotel_id uuid, _from date, _days int default 31)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_hotel_member(_hotel_id) then raise exception 'Hotel not found'; end if;
  _days := least(greatest(coalesce(_days, 31), 1), 92);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'room_type_id', t.id, 'name', t.name, 'base_rate', t.base_rate, 'online_rate', t.online_rate,
      'rooms', (select count(*) from rooms r where r.room_type_id = t.id),
      'days', (select jsonb_agg(jsonb_build_object(
          'date', d.d, 'rate', night_rate(t, d.d, false), 'online', night_rate(t, d.d, true),
          'season', (season_for(t.hotel_id, d.d)).name, 'color', (season_for(t.hotel_id, d.d)).color,
          'min_nights', (season_for(t.hotel_id, d.d)).min_nights, 'cta', coalesce((season_for(t.hotel_id, d.d)).closed_to_arrival, false),
          'free', (select count(*) from rooms r where r.room_type_id = t.id and r.status <> 'out_of_order')
                - (select count(*) from reservations x where x.room_type_id = t.id and x.status in ('confirmed','checked_in')
                     and d.d >= x.check_in and d.d < x.check_out))
        order by d.d) from (select generate_series(_from, _from + _days - 1, interval '1 day')::date d) d)
    ) order by t.base_rate, t.name), '[]'::jsonb)
    from room_types t where t.hotel_id = _hotel_id);
end $$;
grant execute on function public.rate_calendar(uuid, date, int) to authenticated;

-- ---------------------------------------------------------------------
-- Stays keep their nightly prices
-- ---------------------------------------------------------------------
alter table public.reservations add column if not exists nightly_rates jsonb
  check (nightly_rates is null or jsonb_typeof(nightly_rates) = 'object');
alter table public.reservations alter column total_amount drop expression;

create or replace function public.night_price(_r public.reservations, _d date)
returns numeric language sql immutable as $$
  select coalesce((_r.nightly_rates ->> _d::text)::numeric, _r.rate_per_night)
$$;

create or replace function public.reservations_total()
returns trigger language plpgsql as $$
begin
  -- Typing a new single rate replaces the nightly prices.
  if tg_op = 'UPDATE' and new.rate_per_night is distinct from old.rate_per_night
     and new.nightly_rates is not distinct from old.nightly_rates then
    new.nightly_rates := null;
  end if;
  if new.nightly_rates = '{}'::jsonb then new.nightly_rates := null; end if;
  new.total_amount := (select coalesce(sum(public.night_price(new, d::date)), 0)
                         from generate_series(new.check_in, new.check_out - 1, interval '1 day') d);
  return new;
end $$;
create trigger reservations_total before insert or update on public.reservations
  for each row execute function public.reservations_total();
-- (dropping the expression keeps the stored totals, so existing stays are unchanged)

-- Room charges use each night's price.
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

  update folio_charges
     set voided_at = now(), voided_by = auth.uid(), void_reason = 'Stay dates changed'
   where reservation_id = _r.id and kind = 'room' and voided_at is null
     and (stay_date < _r.check_in or stay_date >= _r.check_out);

  update folio_charges
     set unit_price = night_price(_r, stay_date)
   where reservation_id = _r.id and kind = 'room' and voided_at is null
     and unit_price <> night_price(_r, stay_date);

  for d in select generate_series(_r.check_in, _r.check_out - 1, interval '1 day')::date loop
    if not exists (
      select 1 from folio_charges
      where reservation_id = _r.id and kind = 'room' and stay_date = d
        and (voided_at is null or void_reason is distinct from 'Stay dates changed')
    ) then
      insert into folio_charges (hotel_id, reservation_id, kind, description, stay_date, quantity, unit_price)
      values (_r.hotel_id, _r.id, 'room',
              format('Room %s – night of %s', coalesce(_num, '?'), to_char(d, 'Dy DD Mon YYYY')),
              d, 1, night_price(_r, d));
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
    or old.nightly_rates is distinct from new.nightly_rates
    or old.room_id is distinct from new.room_id) then
    perform sync_room_charges(new.id);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Booking page: quotes and restrictions from seasons
-- ---------------------------------------------------------------------
create or replace function public.public_availability(_slug text, _check_in date, _check_out date, _guests int default 1)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _s booking_settings; _h hotels; _n int; _out jsonb := '[]'; _t room_types; _q jsonb; _why text;
begin
  select * into _s from booking_settings where slug = lower(trim(_slug)) and enabled;
  if not found then raise exception 'This booking page is not available'; end if;
  perform public_check_dates(_s, _check_in, _check_out);
  select * into _h from hotels where id = _s.hotel_id;
  _n := _check_out - _check_in;
  for _t in select t.* from room_types t
             where t.hotel_id = _h.id and t.online_bookable and exists (select 1 from rooms r where r.room_type_id = t.id) loop
    _q := stay_quote_internal(_t.id, _check_in, _check_out, true);
    _why := case
      when (_q->>'closed_to_arrival')::boolean then format('No arrivals on this date (%s)', _q->>'closed_season')
      when (_q->>'min_nights')::int > _n then format('Minimum stay %s nights for these dates', _q->>'min_nights') end;
    _out := _out || jsonb_build_object(
      'room_type_id', _t.id, 'name', _t.name,
      'available', case when _why is null then least(room_type_free(_t.id, _check_in, _check_out), 5) else 0 end,
      'fits', _t.max_occupancy >= greatest(coalesce(_guests, 1), 1),
      'nights', _n, 'rate', (_q->>'average')::numeric, 'total', (_q->>'total')::numeric,
      'uniform', (_q->>'uniform')::boolean, 'seasons', _q->'seasons', 'restriction', _why);
  end loop;
  return (select coalesce(jsonb_agg(x order by (x->>'total')::numeric), '[]'::jsonb) from jsonb_array_elements(_out) x);
end $$;

create or replace function public.public_book(
  _slug text, _room_type_id uuid, _check_in date, _check_out date, _adults int, _children int,
  _first_name text, _last_name text, _email text, _phone text, _nationality text default null,
  _requests text default null, _website text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  _s booking_settings; _h hotels; _t room_types; _g uuid; _r reservations; _email_n text; _phone_n text; _q jsonb; _nightly jsonb;
begin
  if coalesce(trim(_website), '') <> '' then raise exception 'Booking could not be completed'; end if;
  select * into _s from booking_settings where slug = lower(trim(_slug)) and enabled;
  if not found then raise exception 'This booking page is not available'; end if;
  select * into _h from hotels where id = _s.hotel_id;
  perform public_check_dates(_s, _check_in, _check_out);

  _email_n := lower(trim(coalesce(_email, '')));
  _phone_n := regexp_replace(coalesce(_phone, ''), '[^0-9+]', '', 'g');
  if length(trim(coalesce(_first_name, ''))) < 1 or length(trim(coalesce(_last_name, ''))) < 1 then raise exception 'Enter your first and last name'; end if;
  if length(_first_name) > 80 or length(_last_name) > 80 or length(coalesce(_requests, '')) > 1000 or length(coalesce(_nationality, '')) > 60 then
    raise exception 'Some details are too long';
  end if;
  if _email_n !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(_email_n) > 200 then raise exception 'Enter a valid email address'; end if;
  if length(regexp_replace(_phone_n, '[^0-9]', '', 'g')) not between 9 and 15 then raise exception 'Enter a valid phone number'; end if;
  if coalesce(_adults, 0) < 1 or coalesce(_children, 0) < 0 or _adults > 20 or _children > 20 then raise exception 'Check the number of guests'; end if;

  if (select count(*) from reservations x join guests g on g.id = x.guest_id
       where x.hotel_id = _h.id and x.source = 'website' and x.created_at > now() - interval '1 day'
         and (lower(g.email) = _email_n or g.phone = _phone_n)) >= 3 then
    raise exception 'You have made several bookings today. Please contact the hotel to book more rooms.';
  end if;
  if (select count(*) from reservations where hotel_id = _h.id and source = 'website' and created_by is null
        and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Online booking is busy; please try again in a few minutes or contact the hotel';
  end if;

  select * into _t from room_types where id = _room_type_id and hotel_id = _h.id and online_bookable for update;
  if not found then raise exception 'That room type is not available online'; end if;
  if _t.max_occupancy < _adults + _children then raise exception '% sleeps up to % guests', _t.name, _t.max_occupancy; end if;
  _q := stay_quote_internal(_t.id, _check_in, _check_out, true);
  if (_q->>'closed_to_arrival')::boolean then raise exception 'Sorry, there are no arrivals on % (%). Please choose another date.', to_char(_check_in, 'DD Mon'), _q->>'closed_season'; end if;
  if (_q->>'min_nights')::int > _check_out - _check_in then raise exception 'The minimum stay for these dates is % nights', _q->>'min_nights'; end if;
  if room_type_free(_t.id, _check_in, _check_out) < 1 then raise exception 'Sorry, % is no longer available for those dates', _t.name; end if;
  select jsonb_object_agg(n->>'date', (n->>'rate')::numeric) into _nightly from jsonb_array_elements(_q->'nights') n;

  insert into guests (hotel_id, first_name, last_name, email, phone, nationality, notes)
  values (_h.id, initcap(trim(_first_name)), initcap(trim(_last_name)), _email_n, _phone_n, nullif(trim(_nationality), ''), 'Booked online')
  returning id into _g;

  perform set_config('hotel_easy.rpc', 'on', true);
  insert into reservations (hotel_id, guest_id, room_type_id, check_in, check_out, adults, children, status, source, rate_per_night, nightly_rates, special_requests)
  values (_h.id, _g, _t.id, _check_in, _check_out, _adults, coalesce(_children, 0), 'confirmed', 'website', (_q->>'average')::numeric,
          case when (_q->>'uniform')::boolean then null else _nightly end, nullif(trim(_requests), ''))
  returning * into _r;
  perform set_config('hotel_easy.rpc', '', true);
  perform log_activity(_h.id, 'online', format('Online booking %s: %s %s, %s, %s → %s', _r.code, initcap(trim(_first_name)), initcap(trim(_last_name)),
          _t.name, to_char(_check_in, 'DD Mon'), to_char(_check_out, 'DD Mon')), _r.id);

  return jsonb_build_object('code', _r.code, 'room_type', _t.name, 'check_in', _r.check_in, 'check_out', _r.check_out,
    'nights', _r.nights, 'rate', _r.rate_per_night, 'total', _r.total_amount, 'currency', _h.currency,
    'guest', initcap(trim(_first_name)) || ' ' || initcap(trim(_last_name)), 'email', _email_n);
end $$;
