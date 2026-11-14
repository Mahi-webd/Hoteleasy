-- =====================================================================
-- HotelEasy: guest requests & concierge
--  * every room has a QR code (room_links.token) that opens a guest page
--  * the guest proves they are staying there with their last name (or
--    front desk sends them their stay link), then asks for towels,
--    cleaning, a repair, a taxi, a wake-up call or late check-out
--  * requests go to housekeeping, maintenance, front desk or the
--    restaurant, with live status the guest can see; repairs also open a
--    maintenance ticket
-- =====================================================================

alter table public.hotels add column if not exists guest_info text check (guest_info is null or length(guest_info) <= 2000);

-- A secret key per stay for the guest page. Kept in its own table so it never
-- comes back with ordinary reservation reads.
create table public.stay_keys (
  reservation_id uuid primary key references public.reservations(id) on delete cascade,
  hotel_id       uuid not null references public.hotels(id) on delete cascade,
  key            text not null unique default replace(gen_random_uuid()::text, '-', '') || left(replace(gen_random_uuid()::text, '-', ''), 8)
);
alter table public.stay_keys enable row level security;
revoke all on public.stay_keys from anon, authenticated;
insert into public.stay_keys (reservation_id, hotel_id) select id, hotel_id from public.reservations where status in ('confirmed', 'checked_in') on conflict do nothing;
create or replace function public.reservations_stay_key()
returns trigger language plpgsql security definer set search_path = public as $$
begin insert into stay_keys (reservation_id, hotel_id) values (new.id, new.hotel_id) on conflict do nothing; return new; end $$;
create trigger reservations_stay_key after insert on public.reservations for each row execute function public.reservations_stay_key();

create table public.room_links (
  room_id    uuid primary key references public.rooms(id) on delete cascade,
  hotel_id   uuid not null references public.hotels(id) on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
insert into public.room_links (room_id, hotel_id) select id, hotel_id from public.rooms on conflict do nothing;
create or replace function public.rooms_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin insert into room_links (room_id, hotel_id) values (new.id, new.hotel_id) on conflict do nothing; return new; end $$;
create trigger rooms_link after insert on public.rooms for each row execute function public.rooms_link();
alter table public.room_links enable row level security;
revoke all on public.room_links from anon;
create policy rl_sel on public.room_links for select to authenticated
  using (public.has_hotel_role_any(hotel_id, array['owner','manager','front_desk']));
-- (new codes only through room_link_reset)

create table public.request_types (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references public.hotels(id) on delete cascade,
  label       text not null check (length(trim(label)) between 1 and 60),
  department  text not null check (department in ('housekeeping', 'maintenance', 'front_desk', 'restaurant')),
  icon        text not null default 'bell',
  ask_time    boolean not null default false,
  ask_details boolean not null default false,
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index on public.request_types (hotel_id, sort);
alter table public.request_types enable row level security;
revoke all on public.request_types from anon;
create policy rt_sel on public.request_types for select to authenticated using (public.is_hotel_member(hotel_id));
create policy rt_all on public.request_types for all to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]));

