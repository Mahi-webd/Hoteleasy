-- Booking.com / Airbnb / Expedia calendar sync (iCal), both ways.
-- A "calendar link" ties one of our rooms to one listing on an OTA:
--   export: the OTA reads our feed (functions/v1/ical/<token>.ics) and closes the nights the room isn't free
--   import: we read the OTA's feed every few minutes and turn its bookings into reservations on that room
--           (placeholder guest, price 0: front desk adds the name and price; the OTA collects the money).
-- Booking.com only offers calendar sync to listings with one unit per room type, so it is always one room per link.

insert into public.permission_catalog (key, module, module_label, action, label, sort, default_roles, added_at) values
  ('channels.view', 'channels', 'Booking.com & Airbnb sync', 'view', 'See calendar links and imported bookings', 67, array['owner','manager','front_desk','accountant'], now()),
  ('channels.edit', 'channels', 'Booking.com & Airbnb sync', 'edit', 'Add and change calendar links, sync now', 68, array['owner','manager'], now())
on conflict (key) do nothing;

create table if not exists public.channel_links (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  channel text not null check (channel in ('booking_com', 'airbnb', 'expedia', 'vrbo', 'other')),
  name text,
  room_id uuid not null references public.rooms(id) on delete cascade,
  import_url text check (import_url is null or import_url ~* '^https://'),
  import_blocks boolean not null default false,   -- also import "Not available" blocks (Airbnb echoes our own blocks: off)
  export_token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  enabled boolean not null default true,
  last_sync_at timestamptz,
  last_sync_ok boolean,
  last_sync_message text,
  last_event_count int,
  last_export_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (room_id, channel)
);
create index if not exists channel_links_hotel on public.channel_links (hotel_id);
alter table public.channel_links enable row level security;
drop policy if exists chl_sel on public.channel_links;
create policy chl_sel on public.channel_links for select to authenticated using (
  public.has_hotel_role(hotel_id, array['owner','manager','front_desk','accountant']::hotel_role[], 'channels.view'));
grant select on public.channel_links to authenticated;

