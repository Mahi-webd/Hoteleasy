-- =====================================================================
-- HotelEasy – Online booking page and guest feedback
--
--   * Each hotel can switch on a public booking page at /book/<slug>.
--     Guests see live availability and prices by room type, book one
--     room, get a booking code, and can look it up or cancel it later
--     (within the hotel's free-cancellation window).
--   * Online bookings arrive as confirmed reservations with source
--     'website' and no room yet; front desk assigns a room at check-in.
--   * After check-out each stay gets a private feedback link
--     (/feedback/<token>) staff can share by WhatsApp, SMS or email.
--     Managers reply to reviews and choose which to show on the
--     booking page (only if the guest agreed).
--   * Everything the public sees goes through a few functions; the
--     tables themselves stay closed to anonymous visitors.
--
-- Run AFTER 20261112100000_inventory.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------
create table public.booking_settings (
  hotel_id              uuid primary key references public.hotels(id) on delete cascade,
  enabled               boolean not null default false,
  slug                  text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$'),
  headline              text,
  description           text,
  photo_url             text check (photo_url is null or photo_url ~* '^https://'),
  policies              text,
  payment_instructions  text,
  whatsapp              text,
  free_cancel_days      int check (free_cancel_days is null or free_cancel_days between 0 and 60),
  min_nights            int not null default 1 check (min_nights between 1 and 30),
  max_nights            int not null default 30 check (max_nights between 1 and 90),
  max_advance_days      int not null default 365 check (max_advance_days between 1 and 730),
  same_day_cutoff       time not null default '18:00',
  show_reviews          boolean not null default true,
  updated_at            timestamptz not null default now()
);
create trigger t_booking_settings_upd before update on public.booking_settings for each row execute function public.touch_updated_at();

alter table public.room_types add column if not exists photo_url text check (photo_url is null or photo_url ~* '^https://');
alter table public.room_types add column if not exists online_bookable boolean not null default true;
alter table public.room_types add column if not exists online_rate numeric(12,2) check (online_rate is null or online_rate >= 0);

alter table public.booking_settings enable row level security;
revoke all on public.booking_settings from anon;
create policy bs_sel on public.booking_settings for select to authenticated using (public.is_hotel_member(hotel_id));
create policy bs_w on public.booking_settings for all to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]));

-- Default settings for every hotel, with a slug made from its name.
create or replace function public.booking_slug_for(_name text, _hotel_id uuid)
returns text language plpgsql stable set search_path = public as $$
declare _base text; _s text; _i int := 1;
begin
  _base := trim(both '-' from regexp_replace(lower(coalesce(_name, 'hotel')), '[^a-z0-9]+', '-', 'g'));
  _base := left(coalesce(nullif(_base, ''), 'hotel'), 40);
  if length(_base) < 3 then _base := _base || '-hotel'; end if;
  _base := trim(both '-' from _base);
  _s := _base;
  while exists (select 1 from booking_settings where slug = _s and hotel_id <> _hotel_id) loop
    _i := _i + 1; _s := _base || '-' || _i;
  end loop;
  return _s;
end $$;

insert into public.booking_settings (hotel_id, slug)
select h.id, public.booking_slug_for(h.name, h.id) from public.hotels h
on conflict do nothing;

create or replace function public.hotels_booking_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into booking_settings (hotel_id, slug) values (new.id, booking_slug_for(new.name, new.id)) on conflict do nothing;
  return new;
end $$;
create trigger hotels_booking_defaults after insert on public.hotels for each row execute function public.hotels_booking_defaults();

-- ---------------------------------------------------------------------
-- Availability
-- ---------------------------------------------------------------------
-- Rooms of a type still free on every night of the stay (rooms with
-- or without an assigned room number both count).
create or replace function public.room_type_free(_room_type_id uuid, _check_in date, _check_out date)
returns int language sql stable security definer set search_path = public as $$
  select greatest(0,
    (select count(*) from rooms where room_type_id = _room_type_id and status not in ('maintenance', 'out_of_order'))::int
    - coalesce((
        select max(c) from (
          select (select count(*) from reservations x
                   where x.room_type_id = _room_type_id and x.status in ('confirmed', 'checked_in')
                     and d::date >= x.check_in and d::date < x.check_out) c
            from generate_series(_check_in, _check_out - 1, interval '1 day') d) s), 0)::int);
