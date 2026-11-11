-- =====================================================================
-- HotelEasy core schema (multi-hotel / SaaS)
-- Phase 1-2: hotels, staff & roles, room types, rooms, guests,
-- reservations, check-in / check-out, activity log.
--
-- Every business table carries hotel_id. Row Level Security only lets a
-- signed-in user see rows of hotels they are a member of, and only lets
-- the right roles change them.
-- =====================================================================

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.hotel_role as enum
  ('owner', 'manager', 'front_desk', 'housekeeping', 'restaurant', 'accountant');

create type public.room_status as enum
  ('available', 'occupied', 'dirty', 'cleaning', 'maintenance', 'out_of_order');

create type public.reservation_status as enum
  ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show');

create type public.booking_source as enum
  ('walk_in', 'phone', 'email', 'website', 'booking_com', 'expedia', 'airbnb', 'agent', 'other');

-- ---------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Hotels and membership
-- ---------------------------------------------------------------------
create table public.hotels (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) > 0),
  address         text,
  city            text,
  country         text not null default 'Kenya',
  phone           text,
  email           text,
  currency        text not null default 'KES',
  timezone        text not null default 'Africa/Nairobi',
  vat_rate        numeric(5,4) not null default 0.16 check (vat_rate >= 0 and vat_rate < 1),
  checkin_time    time not null default '14:00',
  checkout_time   time not null default '11:00',
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.hotel_members (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references public.hotels(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.hotel_role not null,
  created_at  timestamptz not null default now(),
  unique (hotel_id, user_id)
);
create index on public.hotel_members (user_id);

create table public.hotel_invitations (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references public.hotels(id) on delete cascade,
  email        text not null,
  role         public.hotel_role not null check (role <> 'owner'),
  invited_by   uuid references auth.users(id) on delete set null,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);
create unique index hotel_invitations_pending_uq
  on public.hotel_invitations (hotel_id, lower(email)) where accepted_at is null;

-- Membership helpers. SECURITY DEFINER so policies can call them without
-- recursing into hotel_members' own policies.
create or replace function public.is_hotel_member(_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hotel_members
    where hotel_id = _hotel_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_hotel_role(_hotel_id uuid, _roles public.hotel_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hotel_members
    where hotel_id = _hotel_id and user_id = auth.uid() and role = any(_roles)
  );
$$;

-- ---------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------
create table public.room_types (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       uuid not null references public.hotels(id) on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  description    text,
  base_rate      numeric(12,2) not null default 0 check (base_rate >= 0),
  max_occupancy  int not null default 2 check (max_occupancy between 1 and 20),
  amenities      text[] not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (hotel_id, name)
);

create table public.rooms (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid not null references public.hotels(id) on delete cascade,
  room_number   text not null check (length(trim(room_number)) > 0),
  room_type_id  uuid not null references public.room_types(id) on delete restrict,
  floor         int,
  status        public.room_status not null default 'available',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (hotel_id, room_number)
);
create index on public.rooms (hotel_id, status);

-- ---------------------------------------------------------------------
-- Guests
-- ---------------------------------------------------------------------
create table public.guests (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid not null references public.hotels(id) on delete cascade,
  first_name    text not null check (length(trim(first_name)) > 0),
  last_name     text not null default '',
  email         text,
  phone         text,
  id_type       text,          -- National ID, Passport, Alien ID ...
  id_number     text,
  nationality   text,
  address       text,
  date_of_birth date,
  is_vip        boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.guests (hotel_id, last_name, first_name);
create index on public.guests (hotel_id, phone);
create index on public.guests (hotel_id, email);

-- ---------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------
create table public.reservations (
  id               uuid primary key default gen_random_uuid(),
  hotel_id         uuid not null references public.hotels(id) on delete cascade,
  code             text not null,
  guest_id         uuid not null references public.guests(id) on delete restrict,
  room_type_id     uuid not null references public.room_types(id) on delete restrict,
  room_id          uuid references public.rooms(id) on delete set null,
  check_in         date not null,
  check_out        date not null,
  adults           int not null default 1 check (adults >= 1),
  children         int not null default 0 check (children >= 0),
  status           public.reservation_status not null default 'confirmed',
  source           public.booking_source not null default 'walk_in',
  rate_per_night   numeric(12,2) not null check (rate_per_night >= 0),
  nights           int generated always as (check_out - check_in) stored,
  total_amount     numeric(14,2) generated always as ((check_out - check_in) * rate_per_night) stored,
  special_requests text,
  checked_in_at    timestamptz,
  checked_out_at   timestamptz,
  cancelled_at     timestamptz,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint reservations_dates_ck check (check_out > check_in),
  constraint reservations_code_uq unique (hotel_id, code),
  -- A room can never be double-booked for overlapping nights.
  constraint reservations_no_overlap exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (room_id is not null and status in ('confirmed', 'checked_in'))
);
create index on public.reservations (hotel_id, check_in);
create index on public.reservations (hotel_id, check_out);
create index on public.reservations (hotel_id, status);
create index on public.reservations (guest_id);

-- Reservation code like HE-7K3P9Q, unique per hotel.
create or replace function public.set_reservation_code()
returns trigger language plpgsql as $$
declare
  _code text;
begin
  if new.code is not null and new.code <> '' then
    return new;
  end if;
  loop
    _code := 'HE-' || upper(substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=0O1Il', ''), 1, 6));
    exit when length(_code) = 9 and not exists (
      select 1 from public.reservations where hotel_id = new.hotel_id and code = _code
    );
  end loop;
  new.code := _code;
  return new;
end $$;

create trigger reservations_set_code
  before insert on public.reservations
  for each row execute function public.set_reservation_code();

-- Keep room / room type / guest consistent with the reservation's hotel.
create or replace function public.check_reservation_refs()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _room record;
begin
  if not exists (select 1 from public.guests where id = new.guest_id and hotel_id = new.hotel_id) then
    raise exception 'Guest does not belong to this hotel';
  end if;
  if not exists (select 1 from public.room_types where id = new.room_type_id and hotel_id = new.hotel_id) then
    raise exception 'Room type does not belong to this hotel';
  end if;
  if new.room_id is not null then
    select * into _room from public.rooms where id = new.room_id;
    if _room.hotel_id is distinct from new.hotel_id then
      raise exception 'Room does not belong to this hotel';
    end if;
    if _room.room_type_id <> new.room_type_id then
      new.room_type_id := _room.room_type_id;
    end if;
  end if;
  return new;
end $$;

create trigger reservations_check_refs
  before insert or update of guest_id, room_type_id, room_id, hotel_id on public.reservations
  for each row execute function public.check_reservation_refs();

create or replace function public.check_room_type_hotel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.room_types where id = new.room_type_id and hotel_id = new.hotel_id) then
    raise exception 'Room type does not belong to this hotel';
  end if;
  return new;
end $$;

create trigger rooms_check_type
  before insert or update of room_type_id, hotel_id on public.rooms
  for each row execute function public.check_room_type_hotel();

-- ---------------------------------------------------------------------
-- Activity log (feeds the dashboard "Recent activity")
-- ---------------------------------------------------------------------
create table public.activity_log (
  id          bigserial primary key,
  hotel_id    uuid not null references public.hotels(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  kind        text not null,      -- reservation, checkin, checkout, cancel, room, guest, staff
  message     text not null,
  entity_id   uuid,
  created_at  timestamptz not null default now()
);
create index on public.activity_log (hotel_id, created_at desc);

create or replace function public.log_activity(_hotel_id uuid, _kind text, _message text, _entity_id uuid default null)
returns void language sql security definer set search_path = public as $$
  insert into public.activity_log (hotel_id, actor_id, kind, message, entity_id)
  values (_hotel_id, auth.uid(), _kind, _message, _entity_id);
$$;
revoke execute on function public.log_activity(uuid, text, text, uuid) from public, anon, authenticated;

create or replace function public.log_reservation_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare _g text;
begin
  select trim(first_name || ' ' || last_name) into _g from public.guests where id = new.guest_id;
  perform public.log_activity(new.hotel_id, 'reservation',
    format('New reservation %s for %s (%s → %s)', new.code, _g,
           to_char(new.check_in, 'DD Mon'), to_char(new.check_out, 'DD Mon')), new.id);
  return new;
end $$;

create trigger reservations_log_insert
  after insert on public.reservations
  for each row execute function public.log_reservation_insert();

-- updated_at triggers
create trigger t_profiles_upd     before update on public.profiles     for each row execute function public.touch_updated_at();
create trigger t_hotels_upd       before update on public.hotels       for each row execute function public.touch_updated_at();
create trigger t_room_types_upd   before update on public.room_types   for each row execute function public.touch_updated_at();
create trigger t_rooms_upd        before update on public.rooms        for each row execute function public.touch_updated_at();
create trigger t_guests_upd       before update on public.guests       for each row execute function public.touch_updated_at();
create trigger t_reservations_upd before update on public.reservations for each row execute function public.touch_updated_at();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles          enable row level security;
alter table public.hotels            enable row level security;
alter table public.hotel_members     enable row level security;
alter table public.hotel_invitations enable row level security;
alter table public.room_types        enable row level security;
alter table public.rooms             enable row level security;
alter table public.guests            enable row level security;
alter table public.reservations      enable row level security;
alter table public.activity_log      enable row level security;

-- Nothing is readable without signing in.
revoke all on all tables in schema public from anon;

-- profiles: yourself, and colleagues in any hotel you share
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid() or exists (
      select 1 from public.hotel_members me
      join public.hotel_members them on them.hotel_id = me.hotel_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- hotels
create policy hotels_select on public.hotels for select to authenticated
  using (public.is_hotel_member(id));
create policy hotels_update on public.hotels for update to authenticated
  using (public.has_hotel_role(id, array['owner','manager']::public.hotel_role[]))
  with check (public.has_hotel_role(id, array['owner','manager']::public.hotel_role[]));
-- (insert happens through create_hotel(); delete is not allowed from the app)

-- hotel_members: everyone in a hotel can see the team; only the owner changes it
create policy members_select on public.hotel_members for select to authenticated
  using (public.is_hotel_member(hotel_id));
create policy members_update on public.hotel_members for update to authenticated
  using (public.has_hotel_role(hotel_id, array['owner']::public.hotel_role[]) and user_id <> auth.uid())
  with check (public.has_hotel_role(hotel_id, array['owner']::public.hotel_role[]) and role <> 'owner');
create policy members_delete on public.hotel_members for delete to authenticated
  using (public.has_hotel_role(hotel_id, array['owner']::public.hotel_role[]) and user_id <> auth.uid());

-- invitations: owner & manager
create policy inv_select on public.hotel_invitations for select to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]));
create policy inv_insert on public.hotel_invitations for insert to authenticated
  with check (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[])
              and (role <> 'manager' or public.has_hotel_role(hotel_id, array['owner']::public.hotel_role[])));
create policy inv_delete on public.hotel_invitations for delete to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]));

