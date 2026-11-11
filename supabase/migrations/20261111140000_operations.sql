-- =====================================================================
-- HotelEasy phase 4: housekeeping and maintenance
--
-- * Cleaning tasks are created automatically when a room becomes dirty
--   (e.g. at check-out). Starting a task marks the room "cleaning";
--   finishing it makes the room available again.
-- * Maintenance tickets can take a room out of service. While a blocking
--   ticket is open the room stays in "maintenance" and cannot be sold or
--   checked into. Resolving the ticket sends the room to cleaning.
-- * New staff role: maintenance (technician).
--
-- Run AFTER 20261111120000_billing.sql.
-- =====================================================================

alter type public.hotel_role add value if not exists 'maintenance';

-- Text-based role check, so this script can use the new 'maintenance'
-- role in the same transaction that adds it.
create or replace function public.has_hotel_role_any(_hotel_id uuid, _roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hotel_members
    where hotel_id = _hotel_id and user_id = auth.uid() and role::text = any(_roles)
  );
$$;

-- ---------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------
create type public.hk_task_type as enum ('checkout_clean', 'stayover_clean', 'deep_clean', 'turndown', 'inspection');
create type public.hk_status    as enum ('pending', 'in_progress', 'done', 'cancelled');
create type public.priority     as enum ('low', 'normal', 'high', 'urgent');

create table public.housekeeping_tasks (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       uuid not null references public.hotels(id) on delete cascade,
  room_id        uuid not null references public.rooms(id) on delete cascade,
  task_type      public.hk_task_type not null default 'checkout_clean',
  status         public.hk_status not null default 'pending',
  priority       public.priority not null default 'normal',
  due_date       date not null default current_date,
  assigned_to    uuid references auth.users(id) on delete set null,
  notes          text,
  created_by     uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  completed_at   timestamptz,
  completed_by   uuid references auth.users(id) on delete set null,
  updated_at     timestamptz not null default now()
);
create index on public.housekeeping_tasks (hotel_id, status, due_date);
create index on public.housekeeping_tasks (room_id, status);
-- one open task of each type per room
create unique index hk_one_open_per_room_type
  on public.housekeeping_tasks (room_id, task_type) where status in ('pending', 'in_progress');

create trigger t_hk_upd before update on public.housekeeping_tasks
  for each row execute function public.touch_updated_at();

create or replace function public.check_hk_task()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from rooms where id = new.room_id and hotel_id = new.hotel_id) then
    raise exception 'Room does not belong to this hotel';
  end if;
  if new.assigned_to is not null and not exists (
    select 1 from hotel_members where hotel_id = new.hotel_id and user_id = new.assigned_to) then
    raise exception 'That person is not on this hotel''s team';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'in_progress' and new.started_at is null then new.started_at := now(); end if;
    if new.status = 'done' then
      new.completed_at := coalesce(new.completed_at, now());
      new.completed_by := coalesce(new.completed_by, auth.uid());
    end if;
    if new.status = 'pending' then new.started_at := null; new.completed_at := null; new.completed_by := null; end if;
  end if;
  return new;
end $$;
create trigger hk_check before insert or update on public.housekeeping_tasks
  for each row execute function public.check_hk_task();