$$;
revoke execute on function public.room_type_free(uuid, date, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Public functions (anonymous visitors)
-- ---------------------------------------------------------------------
create or replace function public.public_hotel(_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _h hotels; _s booking_settings;
begin
  select s.* into _s from booking_settings s where s.slug = lower(trim(_slug)) and s.enabled;
  if not found then return null; end if;
  select * into _h from hotels where id = _s.hotel_id;
  return jsonb_build_object(
    'name', _h.name, 'city', _h.city, 'address', _h.address, 'country', _h.country, 'phone', _h.phone, 'email', _h.email,
    'currency', _h.currency, 'checkin_time', to_char(_h.checkin_time, 'HH24:MI'), 'checkout_time', to_char(_h.checkout_time, 'HH24:MI'),
    'prices_include_tax', _h.prices_include_vat, 'tax_rate', _h.vat_rate + _h.tourism_levy_rate,
    'today', (now() at time zone _h.timezone)::date,
    'headline', _s.headline, 'description', _s.description, 'photo_url', _s.photo_url, 'policies', _s.policies,
    'payment_instructions', _s.payment_instructions, 'whatsapp', _s.whatsapp, 'free_cancel_days', _s.free_cancel_days,
    'min_nights', _s.min_nights, 'max_nights', _s.max_nights, 'max_advance_days', _s.max_advance_days,
    'room_types', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', t.id, 'name', t.name, 'description', t.description, 'max_occupancy', t.max_occupancy,
               'amenities', t.amenities, 'photo_url', t.photo_url, 'rate', coalesce(t.online_rate, t.base_rate))
             order by coalesce(t.online_rate, t.base_rate), t.name), '[]'::jsonb)
        from room_types t
       where t.hotel_id = _h.id and t.online_bookable
         and exists (select 1 from rooms r where r.room_type_id = t.id)),
    'reviews', case when _s.show_reviews then (
      select jsonb_build_object(
        'count', count(*), 'average', round(avg(f.overall), 1),
        'recent', coalesce((select jsonb_agg(x) from (
            select jsonb_build_object('name', f2.public_name, 'overall', f2.overall, 'comment', f2.comment,
                                      'month', to_char(f2.submitted_at, 'Mon YYYY'), 'response', f2.response) x
              from guest_feedback f2
             where f2.hotel_id = _h.id and f2.published and f2.consent_publish and f2.submitted_at is not null
             order by f2.submitted_at desc limit 6) r), '[]'::jsonb))
        from guest_feedback f where f.hotel_id = _h.id and f.submitted_at is not null) end
  );
end $$;

-- Checks shared by availability and booking.
create or replace function public.public_check_dates(_s booking_settings, _check_in date, _check_out date)
returns void language plpgsql stable security definer set search_path = public as $$
declare _h hotels; _today date; _now time;
begin
  select * into _h from hotels where id = _s.hotel_id;
  _today := (now() at time zone _h.timezone)::date;
  _now := (now() at time zone _h.timezone)::time;
  if _check_in is null or _check_out is null or _check_out <= _check_in then raise exception 'Choose a check-out date after check-in'; end if;
  if _check_in < _today then raise exception 'Check-in cannot be in the past'; end if;
  if _check_in = _today and _now > _s.same_day_cutoff then
    raise exception 'Same-day bookings close at %. Please call or WhatsApp the hotel.', to_char(_s.same_day_cutoff, 'HH24:MI');
  end if;
  if _check_in > _today + _s.max_advance_days then raise exception 'Bookings open up to % days ahead', _s.max_advance_days; end if;
  if _check_out - _check_in < _s.min_nights then raise exception 'The minimum stay is % night(s)', _s.min_nights; end if;
  if _check_out - _check_in > _s.max_nights then raise exception 'The maximum stay online is % nights', _s.max_nights; end if;
end $$;
revoke execute on function public.public_check_dates(booking_settings, date, date) from public, anon, authenticated;

create or replace function public.public_availability(_slug text, _check_in date, _check_out date, _guests int default 1)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _s booking_settings; _h hotels; _n int;
begin
  select * into _s from booking_settings where slug = lower(trim(_slug)) and enabled;
  if not found then raise exception 'This booking page is not available'; end if;
  perform public_check_dates(_s, _check_in, _check_out);
  select * into _h from hotels where id = _s.hotel_id;
  _n := _check_out - _check_in;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'room_type_id', t.id, 'name', t.name,
             'available', least(room_type_free(t.id, _check_in, _check_out), 5),
             'fits', t.max_occupancy >= greatest(coalesce(_guests, 1), 1),
             'nights', _n, 'rate', coalesce(t.online_rate, t.base_rate),
             'total', _n * coalesce(t.online_rate, t.base_rate))
           order by coalesce(t.online_rate, t.base_rate)), '[]'::jsonb)
      from room_types t
     where t.hotel_id = _h.id and t.online_bookable and exists (select 1 from rooms r where r.room_type_id = t.id));