-- room types: everyone reads, owner/manager edits
create policy room_types_select on public.room_types for select to authenticated
  using (public.is_hotel_member(hotel_id));
create policy room_types_write on public.room_types for all to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]));

-- rooms: everyone reads; owner/manager add/remove; front desk & housekeeping update status
create policy rooms_select on public.rooms for select to authenticated
  using (public.is_hotel_member(hotel_id));
create policy rooms_insert on public.rooms for insert to authenticated
  with check (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]));
create policy rooms_update on public.rooms for update to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk','housekeeping']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager','front_desk','housekeeping']::public.hotel_role[]));
create policy rooms_delete on public.rooms for delete to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]));

-- guests: front office roles
create policy guests_select on public.guests for select to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk','accountant','restaurant']::public.hotel_role[]));
create policy guests_insert on public.guests for insert to authenticated
  with check (public.has_hotel_role(hotel_id, array['owner','manager','front_desk']::public.hotel_role[]));
create policy guests_update on public.guests for update to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager','front_desk']::public.hotel_role[]));
create policy guests_delete on public.guests for delete to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]));

-- reservations: everyone in the hotel reads (housekeeping needs arrivals/departures);
-- front office creates and edits; status changes go through the RPCs below.
create policy res_select on public.reservations for select to authenticated
  using (public.is_hotel_member(hotel_id));