-- Task progress drives room status (only for rooms nobody is staying in).
create or replace function public.hk_task_room_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare _room rooms; _num text;
begin
  if new.status is not distinct from old.status then return new; end if;
  select * into _room from rooms where id = new.room_id;
  _num := _room.room_number;
  if new.task_type in ('checkout_clean', 'deep_clean') and _room.status not in ('occupied', 'maintenance', 'out_of_order') then
    if new.status = 'in_progress' then
      update rooms set status = 'cleaning' where id = new.room_id and status <> 'cleaning';
    elsif new.status = 'done' then
      -- other open cleaning task on the same room keeps it out of sale
      if not exists (select 1 from housekeeping_tasks
                     where room_id = new.room_id and id <> new.id and status in ('pending','in_progress')
                       and task_type in ('checkout_clean','deep_clean')) then
        update rooms set status = 'available' where id = new.room_id and status <> 'available';
      end if;
    elsif new.status = 'pending' and old.status = 'in_progress' then
      update rooms set status = 'dirty' where id = new.room_id and status = 'cleaning';
    end if;
  end if;
  if new.status = 'done' then
    perform log_activity(new.hotel_id, 'housekeeping',
      format('Room %s %s', _num, case new.task_type when 'checkout_clean' then 'cleaned and ready'
                                                     when 'stayover_clean' then 'serviced'
                                                     when 'deep_clean' then 'deep cleaned'
                                                     when 'turndown' then 'turndown done'
                                                     else 'inspected' end), new.room_id);
  end if;
  return new;
end $$;
create trigger hk_room_status after update of status on public.housekeeping_tasks
  for each row execute function public.hk_task_room_status();

-- ---------------------------------------------------------------------
-- Maintenance
-- ---------------------------------------------------------------------
create type public.mt_category as enum
  ('plumbing', 'electrical', 'air_con', 'furniture', 'appliance', 'internet_tv', 'locks_keys', 'painting', 'pest', 'other');
create type public.mt_status as enum ('open', 'in_progress', 'on_hold', 'resolved', 'cancelled');

create table public.maintenance_tickets (
  id                 uuid primary key default gen_random_uuid(),
  hotel_id           uuid not null references public.hotels(id) on delete cascade,
  number             int not null,
  room_id            uuid references public.rooms(id) on delete set null,
  location           text,          -- for places that aren't rooms: Kitchen, Pool, Lobby…
  title              text not null check (length(trim(title)) > 0),
  description        text,
  category           public.mt_category not null default 'other',
  priority           public.priority not null default 'normal',
  status             public.mt_status not null default 'open',
  blocks_room        boolean not null default false,  -- take the room out of service
  assigned_to        uuid references auth.users(id) on delete set null,
  reported_by        uuid references auth.users(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  resolved_at        timestamptz,
  resolved_by        uuid references auth.users(id) on delete set null,
  resolution_notes   text,
  cost               numeric(12,2) check (cost is null or cost >= 0),
  constraint mt_where check (room_id is not null or length(trim(coalesce(location, ''))) > 0),
  constraint mt_block_needs_room check (not blocks_room or room_id is not null),
  unique (hotel_id, number)
);
create index on public.maintenance_tickets (hotel_id, status);
create index on public.maintenance_tickets (room_id) where status in ('open', 'in_progress', 'on_hold');
create trigger t_mt_upd before update on public.maintenance_tickets
  for each row execute function public.touch_updated_at();

create or replace function public.check_mt_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('mt-' || new.hotel_id::text));
    new.number := coalesce((select max(number) from maintenance_tickets where hotel_id = new.hotel_id), 0) + 1;
  end if;
  if new.room_id is not null and not exists (select 1 from rooms where id = new.room_id and hotel_id = new.hotel_id) then
    raise exception 'Room does not belong to this hotel';
  end if;
  if new.assigned_to is not null and not exists (
    select 1 from hotel_members where hotel_id = new.hotel_id and user_id = new.assigned_to) then
    raise exception 'That person is not on this hotel''s team';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'resolved' then
      new.resolved_at := now(); new.resolved_by := auth.uid();
    elsif old.status = 'resolved' then
      new.resolved_at := null; new.resolved_by := null;
    end if;
  end if;
  return new;
end $$;
create trigger mt_check before insert or update on public.maintenance_tickets
  for each row execute function public.check_mt_ticket();

create or replace function public.room_has_blocking_ticket(_room_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from maintenance_tickets
                 where room_id = _room_id and blocks_room and status in ('open', 'in_progress', 'on_hold'));
$$;

