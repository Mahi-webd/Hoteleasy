-- =====================================================================
-- HotelEasy – Staff, rota, leave and attendance
--
--   * Staff list: everyone who works at the hotel, with or without an
--     app login (a login can be linked so they see "My shifts").
--     Pay rates sit in a separate table only managers and accountants
--     can read.
--   * Shift templates (Morning 06–14, …) and a weekly rota. Shifts are
--     written through functions that refuse double-booking a person and
--     scheduling someone on approved leave. Staff see a week only after
--     a manager publishes it.
--   * Leave requests (staff ask, managers approve or refuse).
--   * Clock in / out: staff with a login clock themselves; managers and
--     front desk can clock in those without one. Lateness is measured
--     against the shift.
--   * Hours report per person for payroll, with a pay estimate.
--
-- Run AFTER 20261112200000_expenses.sql.
-- =====================================================================

create or replace function public.rota_admin(_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_hotel_role_any(_hotel_id, array['owner', 'manager']);
$$;
create or replace function public.rota_clocker(_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_hotel_role_any(_hotel_id, array['owner', 'manager', 'front_desk']);
$$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references public.hotels(id) on delete cascade,
  full_name   text not null check (length(trim(full_name)) > 0),
  department  text not null default 'Front office',
  job_title   text,
  phone       text,
  employment  text not null default 'permanent' check (employment in ('permanent', 'contract', 'casual')),
  user_id     uuid references auth.users(id) on delete set null,
  active      boolean not null default true,
  started_on  date,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (hotel_id, user_id)
);

create table public.staff_pay (
  staff_id  uuid primary key references public.staff(id) on delete cascade,
  hotel_id  uuid not null references public.hotels(id) on delete cascade,
  pay_type  text not null check (pay_type in ('monthly', 'daily', 'hourly')),
  rate      numeric(12,2) not null check (rate >= 0)
);

create table public.shift_templates (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       uuid not null references public.hotels(id) on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  starts         time not null,
  ends           time not null,
  break_minutes  int not null default 0 check (break_minutes between 0 and 240),
  color          text not null default 'blue' check (color in ('blue', 'green', 'amber', 'purple', 'rose', 'slate')),
  sort           int not null default 0,
  unique (hotel_id, name)
);

create table public.shifts (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       uuid not null references public.hotels(id) on delete cascade,
  staff_id       uuid not null references public.staff(id) on delete cascade,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  break_minutes  int not null default 0 check (break_minutes between 0 and 240),
  template_id    uuid references public.shift_templates(id) on delete set null,
  department     text,
  note           text,
  published      boolean not null default false,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '16 hours')
);
create index on public.shifts (hotel_id, starts_at);
create index on public.shifts (staff_id, starts_at);

create table public.leave_requests (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references public.hotels(id) on delete cascade,
  staff_id    uuid not null references public.staff(id) on delete cascade,
  kind        text not null check (kind in ('annual', 'sick', 'maternity', 'paternity', 'compassionate', 'unpaid', 'off')),
  from_date   date not null,
  to_date     date not null,
  status      text not null default 'requested' check (status in ('requested', 'approved', 'refused', 'cancelled')),
  note        text,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  decided_by  uuid references auth.users(id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  check (to_date >= from_date and to_date - from_date <= 120)
);
create index on public.leave_requests (hotel_id, from_date);

create table public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references public.hotels(id) on delete cascade,
  staff_id    uuid not null references public.staff(id) on delete cascade,
  shift_id    uuid references public.shifts(id) on delete set null,
  clock_in    timestamptz not null,
  clock_out   timestamptz,
  source      text not null default 'self' check (source in ('self', 'supervisor')),
  note        text,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  edited_by   uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (clock_out is null or (clock_out > clock_in and clock_out - clock_in <= interval '20 hours'))
);
create unique index time_entries_one_open on public.time_entries (staff_id) where clock_out is null;
create index on public.time_entries (hotel_id, clock_in);