create policy res_insert on public.reservations for insert to authenticated
  with check (public.has_hotel_role(hotel_id, array['owner','manager','front_desk']::public.hotel_role[])
              and status = 'confirmed');
create policy res_update on public.reservations for update to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager','front_desk']::public.hotel_role[]));
-- no delete: cancel instead, so history is kept

-- activity log: read-only for members (written by functions)
create policy activity_select on public.activity_log for select to authenticated
  using (public.is_hotel_member(hotel_id));

-- Block direct status jumps from the table API; status changes must use RPCs
-- (which set the flag below) so room status stays in sync.
create or replace function public.guard_reservation_status()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('hotel_easy.rpc', true), '') <> 'on' then
    raise exception 'Use check-in, check-out or cancel to change a reservation''s status';
  end if;
  if old.status in ('checked_out', 'cancelled', 'no_show')
     and coalesce(current_setting('hotel_easy.rpc', true), '') <> 'on' then
    raise exception 'This reservation is closed and can no longer be edited';
  end if;
  return new;
end $$;

create trigger reservations_guard_status
  before update on public.reservations
  for each row execute function public.guard_reservation_status();

-- =====================================================================
-- Functions called by the app (RPC)
-- =====================================================================

-- Create a hotel; the caller becomes its owner. Optionally seeds a few
-- room types and rooms so a new hotel has something to try.
create or replace function public.create_hotel(
  _name text,
  _city text default null,
  _phone text default null,
  _email text default null,
  _with_sample_rooms boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _hotel uuid;
  _std uuid; _dlx uuid; _ste uuid;
  i int;
begin
  if _uid is null then raise exception 'Not signed in'; end if;
  if _name is null or length(trim(_name)) = 0 then raise exception 'Hotel name is required'; end if;

  insert into hotels (name, city, phone, email, created_by)
  values (trim(_name), _city, _phone, _email, _uid)
  returning id into _hotel;

  insert into hotel_members (hotel_id, user_id, role) values (_hotel, _uid, 'owner');

  if _with_sample_rooms then
    insert into room_types (hotel_id, name, base_rate, max_occupancy, amenities)
      values (_hotel, 'Standard', 6500, 2, array['WiFi','TV','Hot shower']) returning id into _std;
    insert into room_types (hotel_id, name, base_rate, max_occupancy, amenities)
      values (_hotel, 'Deluxe', 9500, 3, array['WiFi','TV','Hot shower','Balcony','Mini fridge']) returning id into _dlx;
    insert into room_types (hotel_id, name, base_rate, max_occupancy, amenities)
      values (_hotel, 'Suite', 15000, 4, array['WiFi','TV','Bathtub','Lounge','Mini bar']) returning id into _ste;
    for i in 1..6 loop
      insert into rooms (hotel_id, room_number, room_type_id, floor) values (_hotel, (100 + i)::text, _std, 1);
    end loop;
    for i in 1..4 loop
      insert into rooms (hotel_id, room_number, room_type_id, floor) values (_hotel, (200 + i)::text, _dlx, 2);
    end loop;
    for i in 1..2 loop
      insert into rooms (hotel_id, room_number, room_type_id, floor) values (_hotel, (300 + i)::text, _ste, 3);
    end loop;
  end if;

  perform log_activity(_hotel, 'staff', 'Hotel created');
  return _hotel;
end $$;

-- Attach any pending invitations for the signed-in user's email.
create or replace function public.accept_pending_invitations()
returns int language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _email text;
  _n int := 0;
  _inv record;
begin
  if _uid is null then return 0; end if;
  select lower(email) into _email from auth.users where id = _uid;
  for _inv in
    select * from hotel_invitations where lower(email) = _email and accepted_at is null
  loop
    insert into hotel_members (hotel_id, user_id, role)
    values (_inv.hotel_id, _uid, _inv.role)
    on conflict (hotel_id, user_id) do nothing;
    update hotel_invitations set accepted_at = now() where id = _inv.id;
    perform log_activity(_inv.hotel_id, 'staff', format('%s joined as %s', _email, replace(_inv.role::text, '_', ' ')));
    _n := _n + 1;
  end loop;
  return _n;
end $$;

-- Team list with names and emails (emails live in auth.users).
create or replace function public.hotel_team(_hotel_id uuid)
returns table (member_id uuid, user_id uuid, full_name text, email text, role public.hotel_role, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.user_id, p.full_name, u.email::text, m.role, m.created_at
  from hotel_members m
  join auth.users u on u.id = m.user_id
  left join profiles p on p.id = m.user_id
  where m.hotel_id = _hotel_id and public.is_hotel_member(_hotel_id)
  order by m.created_at;
$$;

-- Rooms free for the whole stay (no overlapping active booking, not blocked).
create or replace function public.available_rooms(
  _hotel_id uuid, _check_in date, _check_out date,
  _room_type_id uuid default null, _exclude_reservation uuid default null
) returns setof public.rooms
language sql stable security invoker set search_path = public as $$
  select r.* from rooms r
  where r.hotel_id = _hotel_id
    and r.status not in ('maintenance', 'out_of_order')
    and (_room_type_id is null or r.room_type_id = _room_type_id)
    and not exists (
      select 1 from reservations x
      where x.room_id = r.id
        and x.status in ('confirmed', 'checked_in')
        and (_exclude_reservation is null or x.id <> _exclude_reservation)
        and daterange(x.check_in, x.check_out, '[)') && daterange(_check_in, _check_out, '[)')
    )
  order by r.room_number;
$$;

create or replace function public.check_in_reservation(_reservation_id uuid, _room_id uuid default null)
returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  _r reservations;
  _room rooms;
  _g text;
begin
  select * into _r from reservations where id = _reservation_id for update;
  if not found then raise exception 'Reservation not found'; end if;
  if not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[]) then
    raise exception 'You do not have permission to check guests in';
  end if;
  if _r.status <> 'confirmed' then
    raise exception 'Only confirmed reservations can be checked in (this one is %)', replace(_r.status::text, '_', ' ');
  end if;
  if _r.check_in > (now() at time zone (select timezone from hotels where id = _r.hotel_id))::date then
    raise exception 'This reservation starts on %; it cannot be checked in early. Change the dates first.', to_char(_r.check_in, 'DD Mon YYYY');
  end if;

  perform set_config('hotel_easy.rpc', 'on', true);

  if _room_id is not null and _room_id is distinct from _r.room_id then
    update reservations set room_id = _room_id where id = _r.id;  -- exclusion constraint guards overlaps
  end if;
  select * into _r from reservations where id = _reservation_id;
  if _r.room_id is null then raise exception 'Assign a room before checking in'; end if;

  select * into _room from rooms where id = _r.room_id for update;
  if _room.status = 'occupied' then
    raise exception 'Room % is still occupied', _room.room_number;
  end if;
  if _room.status in ('maintenance', 'out_of_order') then
    raise exception 'Room % is not usable (%)', _room.room_number, replace(_room.status::text, '_', ' ');
  end if;

  update reservations set status = 'checked_in', checked_in_at = now() where id = _r.id returning * into _r;
  update rooms set status = 'occupied' where id = _room.id;

  select trim(first_name || ' ' || last_name) into _g from guests where id = _r.guest_id;
  perform log_activity(_r.hotel_id, 'checkin', format('%s checked in to room %s', _g, _room.room_number), _r.id);
  perform set_config('hotel_easy.rpc', 'off', true);
  return _r;
end $$;

create or replace function public.check_out_reservation(_reservation_id uuid)
returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  _r reservations;
  _num text;
  _g text;
begin
  select * into _r from reservations where id = _reservation_id for update;
  if not found then raise exception 'Reservation not found'; end if;
  if not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[]) then
    raise exception 'You do not have permission to check guests out';
  end if;
  if _r.status <> 'checked_in' then
    raise exception 'Only checked-in guests can be checked out';
  end if;

  perform set_config('hotel_easy.rpc', 'on', true);
  update reservations set status = 'checked_out', checked_out_at = now() where id = _r.id returning * into _r;
  update rooms set status = 'dirty' where id = _r.room_id returning room_number into _num;

  select trim(first_name || ' ' || last_name) into _g from guests where id = _r.guest_id;
  perform log_activity(_r.hotel_id, 'checkout', format('%s checked out of room %s', _g, _num), _r.id);
  perform set_config('hotel_easy.rpc', 'off', true);
  return _r;