create table if not exists public.channel_events (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.channel_links(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  uid text not null,
  check_in date not null,
  check_out date not null,
  summary text,
  status text not null check (status in ('booked', 'skipped', 'conflict', 'cancelled', 'past')),
  reservation_id uuid references public.reservations(id) on delete set null,
  message text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (link_id, uid)
);
alter table public.channel_events enable row level security;
drop policy if exists che_sel on public.channel_events;
create policy che_sel on public.channel_events for select to authenticated using (
  public.has_hotel_role(hotel_id, array['owner','manager','front_desk','accountant']::hotel_role[], 'channels.view'));
grant select on public.channel_events to authenticated;

alter table public.reservations add column if not exists channel_link_id uuid references public.channel_links(id) on delete set null;
alter table public.reservations add column if not exists channel_uid text;
create unique index if not exists reservations_channel_uid on public.reservations (channel_link_id, channel_uid) where channel_link_id is not null;

create or replace function public.channel_label(_c text) returns text language sql immutable as $$
  select case _c when 'booking_com' then 'Booking.com' when 'airbnb' then 'Airbnb' when 'expedia' then 'Expedia' when 'vrbo' then 'Vrbo' else 'Other site' end;
$$;

-- ---------- managing links ----------
create or replace function public.channel_link_save(_hotel_id uuid, _id uuid, _channel text, _name text, _room_id uuid,
  _import_url text, _import_blocks boolean, _enabled boolean)
returns public.channel_links language plpgsql security definer set search_path = public as $$
declare _l channel_links; _url text;
begin
  if not has_hotel_role(_hotel_id, array['owner','manager']::hotel_role[], 'channels.edit') then raise exception 'Only a manager can change calendar links'; end if;
  if not exists (select 1 from rooms where id = _room_id and hotel_id = _hotel_id) then raise exception 'Pick a room'; end if;
  _url := nullif(btrim(coalesce(_import_url, '')), '');
  if _url is not null and _url !~* '^https://[^/\s]+\.[^/\s]+/' then raise exception 'Paste the full calendar link from the site, starting with https://'; end if;
  if _id is null then
    insert into channel_links (hotel_id, channel, name, room_id, import_url, import_blocks, enabled)
    values (_hotel_id, _channel, nullif(btrim(coalesce(_name, '')), ''), _room_id, _url, coalesce(_import_blocks, false), coalesce(_enabled, true))
    returning * into _l;
    perform log_activity(_hotel_id, 'settings', format('%s calendar link added for room %s', channel_label(_channel), (select room_number from rooms where id = _room_id)), _l.id);
  else
    update channel_links set channel = _channel, name = nullif(btrim(coalesce(_name, '')), ''), room_id = _room_id, import_url = _url,
           import_blocks = coalesce(_import_blocks, false), enabled = coalesce(_enabled, true),
           last_sync_at = case when import_url is distinct from _url then null else last_sync_at end
     where id = _id and hotel_id = _hotel_id returning * into _l;
    if not found then raise exception 'Link not found'; end if;
  end if;
  return _l;
exception when unique_violation then
  raise exception 'Room % already has a % link', (select room_number from rooms where id = _room_id), channel_label(_channel);
end $$;

-- Removing a link cancels the upcoming bookings it imported (they would otherwise block the room forever)
create or replace function public.channel_link_delete(_id uuid) returns int language plpgsql security definer set search_path = public as $$
declare _l channel_links; _n int;
begin
  select * into _l from channel_links where id = _id;
  if not found or not has_hotel_role(_l.hotel_id, array['owner','manager']::hotel_role[], 'channels.edit') then raise exception 'Link not found'; end if;
  perform set_config('hotel_easy.rpc', 'on', true);
  with c as (update reservations set status = 'cancelled', cancelled_at = now()
              where channel_link_id = _id and status = 'confirmed' returning 1)
  select count(*) into _n from c;
  delete from channel_links where id = _id;
  perform set_config('hotel_easy.rpc', '', true);
  perform log_activity(_l.hotel_id, 'settings', format('%s calendar link removed%s', channel_label(_l.channel),
    case when _n > 0 then format(' (%s upcoming imported bookings cancelled)', _n) else '' end));
  return _n;
end $$;

create or replace function public.channel_can_sync(_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from channel_links l where l.id = _id
    and has_hotel_role(l.hotel_id, array['owner','manager','front_desk']::hotel_role[], 'channels.edit|reservations.create'));
$$;
create or replace function public.channel_can_view(_hotel_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select is_hotel_member(_hotel_id);
$$;
grant execute on function public.channel_link_save(uuid, uuid, text, text, uuid, text, boolean, boolean), public.channel_link_delete(uuid),
  public.channel_can_sync(uuid), public.channel_can_view(uuid) to authenticated;

-- ---------- export: our calendar for one room, as iCal ----------
create or replace function public.channel_export(_token text) returns text language plpgsql security definer set search_path = public as $$
declare _l channel_links; _h hotels; _rm rooms; _today date; _out text; _ev text := ''; r record; _stamp text;
begin
  select * into _l from channel_links where export_token = _token and enabled;
  if not found then return null; end if;
  select * into _h from hotels where id = _l.hotel_id;
  select * into _rm from rooms where id = _l.room_id;
  _today := (now() at time zone _h.timezone)::date;
  _stamp := to_char(now() at time zone 'UTC', 'YYYYMMDD"T"HH24MISS"Z"');
  -- 1. bookings on this room (not the ones this same link imported: the site already knows those)
  for r in select x.id, x.check_in, x.check_out from reservations x
            where x.room_id = _l.room_id and x.status in ('confirmed', 'checked_in')
              and x.check_out > _today and x.check_in < _today + 730
              and x.channel_link_id is distinct from _l.id
            order by x.check_in loop
    _ev := _ev || format(E'BEGIN:VEVENT\r\nUID:res-%s@hoteleasy\r\nDTSTAMP:%s\r\nDTSTART;VALUE=DATE:%s\r\nDTEND;VALUE=DATE:%s\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\n',
      r.id, _stamp, to_char(greatest(r.check_in, _today), 'YYYYMMDD'), to_char(r.check_out, 'YYYYMMDD'));
  end loop;
  -- 2. nights the room type is full (bookings without a room yet, or the room is out of order), next 365 days
  for r in with nights as (
             select d::date d from generate_series(_today, _today + 364, interval '1 day') d
              where (room_type_free(_rm.room_type_id, d::date, d::date + 1) = 0 or _rm.status in ('maintenance', 'out_of_order') and d::date < _today + 1)
                and not exists (select 1 from reservations x where x.room_id = _l.room_id and x.status in ('confirmed', 'checked_in')
                                  and d::date >= x.check_in and d::date < x.check_out and x.channel_link_id is distinct from _l.id)),
           g as (select d, d - (row_number() over (order by d))::int grp from nights)
           select min(d) s, max(d) + 1 e from g group by grp order by 1 loop
    _ev := _ev || format(E'BEGIN:VEVENT\r\nUID:full-%s-%s@hoteleasy\r\nDTSTAMP:%s\r\nDTSTART;VALUE=DATE:%s\r\nDTEND;VALUE=DATE:%s\r\nSUMMARY:Not available\r\nEND:VEVENT\r\n',
      _rm.id, to_char(r.s, 'YYYYMMDD'), _stamp, to_char(r.s, 'YYYYMMDD'), to_char(r.e, 'YYYYMMDD'));
  end loop;
  update channel_links set last_export_at = now() where id = _l.id;
  _out := format(E'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//HotelEasy//Room calendar//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:%s room %s\r\n',
    regexp_replace(_h.name, '[\r\n,;]', ' ', 'g'), _rm.room_number) || _ev || E'END:VCALENDAR\r\n';
  return _out;
end $$;

-- ---------- import: apply the events read from the site's feed ----------
-- _events: [{uid, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', summary, description}]
create or replace function public.channel_apply(_link_id uuid, _events jsonb, _ok boolean, _message text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _l channel_links; _h hotels; _rm rooms; _today date; _run timestamptz := clock_timestamp(); e jsonb;
  _uid text; _s date; _e date; _sum text; _desc text; _ce channel_events; _r reservations; _g uuid; _rid uuid;
  _added int := 0; _changed int := 0; _cancelled int := 0; _conflicts int := 0; _skipped int := 0; _src booking_source; _msg text; _other text;
begin
  select * into _l from channel_links where id = _link_id for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'link not found'); end if;
  if not _ok then
    update channel_links set last_sync_at = now(), last_sync_ok = false, last_sync_message = left(_message, 300) where id = _l.id;
    return jsonb_build_object('ok', false, 'message', _message);
  end if;
  select * into _h from hotels where id = _l.hotel_id;
  select * into _rm from rooms where id = _l.room_id;
  _today := (now() at time zone _h.timezone)::date;
  _src := case _l.channel when 'booking_com' then 'booking_com' when 'airbnb' then 'airbnb' when 'expedia' then 'expedia' else 'other' end::booking_source;
  perform set_config('hotel_easy.rpc', 'on', true);

  for e in select * from jsonb_array_elements(coalesce(_events, '[]')) loop
    _uid := left(coalesce(e->>'uid', ''), 300);
    _s := (e->>'start')::date; _e := (e->>'end')::date;
    _sum := left(nullif(btrim(coalesce(e->>'summary', '')), ''), 200);
    _desc := left(nullif(btrim(coalesce(e->>'description', '')), ''), 400);
    if _uid = '' or _s is null then continue; end if;
    if _e is null or _e <= _s then _e := _s + 1; end if;

    select * into _ce from channel_events where link_id = _l.id and uid = _uid;
    if not found then
      insert into channel_events (link_id, hotel_id, uid, check_in, check_out, summary, status)
      values (_l.id, _l.hotel_id, _uid, _s, _e, _sum, 'skipped') returning * into _ce;
    end if;
    update channel_events set check_in = _s, check_out = _e, summary = _sum, last_seen = _run where id = _ce.id;

    if _e <= _today then
      update channel_events set status = case when reservation_id is null then 'past' else status end where id = _ce.id;
      continue;
    end if;
    if not _l.import_blocks and coalesce(_sum, '') ~* '(not available|blocked|unavailable)' and _ce.reservation_id is null then
      update channel_events set status = 'skipped', message = 'Blocked dates, not a booking (import of blocks is off)' where id = _ce.id;
      _skipped := _skipped + 1;
      continue;
    end if;

    _rid := _ce.reservation_id;
    if _rid is null then
      select id into _rid from reservations where channel_link_id = _l.id and channel_uid = _uid;
    end if;
    if _rid is not null then
      select * into _r from reservations where id = _rid;
      if _r.status in ('confirmed', 'cancelled') and (_r.check_in <> _s or _r.check_out <> _e or _r.status = 'cancelled' or _r.room_id is null) then
        begin
          update reservations set check_in = _s, check_out = _e, status = 'confirmed', cancelled_at = null,
                 room_id = coalesce(room_id, _l.room_id)
           where id = _rid;
          update channel_events set status = 'booked', reservation_id = _rid, message = null where id = _ce.id;
          _changed := _changed + 1;
        exception when exclusion_violation then
          update reservations set check_in = _s, check_out = _e, status = 'confirmed', cancelled_at = null, room_id = null where id = _rid;
          update channel_events set status = 'conflict', reservation_id = _rid,
                 message = format('Room %s is already taken on some of these nights. The booking is kept without a room: move one of them.', _rm.room_number)
           where id = _ce.id;
          _conflicts := _conflicts + 1;
        end;
      else
        update channel_events set reservation_id = _rid,
               status = case when _r.room_id is null and _r.status = 'confirmed' then 'conflict' else 'booked' end where id = _ce.id;
      end if;
      continue;
    end if;

    -- a new booking from the site
    insert into guests (hotel_id, first_name, last_name, notes)
    values (_l.hotel_id, channel_label(_l.channel), 'guest', 'Imported from the ' || channel_label(_l.channel) || ' calendar. Add the real name at check-in.')
    returning id into _g;
    begin
      insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, adults, status, source, rate_per_night,
                                special_requests, channel_link_id, channel_uid)
      values (_l.hotel_id, _g, _rm.room_type_id, _l.room_id, _s, _e, 1, 'confirmed', _src, 0,
              left(format('From the %s calendar (%s). Add the guest''s name and the price.%s', channel_label(_l.channel), coalesce(_sum, 'booked'),
                   case when _desc is not null then E'\n' || _desc else '' end), 1000),
              _l.id, _uid)
      returning id into _rid;
      update channel_events set status = 'booked', reservation_id = _rid, message = null where id = _ce.id;
      _added := _added + 1;
      perform log_activity(_l.hotel_id, 'online', format('%s booking imported: room %s, %s → %s', channel_label(_l.channel), _rm.room_number,
        to_char(_s, 'DD Mon'), to_char(_e, 'DD Mon')), _rid);
    exception when exclusion_violation then
      select x.code into _other from reservations x where x.room_id = _l.room_id and x.status in ('confirmed', 'checked_in')
        and daterange(x.check_in, x.check_out) && daterange(_s, _e) limit 1;
      insert into reservations (hotel_id, guest_id, room_type_id, room_id, check_in, check_out, adults, status, source, rate_per_night,
                                special_requests, channel_link_id, channel_uid)
      values (_l.hotel_id, _g, _rm.room_type_id, null, _s, _e, 1, 'confirmed', _src, 0,
              format('From the %s calendar. DOUBLE BOOKING: room %s is already taken by %s. Move one of the guests.', channel_label(_l.channel), _rm.room_number, coalesce(_other, 'another booking')),
              _l.id, _uid)
      returning id into _rid;
      _msg := format('Double booking: room %s is already taken by %s on these nights. The %s booking is kept without a room.', _rm.room_number, coalesce(_other, 'another booking'), channel_label(_l.channel));
      update channel_events set status = 'conflict', reservation_id = _rid, message = _msg where id = _ce.id;
      _conflicts := _conflicts + 1;
      perform log_activity(_l.hotel_id, 'online', _msg, _rid);
    end;
  end loop;

  -- bookings that disappeared from the feed were cancelled on the site
  for _ce in select * from channel_events where link_id = _l.id and last_seen < _run and status in ('booked', 'conflict') loop
    select * into _r from reservations where id = _ce.reservation_id;
    if found and _r.status = 'confirmed' and _r.check_out > _today then
      update reservations set status = 'cancelled', cancelled_at = now() where id = _r.id;
      _cancelled := _cancelled + 1;
      perform log_activity(_l.hotel_id, 'cancel', format('%s booking %s cancelled on the site (gone from its calendar)', channel_label(_l.channel), _r.code), _r.id);
    end if;
    update channel_events set status = 'cancelled' where id = _ce.id;
  end loop;
  delete from channel_events where link_id = _l.id and last_seen < _run - interval '90 days';

  perform set_config('hotel_easy.rpc', '', true);
  _msg := concat_ws(', ', case when _added > 0 then _added || ' new' end, case when _changed > 0 then _changed || ' changed' end,
                   case when _cancelled > 0 then _cancelled || ' cancelled' end, case when _conflicts > 0 then _conflicts || ' DOUBLE BOOKED' end,
                   case when _skipped > 0 then _skipped || ' blocks skipped' end);
  update channel_links set last_sync_at = now(), last_sync_ok = _conflicts = 0,
         last_sync_message = coalesce(nullif(_msg, ''), 'Up to date'),
         last_event_count = jsonb_array_length(coalesce(_events, '[]'))
   where id = _l.id;
  return jsonb_build_object('ok', true, 'added', _added, 'changed', _changed, 'cancelled', _cancelled, 'conflicts', _conflicts,
    'skipped', _skipped, 'message', coalesce(nullif(_msg, ''), 'Up to date'));
end $$;

-- links to read now: enabled, with a feed, not read in the last _minutes (optionally one hotel)
create or replace function public.channel_due(_minutes int, _hotel_id uuid default null)
returns table (id uuid, import_url text) language sql stable security definer set search_path = public as $$
  select l.id, l.import_url from channel_links l
   where l.enabled and l.import_url is not null and (_hotel_id is null or l.hotel_id = _hotel_id)
     and (l.last_sync_at is null or l.last_sync_at < now() - make_interval(mins => greatest(_minutes, 1)))
   order by l.last_sync_at nulls first limit 25;
$$;
create or replace function public.channel_link_url(_id uuid) returns text language sql stable security definer set search_path = public as $$
  select import_url from channel_links where id = _id and enabled;
$$;

revoke all on function public.channel_export(text), public.channel_apply(uuid, jsonb, boolean, text), public.channel_due(int, uuid),
  public.channel_link_url(uuid) from public, anon, authenticated;
grant execute on function public.channel_export(text), public.channel_apply(uuid, jsonb, boolean, text), public.channel_due(int, uuid),
  public.channel_link_url(uuid) to service_role;