-- ---------------------------------------------------------------------
-- Checks on the staff tables
-- ---------------------------------------------------------------------
create or replace function public.staff_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'staff' then
    if new.user_id is not null and not exists (select 1 from hotel_members where hotel_id = new.hotel_id and user_id = new.user_id) then
      raise exception 'That login is not a member of this hotel';
    end if;
  elsif tg_table_name = 'staff_pay' then
    select hotel_id into new.hotel_id from staff where id = new.staff_id;
  elsif tg_table_name = 'leave_requests' then
    if not exists (select 1 from staff where id = new.staff_id and hotel_id = new.hotel_id) then raise exception 'Staff member not found'; end if;
    if tg_op = 'INSERT' and not rota_admin(new.hotel_id) then
      -- staff ask for themselves; the request starts as "requested"
      if not exists (select 1 from staff where id = new.staff_id and user_id = auth.uid()) then raise exception 'You can only ask for your own leave'; end if;
      new.status := 'requested'; new.decided_by := null; new.decided_at := null;
    end if;
    if tg_op = 'UPDATE' and not rota_admin(new.hotel_id) then
      if new.status <> 'cancelled' or old.status not in ('requested', 'approved')
         or (new.from_date, new.to_date, new.kind, new.staff_id) is distinct from (old.from_date, old.to_date, old.kind, old.staff_id) then
        raise exception 'You can only cancel your own request';
      end if;
    end if;
    if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved', 'refused') then
      new.decided_by := auth.uid(); new.decided_at := now();
    end if;
    if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
      -- shifts on approved leave days are taken off the rota
      delete from shifts sh where sh.staff_id = new.staff_id
         and (sh.starts_at at time zone (select timezone from hotels where id = new.hotel_id))::date between new.from_date and new.to_date;
      perform log_activity(new.hotel_id, 'staff', format('Leave approved: %s, %s to %s', (select full_name from staff where id = new.staff_id),
              to_char(new.from_date, 'DD Mon'), to_char(new.to_date, 'DD Mon')), new.id);
    end if;
  end if;
  return new;
end $$;
create trigger staff_guard before insert or update on public.staff for each row execute function public.staff_guard();
create trigger staff_pay_guard before insert or update on public.staff_pay for each row execute function public.staff_guard();
create trigger leave_guard before insert or update on public.leave_requests for each row execute function public.staff_guard();