create or replace function public.request_types_defaults(_hotel_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into request_types (hotel_id, label, department, icon, ask_time, ask_details, sort)
  select _hotel_id, v.label, v.dept, v.icon, v.t, v.d, v.s
    from (values ('Extra towels', 'housekeeping', 'towel', false, false, 1),
                 ('Clean my room', 'housekeeping', 'sparkles', true, false, 2),
                 ('Extra pillows or blanket', 'housekeeping', 'bed', false, false, 3),
                 ('Toiletries', 'housekeeping', 'soap', false, true, 4),
                 ('Something isn''t working', 'maintenance', 'wrench', false, true, 5),
                 ('Wake-up call', 'front_desk', 'alarm', true, false, 6),
                 ('Taxi or transfer', 'front_desk', 'car', true, true, 7),
                 ('Late check-out', 'front_desk', 'clock', true, false, 8),
                 ('Food to my room', 'restaurant', 'utensils', false, true, 9),
                 ('Something else', 'front_desk', 'message', false, true, 10)) v(label, dept, icon, t, d, s)
   where not exists (select 1 from request_types where hotel_id = _hotel_id);
$$;
revoke execute on function public.request_types_defaults(uuid) from public, anon, authenticated;
select public.request_types_defaults(id) from public.hotels;
create or replace function public.hotels_request_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform request_types_defaults(new.id); return new; end $$;
create trigger hotels_request_defaults after insert on public.hotels for each row execute function public.hotels_request_defaults();

create table public.guest_requests (
  id               uuid primary key default gen_random_uuid(),
  hotel_id         uuid not null references public.hotels(id) on delete cascade,
  reservation_id   uuid not null references public.reservations(id) on delete cascade,
  room_id          uuid references public.rooms(id) on delete set null,
  type_id          uuid references public.request_types(id) on delete set null,
  label            text not null,
  department       text not null check (department in ('housekeeping', 'maintenance', 'front_desk', 'restaurant')),
  details          text check (details is null or length(details) <= 500),
  wanted_at        timestamptz,
  status           text not null default 'new' check (status in ('new', 'acknowledged', 'done', 'cancelled')),
  reply            text check (reply is null or length(reply) <= 300),
  ticket_id        uuid references public.maintenance_tickets(id) on delete set null,
  from_guest       boolean not null default true,
  created_at       timestamptz not null default now(),
  acknowledged_at  timestamptz,
  done_at          timestamptz,
  handled_by       uuid references auth.users(id) on delete set null,
  updated_at       timestamptz not null default now()
);
create index on public.guest_requests (hotel_id, status, created_at desc);
create index on public.guest_requests (reservation_id);
create trigger t_gr_upd before update on public.guest_requests for each row execute function public.touch_updated_at();

-- Who works on which requests.
create or replace function public.request_staff(_hotel_id uuid, _department text)
returns boolean language sql stable security definer set search_path = public as $$
  select has_hotel_role_any(_hotel_id, array['owner','manager','front_desk'])
      or (_department = 'housekeeping' and has_hotel_role_any(_hotel_id, array['housekeeping']))
      or (_department = 'maintenance' and has_hotel_role_any(_hotel_id, array['maintenance']))
      or (_department = 'restaurant' and has_hotel_role_any(_hotel_id, array['restaurant']));
$$;

alter table public.guest_requests enable row level security;
revoke all on public.guest_requests from anon;
create policy gr_sel on public.guest_requests for select to authenticated using (public.request_staff(hotel_id, department));
-- (changes go through request_update / request_create_staff)

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.guest_requests;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- The guest side (no sign-in)
-- ---------------------------------------------------------------------
create or replace function public.stay_by_key(_key text)
returns public.reservations language sql stable security definer set search_path = public as $$
  select r.* from stay_keys k join reservations r on r.id = k.reservation_id
   where k.key = _key and _key is not null and length(_key) >= 32 and r.status = 'checked_in'
$$;
revoke execute on function public.stay_by_key(text) from public, anon, authenticated;

-- What the QR code in a room shows before the guest says who they are.
create or replace function public.public_room(_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _l room_links; _h hotels; _num text; _occupied boolean;
begin
  select * into _l from room_links where token = _token;
  if not found then return null; end if;
  select * into _h from hotels where id = _l.hotel_id;
  select room_number into _num from rooms where id = _l.room_id;
  _occupied := exists (select 1 from reservations where room_id = _l.room_id and status = 'checked_in');
  return jsonb_build_object('hotel', _h.name, 'phone', _h.phone, 'room', _num, 'occupied', _occupied);
end $$;

-- The guest confirms their last name; we give back the key for their stay.
create or replace function public.public_room_unlock(_token text, _last_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _l room_links; _key text; _fails int;
begin
  select * into _l from room_links where token = _token;
  if not found then raise exception 'This QR code is not valid'; end if;
  select count(*) into _fails from activity_log where hotel_id = _l.hotel_id and kind = 'guest_page_fail'
     and entity_id = _l.room_id and created_at > now() - interval '15 minutes';
  if _fails >= 5 then return jsonb_build_object('error', 'Too many tries. Please call reception.'); end if;
  select k.key into _key from reservations r join guests g on g.id = r.guest_id join stay_keys k on k.reservation_id = r.id
   where r.room_id = _l.room_id and r.status = 'checked_in'
     and lower(regexp_replace(trim(g.last_name), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(_last_name, '')), '\s+', ' ', 'g'))
   limit 1;
  if _key is null then
    insert into activity_log (hotel_id, kind, message, entity_id) values (_l.hotel_id, 'guest_page_fail', 'Guest page: wrong name entered', _l.room_id);
    return jsonb_build_object('error', 'That name doesn''t match the guest in this room. Check the spelling, or call reception.');
  end if;
  return jsonb_build_object('key', _key);
end $$;

create or replace function public.public_stay(_key text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _r reservations; _h hotels; _g guests; _num text;
begin
  _r := stay_by_key(_key);
  if _r.id is null then return null; end if;
  select * into _h from hotels where id = _r.hotel_id;
  select * into _g from guests where id = _r.guest_id;
  select room_number into _num from rooms where id = _r.room_id;
  return jsonb_build_object(
    'hotel', jsonb_build_object('name', _h.name, 'phone', _h.phone, 'timezone', _h.timezone, 'checkout_time', to_char(_h.checkout_time, 'HH24:MI'),
       'guest_info', _h.guest_info),
    'first_name', _g.first_name, 'room', _num, 'check_out', _r.check_out,
    'plan', (select name from rate_plans where id = _r.rate_plan_id),
    'types', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'label', t.label, 'icon', t.icon, 'ask_time', t.ask_time, 'ask_details', t.ask_details,
               'department', t.department) order by t.sort, t.label), '[]'::jsonb)
              from request_types t where t.hotel_id = _r.hotel_id and t.active),
    'requests', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'label', q.label, 'details', q.details, 'wanted_at', q.wanted_at,
               'status', q.status, 'reply', q.reply, 'created_at', q.created_at, 'done_at', q.done_at) order by q.created_at desc), '[]'::jsonb)
              from guest_requests q where q.reservation_id = _r.id));
