-- =====================================================================
-- HotelEasy: online pre-check-in
--  * every confirmed reservation gets a private link (prechecks.token)
--  * the guest fills in the guest register details (Hotels and Restaurants
--    Act), ID or passport, arrival time, companions, and signs the
--    registration card on their phone
--  * front desk reviews, copies the details onto the guest record, and
--    checks the guest in as usual
-- =====================================================================

alter table public.hotels add column if not exists house_rules text check (house_rules is null or length(house_rules) <= 4000);

create table public.prechecks (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        uuid not null references public.hotels(id) on delete cascade,
  reservation_id  uuid not null unique references public.reservations(id) on delete cascade,
  token           text not null unique default replace(gen_random_uuid()::text, '-', '') || left(replace(gen_random_uuid()::text, '-', ''), 8),
  created_at      timestamptz not null default now(),
  shared_at       timestamptz,
  submitted_at    timestamptz,
  first_name      text,
  last_name       text,
  email           text,
  phone           text,
  nationality     text,
  residence       text,
  id_type         text check (id_type is null or id_type in ('National ID', 'Passport', 'Alien ID', 'Driving licence', 'Other')),
  id_number       text,
  date_of_birth   date,
  address         text,
  arrival_time    text check (arrival_time is null or arrival_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  purpose         text check (purpose is null or purpose in ('leisure', 'business', 'conference', 'other')),
  coming_from     text,
  going_to        text,
  vehicle_reg     text,
  companions      jsonb not null default '[]' check (jsonb_typeof(companions) = 'array' and jsonb_array_length(companions) <= 12),
  requests        text check (requests is null or length(requests) <= 1000),
  signature       text check (signature is null or (signature like 'data:image/png;base64,%' and length(signature) <= 300000)),
  signed_name     text,
  accepted_at     timestamptz,
  marketing_ok    boolean not null default false,
  reviewed_at     timestamptz,
  reviewed_by     uuid references auth.users(id) on delete set null
);
create index on public.prechecks (hotel_id, submitted_at desc);

-- Staff may only mark a link as shared; everything else goes through the functions below.
create or replace function public.precheck_guard()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('hotel_easy.rpc', true), '') = 'on' then return new; end if;
  if (to_jsonb(new) - 'shared_at') is distinct from (to_jsonb(old) - 'shared_at') then
    raise exception 'Online check-in details can only be changed by the guest';
  end if;
  return new;
end $$;
create trigger precheck_guard before update on public.prechecks for each row execute function public.precheck_guard();

alter table public.prechecks enable row level security;
revoke all on public.prechecks from anon;
create policy pc_sel on public.prechecks for select to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk']::public.hotel_role[]));
create policy pc_upd on public.prechecks for update to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager','front_desk']::public.hotel_role[]));

-- A link for every confirmed reservation, new or existing.
create or replace function public.precheck_on_reservation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed' then
    insert into prechecks (hotel_id, reservation_id) values (new.hotel_id, new.id) on conflict (reservation_id) do nothing;
  end if;
  return new;
end $$;
create trigger precheck_on_reservation after insert on public.reservations for each row execute function public.precheck_on_reservation();

insert into public.prechecks (hotel_id, reservation_id)
select hotel_id, id from public.reservations where status = 'confirmed' and check_out >= current_date
on conflict do nothing;

-- Staff: the link token for a reservation that hasn't arrived yet.
create or replace function public.precheck_link(_reservation_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare _r reservations; _t text;
begin
  select * into _r from reservations where id = _reservation_id;
  if not found or not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[]) then raise exception 'Reservation not found'; end if;
  if _r.status <> 'confirmed' then raise exception 'Online check-in is for confirmed reservations that have not arrived yet'; end if;
  insert into prechecks (hotel_id, reservation_id) values (_r.hotel_id, _r.id) on conflict (reservation_id) do nothing;
  select token into _t from prechecks where reservation_id = _r.id;
  return _t;
end $$;