-- ---------------------------------------------------------------------
-- Shifts: written only through these functions
-- ---------------------------------------------------------------------
create or replace function public.shift_save(_hotel_id uuid, _staff_id uuid, _date date, _starts time, _ends time,
  _break int default 0, _template_id uuid default null, _note text default null, _id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _tz text; _s timestamptz; _e timestamptz; _st staff; _clash text; _sid uuid;
begin
  if not rota_admin(_hotel_id) then raise exception 'Only owners and managers can change the rota'; end if;
  select * into _st from staff where id = _staff_id and hotel_id = _hotel_id;
  if not found then raise exception 'Staff member not found'; end if;
  if not _st.active then raise exception '% is no longer active', _st.full_name; end if;
  if _template_id is not null and not exists (select 1 from shift_templates where id = _template_id and hotel_id = _hotel_id) then
    raise exception 'Shift template not found';
  end if;
  select coalesce(timezone, 'Africa/Nairobi') into _tz from hotels where id = _hotel_id;
  _s := (_date + _starts) at time zone _tz;
  _e := (_date + _ends) at time zone _tz;
  if _e <= _s then _e := _e + interval '1 day'; end if;   -- night shifts end the next morning
  if exists (select 1 from leave_requests where staff_id = _staff_id and status = 'approved' and _date between from_date and to_date) then
    raise exception '% is on approved leave that day', _st.full_name;
  end if;
  select to_char(starts_at at time zone _tz, 'HH24:MI') || '–' || to_char(ends_at at time zone _tz, 'HH24:MI') into _clash
    from shifts where staff_id = _staff_id and id is distinct from _id and starts_at < _e and ends_at > _s limit 1;
  if _clash is not null then raise exception '% already has a shift %', _st.full_name, _clash; end if;
  if _id is null then
    insert into shifts (hotel_id, staff_id, starts_at, ends_at, break_minutes, template_id, department, note, created_by)
    values (_hotel_id, _staff_id, _s, _e, coalesce(_break, 0), _template_id, _st.department, nullif(trim(_note), ''), auth.uid())
    returning id into _sid;
  else
    update shifts set staff_id = _staff_id, starts_at = _s, ends_at = _e, break_minutes = coalesce(_break, 0), template_id = _template_id,
                      department = _st.department, note = nullif(trim(_note), '')
     where id = _id and hotel_id = _hotel_id returning id into _sid;
    if _sid is null then raise exception 'Shift not found'; end if;
  end if;
  return _sid;
end $$;

create or replace function public.shift_delete(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _h uuid;
begin
  select hotel_id into _h from shifts where id = _id;
  if _h is null or not rota_admin(_h) then raise exception 'Shift not found'; end if;
  delete from shifts where id = _id;
end $$;

create or replace function public.rota_publish(_hotel_id uuid, _from date, _to date)
returns int language plpgsql security definer set search_path = public as $$
declare _tz text; _n int;
begin
  if not rota_admin(_hotel_id) then raise exception 'Only owners and managers can publish the rota'; end if;
  select coalesce(timezone, 'Africa/Nairobi') into _tz from hotels where id = _hotel_id;
  update shifts set published = true
   where hotel_id = _hotel_id and not published and (starts_at at time zone _tz)::date between _from and _to;
  get diagnostics _n = row_count;
  perform log_activity(_hotel_id, 'staff', format('Rota published for %s – %s (%s new shifts)', to_char(_from, 'DD Mon'), to_char(_to, 'DD Mon'), _n), null);
  return _n;
end $$;

-- Copy a week's shifts 7 days forward, skipping anyone on leave or already busy.
create or replace function public.rota_copy_week(_hotel_id uuid, _from date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _tz text; _r record; _made int := 0; _skipped int := 0;
begin
  if not rota_admin(_hotel_id) then raise exception 'Only owners and managers can change the rota'; end if;
  select coalesce(timezone, 'Africa/Nairobi') into _tz from hotels where id = _hotel_id;
  for _r in
    select s.* from shifts s join staff st on st.id = s.staff_id
     where s.hotel_id = _hotel_id and st.active and (s.starts_at at time zone _tz)::date between _from and _from + 6
  loop
    if exists (select 1 from leave_requests where staff_id = _r.staff_id and status = 'approved'
                 and ((_r.starts_at at time zone _tz)::date + 7) between from_date and to_date)
       or exists (select 1 from shifts where staff_id = _r.staff_id and starts_at < _r.ends_at + interval '7 days' and ends_at > _r.starts_at + interval '7 days') then
      _skipped := _skipped + 1;
    else
      insert into shifts (hotel_id, staff_id, starts_at, ends_at, break_minutes, template_id, department, note, created_by)
      values (_hotel_id, _r.staff_id, _r.starts_at + interval '7 days', _r.ends_at + interval '7 days', _r.break_minutes, _r.template_id,
              _r.department, _r.note, auth.uid());
      _made := _made + 1;
    end if;
  end loop;
  return jsonb_build_object('copied', _made, 'skipped', _skipped);
end $$;

-- ---------------------------------------------------------------------
-- Clock in / out
-- ---------------------------------------------------------------------
create or replace function public.clock(_hotel_id uuid, _action text, _staff_id uuid default null, _note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _st staff; _open time_entries; _shift shifts; _late int; _id uuid; _src text;
begin
  if _staff_id is null then
    select * into _st from staff where hotel_id = _hotel_id and user_id = auth.uid() and active;
    if not found then raise exception 'Your login is not linked to a staff record. Ask a manager to link it.'; end if;
    _src := 'self';
  else
    if not rota_clocker(_hotel_id) then raise exception 'Only managers and front desk can clock in other staff'; end if;
    select * into _st from staff where id = _staff_id and hotel_id = _hotel_id and active;
    if not found then raise exception 'Staff member not found'; end if;
    _src := case when _st.user_id = auth.uid() then 'self' else 'supervisor' end;
  end if;
  select * into _open from time_entries where staff_id = _st.id and clock_out is null;
  if _action = 'in' then
    if found then raise exception '% is already clocked in since %', _st.full_name,
      to_char(_open.clock_in at time zone (select timezone from hotels where id = _hotel_id), 'HH24:MI'); end if;
    -- the shift that starts closest to now (from 3 hours before to 6 hours after)
    select * into _shift from shifts
     where staff_id = _st.id and starts_at between now() - interval '6 hours' and now() + interval '3 hours'
     order by abs(extract(epoch from starts_at - now())) limit 1;
    insert into time_entries (hotel_id, staff_id, shift_id, clock_in, source, note)
    values (_hotel_id, _st.id, _shift.id, now(), _src, nullif(trim(_note), '')) returning id into _id;
    _late := case when _shift.id is not null then greatest(0, floor(extract(epoch from now() - _shift.starts_at) / 60))::int end;
    return jsonb_build_object('id', _id, 'name', _st.full_name, 'action', 'in', 'late_minutes', _late, 'has_shift', _shift.id is not null);
  elsif _action = 'out' then
    if _open.id is null then raise exception '% is not clocked in', _st.full_name; end if;
    update time_entries set clock_out = greatest(now(), clock_in + interval '1 minute'),
                            note = coalesce(nullif(trim(_note), ''), note)
     where id = _open.id;
    return jsonb_build_object('id', _open.id, 'name', _st.full_name, 'action', 'out',
                              'hours', round(extract(epoch from now() - _open.clock_in) / 3600.0, 2));
  end if;
  raise exception 'Unknown action';
end $$;

-- Managers correct forgotten clock-outs and wrong times (with a note).
create or replace function public.time_entry_fix(_id uuid, _clock_in timestamptz, _clock_out timestamptz, _note text)
returns void language plpgsql security definer set search_path = public as $$
declare _e time_entries;
begin
  select * into _e from time_entries where id = _id;
  if not found or not rota_admin(_e.hotel_id) then raise exception 'Entry not found'; end if;
  if coalesce(trim(_note), '') = '' then raise exception 'Say why the time is being changed'; end if;
  update time_entries set clock_in = _clock_in, clock_out = _clock_out, edited_by = auth.uid(),
         note = trim(_note) where id = _id;
  perform log_activity(_e.hotel_id, 'staff', format('Clock times changed for %s: %s', (select full_name from staff where id = _e.staff_id), trim(_note)), _id);
end $$;

-- Team members who aren't on the staff list yet.
create or replace function public.staff_import_members(_hotel_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare _n int;
begin
  if not rota_admin(_hotel_id) then raise exception 'Only owners and managers can add staff'; end if;
  insert into staff (hotel_id, full_name, department, job_title, user_id, phone)
  select m.hotel_id, coalesce(nullif(trim(p.full_name), ''), split_part(u.email, '@', 1)),
         case m.role::text when 'housekeeping' then 'Housekeeping' when 'restaurant' then 'Restaurant & bar'
           when 'maintenance' then 'Maintenance' when 'accountant' then 'Accounts' when 'storekeeper' then 'Stores'
           when 'owner' then 'Management' when 'manager' then 'Management' else 'Front office' end,
         initcap(replace(m.role::text, '_', ' ')), m.user_id, p.phone
    from hotel_members m join auth.users u on u.id = m.user_id left join profiles p on p.id = m.user_id
   where m.hotel_id = _hotel_id and not exists (select 1 from staff s where s.hotel_id = _hotel_id and s.user_id = m.user_id);
  get diagnostics _n = row_count;
  return _n;
end $$;

create or replace function public.rota_defaults(_hotel_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into shift_templates (hotel_id, name, starts, ends, break_minutes, color, sort) values
    (_hotel_id, 'Morning', '06:00', '14:00', 30, 'amber', 1),
    (_hotel_id, 'Day', '08:00', '17:00', 60, 'green', 2),
    (_hotel_id, 'Evening', '14:00', '22:00', 30, 'blue', 3),
    (_hotel_id, 'Night', '22:00', '06:00', 30, 'purple', 4)
  on conflict (hotel_id, name) do nothing;
end $$;
revoke execute on function public.rota_defaults(uuid) from public, anon, authenticated;
select public.rota_defaults(id) from public.hotels;
create or replace function public.hotels_rota_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform rota_defaults(new.id); return new; end $$;
create trigger hotels_rota_defaults after insert on public.hotels for each row execute function public.hotels_rota_defaults();

-- ---------------------------------------------------------------------
-- Hours report
-- ---------------------------------------------------------------------
create or replace function public.staff_hours_report(_hotel_id uuid, _from date, _to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _tz text;
begin
  if not has_hotel_role_any(_hotel_id, array['owner', 'manager', 'accountant']) then
    raise exception 'Only owners, managers and accountants can see staff hours';
  end if;
  if _from is null or _to is null or _from > _to or _to - _from > 92 then raise exception 'Choose a period of up to three months'; end if;
  select coalesce(timezone, 'Africa/Nairobi') into _tz from hotels where id = _hotel_id;
  return (
    with sh as (
      select s.staff_id, count(*) n,
             sum(extract(epoch from s.ends_at - s.starts_at) / 3600.0 - s.break_minutes / 60.0) hours
        from shifts s where s.hotel_id = _hotel_id and (s.starts_at at time zone _tz)::date between _from and _to
       group by 1),
    te as (
      select t.staff_id, count(distinct (t.clock_in at time zone _tz)::date) days,
             sum(extract(epoch from coalesce(t.clock_out, t.clock_in) - t.clock_in) / 3600.0
                 - coalesce((select break_minutes from shifts where id = t.shift_id), 0) / 60.0 * (t.clock_out is not null)::int) hours,
             count(*) filter (where t.clock_out is null) open,
             count(*) filter (where t.shift_id is not null and t.clock_in > (select starts_at from shifts where id = t.shift_id) + interval '10 minutes') late
        from time_entries t where t.hotel_id = _hotel_id and (t.clock_in at time zone _tz)::date between _from and _to
       group by 1),
    absent as (
      select s.staff_id, count(*) n from shifts s
       where s.hotel_id = _hotel_id and s.published and s.ends_at < now() and (s.starts_at at time zone _tz)::date between _from and _to
         and not exists (select 1 from time_entries t where t.shift_id = s.id)
         and not exists (select 1 from time_entries t where t.staff_id = s.staff_id and t.clock_in < s.ends_at and coalesce(t.clock_out, now()) > s.starts_at)
       group by 1),
    lv as (
      select l.staff_id, sum(least(l.to_date, _to) - greatest(l.from_date, _from) + 1) days,
             sum(least(l.to_date, _to) - greatest(l.from_date, _from) + 1) filter (where l.kind = 'sick') sick
        from leave_requests l where l.hotel_id = _hotel_id and l.status = 'approved' and l.from_date <= _to and l.to_date >= _from
       group by 1)
    select coalesce(jsonb_agg(jsonb_build_object(
             'staff_id', st.id, 'name', st.full_name, 'department', st.department, 'employment', st.employment,
             'shifts', coalesce(sh.n, 0), 'scheduled_hours', round(coalesce(sh.hours, 0)::numeric, 2),
             'worked_days', coalesce(te.days, 0), 'worked_hours', round(greatest(coalesce(te.hours, 0), 0)::numeric, 2),
             'open', coalesce(te.open, 0), 'late', coalesce(te.late, 0), 'absent', coalesce(absent.n, 0),
             'leave_days', coalesce(lv.days, 0), 'sick_days', coalesce(lv.sick, 0),
             'overtime_hours', round(greatest(coalesce(te.hours, 0) - coalesce(sh.hours, 0), 0)::numeric, 2),
             'pay_type', p.pay_type, 'rate', p.rate,
             'pay_estimate', case p.pay_type
                when 'daily' then round(coalesce(te.days, 0) * p.rate, 2)
                when 'hourly' then round(greatest(coalesce(te.hours, 0), 0)::numeric * p.rate, 2)
                when 'monthly' then round(p.rate * ((_to - _from + 1) / 30.0), 2) end)
           order by st.department, st.full_name), '[]'::jsonb)
      from staff st
      left join sh on sh.staff_id = st.id left join te on te.staff_id = st.id left join absent on absent.staff_id = st.id
      left join lv on lv.staff_id = st.id left join staff_pay p on p.staff_id = st.id
     where st.hotel_id = _hotel_id and (st.active or sh.n is not null or te.days is not null));
end $$;

-- ---------------------------------------------------------------------
-- Security
-- ---------------------------------------------------------------------
alter table public.staff enable row level security;
alter table public.staff_pay enable row level security;
alter table public.shift_templates enable row level security;
alter table public.shifts enable row level security;
alter table public.leave_requests enable row level security;
alter table public.time_entries enable row level security;
revoke all on public.staff, public.staff_pay, public.shift_templates, public.shifts, public.leave_requests, public.time_entries from anon;

-- the team list and the published rota are visible to everyone in the hotel
create policy staff_sel on public.staff for select to authenticated using (public.is_hotel_member(hotel_id));
create policy staff_w on public.staff for all to authenticated using (public.rota_admin(hotel_id)) with check (public.rota_admin(hotel_id));
create policy pay_sel on public.staff_pay for select to authenticated using (public.has_hotel_role_any(hotel_id, array['owner','manager','accountant']));
create policy pay_w on public.staff_pay for all to authenticated
  using (exists (select 1 from public.staff s where s.id = staff_id and public.rota_admin(s.hotel_id)))
  with check (exists (select 1 from public.staff s where s.id = staff_id and public.rota_admin(s.hotel_id)));
create policy tpl_sel on public.shift_templates for select to authenticated using (public.is_hotel_member(hotel_id));
create policy tpl_w on public.shift_templates for all to authenticated using (public.rota_admin(hotel_id)) with check (public.rota_admin(hotel_id));
create policy shifts_sel on public.shifts for select to authenticated
  using (public.rota_admin(hotel_id) or (published and public.is_hotel_member(hotel_id)));
create policy leave_sel on public.leave_requests for select to authenticated
  using (public.rota_admin(hotel_id) or exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid())
         or (status = 'approved' and public.is_hotel_member(hotel_id)));
create policy leave_ins on public.leave_requests for insert to authenticated with check (public.is_hotel_member(hotel_id));
create policy leave_upd on public.leave_requests for update to authenticated
  using (public.rota_admin(hotel_id) or exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()))
  with check (public.rota_admin(hotel_id) or exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()));
create policy te_sel on public.time_entries for select to authenticated
  using (public.rota_clocker(hotel_id) or public.has_hotel_role_any(hotel_id, array['accountant'])
         or exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()));
-- shifts and time entries are written only by the functions above

do $$
declare f text;
begin
  foreach f in array array['rota_admin(uuid)', 'rota_clocker(uuid)',
    'shift_save(uuid, uuid, date, time without time zone, time without time zone, integer, uuid, text, uuid)', 'shift_delete(uuid)',
    'rota_publish(uuid, date, date)', 'rota_copy_week(uuid, date)', 'clock(uuid, text, uuid, text)',
    'time_entry_fix(uuid, timestamp with time zone, timestamp with time zone, text)', 'staff_import_members(uuid)',
    'staff_hours_report(uuid, date, date)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.time_entries;
  end if;
end $$;