-- Ticket changes drive the room's status.
create or replace function public.mt_ticket_room_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare _num text; _active boolean; _was_active boolean;
begin
  _active := new.blocks_room and new.status in ('open', 'in_progress', 'on_hold');
  _was_active := tg_op = 'UPDATE' and old.blocks_room and old.status in ('open', 'in_progress', 'on_hold')
                 and old.room_id is not distinct from new.room_id;
  select room_number into _num from rooms where id = new.room_id;

  if _active then
    -- occupied rooms switch to maintenance when the guest leaves (see rooms trigger)
    update rooms set status = 'maintenance'
     where id = new.room_id and status in ('available', 'dirty', 'cleaning');
  elsif _was_active and not room_has_blocking_ticket(new.room_id) then
    update rooms set status = 'dirty' where id = new.room_id and status = 'maintenance';
  end if;

  if tg_op = 'INSERT' then
    perform log_activity(new.hotel_id, 'maintenance',
      format('Issue #%s reported: %s%s', new.number, new.title,
             coalesce(' (room ' || _num || ')', ' (' || new.location || ')', '')), new.id);
  elsif new.status is distinct from old.status and new.status in ('resolved', 'cancelled') then
    perform log_activity(new.hotel_id, 'maintenance',
      format('Issue #%s %s: %s', new.number, new.status, new.title), new.id);
  end if;
  return new;
end $$;
create trigger mt_room_status after insert or update of status, blocks_room, room_id on public.maintenance_tickets
  for each row execute function public.mt_ticket_room_status();

-- ---------------------------------------------------------------------
-- Room status changes create cleaning tasks / respect maintenance holds
-- ---------------------------------------------------------------------
create or replace function public.rooms_guard_maintenance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('available', 'dirty', 'cleaning') and new.status is distinct from old.status
     and room_has_blocking_ticket(new.id) then
    new.status := 'maintenance';
  end if;
  return new;
end $$;
create trigger rooms_guard_maintenance before update of status on public.rooms
  for each row execute function public.rooms_guard_maintenance();

create or replace function public.rooms_housekeeping()
returns trigger language plpgsql security definer set search_path = public as $$
declare _arrival boolean;
begin
  if new.status = old.status then return new; end if;

  if new.status = 'dirty' then
    select exists (select 1 from reservations
                   where room_id = new.id and status = 'confirmed'
                     and check_in <= (now() at time zone (select timezone from hotels where id = new.hotel_id))::date)
      into _arrival;
    insert into housekeeping_tasks (hotel_id, room_id, task_type, priority, due_date, notes)
    values (new.hotel_id, new.id, 'checkout_clean',
            case when _arrival then 'urgent'::priority else 'normal'::priority end,
            (now() at time zone (select timezone from hotels where id = new.hotel_id))::date,
            case when _arrival then 'Guest arriving today' end)
    on conflict (room_id, task_type) where status in ('pending', 'in_progress') do nothing;
  elsif new.status = 'available' then
    -- room declared ready by hand: close open cleaning tasks
    update housekeeping_tasks set status = 'done', notes = coalesce(notes || ' · ', '') || 'Room marked available'
     where room_id = new.id and status in ('pending', 'in_progress') and task_type in ('checkout_clean', 'deep_clean');
  end if;
  return new;
end $$;
create trigger rooms_housekeeping after update of status on public.rooms
  for each row execute function public.rooms_housekeeping();

-- A room that's booked for arrival today gets its open cleaning task bumped.
create or replace function public.reservations_bump_cleaning()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.room_id is not null and new.status = 'confirmed'
     and new.check_in <= (now() at time zone (select timezone from hotels where id = new.hotel_id))::date then
    update housekeeping_tasks set priority = 'urgent', notes = coalesce(notes, 'Guest arriving today')
     where room_id = new.room_id and status in ('pending', 'in_progress') and priority <> 'urgent';
  end if;
  return new;
end $$;
create trigger reservations_bump_cleaning after insert or update of room_id, check_in on public.reservations
  for each row execute function public.reservations_bump_cleaning();