end $$;

create or replace function public.public_book(
  _slug text, _room_type_id uuid, _check_in date, _check_out date, _adults int, _children int,
  _first_name text, _last_name text, _email text, _phone text, _nationality text default null,
  _requests text default null, _website text default null)
-- extensions: the booking-code trigger uses pgcrypto, which Supabase keeps in the extensions schema
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  _s booking_settings; _h hotels; _t room_types; _g uuid; _r reservations; _email_n text; _phone_n text; _rate numeric;
begin
  -- _website is a hidden field people never fill in; bots do.
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

  -- Limits against abuse
  if (select count(*) from reservations x join guests g on g.id = x.guest_id
       where x.hotel_id = _h.id and x.source = 'website' and x.created_at > now() - interval '1 day'
         and (lower(g.email) = _email_n or g.phone = _phone_n)) >= 3 then
    raise exception 'You have made several bookings today. Please contact the hotel to book more rooms.';
  end if;
  if (select count(*) from reservations where hotel_id = _h.id and source = 'website' and created_by is null
        and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Online booking is busy; please try again in a few minutes or contact the hotel';
  end if;

  -- One booking at a time per room type, so two guests can't take the last room.
  select * into _t from room_types where id = _room_type_id and hotel_id = _h.id and online_bookable for update;
  if not found then raise exception 'That room type is not available online'; end if;
  if _t.max_occupancy < _adults + _children then raise exception '% sleeps up to % guests', _t.name, _t.max_occupancy; end if;
  if room_type_free(_t.id, _check_in, _check_out) < 1 then raise exception 'Sorry, % is no longer available for those dates', _t.name; end if;
  _rate := coalesce(_t.online_rate, _t.base_rate);

  insert into guests (hotel_id, first_name, last_name, email, phone, nationality, notes)
  values (_h.id, initcap(trim(_first_name)), initcap(trim(_last_name)), _email_n, _phone_n, nullif(trim(_nationality), ''), 'Booked online')
  returning id into _g;

  perform set_config('hotel_easy.rpc', 'on', true);
  insert into reservations (hotel_id, guest_id, room_type_id, check_in, check_out, adults, children, status, source, rate_per_night, special_requests)
  values (_h.id, _g, _t.id, _check_in, _check_out, _adults, coalesce(_children, 0), 'confirmed', 'website', _rate, nullif(trim(_requests), ''))
  returning * into _r;
  perform set_config('hotel_easy.rpc', '', true);
  perform log_activity(_h.id, 'online', format('Online booking %s: %s %s, %s, %s → %s', _r.code, initcap(trim(_first_name)), initcap(trim(_last_name)),
          _t.name, to_char(_check_in, 'DD Mon'), to_char(_check_out, 'DD Mon')), _r.id);

  return jsonb_build_object('code', _r.code, 'room_type', _t.name, 'check_in', _r.check_in, 'check_out', _r.check_out,
    'nights', _r.nights, 'rate', _r.rate_per_night, 'total', _r.total_amount, 'currency', _h.currency,
    'guest', initcap(trim(_first_name)) || ' ' || initcap(trim(_last_name)), 'email', _email_n);
end $$;

-- Look up (and optionally cancel) a booking with its code and the guest's email or last name.
create or replace function public.public_booking(_slug text, _code text, _email_or_last_name text, _cancel boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _s booking_settings; _h hotels; _r reservations; _g guests; _t room_types; _k text; _today date; _can boolean;
begin
  select * into _s from booking_settings where slug = lower(trim(_slug)) and enabled;
  if not found then raise exception 'This booking page is not available'; end if;
  select * into _h from hotels where id = _s.hotel_id;
  _k := lower(trim(coalesce(_email_or_last_name, '')));
  select r.* into _r from reservations r join guests g on g.id = r.guest_id
   where r.hotel_id = _h.id and upper(r.code) = upper(trim(_code))
     and _k <> '' and (lower(g.email) = _k or lower(g.last_name) = _k)
   for update of r;
  if not found then raise exception 'No booking matches that code and email or last name'; end if;
  select * into _g from guests where id = _r.guest_id;
  select * into _t from room_types where id = _r.room_type_id;
  _today := (now() at time zone _h.timezone)::date;
  _can := _r.status = 'confirmed' and _s.free_cancel_days is not null and _r.check_in - _today >= _s.free_cancel_days;
  if _cancel then
    if not _can then raise exception 'This booking can no longer be cancelled online. Please contact the hotel.'; end if;
    perform set_config('hotel_easy.rpc', 'on', true);
    update reservations set status = 'cancelled', cancelled_at = now() where id = _r.id returning * into _r;
    perform set_config('hotel_easy.rpc', '', true);
    perform log_activity(_h.id, 'cancel', format('Online booking %s cancelled by the guest', _r.code), _r.id);
    _can := false;
  end if;
  return jsonb_build_object('code', _r.code, 'status', _r.status, 'room_type', _t.name, 'check_in', _r.check_in, 'check_out', _r.check_out,
    'nights', _r.nights, 'total', _r.total_amount, 'currency', _h.currency, 'guest', trim(_g.first_name || ' ' || _g.last_name),
    'can_cancel', _can,
    'cancel_by', case when _s.free_cancel_days is not null then _r.check_in - _s.free_cancel_days end);
end $$;

-- ---------------------------------------------------------------------
-- Guest feedback
-- ---------------------------------------------------------------------
create table public.guest_feedback (
  id               uuid primary key default gen_random_uuid(),
  hotel_id         uuid not null references public.hotels(id) on delete cascade,
  reservation_id   uuid not null unique references public.reservations(id) on delete cascade,
  token            text not null unique default replace(gen_random_uuid()::text, '-', '') || left(replace(gen_random_uuid()::text, '-', ''), 8),
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '60 days',
  shared_at        timestamptz,
  submitted_at     timestamptz,
  overall          int check (overall between 1 and 5),
  cleanliness      int check (cleanliness between 1 and 5),
  service          int check (service between 1 and 5),
  comfort          int check (comfort between 1 and 5),
  food             int check (food between 1 and 5),
  value            int check (value between 1 and 5),
  recommend        int check (recommend between 0 and 10),
  comment          text check (length(comment) <= 2000),
  public_name      text,
  consent_publish  boolean not null default false,
  published        boolean not null default false,
  response         text check (length(response) <= 2000),
  responded_by     uuid references auth.users(id) on delete set null,
  responded_at     timestamptz
);
create index on public.guest_feedback (hotel_id, submitted_at desc);

-- Staff can only reply, publish and mark as shared; ratings belong to the guest.
create or replace function public.feedback_guard()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('hotel_easy.rpc', true), '') = 'on' then return new; end if;
  if (new.overall, new.cleanliness, new.service, new.comfort, new.food, new.value, new.recommend, new.comment,
      new.submitted_at, new.token, new.reservation_id, new.hotel_id, new.consent_publish, new.public_name)
     is distinct from
     (old.overall, old.cleanliness, old.service, old.comfort, old.food, old.value, old.recommend, old.comment,
      old.submitted_at, old.token, old.reservation_id, old.hotel_id, old.consent_publish, old.public_name) then
    raise exception 'Guest ratings and comments cannot be changed';
  end if;
  if new.published and not new.consent_publish then raise exception 'The guest did not agree to publish this review'; end if;
  if new.response is distinct from old.response then
    new.responded_by := auth.uid(); new.responded_at := case when new.response is null then null else now() end;
  end if;
  return new;
end $$;
create trigger feedback_guard before update on public.guest_feedback for each row execute function public.feedback_guard();

alter table public.guest_feedback enable row level security;
revoke all on public.guest_feedback from anon;
create policy fb_sel on public.guest_feedback for select to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk','accountant']::public.hotel_role[]));
create policy fb_upd on public.guest_feedback for update to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager','front_desk']::public.hotel_role[]));
-- replying and publishing are for managers; front desk may only mark a link as shared
create or replace function public.feedback_manager_only()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.response, new.published) is distinct from (old.response, old.published)
     and not has_hotel_role(new.hotel_id, array['owner','manager']::hotel_role[]) then
    raise exception 'Only owners and managers can reply to or publish reviews';
  end if;
  return new;
