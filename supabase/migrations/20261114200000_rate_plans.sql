-- =====================================================================
-- HotelEasy: rate plans & packages
--  * plans such as bed & breakfast, half board, full board or a safari
--    package: meals included, a price per adult and per child per night,
--    and an optional price per person per stay (transfers, game drives…)
--  * a stay on a plan gets its meal lines on the bill night by night
--    (kind "food"), so food revenue is reported as food
--  * the booking page offers the plans; the kitchen sees meal counts
-- =====================================================================

create table public.rate_plans (
  id               uuid primary key default gen_random_uuid(),
  hotel_id         uuid not null references public.hotels(id) on delete cascade,
  name             text not null check (length(trim(name)) between 1 and 60),
  code             text not null check (code ~ '^[A-Z0-9]{1,6}$'),
  description      text check (description is null or length(description) <= 600),
  breakfast        boolean not null default false,
  lunch            boolean not null default false,
  dinner           boolean not null default false,
  adult_night      numeric(12,2) not null default 0 check (adult_night >= 0),
  child_night      numeric(12,2) not null default 0 check (child_night >= 0),
  adult_stay       numeric(12,2) not null default 0 check (adult_stay >= 0),
  child_stay       numeric(12,2) not null default 0 check (child_stay >= 0),
  stay_label       text check (stay_label is null or length(stay_label) <= 80),
  room_type_ids    uuid[],
  online           boolean not null default true,
  min_nights       int check (min_nights is null or min_nights between 1 and 30),
  active           boolean not null default true,
  sort             int not null default 0,
  created_at       timestamptz not null default now(),
  unique (hotel_id, code)
);
alter table public.rate_plans enable row level security;
revoke all on public.rate_plans from anon;
create policy rp_sel on public.rate_plans for select to authenticated using (public.is_hotel_member(hotel_id));
create policy rp_all on public.rate_plans for all to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]));
create or replace function public.rate_plans_code_upper()
returns trigger language plpgsql as $$ begin new.code := upper(trim(new.code)); if new.room_type_ids = '{}' then new.room_type_ids := null; end if; return new; end $$;
create trigger rate_plans_code_upper before insert or update on public.rate_plans for each row execute function public.rate_plans_code_upper();

alter table public.reservations add column if not exists rate_plan_id uuid references public.rate_plans(id) on delete restrict;
alter table public.reservations add column if not exists plan_night numeric(12,2) not null default 0 check (plan_night >= 0);
alter table public.reservations add column if not exists plan_stay numeric(12,2) not null default 0 check (plan_stay >= 0);
alter table public.folio_charges add column if not exists rate_plan_id uuid references public.rate_plans(id) on delete set null;
create unique index folio_charges_one_plan_line on public.folio_charges (reservation_id, stay_date, kind)
  where rate_plan_id is not null and voided_at is null;

-- Plan prices are worked out when the plan or the number of guests changes, then kept.
create or replace function public.reservations_plan()
returns trigger language plpgsql security definer set search_path = public as $$
declare _p rate_plans;
begin
  if new.rate_plan_id is null then new.plan_night := 0; new.plan_stay := 0; return new; end if;
  if tg_op = 'UPDATE' and new.rate_plan_id is not distinct from old.rate_plan_id and new.adults = old.adults and new.children = old.children
     and new.room_type_id = old.room_type_id then
    return new;
  end if;
  select * into _p from rate_plans where id = new.rate_plan_id;
  if not found or _p.hotel_id <> new.hotel_id then raise exception 'Rate plan not found'; end if;
  if (tg_op = 'INSERT' or new.rate_plan_id is distinct from old.rate_plan_id) and not _p.active then raise exception '% is no longer offered', _p.name; end if;
  if _p.room_type_ids is not null and not (new.room_type_id = any (_p.room_type_ids)) then
    raise exception '% is not available for %', _p.name, (select name from room_types where id = new.room_type_id);
  end if;
  new.plan_night := _p.adult_night * new.adults + _p.child_night * new.children;
  new.plan_stay := _p.adult_stay * new.adults + _p.child_stay * new.children;
  return new;
end $$;
create trigger reservations_plan before insert or update on public.reservations for each row execute function public.reservations_plan();

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
                         from generate_series(new.check_in, new.check_out - 1, interval '1 day') d)
                      + coalesce(new.plan_night, 0) * (new.check_out - new.check_in) + coalesce(new.plan_stay, 0);
  return new;
end $$;