-- Daily service for occupied rooms
create or replace function public.create_stayover_tasks(_hotel_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare _n int; _today date;
begin
  if not has_hotel_role_any(_hotel_id, array['owner','manager','front_desk','housekeeping']) then
    raise exception 'You do not have permission to create housekeeping tasks';
  end if;
  _today := (now() at time zone (select timezone from hotels where id = _hotel_id))::date;
  insert into housekeeping_tasks (hotel_id, room_id, task_type, due_date)
  select r.hotel_id, r.id, 'stayover_clean', _today
  from rooms r
  where r.hotel_id = _hotel_id and r.status = 'occupied'
    and exists (select 1 from reservations x where x.room_id = r.id and x.status = 'checked_in' and x.check_out > _today)
  on conflict (room_id, task_type) where status in ('pending', 'in_progress') do nothing;
  get diagnostics _n = row_count;
  return _n;
end $$;

-- Close stayover tasks when the guest checks out (the checkout clean replaces them)
create or replace function public.reservations_close_stayover()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'checked_out' and old.status = 'checked_in' then
    update housekeeping_tasks set status = 'cancelled', notes = coalesce(notes || ' · ', '') || 'Guest checked out'
     where room_id = new.room_id and status = 'pending' and task_type in ('stayover_clean', 'turndown');
  end if;
  return new;
end $$;
create trigger reservations_close_stayover after update of status on public.reservations
  for each row execute function public.reservations_close_stayover();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.housekeeping_tasks  enable row level security;
alter table public.maintenance_tickets enable row level security;
revoke all on public.housekeeping_tasks, public.maintenance_tickets from anon;

-- Housekeeping: housekeepers, front office and managers
create policy hk_select on public.housekeeping_tasks for select to authenticated
  using (public.has_hotel_role_any(hotel_id, array['owner','manager','front_desk','housekeeping']));
create policy hk_insert on public.housekeeping_tasks for insert to authenticated
  with check (public.has_hotel_role_any(hotel_id, array['owner','manager','front_desk','housekeeping']));
create policy hk_update on public.housekeeping_tasks for update to authenticated
  using (public.has_hotel_role_any(hotel_id, array['owner','manager','front_desk','housekeeping']))
  with check (public.has_hotel_role_any(hotel_id, array['owner','manager','front_desk','housekeeping']));
-- no delete: cancel instead

-- Maintenance: anyone on the team can report and see issues;
-- managers, technicians and the assignee can work on them.
create policy mt_select on public.maintenance_tickets for select to authenticated
  using (public.is_hotel_member(hotel_id));
create policy mt_insert on public.maintenance_tickets for insert to authenticated
  with check (public.is_hotel_member(hotel_id) and reported_by = auth.uid()
              and (status = 'open'));
create policy mt_update on public.maintenance_tickets for update to authenticated
  using (public.has_hotel_role_any(hotel_id, array['owner','manager','maintenance','front_desk']) or assigned_to = auth.uid())
  with check (public.has_hotel_role_any(hotel_id, array['owner','manager','maintenance','front_desk']) or assigned_to = auth.uid());

-- Technicians need to change a room's status? No: the triggers do it.
-- They also need to see rooms (already allowed for every member).

revoke execute on function public.create_stayover_tasks(uuid) from public, anon;
grant execute on function public.create_stayover_tasks(uuid) to authenticated;
revoke execute on function public.has_hotel_role_any(uuid, text[]) from public, anon;
grant execute on function public.has_hotel_role_any(uuid, text[]) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.housekeeping_tasks, public.maintenance_tickets;
  end if;
end $$;

-- Rooms already dirty when this runs get a cleaning task now.
insert into public.housekeeping_tasks (hotel_id, room_id, task_type, created_by)
select hotel_id, id, 'checkout_clean', null from public.rooms where status in ('dirty', 'cleaning')
on conflict (room_id, task_type) where status in ('pending', 'in_progress') do nothing;