end $$;

create or replace function public.public_request(_key text, _type_id uuid, _details text default null, _wanted_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _r reservations; _t request_types; _id uuid; _ticket uuid; _num text; _g text;
begin
  _r := stay_by_key(_key);
  if _r.id is null then raise exception 'Your stay has ended or this link is not valid'; end if;
  select * into _t from request_types where id = _type_id and hotel_id = _r.hotel_id and active;
  if not found then raise exception 'Choose what you need'; end if;
  if length(coalesce(_details, '')) > 500 then raise exception 'Please keep it under 500 characters'; end if;
  if _t.ask_details and _t.department = 'maintenance' and coalesce(trim(_details), '') = '' then raise exception 'Tell us what isn''t working'; end if;
  if _wanted_at is not null and (_wanted_at < now() - interval '10 minutes' or _wanted_at > now() + interval '14 days') then
    raise exception 'Choose a time in the next two weeks';
  end if;
  if (select count(*) from guest_requests where reservation_id = _r.id and status in ('new', 'acknowledged')) >= 8 then
    raise exception 'You have several requests waiting. Reception will be with you shortly, or please call them.';
  end if;
  if (select count(*) from guest_requests where reservation_id = _r.id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many requests in the last hour. Please call reception.';
  end if;
  select room_number into _num from rooms where id = _r.room_id;
  select trim(first_name || ' ' || last_name) into _g from guests where id = _r.guest_id;
  if _t.department = 'maintenance' then
    insert into maintenance_tickets (hotel_id, room_id, title, description, category, priority, reported_by)
    values (_r.hotel_id, _r.room_id, left('Guest: ' || coalesce(nullif(trim(_details), ''), _t.label), 120),
            format('Reported by %s (room %s) from the guest page.%s', _g, _num, coalesce(E'\n' || nullif(trim(_details), ''), '')), 'other', 'high', null)
    returning id into _ticket;
  end if;
  insert into guest_requests (hotel_id, reservation_id, room_id, type_id, label, department, details, wanted_at, ticket_id)
  values (_r.hotel_id, _r.id, _r.room_id, _t.id, _t.label, _t.department, nullif(trim(_details), ''), _wanted_at, _ticket)
  returning id into _id;
  perform log_activity(_r.hotel_id, 'request', format('Room %s: %s%s', coalesce(_num, '?'), _t.label,
          coalesce(' – ' || left(nullif(trim(_details), ''), 60), '')), _r.id);
  return _id;
end $$;

create or replace function public.public_request_cancel(_key text, _id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _r reservations;
begin
  _r := stay_by_key(_key);
  if _r.id is null then raise exception 'Your stay has ended or this link is not valid'; end if;
  update guest_requests set status = 'cancelled' where id = _id and reservation_id = _r.id and status = 'new';
  if not found then raise exception 'That request is already being handled'; end if;
end $$;

revoke execute on function public.public_room(text) from public;
revoke execute on function public.public_room_unlock(text, text) from public;
revoke execute on function public.public_stay(text) from public;
revoke execute on function public.public_request(text, uuid, text, timestamptz) from public;
revoke execute on function public.public_request_cancel(text, uuid) from public;
grant execute on function public.public_room(text) to anon, authenticated;
grant execute on function public.public_room_unlock(text, text) to anon, authenticated;
grant execute on function public.public_stay(text) to anon, authenticated;
grant execute on function public.public_request(text, uuid, text, timestamptz) to anon, authenticated;
grant execute on function public.public_request_cancel(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Staff side
-- ---------------------------------------------------------------------
create or replace function public.request_update(_id uuid, _status text, _reply text default null)
returns void language plpgsql security definer set search_path = public as $$
declare _q guest_requests;
begin
  select * into _q from guest_requests where id = _id for update;
  if not found or not request_staff(_q.hotel_id, _q.department) then raise exception 'Request not found'; end if;
  if _status not in ('acknowledged', 'done', 'cancelled', 'new') then raise exception 'Unknown status'; end if;
  if length(coalesce(_reply, '')) > 300 then raise exception 'Keep the reply under 300 characters'; end if;
  update guest_requests set status = _status, reply = coalesce(nullif(trim(_reply), ''), reply), handled_by = auth.uid(),
         acknowledged_at = case when _status in ('acknowledged', 'done') then coalesce(acknowledged_at, now()) else acknowledged_at end,
         done_at = case when _status = 'done' then now() when _status = 'new' then null else done_at end
   where id = _id;
end $$;
grant execute on function public.request_update(uuid, text, text) to authenticated;

-- Staff log a request a guest made by phone or at the desk.
create or replace function public.request_create_staff(_reservation_id uuid, _type_id uuid, _details text default null, _wanted_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _r reservations; _t request_types; _id uuid;
begin
  select * into _r from reservations where id = _reservation_id;
  if not found or not has_hotel_role_any(_r.hotel_id, array['owner','manager','front_desk']) then raise exception 'Reservation not found'; end if;
  if _r.status <> 'checked_in' then raise exception 'That guest is not checked in'; end if;
  select * into _t from request_types where id = _type_id and hotel_id = _r.hotel_id;
  if not found then raise exception 'Choose a request type'; end if;
  insert into guest_requests (hotel_id, reservation_id, room_id, type_id, label, department, details, wanted_at, from_guest, status, acknowledged_at, handled_by)
  values (_r.hotel_id, _r.id, _r.room_id, _t.id, _t.label, _t.department, nullif(trim(_details), ''), _wanted_at, false, 'acknowledged', now(), auth.uid())
  returning id into _id;
  return _id;
end $$;
grant execute on function public.request_create_staff(uuid, uuid, text, timestamptz) to authenticated;

-- A new QR code for a room (e.g. a sticker was photographed by someone who shouldn't have it).
create or replace function public.room_link_reset(_room_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare _t text;
begin
  if not has_hotel_role((select hotel_id from rooms where id = _room_id), array['owner','manager']::hotel_role[]) then raise exception 'Room not found'; end if;
  update room_links set token = replace(gen_random_uuid()::text, '-', ''), created_at = now() where room_id = _room_id returning token into _t;
  return _t;
end $$;
grant execute on function public.room_link_reset(uuid) to authenticated;

-- Front desk: the stay link to send a guest directly (skips the name check).
create or replace function public.stay_link_key(_reservation_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare _r reservations;
begin
  select * into _r from reservations where id = _reservation_id;
  if not found or not has_hotel_role_any(_r.hotel_id, array['owner','manager','front_desk']) then raise exception 'Reservation not found'; end if;
  if _r.status <> 'checked_in' then raise exception 'The guest page works while the guest is checked in'; end if;
  insert into stay_keys (reservation_id, hotel_id) values (_r.id, _r.hotel_id) on conflict do nothing;
  return (select key from stay_keys where reservation_id = _r.id);
end $$;
grant execute on function public.stay_link_key(uuid) to authenticated;

-- Open requests close when the guest checks out.
create or replace function public.reservations_close_requests()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('checked_out', 'cancelled', 'no_show') and old.status = 'checked_in' then
    update guest_requests set status = 'cancelled', reply = coalesce(reply, 'Closed at check-out') where reservation_id = new.id and status in ('new', 'acknowledged');
    update stay_keys set key = replace(gen_random_uuid()::text, '-', '') || left(replace(gen_random_uuid()::text, '-', ''), 8) where reservation_id = new.id;
  end if;
  return new;
end $$;
create trigger reservations_close_requests after update of status on public.reservations
  for each row execute function public.reservations_close_requests();