end $$;

create or replace function public.cancel_reservation(_reservation_id uuid, _no_show boolean default false)
returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  _r reservations;
begin
  select * into _r from reservations where id = _reservation_id for update;
  if not found then raise exception 'Reservation not found'; end if;
  if not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[]) then
    raise exception 'You do not have permission to cancel reservations';
  end if;
  if _r.status <> 'confirmed' then
    raise exception 'Only confirmed (not yet arrived) reservations can be cancelled';
  end if;

  perform set_config('hotel_easy.rpc', 'on', true);
  update reservations
     set status = case when _no_show then 'no_show'::reservation_status else 'cancelled'::reservation_status end,
         cancelled_at = now()
   where id = _r.id returning * into _r;
  perform log_activity(_r.hotel_id, 'cancel',
    format('Reservation %s %s', _r.code, case when _no_show then 'marked no-show' else 'cancelled' end), _r.id);
  perform set_config('hotel_easy.rpc', 'off', true);
  return _r;
end $$;

-- Lock down function execution to signed-in users.
revoke execute on function public.create_hotel(text, text, text, text, boolean) from public, anon;
revoke execute on function public.accept_pending_invitations() from public, anon;
revoke execute on function public.hotel_team(uuid) from public, anon;
revoke execute on function public.available_rooms(uuid, date, date, uuid, uuid) from public, anon;
revoke execute on function public.check_in_reservation(uuid, uuid) from public, anon;
revoke execute on function public.check_out_reservation(uuid) from public, anon;
revoke execute on function public.cancel_reservation(uuid, boolean) from public, anon;
grant execute on function public.create_hotel(text, text, text, text, boolean) to authenticated;
grant execute on function public.accept_pending_invitations() to authenticated;
grant execute on function public.hotel_team(uuid) to authenticated;
grant execute on function public.available_rooms(uuid, date, date, uuid, uuid) to authenticated;
grant execute on function public.check_in_reservation(uuid, uuid) to authenticated;
grant execute on function public.check_out_reservation(uuid) to authenticated;
grant execute on function public.cancel_reservation(uuid, boolean) to authenticated;

-- Live updates for the main screens
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rooms, public.reservations, public.activity_log;
  end if;
end $$;