create or replace function public.sync_room_charges(_reservation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _r reservations;
  _num text;
  d date;
  _p rate_plans;
  _pax text;
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

  -- Meal plan lines: one per night, plus the per-stay package line on the first night.
  select * into _p from rate_plans where id = _r.rate_plan_id;
  update folio_charges
     set voided_at = now(), voided_by = auth.uid(),
         void_reason = case when rate_plan_id is distinct from _r.rate_plan_id then 'Meal plan changed' else 'Stay dates changed' end
   where reservation_id = _r.id and rate_plan_id is not null and voided_at is null
     and (rate_plan_id is distinct from _r.rate_plan_id
          or (kind = 'food' and (stay_date < _r.check_in or stay_date >= _r.check_out or _r.plan_night <= 0))
          or (kind = 'other' and (stay_date <> _r.check_in or _r.plan_stay <= 0)));
  if _p.id is null then return; end if;
  _pax := concat_ws(', ', _r.adults || ' adult' || case when _r.adults = 1 then '' else 's' end,
                    case when _r.children > 0 then _r.children || ' child' || case when _r.children = 1 then '' else 'ren' end end);
  update folio_charges set unit_price = _r.plan_night
   where reservation_id = _r.id and rate_plan_id = _p.id and kind = 'food' and voided_at is null and unit_price <> _r.plan_night;
  update folio_charges set unit_price = _r.plan_stay
   where reservation_id = _r.id and rate_plan_id = _p.id and kind = 'other' and voided_at is null and unit_price <> _r.plan_stay;
  if _r.plan_night > 0 then
    for d in select generate_series(_r.check_in, _r.check_out - 1, interval '1 day')::date loop
      if not exists (select 1 from folio_charges where reservation_id = _r.id and rate_plan_id = _p.id and kind = 'food' and stay_date = d
                       and (voided_at is null or void_reason not in ('Stay dates changed', 'Meal plan changed'))) then
        insert into folio_charges (hotel_id, reservation_id, kind, description, stay_date, quantity, unit_price, rate_plan_id)
        values (_r.hotel_id, _r.id, 'food',
                format('%s (%s) – night of %s, %s', _p.name,
                       concat_ws(' & ', case when _p.dinner then 'dinner' end, case when _p.breakfast then 'breakfast' end, case when _p.lunch then 'lunch' end),
                       to_char(d, 'Dy DD Mon'), _pax),
                d, 1, _r.plan_night, _p.id);
      end if;
    end loop;
  end if;
  if _r.plan_stay > 0 and not exists (select 1 from folio_charges where reservation_id = _r.id and rate_plan_id = _p.id and kind = 'other'
                                        and (voided_at is null or void_reason not in ('Stay dates changed', 'Meal plan changed'))) then
    insert into folio_charges (hotel_id, reservation_id, kind, description, stay_date, quantity, unit_price, rate_plan_id)
    values (_r.hotel_id, _r.id, 'other', format('%s: %s (%s)', _p.name, coalesce(_p.stay_label, 'package'), _pax), _r.check_in, 1, _r.plan_stay, _p.id);
  end if;
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
    or old.rate_plan_id is distinct from new.rate_plan_id or old.plan_night <> new.plan_night or old.plan_stay <> new.plan_stay
    or old.room_id is distinct from new.room_id) then
    perform sync_room_charges(new.id);
  end if;
  return new;
end $$;

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
      'uniform', (_q->>'uniform')::boolean, 'seasons', _q->'seasons', 'restriction', _why,
      'plans', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'code', p.code, 'description', p.description,
                   'breakfast', p.breakfast, 'lunch', p.lunch, 'dinner', p.dinner, 'adult_night', p.adult_night, 'child_night', p.child_night,
                   'adult_stay', p.adult_stay, 'child_stay', p.child_stay, 'stay_label', p.stay_label, 'min_nights', p.min_nights,
                   'too_short', coalesce(p.min_nights, 1) > _n) order by p.sort, p.adult_night, p.name), '[]'::jsonb)
                from rate_plans p where p.hotel_id = _h.id and p.active and p.online and (p.room_type_ids is null or _t.id = any (p.room_type_ids))));
  end loop;
  return (select coalesce(jsonb_agg(x order by (x->>'total')::numeric), '[]'::jsonb) from jsonb_array_elements(_out) x);
end $$;