-- ---------------------------------------------------------------------
-- Public (no sign-in): the guest's side
-- ---------------------------------------------------------------------
create or replace function public.public_precheck(_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _p prechecks; _r reservations; _g guests; _h hotels; _t room_types; _state text; _sub boolean;
begin
  select * into _p from prechecks where token = _token;
  if not found then return null; end if;
  select * into _r from reservations where id = _p.reservation_id;
  select * into _g from guests where id = _r.guest_id;
  select * into _h from hotels where id = _p.hotel_id;
  select * into _t from room_types where id = _r.room_type_id;
  _sub := _p.submitted_at is not null;
  _state := case
    when _r.status = 'checked_in' then 'arrived'
    when _r.status <> 'confirmed' then 'closed'
    when _p.reviewed_at is not null then 'reviewed'
    when _sub then 'submitted'
    else 'open' end;
  return jsonb_build_object(
    'state', _state,
    'hotel', jsonb_build_object('name', _h.name, 'address', _h.address, 'city', _h.city, 'phone', _h.phone, 'email', _h.email,
       'checkin_time', to_char(_h.checkin_time, 'HH24:MI'), 'checkout_time', to_char(_h.checkout_time, 'HH24:MI'),
       'house_rules', _h.house_rules, 'policies', (select policies from booking_settings where hotel_id = _h.id)),
    'code', _r.code, 'check_in', _r.check_in, 'check_out', _r.check_out, 'nights', _r.nights,
    'room_type', _t.name, 'adults', _r.adults, 'children', _r.children,
    'submitted_at', _p.submitted_at,
    -- what the guest typed before, or what the hotel already has (never an ID number or date of birth from past stays)
    'form', jsonb_build_object(
      'first_name', case when _sub then _p.first_name else _g.first_name end,
      'last_name', case when _sub then _p.last_name else _g.last_name end,
      'email', case when _sub then _p.email else _g.email end,
      'phone', case when _sub then _p.phone else _g.phone end,
      'nationality', case when _sub then _p.nationality else _g.nationality end,
      'residence', _p.residence,
      'id_type', case when _sub then _p.id_type else _g.id_type end,
      'id_number', _p.id_number,
      'date_of_birth', _p.date_of_birth,
      'address', case when _sub then _p.address else _g.address end,
      'arrival_time', _p.arrival_time, 'purpose', _p.purpose, 'coming_from', _p.coming_from, 'going_to', _p.going_to,
      'vehicle_reg', _p.vehicle_reg, 'companions', _p.companions, 'requests', _p.requests,
      'signed_name', _p.signed_name, 'marketing_ok', _p.marketing_ok));
end $$;

create or replace function public.public_precheck_submit(_token text, _d jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare _p prechecks; _r reservations; _c jsonb; _email text; _dob date; _comp jsonb := '[]';
  _t text;
begin
  select * into _p from prechecks where token = _token for update;
  if not found then raise exception 'This check-in link is not valid'; end if;
  select * into _r from reservations where id = _p.reservation_id;
  if _r.status = 'checked_in' then raise exception 'You are already checked in. Enjoy your stay!'; end if;
  if _r.status <> 'confirmed' then raise exception 'This booking is no longer active. Please contact the hotel.'; end if;
  if _p.reviewed_at is not null then raise exception 'The hotel has already received your details. Please contact reception to change them.'; end if;

  if coalesce(trim(_d->>'first_name'), '') = '' or coalesce(trim(_d->>'last_name'), '') = '' then raise exception 'Enter your first and last name'; end if;
  if coalesce(trim(_d->>'nationality'), '') = '' then raise exception 'Enter your nationality'; end if;
  if coalesce(_d->>'id_type', '') not in ('National ID', 'Passport', 'Alien ID', 'Driving licence', 'Other') then raise exception 'Choose your ID type'; end if;
  if coalesce(trim(_d->>'id_number'), '') = '' then raise exception 'Enter your ID or passport number'; end if;
  _email := nullif(lower(trim(_d->>'email')), '');
  if _email is not null and _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address'; end if;
  if _email is null and coalesce(trim(_d->>'phone'), '') = '' then raise exception 'Enter a phone number or email address'; end if;
  if nullif(_d->>'date_of_birth', '') is not null then
    begin _dob := (_d->>'date_of_birth')::date; exception when others then raise exception 'Enter a valid date of birth'; end;
    if _dob > current_date or _dob < date '1900-01-01' then raise exception 'Enter a valid date of birth'; end if;
  end if;
  if nullif(_d->>'arrival_time', '') is not null and (_d->>'arrival_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Enter the arrival time as HH:MM'; end if;
  if coalesce(_d->>'purpose', '') <> '' and _d->>'purpose' not in ('leisure', 'business', 'conference', 'other') then raise exception 'Choose the purpose of your visit'; end if;
  if length(coalesce(_d->>'requests', '')) > 1000 then raise exception 'Please keep requests under 1000 characters'; end if;
  if coalesce(_d->>'signature', '') not like 'data:image/png;base64,%' or length(_d->>'signature') > 300000 then raise exception 'Please sign in the box'; end if;
  if coalesce(trim(_d->>'signed_name'), '') = '' then raise exception 'Type your full name next to your signature'; end if;
  if coalesce((_d->>'accept')::boolean, false) is not true then raise exception 'Please accept the hotel''s terms to continue'; end if;
  foreach _t in array array['first_name','last_name','nationality','residence','id_number','address','coming_from','going_to','vehicle_reg','signed_name','phone'] loop
    if length(coalesce(_d->>_t, '')) > 200 then raise exception 'One of the answers is too long'; end if;
  end loop;

  if jsonb_typeof(_d->'companions') = 'array' then
    if jsonb_array_length(_d->'companions') > 12 then raise exception 'Up to 12 other guests can be listed'; end if;
    for _c in select * from jsonb_array_elements(_d->'companions') loop
      if coalesce(trim(_c->>'name'), '') <> '' then
        _comp := _comp || jsonb_build_array(jsonb_build_object('name', left(trim(_c->>'name'), 120),
          'id_number', nullif(left(trim(coalesce(_c->>'id_number', '')), 40), ''), 'child', coalesce((_c->>'child')::boolean, false)));
      end if;
    end loop;
  end if;

  perform set_config('hotel_easy.rpc', 'on', true);
  update prechecks set
    first_name = trim(_d->>'first_name'), last_name = trim(_d->>'last_name'), email = _email,
    phone = nullif(trim(_d->>'phone'), ''), nationality = trim(_d->>'nationality'), residence = nullif(trim(_d->>'residence'), ''),
    id_type = _d->>'id_type', id_number = upper(trim(_d->>'id_number')), date_of_birth = _dob,
    address = nullif(trim(_d->>'address'), ''), arrival_time = nullif(_d->>'arrival_time', ''), purpose = nullif(_d->>'purpose', ''),
    coming_from = nullif(trim(_d->>'coming_from'), ''), going_to = nullif(trim(_d->>'going_to'), ''),
    vehicle_reg = nullif(upper(trim(_d->>'vehicle_reg')), ''), companions = _comp, requests = nullif(trim(_d->>'requests'), ''),
    signature = _d->>'signature', signed_name = trim(_d->>'signed_name'), accepted_at = now(),
    marketing_ok = coalesce((_d->>'marketing_ok')::boolean, false),
    submitted_at = now()
  where id = _p.id;
  perform set_config('hotel_easy.rpc', '', true);
  perform log_activity(_p.hotel_id, 'precheck',
    format('%s %s completed online check-in for %s (arriving %s%s)', trim(_d->>'first_name'), trim(_d->>'last_name'), _r.code,
      to_char(_r.check_in, 'DD Mon'), coalesce(' ~' || nullif(_d->>'arrival_time', ''), '')), _r.id);
end $$;

-- From the booking page: find the check-in link with the booking code and email or last name.
create or replace function public.public_precheck_find(_slug text, _code text, _email_or_last_name text)
returns text language plpgsql security definer set search_path = public as $$
declare _hid uuid; _k text; _t text;
begin
  select hotel_id into _hid from booking_settings where slug = lower(trim(_slug)) and enabled;
  if not found then raise exception 'This booking page is not available'; end if;
  _k := lower(trim(coalesce(_email_or_last_name, '')));
  select p.token into _t from reservations r join guests g on g.id = r.guest_id join prechecks p on p.reservation_id = r.id
   where r.hotel_id = _hid and upper(r.code) = upper(trim(_code)) and r.status = 'confirmed'
     and _k <> '' and (lower(g.email) = _k or lower(g.last_name) = _k);
  if _t is null then raise exception 'No upcoming booking matches that code and email or last name'; end if;
  return _t;
end $$;

-- ---------------------------------------------------------------------
-- Front desk: accept the details onto the guest record
-- ---------------------------------------------------------------------
create or replace function public.precheck_accept(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _p prechecks; _r reservations; _note text;
begin
  select * into _p from prechecks where id = _id for update;
  if not found or not has_hotel_role(_p.hotel_id, array['owner','manager','front_desk']::hotel_role[]) then raise exception 'Online check-in not found'; end if;
  if _p.submitted_at is null then raise exception 'The guest has not filled in the online check-in yet'; end if;
  if _p.reviewed_at is not null then raise exception 'These details were already accepted'; end if;
  select * into _r from reservations where id = _p.reservation_id for update;
  if _r.status not in ('confirmed', 'checked_in') then raise exception 'This reservation is closed'; end if;

  update guests set first_name = _p.first_name, last_name = _p.last_name,
    email = coalesce(_p.email, email), phone = coalesce(_p.phone, phone), nationality = _p.nationality,
    id_type = _p.id_type, id_number = _p.id_number, date_of_birth = coalesce(_p.date_of_birth, date_of_birth),
    address = coalesce(_p.address, address)
  where id = _r.guest_id;

  _note := concat_ws(' · ',
    case when _p.arrival_time is not null then 'Arriving about ' || _p.arrival_time end,
    _p.requests);
  perform set_config('hotel_easy.rpc', 'on', true);
  if _note <> '' and position(_note in coalesce(_r.special_requests, '')) = 0 then
    update reservations set special_requests = left(concat_ws(E'\n', nullif(special_requests, ''), _note), 2000) where id = _r.id;
  end if;
  update prechecks set reviewed_at = now(), reviewed_by = auth.uid() where id = _p.id;
  perform set_config('hotel_easy.rpc', '', true);
  perform log_activity(_p.hotel_id, 'precheck', format('Online check-in details accepted for %s', _r.code), _r.id);
end $$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke execute on function public.public_precheck(text) from public;
revoke execute on function public.public_precheck_submit(text, jsonb) from public;
revoke execute on function public.public_precheck_find(text, text, text) from public;
grant execute on function public.public_precheck(text) to anon, authenticated;
grant execute on function public.public_precheck_submit(text, jsonb) to anon, authenticated;
grant execute on function public.public_precheck_find(text, text, text) to anon, authenticated;
revoke execute on function public.precheck_link(uuid) from public, anon;
revoke execute on function public.precheck_accept(uuid) from public, anon;
grant execute on function public.precheck_link(uuid) to authenticated;
grant execute on function public.precheck_accept(uuid) to authenticated;
revoke execute on function public.precheck_on_reservation() from public, anon, authenticated;