end $$;
create trigger feedback_manager_only before update on public.guest_feedback for each row execute function public.feedback_manager_only();

-- A feedback link for every stay that checks out.
create or replace function public.feedback_on_checkout()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'checked_out' and old.status is distinct from 'checked_out' then
    insert into guest_feedback (hotel_id, reservation_id) values (new.hotel_id, new.id) on conflict (reservation_id) do nothing;
  end if;
  return new;
end $$;
create trigger feedback_on_checkout after update of status on public.reservations for each row execute function public.feedback_on_checkout();

-- Stays that checked out in the last 30 days get links too.
insert into public.guest_feedback (hotel_id, reservation_id)
select hotel_id, id from public.reservations
 where status = 'checked_out' and coalesce(checked_out_at, check_out::timestamptz) > now() - interval '30 days'
on conflict do nothing;

-- Staff: get (or make) the link for a stay that is in house or has left.
create or replace function public.feedback_link(_reservation_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare _r reservations; _t text;
begin
  select * into _r from reservations where id = _reservation_id;
  if not found or not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[]) then raise exception 'Reservation not found'; end if;
  if _r.status not in ('checked_in', 'checked_out') then raise exception 'Feedback links are for guests who have stayed'; end if;
  insert into guest_feedback (hotel_id, reservation_id) values (_r.hotel_id, _r.id) on conflict (reservation_id) do nothing;
  update guest_feedback set expires_at = greatest(expires_at, now() + interval '30 days') where reservation_id = _r.id and submitted_at is null;
  select token into _t from guest_feedback where reservation_id = _r.id;
  return _t;