drop function if exists public.public_book(text, uuid, date, date, int, int, text, text, text, text, text, text, text);
create or replace function public.public_book(
  _slug text, _room_type_id uuid, _check_in date, _check_out date, _adults int, _children int,
  _first_name text, _last_name text, _email text, _phone text, _nationality text default null,
  _requests text default null, _website text default null, _rate_plan_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  _s booking_settings; _h hotels; _t room_types; _g uuid; _p rate_plans; _r reservations; _email_n text; _phone_n text; _q jsonb; _nightly jsonb;
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
  if _rate_plan_id is not null then
    select * into _p from rate_plans where id = _rate_plan_id and hotel_id = _h.id and active and online;
    if not found then raise exception 'That rate plan is not available online'; end if;
    if _p.room_type_ids is not null and not (_t.id = any (_p.room_type_ids)) then raise exception '% is not available for %', _p.name, _t.name; end if;
    if coalesce(_p.min_nights, 1) > _check_out - _check_in then raise exception '% needs at least % nights', _p.name, _p.min_nights; end if;
  end if;
  select jsonb_object_agg(n->>'date', (n->>'rate')::numeric) into _nightly from jsonb_array_elements(_q->'nights') n;

  insert into guests (hotel_id, first_name, last_name, email, phone, nationality, notes)
  values (_h.id, initcap(trim(_first_name)), initcap(trim(_last_name)), _email_n, _phone_n, nullif(trim(_nationality), ''), 'Booked online')
  returning id into _g;

  perform set_config('hotel_easy.rpc', 'on', true);
  insert into reservations (hotel_id, guest_id, room_type_id, check_in, check_out, adults, children, status, source, rate_per_night, nightly_rates, special_requests, rate_plan_id)
  values (_h.id, _g, _t.id, _check_in, _check_out, _adults, coalesce(_children, 0), 'confirmed', 'website', (_q->>'average')::numeric,
          case when (_q->>'uniform')::boolean then null else _nightly end, nullif(trim(_requests), ''), _p.id)
  returning * into _r;
  perform set_config('hotel_easy.rpc', '', true);
  perform log_activity(_h.id, 'online', format('Online booking %s: %s %s, %s, %s → %s', _r.code, initcap(trim(_first_name)), initcap(trim(_last_name)),
          _t.name, to_char(_check_in, 'DD Mon'), to_char(_check_out, 'DD Mon')), _r.id);

  return jsonb_build_object('code', _r.code, 'room_type', _t.name, 'check_in', _r.check_in, 'check_out', _r.check_out,
    'nights', _r.nights, 'rate', _r.rate_per_night, 'total', _r.total_amount, 'currency', _h.currency, 'plan', _p.name,
    'guest', initcap(trim(_first_name)) || ' ' || initcap(trim(_last_name)), 'email', _email_n);
end $$;
revoke execute on function public.public_book(text, uuid, date, date, int, int, text, text, text, text, text, text, text, uuid) from public;
grant execute on function public.public_book(text, uuid, date, date, int, int, text, text, text, text, text, text, text, uuid) to anon, authenticated;

create or replace function public.email_compose(_hotel_id uuid, _reservation_id uuid, _kind text, _test_to text default null, _preview boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  _o record; _s email_settings; _h hotels; _r reservations; _g guests; _t room_types; _b booking_settings;
  _subject text; _title text; _body text; _url text; _btn text; _text text; _to text; _p prechecks; _f guest_feedback;
  _money text; _stay text;
begin
  select _hotel_id as hotel_id, _reservation_id as reservation_id, _kind as kind, _test_to as to_email into _o;
  select * into _s from email_settings where hotel_id = _o.hotel_id;
  select * into _h from hotels where id = _o.hotel_id;
  select * into _b from booking_settings where hotel_id = _o.hotel_id;

  if _o.kind = 'test' then
    _to := _o.to_email;
    _subject := format('Test email from %s', _h.name);
    _title := 'Emails are working';
    _body := '<p>This is a test from HotelEasy. Guests will receive booking emails from <b>' || html_esc(coalesce(_s.from_name, _h.name)) || '</b>'
          || coalesce(', and replies go to <b>' || html_esc(coalesce(_s.reply_to, _h.email)) || '</b>', '') || '.</p>';
    _text := 'This is a test email from HotelEasy.';
  else
    select * into _r from reservations where id = _o.reservation_id;
    if not found then return jsonb_build_object('skip', 'booking deleted'); end if;
    select * into _g from guests where id = _r.guest_id;
    select * into _t from room_types where id = _r.room_type_id;
    _to := lower(trim(_g.email));
    if _to is null or _to !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('skip', 'guest has no email address'); end if;
    if not _s.enabled and not _preview then return jsonb_build_object('skip', 'emails are switched off'); end if;
    if not _preview and ((_o.kind = 'confirmation' and not _s.send_confirmation) or (_o.kind = 'prearrival' and not _s.send_prearrival)
       or (_o.kind = 'thankyou' and not _s.send_thankyou) or (_o.kind = 'cancellation' and not _s.send_cancellation)) then
      return jsonb_build_object('skip', 'this email is switched off');
    end if;
    _money := _h.currency || ' ' || to_char(_r.total_amount, 'FM999,999,999,990.00');
    _stay := to_char(_r.check_in, 'Dy DD Mon YYYY') || ' → ' || to_char(_r.check_out, 'Dy DD Mon YYYY');
    select * into _p from prechecks where reservation_id = _r.id;

    if _o.kind = 'confirmation' then
      if not _preview and (_r.status <> 'confirmed') then return jsonb_build_object('skip', 'booking is no longer confirmed'); end if;
      _subject := format('Booking confirmed: %s, %s', _h.name, to_char(_r.check_in, 'DD Mon YYYY'));
      _title := format('Thank you, %s. Your booking is confirmed.', _g.first_name);
      _body := '<table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse">'
        || email_row('Booking code', _r.code) || email_row('Stay', _stay)
        || email_row('Nights', _r.nights::text) || email_row('Room', _t.name)
        || coalesce(email_row('Board', (select name || coalesce(' – ' || nullif(concat_ws(', ', case when breakfast then 'breakfast' end, case when lunch then 'lunch' end, case when dinner then 'dinner' end), ''), '') from rate_plans where id = _r.rate_plan_id)), '')
        || email_row('Guests', (_r.adults + _r.children)::text) || email_row('Total', _money)
        || email_row('Check-in', 'from ' || to_char(_h.checkin_time, 'HH24:MI')) || email_row('Check-out', 'by ' || to_char(_h.checkout_time, 'HH24:MI'))
        || '</table>'
        || coalesce('<h3 style="font-size:16px;margin:20px 0 6px">Payment</h3><p style="font-size:14px;line-height:21px">' || html_esc(nullif(_b.payment_instructions, '')) || '</p>', '')
        || case when _b.free_cancel_days is not null then '<p style="font-size:14px;line-height:21px">Free cancellation until '
             || to_char(_r.check_in - _b.free_cancel_days, 'DD Mon YYYY') || '.</p>' else '' end
        || coalesce('<p style="font-size:14px;line-height:21px">' || html_esc(nullif(_s.confirmation_note, '')) || '</p>', '')
        || case when _p.id is not null then '<p style="font-size:14px;line-height:21px">Save time on arrival: check in online before you come.</p>' else '' end;
      if _p.id is not null then _url := rtrim(_s.app_url, '/') || '/checkin/' || _p.token; _btn := 'Check in online'; end if;
      _text := format(E'Your booking at %s is confirmed.\nCode: %s\nStay: %s\nRoom: %s\nTotal: %s', _h.name, _r.code, _stay, _t.name, _money)
        || coalesce(E'\nCheck in online: ' || _url, '');

    elsif _o.kind = 'prearrival' then
      if not _preview and (_r.status <> 'confirmed') then return jsonb_build_object('skip', 'booking is no longer confirmed'); end if;
      _subject := format('See you on %s at %s', trim(to_char(_r.check_in, 'Day')), _h.name);
      _title := format('We look forward to welcoming you, %s', _g.first_name);
      _body := '<p style="font-size:14px;line-height:21px">Your stay starts on <b>' || to_char(_r.check_in, 'FMDay DD Month') || '</b>. Check-in is from <b>'
        || to_char(_h.checkin_time, 'HH24:MI') || '</b>.</p>'
        || '<table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse">'
        || email_row('Booking code', _r.code) || email_row('Room', _t.name) || email_row('Stay', _stay)
        || coalesce(email_row('Address', nullif(concat_ws(', ', _h.address, _h.city), '')), '') || '</table>'
        || coalesce('<p style="font-size:14px;line-height:21px">' || html_esc(nullif(_s.prearrival_note, '')) || '</p>', '')
        || case when _p.id is not null and _p.submitted_at is null then
             '<p style="font-size:14px;line-height:21px">Skip the paperwork at reception: fill in your details and sign the registration card online. It takes about two minutes.</p>'
           when _p.submitted_at is not null then '<p style="font-size:14px;line-height:21px">Thank you for checking in online. Please bring the ID or passport you entered.</p>'
           else '' end;
      if _p.id is not null and _p.submitted_at is null then _url := rtrim(_s.app_url, '/') || '/checkin/' || _p.token; _btn := 'Check in online'; end if;
      _text := format(E'Your stay at %s starts on %s (check-in from %s).\nBooking: %s', _h.name, to_char(_r.check_in, 'FMDay DD Month'), to_char(_h.checkin_time, 'HH24:MI'), _r.code)
        || coalesce(E'\nCheck in online: ' || _url, '');

    elsif _o.kind = 'thankyou' then
      if not _preview and (_r.status <> 'checked_out') then return jsonb_build_object('skip', 'guest has not checked out'); end if;
      select * into _f from guest_feedback where reservation_id = _r.id;
      if not _preview and (_f.submitted_at is not null) then return jsonb_build_object('skip', 'guest already left feedback'); end if;
      _subject := format('Thank you for staying at %s', _h.name);
      _title := format('Thank you for staying with us, %s', _g.first_name);
      _body := '<p style="font-size:14px;line-height:21px">We hope you enjoyed your stay and had a safe journey. '
        || case when _f.id is not null then 'Would you tell us how it went? It takes one minute and helps us improve.' else 'We hope to see you again soon.' end || '</p>';
      if _f.id is not null then _url := rtrim(_s.app_url, '/') || '/feedback/' || _f.token; _btn := 'Rate your stay';
      end if;
      _text := format('Thank you for staying at %s.', _h.name) || coalesce(E'\nTell us how it went: ' || _url, '');

    else -- cancellation
      if not _preview and (_r.status <> 'cancelled') then return jsonb_build_object('skip', 'booking is not cancelled'); end if;
      _subject := format('Booking %s cancelled', _r.code);
      _title := 'Your booking has been cancelled';
      _body := '<table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse">'
        || email_row('Booking code', _r.code) || email_row('Was for', _stay) || email_row('Room', _t.name) || '</table>'
        || '<p style="font-size:14px;line-height:21px">If you did not ask for this, or would like to book again, please contact us'
        || coalesce(' on ' || html_esc(_h.phone), '') || '.</p>';
      _text := format('Your booking %s at %s (%s) has been cancelled.', _r.code, _h.name, _stay);
    end if;
  end if;

  return jsonb_build_object('to', _to, 'subject', _subject, 'html', email_layout(_h, _title, _body, _url, _btn),
    'text', _text || coalesce(E'\n\n' || _h.name || coalesce(', ' || _h.phone, ''), ''),
    'from_name', coalesce(nullif(trim(_s.from_name), ''), _h.name), 'reply_to', coalesce(_s.reply_to, _h.email));
end $$;
revoke execute on function public.email_compose(uuid, uuid, text, text, boolean) from public, anon, authenticated;

-- Meals the kitchen should expect on a day: dinner for the night of that
-- day, breakfast and lunch for guests who slept the night before.
create or replace function public.meal_counts(_hotel_id uuid, _date date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_hotel_member(_hotel_id) then raise exception 'Hotel not found'; end if;
  return (
    with st as (
      select r.id, r.code, r.adults + r.children as pax, r.adults, r.children, p.name plan, p.code pcode, p.breakfast, p.lunch, p.dinner,
             rm.room_number, trim(g.first_name || ' ' || g.last_name) guest, r.status,
             (_date - 1 >= r.check_in and _date - 1 < r.check_out) as slept_before,
             (_date >= r.check_in and _date < r.check_out) as sleeps_tonight
        from reservations r join rate_plans p on p.id = r.rate_plan_id
        join guests g on g.id = r.guest_id left join rooms rm on rm.id = r.room_id
       where r.hotel_id = _hotel_id and r.status in ('confirmed', 'checked_in', 'checked_out')
         and r.check_in <= _date and r.check_out >= _date)
    select jsonb_build_object(
      'date', _date,
      'breakfast', coalesce(sum(pax) filter (where breakfast and slept_before and status <> 'confirmed'), 0),
      'lunch', coalesce(sum(pax) filter (where lunch and slept_before and status <> 'confirmed'), 0),
      'dinner', coalesce(sum(pax) filter (where dinner and sleeps_tonight and status <> 'checked_out'), 0),
      'stays', coalesce(jsonb_agg(jsonb_build_object('code', code, 'guest', guest, 'room', room_number, 'pax', pax, 'adults', adults, 'children', children,
                 'plan', plan, 'plan_code', pcode,
                 'breakfast', breakfast and slept_before and status <> 'confirmed', 'lunch', lunch and slept_before and status <> 'confirmed',
                 'dinner', dinner and sleeps_tonight and status <> 'checked_out') order by room_number nulls last, guest)
               filter (where (breakfast and slept_before and status <> 'confirmed') or (lunch and slept_before and status <> 'confirmed')
                          or (dinner and sleeps_tonight and status <> 'checked_out')), '[]'::jsonb))
    from st);
end $$;
grant execute on function public.meal_counts(uuid, date) to authenticated;