end $$;

create or replace function public.public_feedback(_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _f guest_feedback; _r reservations; _g guests; _h hotels;
begin
  select * into _f from guest_feedback where token = _token;
  if not found then return null; end if;
  select * into _r from reservations where id = _f.reservation_id;
  select * into _g from guests where id = _r.guest_id;
  select * into _h from hotels where id = _f.hotel_id;
  return jsonb_build_object('hotel', _h.name, 'city', _h.city, 'first_name', _g.first_name,
    'check_in', _r.check_in, 'check_out', _r.check_out, 'submitted', _f.submitted_at is not null,
    'expired', _f.submitted_at is null and _f.expires_at < now(),
    'has_restaurant', exists (select 1 from pos_outlets where hotel_id = _h.id));
end $$;

create or replace function public.public_feedback_submit(_token text, _overall int, _cleanliness int default null, _service int default null,
  _comfort int default null, _food int default null, _value int default null, _recommend int default null,
  _comment text default null, _consent_publish boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare _f guest_feedback; _g guests;
begin
  select * into _f from guest_feedback where token = _token for update;
  if not found then raise exception 'This feedback link is not valid'; end if;
  if _f.submitted_at is not null then raise exception 'Thank you, we already have your feedback'; end if;
  if _f.expires_at < now() then raise exception 'This feedback link has expired'; end if;
  if _overall is null or _overall not between 1 and 5 then raise exception 'Choose an overall rating'; end if;
  if length(coalesce(_comment, '')) > 2000 then raise exception 'Please keep your comment under 2000 characters'; end if;
  select g.* into _g from guests g join reservations r on r.guest_id = g.id where r.id = _f.reservation_id;
  perform set_config('hotel_easy.rpc', 'on', true);
  update guest_feedback set
    overall = _overall, cleanliness = _cleanliness, service = _service, comfort = _comfort, food = _food, value = _value,
    recommend = _recommend, comment = nullif(trim(_comment), ''), consent_publish = coalesce(_consent_publish, false),
    public_name = trim(_g.first_name || ' ' || left(coalesce(_g.last_name, ''), 1) || case when coalesce(_g.last_name, '') <> '' then '.' else '' end),
    submitted_at = now()
  where id = _f.id;
  perform set_config('hotel_easy.rpc', '', true);
  perform log_activity(_f.hotel_id, 'feedback', format('New guest review: %s/5 from %s', _overall, _g.first_name), _f.id);
end $$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['public_hotel(text)', 'public_availability(text, date, date, integer)',
    'public_book(text, uuid, date, date, integer, integer, text, text, text, text, text, text, text)',
    'public_booking(text, text, text, boolean)', 'public_feedback(text)',
    'public_feedback_submit(text, integer, integer, integer, integer, integer, integer, integer, text, boolean)']
  loop
    execute format('revoke execute on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
revoke execute on function public.feedback_link(uuid) from public, anon;
grant execute on function public.feedback_link(uuid) to authenticated;
revoke execute on function public.booking_slug_for(text, uuid) from public, anon;
grant execute on function public.booking_slug_for(text, uuid) to authenticated;
