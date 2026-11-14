-- Custom roles & permissions (role-based access control).
-- The 8 built-in roles keep working exactly as before. An owner can also make custom roles: a name, a job type
-- (used for alerts and task lists) and a set of permissions from permission_catalog. Every role check in the
-- database now names the permission it protects, so a custom role gets exactly what is ticked.

create table if not exists public.permission_catalog (
  key text primary key,
  module text not null,
  module_label text not null,
  action text not null,
  label text not null,
  sort int not null,
  default_roles text[] not null
);
alter table public.permission_catalog enable row level security;
drop policy if exists pcat_sel on public.permission_catalog;
create policy pcat_sel on public.permission_catalog for select to authenticated using (true);
grant select on public.permission_catalog to authenticated;

create table if not exists public.hotel_roles (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 60),
  description text,
  base_role public.hotel_role not null check (base_role <> 'owner'),
  permissions text[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists hotel_roles_name on public.hotel_roles (hotel_id, lower(btrim(name)));
alter table public.hotel_roles enable row level security;
drop policy if exists hr_sel on public.hotel_roles;
create policy hr_sel on public.hotel_roles for select to authenticated using (public.is_hotel_member(hotel_id));
grant select on public.hotel_roles to authenticated;

alter table public.hotel_members add column if not exists custom_role_id uuid references public.hotel_roles(id) on delete restrict;
alter table public.hotel_invitations add column if not exists custom_role_id uuid references public.hotel_roles(id) on delete cascade;
create index if not exists hotel_members_custom_role on public.hotel_members (custom_role_id) where custom_role_id is not null;
do $$ begin
  alter table public.hotel_members add constraint hotel_members_owner_not_custom check (custom_role_id is null or role <> 'owner');
exception when duplicate_object then null; end $$;

-- ---------- role checks ----------
-- Old two-argument checks: built-in roles only (a custom role never passes a check that does not name a permission).
create or replace function public.has_hotel_role(_hotel_id uuid, _roles public.hotel_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hotel_members
    where hotel_id = _hotel_id and user_id = auth.uid() and custom_role_id is null and role = any(_roles));
$$;
create or replace function public.has_hotel_role_any(_hotel_id uuid, _roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hotel_members
    where hotel_id = _hotel_id and user_id = auth.uid() and custom_role_id is null and role::text = any(_roles));
$$;
-- New: built-in roles as before; custom roles by permission. _perm may list alternatives: 'rooms.status|rooms.edit'.
create or replace function public.has_hotel_role(_hotel_id uuid, _roles public.hotel_role[], _perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hotel_members m left join public.hotel_roles r on r.id = m.custom_role_id
    where m.hotel_id = _hotel_id and m.user_id = auth.uid()
      and case when m.custom_role_id is null then m.role = any(_roles)
               else coalesce(r.permissions && string_to_array(_perm, '|'), false) end);
$$;
create or replace function public.has_hotel_role_any(_hotel_id uuid, _roles text[], _perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hotel_members m left join public.hotel_roles r on r.id = m.custom_role_id
    where m.hotel_id = _hotel_id and m.user_id = auth.uid()
      and case when m.custom_role_id is null then m.role::text = any(_roles)
               else coalesce(r.permissions && string_to_array(_perm, '|'), false) end);
$$;
-- Does the current user have this permission? (owner: everything)
create or replace function public.has_perm(_hotel_id uuid, _perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hotel_members m left join public.hotel_roles r on r.id = m.custom_role_id
    where m.hotel_id = _hotel_id and m.user_id = auth.uid()
      and case when m.role = 'owner' then true
               when m.custom_role_id is not null then coalesce(r.permissions && string_to_array(_perm, '|'), false)
               else exists (select 1 from public.permission_catalog c where c.key = any(string_to_array(_perm, '|')) and m.role::text = any(c.default_roles)) end);
$$;
grant execute on function public.has_hotel_role(uuid, public.hotel_role[], text), public.has_hotel_role_any(uuid, text[], text), public.has_perm(uuid, text) to authenticated, anon;

-- ---------- the permission list ----------
delete from public.permission_catalog;
insert into public.permission_catalog (key, module, module_label, action, label, sort, default_roles) values
  ('dashboard.view','dashboard','Dashboard','view','See the dashboard',1,array['owner','manager','front_desk','housekeeping','restaurant','accountant','maintenance','storekeeper']),
  ('reservations.view','reservations','Reservations','view','See bookings and the calendar',2,array['owner','manager','front_desk','housekeeping','restaurant','accountant','maintenance','storekeeper']),
  ('reservations.create','reservations','Reservations','create','Make bookings',3,array['owner','manager','front_desk']),
  ('reservations.edit','reservations','Reservations','edit','Change bookings, check guests in and out',4,array['owner','manager','front_desk']),
  ('reservations.delete','reservations','Reservations','delete','Cancel bookings and mark no-shows',5,array['owner','manager','front_desk']),
  ('precheck.view','precheck','Online check-in','view','See online check-in forms',6,array['owner','manager','front_desk']),
  ('precheck.edit','precheck','Online check-in','edit','Send links and accept forms',7,array['owner','manager','front_desk']),
  ('requests.view','requests','Guest requests','view','See guest requests',8,array['owner','manager','front_desk','housekeeping','maintenance','restaurant']),
  ('requests.edit','requests','Guest requests','edit','Answer and log requests',9,array['owner','manager','front_desk','housekeeping','maintenance','restaurant']),
  ('requests.settings','requests','Guest requests','settings','Request types and room QR codes',10,array['owner','manager']),
  ('audit.view','audit','Night audit','view','See day checks and manager''s reports',11,array['owner','manager','front_desk','accountant']),
  ('audit.create','audit','Night audit','create','Close the day',12,array['owner','manager','front_desk']),
  ('audit.delete','audit','Night audit','delete','Reopen a closed day',13,array['owner','manager']),
  ('rates.view','rates','Rates & seasons','view','See prices, seasons and meal plans',14,array['owner','manager','front_desk','accountant']),
  ('rates.edit','rates','Rates & seasons','edit','Change prices, seasons and meal plans',15,array['owner','manager']),
  ('rooms.view','rooms','Rooms','view','See rooms',16,array['owner','manager','front_desk','housekeeping','restaurant','accountant','maintenance','storekeeper']),
  ('rooms.status','rooms','Rooms','status','Change room status (clean, dirty, out of order)',17,array['owner','manager','front_desk','housekeeping']),
  ('rooms.create','rooms','Rooms','create','Add rooms and room types',18,array['owner','manager']),
  ('rooms.edit','rooms','Rooms','edit','Edit rooms and room types',19,array['owner','manager']),
  ('rooms.delete','rooms','Rooms','delete','Delete rooms',20,array['owner','manager']),
  ('guests.view','guests','Guests','view','See guest profiles',21,array['owner','manager','front_desk','accountant','restaurant']),
  ('guests.create','guests','Guests','create','Add guests',22,array['owner','manager','front_desk']),
  ('guests.edit','guests','Guests','edit','Edit guest profiles',23,array['owner','manager','front_desk']),
  ('guests.delete','guests','Guests','delete','Delete guests',24,array['owner','manager']),
  ('billing.view','billing','Billing & payments','view','See bills, payments and invoices',25,array['owner','manager','front_desk','accountant']),
  ('billing.create','billing','Billing & payments','create','Add charges, take payments, issue invoices',26,array['owner','manager','front_desk','accountant']),
  ('billing.void','billing','Billing & payments','void','Void any charge or payment',27,array['owner','manager','accountant']),
  ('companies.view','companies','Company accounts','view','See companies and their rates',28,array['owner','manager','front_desk','accountant']),
  ('companies.ledger','companies','Company accounts','ledger','See company balances and statements',29,array['owner','manager','accountant']),
  ('companies.edit','companies','Company accounts','edit','Add companies and rates, ledger entries, go over credit limits',30,array['owner','manager','accountant']),
  ('online.view','online','Online booking & reviews','view','See online bookings, reviews and sent emails',31,array['owner','manager','front_desk','accountant']),
  ('online.reply','online','Online booking & reviews','reply','Reply to reviews, send feedback links, resend emails',32,array['owner','manager','front_desk']),
  ('online.edit','online','Online booking & reviews','edit','Booking page and email settings',33,array['owner','manager']),
  ('pos.view','pos','Restaurant & bar POS','view','See orders and bills',34,array['owner','manager','front_desk','restaurant','accountant']),
  ('pos.create','pos','Restaurant & bar POS','create','Take orders and payments, run own cash shift',35,array['owner','manager','front_desk','restaurant']),
  ('pos.admin','pos','Restaurant & bar POS','admin','Menu and tables, voids and discounts, approve with PIN',36,array['owner','manager']),
  ('pos.shifts','pos','Restaurant & bar POS','shifts','See everyone''s cash shifts',37,array['owner','manager','accountant']),
  ('kds.view','kds','Kitchen & bar screen','view','Use the kitchen and bar screen',38,array['owner','manager','front_desk','restaurant']),
  ('owner.view','owner','Owner overview','view','See the owner overview',39,array['owner','manager','accountant']),
  ('reports.view','reports','Reports','view','See reports',40,array['owner','manager','accountant']),
  ('finance.view','finance','Expenses & profit','view','See expenses and profit',41,array['owner','manager','accountant']),
  ('finance.edit','finance','Expenses & profit','edit','Add and edit expenses',42,array['owner','manager','accountant']),
  ('finance.admin','finance','Expenses & profit','admin','Approve expenses, categories and budget',43,array['owner','manager']),
  ('housekeeping.view','housekeeping','Housekeeping','view','See cleaning tasks',44,array['owner','manager','front_desk','housekeeping']),
  ('housekeeping.edit','housekeeping','Housekeeping','edit','Create, assign and complete tasks',45,array['owner','manager','front_desk','housekeeping']),
  ('maintenance.view','maintenance','Maintenance','view','See and report problems',46,array['owner','manager','front_desk','housekeeping','restaurant','accountant','maintenance','storekeeper']),
  ('maintenance.edit','maintenance','Maintenance','edit','Assign and update tickets',47,array['owner','manager','maintenance','front_desk']),
  ('inventory.view','inventory','Inventory','view','See stock',48,array['owner','manager','accountant','storekeeper','restaurant']),
  ('inventory.waste','inventory','Inventory','waste','Record waste',49,array['owner','manager','storekeeper','restaurant']),
  ('inventory.edit','inventory','Inventory','edit','Stock moves, receiving, counts, suppliers and orders',50,array['owner','manager','storekeeper']),
  ('inventory.admin','inventory','Inventory','admin','Approve orders, recipes and store locations',51,array['owner','manager']),
  ('staff.view','staff','Staff & rota','view','See staff and the rota',52,array['owner','manager','front_desk','accountant']),
  ('staff.clock','staff','Staff & rota','clock','Clock staff in and out',53,array['owner','manager','front_desk']),
  ('staff.edit','staff','Staff & rota','edit','Staff list, rota and leave',54,array['owner','manager']),
  ('payroll.view','payroll','Payroll','view','See pay rates, payroll and payslips',55,array['owner','manager','accountant']),
  ('payroll.edit','payroll','Payroll','edit','Run and approve payroll',56,array['owner','manager','accountant']),
  ('payroll.rates','payroll','Payroll','rates','Statutory rates (PAYE, NSSF, SHIF)',57,array['owner']),
  ('settings.view','settings','Settings','view','See hotel settings',58,array['owner','manager','front_desk','housekeeping','restaurant','accountant','maintenance','storekeeper']),
  ('settings.edit','settings','Settings','edit','Hotel details, tax and bill settings',59,array['owner','manager']),
  ('team.invite','team','Team','invite','Invite people and cancel invitations',60,array['owner','manager']);

-- ---------- area helpers: built-in roles as before, custom roles by permission ----------
create or replace function public.pos_viewer(_hotel_id uuid, _perm text) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_hotel_role_any(_hotel_id, array['owner','manager','front_desk','restaurant','accountant'], _perm); $$;
create or replace function public.pos_viewer(_hotel_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.pos_viewer(_hotel_id, 'pos.view'); $$;
grant execute on function public.pos_viewer(uuid, text) to authenticated;
create or replace function public.pos_staff(_hotel_id uuid, _perm text) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_hotel_role_any(_hotel_id, array['owner','manager','front_desk','restaurant'], _perm); $$;
create or replace function public.pos_staff(_hotel_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.pos_staff(_hotel_id, 'pos.create'); $$;
grant execute on function public.pos_staff(uuid, text) to authenticated;
create or replace function public.pos_admin(_hotel_id uuid, _perm text) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_hotel_role_any(_hotel_id, array['owner','manager'], _perm); $$;
create or replace function public.pos_admin(_hotel_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.pos_admin(_hotel_id, 'pos.admin'); $$;
grant execute on function public.pos_admin(uuid, text) to authenticated;
create or replace function public.inv_viewer(_hotel_id uuid, _perm text) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_hotel_role_any(_hotel_id, array['owner','manager','accountant','storekeeper','restaurant'], _perm); $$;
create or replace function public.inv_viewer(_hotel_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.inv_viewer(_hotel_id, 'inventory.view'); $$;
grant execute on function public.inv_viewer(uuid, text) to authenticated;
create or replace function public.inv_staff(_hotel_id uuid, _perm text) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_hotel_role_any(_hotel_id, array['owner','manager','storekeeper'], _perm); $$;
create or replace function public.inv_staff(_hotel_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.inv_staff(_hotel_id, 'inventory.edit'); $$;
grant execute on function public.inv_staff(uuid, text) to authenticated;
create or replace function public.inv_admin(_hotel_id uuid, _perm text) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_hotel_role_any(_hotel_id, array['owner','manager'], _perm); $$;
create or replace function public.inv_admin(_hotel_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.inv_admin(_hotel_id, 'inventory.admin'); $$;
grant execute on function public.inv_admin(uuid, text) to authenticated;
create or replace function public.rota_admin(_hotel_id uuid, _perm text) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_hotel_role_any(_hotel_id, array['owner','manager'], _perm); $$;
create or replace function public.rota_admin(_hotel_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.rota_admin(_hotel_id, 'staff.edit'); $$;
grant execute on function public.rota_admin(uuid, text) to authenticated;
create or replace function public.rota_clocker(_hotel_id uuid, _perm text) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_hotel_role_any(_hotel_id, array['owner','manager','front_desk'], _perm); $$;
create or replace function public.rota_clocker(_hotel_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.rota_clocker(_hotel_id, 'staff.clock'); $$;
grant execute on function public.rota_clocker(uuid, text) to authenticated;
create or replace function public.payroll_staff(_hotel_id uuid, _perm text) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_hotel_role_any(_hotel_id, array['owner','manager','accountant'], _perm); $$;
create or replace function public.payroll_staff(_hotel_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.payroll_staff(_hotel_id, 'payroll.view'); $$;
grant execute on function public.payroll_staff(uuid, text) to authenticated;
create or replace function public.fin_staff(_hotel_id uuid, _perm text) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_hotel_role_any(_hotel_id, array['owner','manager','accountant'], _perm); $$;
create or replace function public.fin_staff(_hotel_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.fin_staff(_hotel_id, 'finance.view'); $$;
grant execute on function public.fin_staff(uuid, text) to authenticated;

-- ---------- request routing, PIN approvers, owner overview ----------
create or replace function public.request_staff(_hotel_id uuid, _department text, _perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select has_hotel_role_any(_hotel_id, array['owner','manager','front_desk'], _perm)
      or (_department = 'housekeeping' and has_hotel_role_any(_hotel_id, array['housekeeping'], _perm))
      or (_department = 'maintenance' and has_hotel_role_any(_hotel_id, array['maintenance'], _perm))
      or (_department = 'restaurant' and has_hotel_role_any(_hotel_id, array['restaurant'], _perm));
$$;
create or replace function public.request_staff(_hotel_id uuid, _department text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.request_staff(_hotel_id, _department, 'requests.edit');
$$;
grant execute on function public.request_staff(uuid, text, text) to authenticated;

-- Whose PIN can approve voids and discounts: owners, managers, and custom roles with pos.admin.
create or replace function public.approve_with_pin(_hotel_id uuid, _pin text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare _mgr uuid;
begin
  if (select count(*) from pin_attempts where user_id = auth.uid() and not ok and at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many wrong PINs. Try again in 10 minutes.';
  end if;
  select p.user_id into _mgr
    from staff_pins p join hotel_members m on m.hotel_id = p.hotel_id and m.user_id = p.user_id
    left join hotel_roles r on r.id = m.custom_role_id
   where p.hotel_id = _hotel_id
     and ((m.custom_role_id is null and m.role::text in ('owner', 'manager')) or 'pos.admin' = any(r.permissions))
     and coalesce(_pin, '') <> '' and p.pin_hash = crypt(_pin, p.pin_hash);
  insert into pin_attempts (hotel_id, user_id, ok) values (_hotel_id, auth.uid(), _mgr is not null);
  return _mgr;
end $$;

-- ---------- team ----------
drop function if exists public.hotel_team(uuid);
create function public.hotel_team(_hotel_id uuid)
returns table (member_id uuid, user_id uuid, full_name text, email text, role public.hotel_role, joined_at timestamptz,
               custom_role_id uuid, custom_role_name text)
language sql stable security definer set search_path = public as $$
  select m.id, m.user_id, p.full_name, u.email::text, m.role, m.created_at, m.custom_role_id, r.name
  from hotel_members m
  join auth.users u on u.id = m.user_id
  left join profiles p on p.id = m.user_id
  left join hotel_roles r on r.id = m.custom_role_id
  where m.hotel_id = _hotel_id and public.is_hotel_member(_hotel_id)
  order by m.created_at;
$$;
grant execute on function public.hotel_team(uuid) to authenticated;

-- Custom roles are given out only by the owner (through member_set_role or an invitation).
create or replace function public.members_role_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.custom_role_id is not null and coalesce(current_setting('hotel_easy.rpc', true), '') <> 'on' then
      raise exception 'Custom roles are given by the owner';
    end if;
  elsif new.custom_role_id is distinct from old.custom_role_id then
    if coalesce(current_setting('hotel_easy.rpc', true), '') <> 'on' then raise exception 'Custom roles are given by the owner'; end if;
  elsif new.role is distinct from old.role and new.custom_role_id is not null
        and coalesce(current_setting('hotel_easy.rpc', true), '') <> 'on' then
    new.custom_role_id := null;   -- picked a built-in role the old way
  end if;
  if new.custom_role_id is not null then
    if not exists (select 1 from hotel_roles where id = new.custom_role_id and hotel_id = new.hotel_id) then
      raise exception 'Role not found';
    end if;
    select base_role into new.role from hotel_roles where id = new.custom_role_id;
  end if;
  return new;
end $$;
drop trigger if exists members_role_guard on public.hotel_members;
create trigger members_role_guard before insert or update on public.hotel_members for each row execute function public.members_role_guard();

create or replace function public.invitations_role_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.custom_role_id is not null then
    if not has_hotel_role(new.hotel_id, array['owner']::hotel_role[]) then raise exception 'Only the owner can invite people with a custom role'; end if;
    select base_role into new.role from hotel_roles where id = new.custom_role_id and hotel_id = new.hotel_id;
    if not found then raise exception 'Role not found'; end if;
  end if;
  return new;
end $$;
drop trigger if exists invitations_role_guard on public.hotel_invitations;
create trigger invitations_role_guard before insert or update on public.hotel_invitations for each row execute function public.invitations_role_guard();

create or replace function public.accept_pending_invitations()
returns integer language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _email text;
  _n int := 0;
  _inv record;
begin
  if _uid is null then return 0; end if;
  select lower(email) into _email from auth.users where id = _uid;
  perform set_config('hotel_easy.rpc', 'on', true);
  for _inv in
    select i.*, r.name role_name from hotel_invitations i left join hotel_roles r on r.id = i.custom_role_id
     where lower(i.email) = _email and i.accepted_at is null
  loop
    insert into hotel_members (hotel_id, user_id, role, custom_role_id)
    values (_inv.hotel_id, _uid, _inv.role, _inv.custom_role_id)
    on conflict (hotel_id, user_id) do nothing;
    update hotel_invitations set accepted_at = now() where id = _inv.id;
    perform log_activity(_inv.hotel_id, 'staff', format('%s joined as %s', _email, coalesce(_inv.role_name, replace(_inv.role::text, '_', ' '))));
    _n := _n + 1;
  end loop;
  perform set_config('hotel_easy.rpc', '', true);
  return _n;
end $$;

-- ---------- what can I do here? ----------
create or replace function public.my_permissions(_hotel_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'role', m.role, 'custom_role_id', m.custom_role_id, 'custom_role_name', r.name,
    'permissions', coalesce(case
      when m.role = 'owner' then (select array_agg(key order by sort) from permission_catalog)
      when m.custom_role_id is not null then (select array_agg(c.key order by c.sort) from permission_catalog c where c.key = any(r.permissions))
      else (select array_agg(key order by sort) from permission_catalog where m.role::text = any(default_roles)) end, '{}'))
  from hotel_members m left join hotel_roles r on r.id = m.custom_role_id
  where m.hotel_id = _hotel_id and m.user_id = auth.uid();
$$;
grant execute on function public.my_permissions(uuid) to authenticated;

-- ---------- managing roles (owner only) ----------
create or replace function public.role_save(_hotel_id uuid, _id uuid, _name text, _description text,
  _base_role public.hotel_role, _permissions text[])
returns public.hotel_roles language plpgsql security definer set search_path = public as $$
declare _r hotel_roles; _bad text; _perms text[];
begin
  if not has_hotel_role(_hotel_id, array['owner']::hotel_role[]) then raise exception 'Only the owner can change roles'; end if;
  if _base_role is null or _base_role = 'owner' then raise exception 'Pick a job type other than owner'; end if;
  if length(btrim(coalesce(_name, ''))) < 2 then raise exception 'Give the role a name'; end if;
  if lower(btrim(_name)) in ('owner','manager','front desk','housekeeping','restaurant','accountant','maintenance','storekeeper') then
    raise exception 'That name is used by a built-in role. Pick another name.';
  end if;
  select string_agg(p, ', ') into _bad from unnest(coalesce(_permissions, '{}')) p where p not in (select key from permission_catalog);
  if _bad is not null then raise exception 'Unknown permission: %', _bad; end if;
  select coalesce(array_agg(distinct p order by p), '{}') into _perms from unnest(coalesce(_permissions, '{}')) p;
  if exists (select 1 from hotel_roles where hotel_id = _hotel_id and lower(btrim(name)) = lower(btrim(_name)) and id is distinct from _id) then
    raise exception 'There is already a role called %', btrim(_name);
  end if;
  if _id is null then
    insert into hotel_roles (hotel_id, name, description, base_role, permissions, created_by)
    values (_hotel_id, btrim(_name), nullif(btrim(coalesce(_description, '')), ''), _base_role, _perms, auth.uid()) returning * into _r;
    perform log_activity(_hotel_id, 'staff', format('Role "%s" created', _r.name), _r.id);
  else
    update hotel_roles set name = btrim(_name), description = nullif(btrim(coalesce(_description, '')), ''), base_role = _base_role,
           permissions = _perms, updated_at = now()
     where id = _id and hotel_id = _hotel_id returning * into _r;
    if not found then raise exception 'Role not found'; end if;
    perform set_config('hotel_easy.rpc', 'on', true);
    update hotel_members set role = _base_role where custom_role_id = _id;
    update hotel_invitations set role = _base_role where custom_role_id = _id and accepted_at is null;
    perform set_config('hotel_easy.rpc', '', true);
    perform log_activity(_hotel_id, 'staff', format('Role "%s" changed', _r.name), _r.id);
  end if;
  return _r;
end $$;

create or replace function public.role_delete(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _r hotel_roles; _n int;
begin
  select * into _r from hotel_roles where id = _id;
  if not found or not has_hotel_role(_r.hotel_id, array['owner']::hotel_role[]) then raise exception 'Role not found'; end if;
  select count(*) into _n from hotel_members where custom_role_id = _id;
  if _n > 0 then raise exception 'Give the % % on this role another role first', _n, case when _n = 1 then 'person' else 'people' end; end if;
  delete from hotel_invitations where custom_role_id = _id and accepted_at is null;
  delete from hotel_roles where id = _id;
  perform log_activity(_r.hotel_id, 'staff', format('Role "%s" deleted', _r.name));
end $$;

create or replace function public.member_set_role(_member_id uuid, _role public.hotel_role, _custom_role_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _m hotel_members; _name text; _who text;
begin
  select * into _m from hotel_members where id = _member_id;
  if not found or not has_hotel_role(_m.hotel_id, array['owner']::hotel_role[]) then raise exception 'Only the owner can change roles'; end if;
  if _m.user_id = auth.uid() then raise exception 'You cannot change your own role'; end if;
  if _m.role = 'owner' then raise exception 'The owner''s role cannot be changed'; end if;
  if _custom_role_id is null and (_role is null or _role = 'owner') then raise exception 'Pick a role'; end if;
  if _custom_role_id is not null then
    select name, base_role into _name, _role from hotel_roles where id = _custom_role_id and hotel_id = _m.hotel_id;
    if not found then raise exception 'Role not found'; end if;
  end if;
  perform set_config('hotel_easy.rpc', 'on', true);
  update hotel_members set role = _role, custom_role_id = _custom_role_id where id = _member_id;
  perform set_config('hotel_easy.rpc', '', true);
  select coalesce(p.full_name, u.email) into _who from auth.users u left join profiles p on p.id = u.id where u.id = _m.user_id;
  perform log_activity(_m.hotel_id, 'staff', format('%s is now %s', _who, coalesce(_name, replace(_role::text, '_', ' '))));
end $$;
grant execute on function public.role_save(uuid, uuid, text, text, public.hotel_role, text[]), public.role_delete(uuid),
  public.member_set_role(uuid, public.hotel_role, uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.owner_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _out jsonb := '[]'; _m record; _today date; _k jsonb; _mtd jsonb; _lm jsonb; _a jsonb; _first date; _lm_first date;
begin
  for _m in select m.hotel_id, m.role::text role, h.* from hotel_members m join hotels h on h.id = m.hotel_id
             where m.user_id = auth.uid() and public.has_hotel_role(m.hotel_id, array['owner','manager','accountant']::hotel_role[], 'owner.view') order by h.name loop
    _today := (now() at time zone _m.timezone)::date;
    _first := date_trunc('month', _today)::date;
    _lm_first := (_first - interval '1 month')::date;
    _k := report_kpis(_m.hotel_id, _today, _today);
    _mtd := report_kpis(_m.hotel_id, _first, _today);
    _lm := report_kpis(_m.hotel_id, _lm_first, least(_lm_first + (_today - _first), _first - 1));
    _a := hotel_alerts(_m.hotel_id);
    _out := _out || jsonb_build_object(
      'hotel_id', _m.hotel_id, 'name', _m.name, 'city', _m.city, 'currency', _m.currency, 'role', _m.role, 'today', _today,
      'rooms', (select count(*) from rooms where hotel_id = _m.hotel_id),
      'in_house', (select count(*) from reservations where hotel_id = _m.hotel_id and status = 'checked_in'),
      'arrivals', (select count(*) from reservations where hotel_id = _m.hotel_id and status in ('confirmed', 'checked_in') and check_in = _today),
      'arrivals_left', (select count(*) from reservations where hotel_id = _m.hotel_id and status = 'confirmed' and check_in = _today),
      'departures', (select count(*) from reservations where hotel_id = _m.hotel_id and check_out = _today and status in ('checked_in', 'checked_out')),
      'out_of_service', (select count(*) from rooms where hotel_id = _m.hotel_id and status in ('maintenance', 'out_of_order')),
      'today', _k, 'mtd', _mtd, 'last_month', _lm,
      'debtors', (select coalesce(sum(b.balance), 0) from reservations r join reservation_balances b on b.reservation_id = r.id
                   where r.hotel_id = _m.hotel_id and r.status = 'checked_out' and b.balance > 0)
               + (select coalesce(sum(greatest(company_balance(c.id), 0)), 0) from companies c where c.hotel_id = _m.hotel_id),
      'bills_due', (select coalesce(sum(amount), 0) from expenses where hotel_id = _m.hotel_id and status = 'unpaid' and due_on <= _today + 7),
      'next_7_days', (select coalesce(jsonb_agg(jsonb_build_object('date', d::date,
                         'occupied', (select count(*) from reservations r where r.hotel_id = _m.hotel_id and r.status in ('confirmed', 'checked_in')
                                       and r.check_in <= d::date and r.check_out > d::date)) order by d), '[]'::jsonb)
                       from generate_series(_today, _today + 6, interval '1 day') d),
      'alerts', _a,
      'alerts_high', (select count(*) from jsonb_array_elements(_a) a where a->>'severity' = 'high'));
  end loop;
  return _out;
end $function$;

-- ---------- every role check now names its permission ----------
CREATE OR REPLACE FUNCTION public.cancel_reservation(_reservation_id uuid, _no_show boolean DEFAULT false)
 RETURNS reservations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _r reservations;
begin
  select * into _r from reservations where id = _reservation_id for update;
  if not found then raise exception 'Reservation not found'; end if;
  if not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[], 'reservations.delete') then
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
end $function$;

CREATE OR REPLACE FUNCTION public.check_in_reservation(_reservation_id uuid, _room_id uuid DEFAULT NULL::uuid)
 RETURNS reservations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _r reservations;
  _room rooms;
  _g text;
begin
  select * into _r from reservations where id = _reservation_id for update;
  if not found then raise exception 'Reservation not found'; end if;
  if not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[], 'reservations.edit') then
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
end $function$;

CREATE OR REPLACE FUNCTION public.check_out_reservation(_reservation_id uuid, _allow_balance boolean DEFAULT false)
 RETURNS reservations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[], 'reservations.edit') then
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
    perform company_transfer_internal(_r.id, _r.company_id, _share, has_hotel_role(_r.hotel_id, array['owner','manager']::hotel_role[], 'companies.edit'));
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
end $function$;

CREATE OR REPLACE FUNCTION public.company_accounts(_hotel_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _today date; _money boolean;
begin
  if not has_hotel_role(_hotel_id, array['owner','manager','front_desk','accountant']::hotel_role[], 'companies.view') then raise exception 'Hotel not found'; end if;
  _money := has_hotel_role(_hotel_id, array['owner','manager','accountant']::hotel_role[], 'companies.ledger');
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
end $function$;

CREATE OR REPLACE FUNCTION public.company_entry(_company_id uuid, _kind text, _amount numeric, _entry_date date DEFAULT NULL::date, _method payment_method DEFAULT NULL::payment_method, _reference text DEFAULT NULL::text, _description text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _c companies; _id uuid; _ref text; _d date;
begin
  select * into _c from companies where id = _company_id;
  if not found or not has_hotel_role(_c.hotel_id, array['owner','manager','accountant']::hotel_role[], 'companies.edit') then raise exception 'Company not found'; end if;
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
end $function$;

CREATE OR REPLACE FUNCTION public.company_entry_void(_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _e company_ledger;
begin
  select * into _e from company_ledger where id = _id for update;
  if not found or not has_hotel_role(_e.hotel_id, array['owner','manager','accountant']::hotel_role[], 'companies.edit') then raise exception 'Entry not found'; end if;
  if _e.voided_at is not null then raise exception 'Already undone'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Give a reason'; end if;
  update company_ledger set voided_at = now(), voided_by = auth.uid(), void_reason = trim(_reason) where id = _id;
  if _e.transfer_id is not null then
    update folio_transfers set voided_at = now(), voided_by = auth.uid(), void_reason = trim(_reason) where id = _e.transfer_id;
  end if;
  perform log_activity(_e.hotel_id, 'billing', format('Company account entry undone: %s (%s)', _e.description, trim(_reason)), _e.reservation_id);
end $function$;

CREATE OR REPLACE FUNCTION public.company_statement(_company_id uuid, _from date, _to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _c companies; _h hotels; _open numeric;
begin
  select * into _c from companies where id = _company_id;
  if not found or not has_hotel_role(_c.hotel_id, array['owner','manager','accountant']::hotel_role[], 'companies.ledger') then raise exception 'Company not found'; end if;
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
end $function$;

CREATE OR REPLACE FUNCTION public.company_transfer(_reservation_id uuid, _company_id uuid DEFAULT NULL::uuid, _amount numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _r reservations; _cid uuid; _amt numeric;
begin
  select * into _r from reservations where id = _reservation_id for update;
  if not found or not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk','accountant']::hotel_role[], 'billing.create') then raise exception 'Reservation not found'; end if;
  if _r.status not in ('checked_in', 'checked_out') then raise exception 'Bills move to a company account once the guest has checked in'; end if;
  _cid := coalesce(_company_id, _r.company_id);
  if _cid is null then raise exception 'Choose a company'; end if;
  _amt := coalesce(_amount, case when _cid = _r.company_id and _r.bill_to <> 'guest' then company_share(_r.id) else reservation_balance(_r.id) end);
  return company_transfer_internal(_r.id, _cid, _amt, has_hotel_role(_r.hotel_id, array['owner','manager','accountant']::hotel_role[], 'companies.edit'));
end $function$;

CREATE OR REPLACE FUNCTION public.create_stayover_tasks(_hotel_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _n int; _today date;
begin
  if not has_hotel_role_any(_hotel_id, array['owner','manager','front_desk','housekeeping'], 'housekeeping.edit') then
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
end $function$;

CREATE OR REPLACE FUNCTION public.day_checks(_hotel_id uuid, _day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _h hotels; _today date; _blocking jsonb := '[]'; _warn jsonb := '[]'; _list jsonb; _n int; _last date;
begin
  if not has_hotel_role_any(_hotel_id, array['owner','manager','front_desk','accountant'], 'audit.view') then raise exception 'Hotel not found'; end if;
  select * into _h from hotels where id = _hotel_id;
  _today := (now() at time zone _h.timezone)::date;
  _last := last_closed_day(_hotel_id);

  if _day > _today then
    _blocking := _blocking || jsonb_build_object('key', 'future', 'title', 'This day hasn''t happened yet', 'detail', 'You can close today or earlier days.');
  end if;
  if _last is not null and _day <= _last then
    _blocking := _blocking || jsonb_build_object('key', 'closed', 'title', 'This day is already closed', 'detail', format('Days up to %s are closed.', to_char(_last, 'Dy DD Mon')));
  elsif _last is not null and _day > _last + 1 then
    _blocking := _blocking || jsonb_build_object('key', 'order', 'title', format('Close %s first', to_char(_last + 1, 'Dy DD Mon')), 'detail', 'Days are closed one after another.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'guest', trim(g.first_name || ' ' || g.last_name), 'room', rm.room_number)), '[]'), count(*)
    into _list, _n
    from reservations r join guests g on g.id = r.guest_id left join rooms rm on rm.id = r.room_id
   where r.hotel_id = _hotel_id and r.status = 'confirmed' and r.check_in <= _day;
  if _n > 0 then _blocking := _blocking || jsonb_build_object('key', 'arrivals', 'title', format('%s arrival%s not checked in', _n, case when _n = 1 then '' else 's' end),
       'detail', 'Check them in, move their dates, or mark them as no-shows.', 'items', _list); end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'guest', trim(g.first_name || ' ' || g.last_name), 'room', rm.room_number)), '[]'), count(*)
    into _list, _n
    from reservations r join guests g on g.id = r.guest_id left join rooms rm on rm.id = r.room_id
   where r.hotel_id = _hotel_id and r.status = 'checked_in' and r.check_out <= _day;
  if _n > 0 then _blocking := _blocking || jsonb_build_object('key', 'departures', 'title', format('%s guest%s should have checked out', _n, case when _n = 1 then '' else 's' end),
       'detail', 'Check them out or extend their stay.', 'items', _list); end if;

  select count(*) into _n from reservations r where r.hotel_id = _hotel_id and r.status = 'checked_in' and r.check_in <= _day and r.check_out > _day
     and not exists (select 1 from folio_charges c where c.reservation_id = r.id and c.kind = 'room' and c.stay_date = _day and c.voided_at is null);
  if _n > 0 then _warn := _warn || jsonb_build_object('key', 'room_charges', 'title', format('%s in-house stay%s missing the room charge for the night', _n, case when _n = 1 then '' else 's' end),
       'detail', 'Closing the day will post them.'); end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'number', o.number, 'total', o.total)), '[]'), count(*) into _list, _n
    from pos_orders o where o.hotel_id = _hotel_id and o.status = 'open' and (o.opened_at at time zone _h.timezone)::date <= _day;
  if _n > 0 then _warn := _warn || jsonb_build_object('key', 'pos_bills', 'title', format('%s restaurant bill%s still open', _n, case when _n = 1 then '' else 's' end),
       'detail', 'They will count on the day they are paid.', 'items', _list); end if;

  select count(*) into _n from pos_shifts where hotel_id = _hotel_id and closed_at is null and (opened_at at time zone _h.timezone)::date <= _day;
  if _n > 0 then _warn := _warn || jsonb_build_object('key', 'shifts', 'title', format('%s cash shift%s still open', _n, case when _n = 1 then '' else 's' end),
       'detail', 'Count and close the cash so it appears in the report.'); end if;

  return jsonb_build_object('day', _day, 'last_closed', _last, 'today', _today,
    'next_to_close', case when _last is null then least(_today - 1, _day) else _last + 1 end,
    'blocking', _blocking, 'warnings', _warn, 'can_close', jsonb_array_length(_blocking) = 0);
end $function$;

CREATE OR REPLACE FUNCTION public.day_report(_hotel_id uuid, _day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _b business_days;
begin
  if not has_hotel_role_any(_hotel_id, array['owner','manager','front_desk','accountant'], 'audit.view') then raise exception 'Hotel not found'; end if;
  select * into _b from business_days where hotel_id = _hotel_id and day = _day;
  if found then
    return _b.summary || jsonb_build_object('closed', true, 'closed_at', _b.closed_at, 'notes', _b.notes,
      'closed_by', (select coalesce(raw_user_meta_data->>'full_name', email) from auth.users where id = _b.closed_by));
  end if;
  return day_figures(_hotel_id, _day) || jsonb_build_object('closed', false);
end $function$;

CREATE OR REPLACE FUNCTION public.day_close(_hotel_id uuid, _day date, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _c jsonb; _r record;
begin
  if not has_hotel_role_any(_hotel_id, array['owner','manager','front_desk'], 'audit.create') then raise exception 'Only owners, managers and front desk can close the day'; end if;
  perform pg_advisory_xact_lock(hashtext('day-close-' || _hotel_id::text));
  _c := day_checks(_hotel_id, _day);
  if not (_c->>'can_close')::boolean then
    raise exception 'Can''t close %: %', to_char(_day, 'Dy DD Mon'), (select string_agg(b->>'title', '; ') from jsonb_array_elements(_c->'blocking') b);
  end if;
  -- post any missing room nights
  for _r in select r.id from reservations r where r.hotel_id = _hotel_id and r.status = 'checked_in' and r.check_in <= _day and r.check_out > _day loop
    perform sync_room_charges(_r.id);
  end loop;
  insert into business_days (hotel_id, day, summary, notes) values (_hotel_id, _day, day_figures(_hotel_id, _day), nullif(trim(_notes), ''));
  perform log_activity(_hotel_id, 'audit', format('Night audit: %s closed', to_char(_day, 'Dy DD Mon YYYY')), null);
  return day_report(_hotel_id, _day);
end $function$;

CREATE OR REPLACE FUNCTION public.day_reopen(_hotel_id uuid, _day date, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not has_hotel_role(_hotel_id, array['owner','manager']::hotel_role[], 'audit.delete') then raise exception 'Only owners and managers can reopen a closed day'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Give a reason for reopening'; end if;
  if _day is distinct from last_closed_day(_hotel_id) then raise exception 'Only the latest closed day can be reopened'; end if;
  delete from business_days where hotel_id = _hotel_id and day = _day;
  perform log_activity(_hotel_id, 'audit', format('Night audit: %s reopened (%s)', to_char(_day, 'Dy DD Mon YYYY'), trim(_reason)), null);
end $function$;

CREATE OR REPLACE FUNCTION public.email_preview(_reservation_id uuid, _kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _r reservations;
begin
  select * into _r from reservations where id = _reservation_id;
  if not found or not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[], 'online.view') then raise exception 'Reservation not found'; end if;
  if _kind not in ('confirmation', 'prearrival', 'thankyou', 'cancellation') then raise exception 'Unknown email'; end if;
  return email_compose(_r.hotel_id, _r.id, _kind, null, true);
end $function$;

CREATE OR REPLACE FUNCTION public.email_retry(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _o email_outbox;
begin
  select * into _o from email_outbox where id = _id for update;
  if not found or not has_hotel_role(_o.hotel_id, array['owner','manager','front_desk']::hotel_role[], 'online.reply') then raise exception 'Email not found'; end if;
  if _o.status = 'sending' then raise exception 'This email is being sent right now'; end if;
  update email_outbox set status = 'queued', send_after = now(), attempts = 0, last_error = null where id = _id;
end $function$;

CREATE OR REPLACE FUNCTION public.email_send_test(_hotel_id uuid, _to text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not has_hotel_role(_hotel_id, array['owner','manager']::hotel_role[], 'online.edit') then raise exception 'Only owners and managers can send test emails'; end if;
  if _to is null or lower(trim(_to)) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address'; end if;
  if (select count(*) from email_outbox where hotel_id = _hotel_id and kind = 'test' and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many test emails; try again later';
  end if;
  insert into email_outbox (hotel_id, kind, to_email) values (_hotel_id, 'test', lower(trim(_to)));
end $function$;

CREATE OR REPLACE FUNCTION public.expenses_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _admin boolean;
begin
  if tg_op = 'DELETE' then
    raise exception 'Expenses cannot be deleted; void them with a reason instead';
  end if;
  if not exists (select 1 from expense_categories where id = new.category_id and hotel_id = new.hotel_id) then
    raise exception 'Category belongs to another hotel';
  end if;
  if new.supplier_id is not null and not exists (select 1 from suppliers where id = new.supplier_id and hotel_id = new.hotel_id) then
    raise exception 'Supplier belongs to another hotel';
  end if;
  if new.payee is null and new.supplier_id is null then
    raise exception 'Say who was paid: choose a supplier or type a payee';
  end if;
  if new.status = 'paid' and new.paid_on is null then new.paid_on := new.spent_on; end if;
  if new.status <> 'paid' and new.status <> 'void' then new.paid_on := null; new.paid_method := null; new.paid_reference := null; end if;
  if tg_op = 'INSERT' then
    new.number := coalesce((select max(number) from expenses where hotel_id = new.hotel_id), 0) + 1;
    new.created_by := auth.uid();
    if new.status = 'void' then raise exception 'New expenses cannot be void'; end if;
    return new;
  end if;
  _admin := has_hotel_role(new.hotel_id, array['owner', 'manager']::hotel_role[], 'finance.admin');
  if new.number <> old.number or new.hotel_id <> old.hotel_id or new.created_by is distinct from old.created_by
     or new.receipt_batch is distinct from old.receipt_batch then
    raise exception 'That cannot be changed';
  end if;
  if old.status = 'void' then raise exception 'This expense is void'; end if;
  if new.status = 'void' and not _admin then raise exception 'Only owners and managers can void expenses'; end if;
  -- a paid expense is locked, except to void it, or (owner/manager) to reopen it
  if old.status = 'paid' and new.status = 'paid'
     and (new.spent_on, new.category_id, new.supplier_id, new.payee, new.description, new.amount, new.vat_amount, new.reference,
          new.paid_on, new.paid_method, new.paid_reference)
         is distinct from
         (old.spent_on, old.category_id, old.supplier_id, old.payee, old.description, old.amount, old.vat_amount, old.reference,
          old.paid_on, old.paid_method, old.paid_reference)
     and not _admin then
    raise exception 'Paid expenses can only be changed by an owner or manager';
  end if;
  if old.status = 'paid' and new.status = 'unpaid' and not _admin then
    raise exception 'Only owners and managers can mark a paid expense as unpaid';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.feedback_link(_reservation_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _r reservations; _t text;
begin
  select * into _r from reservations where id = _reservation_id;
  if not found or not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[], 'online.reply') then raise exception 'Reservation not found'; end if;
  if _r.status not in ('checked_in', 'checked_out') then raise exception 'Feedback links are for guests who have stayed'; end if;
  insert into guest_feedback (hotel_id, reservation_id) values (_r.hotel_id, _r.id) on conflict (reservation_id) do nothing;
  update guest_feedback set expires_at = greatest(expires_at, now() + interval '30 days') where reservation_id = _r.id and submitted_at is null;
  select token into _t from guest_feedback where reservation_id = _r.id;
  return _t;
end $function$;

CREATE OR REPLACE FUNCTION public.feedback_manager_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (new.response, new.published) is distinct from (old.response, old.published)
     and not has_hotel_role(new.hotel_id, array['owner','manager']::hotel_role[], 'online.edit') then
    raise exception 'Only owners and managers can reply to or publish reviews';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.inv_cost_report(_hotel_id uuid, _from date, _to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _tz text;
begin
  if not has_hotel_role_any(_hotel_id, array['owner', 'manager', 'accountant', 'storekeeper'], 'inventory.view') then
    raise exception 'Only managers, accountants and storekeepers can see stock costs';
  end if;
  if _from is null or _to is null or _from > _to or _to - _from > 366 then raise exception 'Choose a period of up to one year'; end if;
  select coalesce(timezone, 'Africa/Nairobi') into _tz from hotels where id = _hotel_id;
  return jsonb_build_object(
    'outlets', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.outlet, s.kind), '[]'::jsonb) from (
        select ou.name outlet, i.charge_kind::text kind, sum(i.net) sales, sum(i.cost) cost,
               count(*) filter (where i.cost = 0) lines_without_recipe, count(*) lines
          from pos_orders o join pos_order_items i on i.order_id = o.id join pos_outlets ou on ou.id = o.outlet_id
         where o.hotel_id = _hotel_id and o.status = 'paid' and i.status <> 'void' and not i.comped
           and (o.closed_at at time zone _tz)::date between _from and _to
         group by ou.name, i.charge_kind) s),
    'items', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.sales desc), '[]'::jsonb) from (
        select coalesce(m.name, i.name) item, i.charge_kind::text kind, sum(i.quantity) qty, sum(i.net) sales, sum(i.cost) cost,
               m.price, recipe_cost(m.id) portion_cost,
               exists (select 1 from menu_item_recipes r where r.menu_item_id = m.id) has_recipe
          from pos_orders o join pos_order_items i on i.order_id = o.id left join menu_items m on m.id = i.menu_item_id
         where o.hotel_id = _hotel_id and o.status = 'paid' and i.status <> 'void' and not i.comped
           and (o.closed_at at time zone _tz)::date between _from and _to
         group by m.id, m.name, i.name, i.charge_kind, m.price
         limit 200) s),
    'comps', (
      select coalesce(sum(i.cost), 0) from pos_orders o join pos_order_items i on i.order_id = o.id
       where o.hotel_id = _hotel_id and (i.comped or i.status = 'void') and i.cost > 0
         and (coalesce(i.voided_at, o.closed_at, o.opened_at) at time zone _tz)::date between _from and _to),
    'movements', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.location, s.kind), '[]'::jsonb) from (
        select l.name location, m.kind::text kind, sum(m.value) value, count(*) lines
          from stock_movements m join stock_locations l on l.id = m.location_id
         where m.hotel_id = _hotel_id and (m.created_at at time zone _tz)::date between _from and _to
         group by l.name, m.kind) s),
    'purchases', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.value desc), '[]'::jsonb) from (
        select coalesce(su.name, 'No supplier') supplier, sum(m.value) value, count(distinct m.batch_id) deliveries
          from stock_movements m left join suppliers su on su.id = m.supplier_id
         where m.hotel_id = _hotel_id and m.kind = 'receive' and (m.created_at at time zone _tz)::date between _from and _to
         group by su.name) s),
    'stock_value', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.location), '[]'::jsonb) from (
        select l.name location, coalesce(sum(round(sl.qty * si.avg_cost, 2)), 0) value, count(si.id) filter (where sl.qty <> 0) items
          from stock_locations l left join stock_levels sl on sl.location_id = l.id left join stock_items si on si.id = sl.item_id
         where l.hotel_id = _hotel_id group by l.name) s)
  );
end $function$;

CREATE OR REPLACE FUNCTION public.inv_move(_hotel_id uuid, _kind text, _location_id uuid, _lines jsonb, _to_location_id uuid DEFAULT NULL::uuid, _department text DEFAULT NULL::text, _note text DEFAULT NULL::text, _supplier_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _batch uuid := gen_random_uuid();
  _l jsonb; _item stock_items; _qty numeric; _have numeric; _n int := 0; _val numeric := 0;
begin
  if _kind = 'waste' then
    if not (inv_staff(_hotel_id) or has_hotel_role_any(_hotel_id, array['restaurant'], 'inventory.waste')) then
      raise exception 'You cannot record waste';
    end if;
    if coalesce(trim(_note), '') = '' then raise exception 'Say why it was thrown away'; end if;
  elsif _kind in ('transfer', 'issue', 'return') then
    if not inv_staff(_hotel_id) then raise exception 'Only managers and storekeepers can move stock'; end if;
  else
    raise exception 'Unknown movement';
  end if;
  perform inv_check_location(_hotel_id, _location_id);
  if _kind = 'transfer' then
    perform inv_check_location(_hotel_id, _to_location_id);
    if _to_location_id = _location_id then raise exception 'Choose a different store to send to'; end if;
  end if;
  if _kind = 'issue' and coalesce(trim(_department), '') = '' then raise exception 'Choose the department receiving it'; end if;
  if _kind = 'return' and (_supplier_id is null or not exists (select 1 from suppliers where id = _supplier_id and hotel_id = _hotel_id)) then
    raise exception 'Choose the supplier';
  end if;
  if _lines is null or jsonb_array_length(_lines) = 0 then raise exception 'Add at least one item'; end if;

  for _l in select * from jsonb_array_elements(_lines) loop
    _qty := (_l->>'qty')::numeric;
    if _qty is null or _qty = 0 then continue; end if;
    if _qty < 0 then raise exception 'Quantities must be positive'; end if;
    select * into _item from stock_items where id = (_l->>'item_id')::uuid and hotel_id = _hotel_id;
    if not found then raise exception 'Item not found'; end if;
    select coalesce(qty, 0) into _have from stock_levels where item_id = _item.id and location_id = _location_id for update;
    if _kind <> 'waste' and coalesce(_have, 0) < _qty then
      raise exception 'Only % % of % in this store', trim(to_char(coalesce(_have, 0), 'FM999,999,990.###')), _item.unit, _item.name;
    end if;
    insert into stock_movements (hotel_id, item_id, location_id, kind, qty, unit_cost, batch_id, note, department, supplier_id)
    values (_hotel_id, _item.id, _location_id,
            case _kind when 'transfer' then 'transfer_out' else _kind end::stock_move_kind,
            -_qty, _item.avg_cost, _batch, nullif(trim(_note), ''), nullif(trim(_department), ''), _supplier_id);
    if _kind = 'transfer' then
      insert into stock_movements (hotel_id, item_id, location_id, kind, qty, unit_cost, batch_id, note)
      values (_hotel_id, _item.id, _to_location_id, 'transfer_in', _qty, _item.avg_cost, _batch, nullif(trim(_note), ''));
    end if;
    _n := _n + 1; _val := _val + round(_qty * _item.avg_cost, 2);
  end loop;
  if _n = 0 then raise exception 'Add at least one item'; end if;
  perform log_activity(_hotel_id, 'inventory', format('%s: %s items worth %s from %s%s', initcap(_kind), _n, to_char(_val, 'FM999,999,990.00'),
          (select name from stock_locations where id = _location_id),
          coalesce(' to ' || (select name from stock_locations where id = _to_location_id), coalesce(' to ' || trim(_department), ''))), _batch);
  return _batch;
end $function$;

CREATE OR REPLACE FUNCTION public.issue_invoice(_reservation_id uuid)
 RETURNS invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk','accountant']::hotel_role[], 'billing.create') then
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
end $function$;

CREATE OR REPLACE FUNCTION public.payroll_set_status(_run_id uuid, _action text, _paid_on date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _run payroll_runs; _t record; _cat_wage uuid; _cat_stat uuid; _due date; _lbl text; _n int; _eom date;
begin
  select * into _run from payroll_runs where id = _run_id for update;
  if not found or not payroll_staff(_run.hotel_id, 'payroll.edit') then raise exception 'Payroll not found'; end if;
  _lbl := to_char(_run.month, 'FMMonth YYYY');
  if _action = 'approve' then
    if not has_hotel_role(_run.hotel_id, array['owner', 'manager']::hotel_role[], 'payroll.edit') then raise exception 'A manager or the owner must approve payroll'; end if;
    if _run.status <> 'draft' then raise exception 'Only a draft can be approved'; end if;
    select count(*) into _n from payslips where run_id = _run_id;
    if _n = 0 then raise exception 'There are no payslips in this payroll'; end if;
    update payroll_runs set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = _run_id;
    perform log_activity(_run.hotel_id, 'staff', format('Payroll for %s approved (%s payslips)', _lbl, _n), _run_id);
  elsif _action = 'reopen' then
    if not has_hotel_role(_run.hotel_id, array['owner', 'manager']::hotel_role[], 'payroll.edit') then raise exception 'A manager or the owner must reopen payroll'; end if;
    if _run.status <> 'approved' then raise exception 'Only an approved, unpaid payroll can be reopened'; end if;
    update payroll_runs set status = 'draft', approved_by = null, approved_at = null where id = _run_id;
  elsif _action = 'paid' then
    if _run.status <> 'approved' then raise exception 'Approve the payroll before marking it paid'; end if;
    select sum(net) net, sum(paye) paye, sum(nssf_tier1 + nssf_tier2 + employer_nssf) nssf, sum(shif) shif,
           sum(ahl + employer_ahl) ahl, sum(nita) nita into _t from payslips where run_id = _run_id;
    select id into _cat_wage from expense_categories where hotel_id = _run.hotel_id and name = 'Salaries and wages';
    select id into _cat_stat from expense_categories where hotel_id = _run.hotel_id and name = 'NSSF, SHIF and housing levy';
    if _cat_wage is null then select id into _cat_wage from expense_categories where hotel_id = _run.hotel_id and grp = 'payroll' and active order by sort limit 1; end if;
    if _cat_stat is null then _cat_stat := _cat_wage; end if;
    if _cat_wage is null then raise exception 'Add an expense category in the "Staff costs" group first'; end if;
    _due := (_run.month + interval '1 month' + interval '8 days')::date;   -- the 9th of the next month
    _eom := (_run.month + interval '1 month - 1 day')::date;               -- wages are a cost of the payroll month
    if _t.net > 0 then
      insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, status, paid_on, paid_method)
      values (_run.hotel_id, _eom, _cat_wage, 'Staff', format('Net wages, %s', _lbl), _t.net, 'paid', coalesce(_paid_on, current_date), 'bank_transfer');
    end if;
    if _t.paye > 0 then insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, due_on, status)
      values (_run.hotel_id, _eom, _cat_wage, 'KRA', format('PAYE, %s', _lbl), _t.paye, _due, 'unpaid'); end if;
    if _t.nssf > 0 then insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, due_on, status)
      values (_run.hotel_id, _eom, _cat_stat, 'NSSF', format('NSSF (staff + employer), %s', _lbl), _t.nssf, _due, 'unpaid'); end if;
    if _t.shif > 0 then insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, due_on, status)
      values (_run.hotel_id, _eom, _cat_stat, 'Social Health Authority', format('SHIF, %s', _lbl), _t.shif, _due, 'unpaid'); end if;
    if _t.ahl > 0 then insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, due_on, status)
      values (_run.hotel_id, _eom, _cat_stat, 'KRA', format('Housing levy (staff + employer), %s', _lbl), _t.ahl, _due, 'unpaid'); end if;
    if _t.nita > 0 then insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, due_on, status)
      values (_run.hotel_id, _eom, _cat_stat, 'NITA', format('NITA levy, %s', _lbl), _t.nita, _due, 'unpaid'); end if;
    update payroll_runs set status = 'paid', paid_on = coalesce(_paid_on, current_date) where id = _run_id;
    perform log_activity(_run.hotel_id, 'staff', format('Payroll for %s paid: net %s', _lbl, to_char(_t.net, 'FM999,999,990.00')), _run_id);
  else
    raise exception 'Unknown action';
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.payroll_generate(_hotel_id uuid, _month date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _m date := date_trunc('month', _month)::date; _end date; _run payroll_runs; _rates uuid; _tz text; _prev text;
begin
  if not payroll_staff(_hotel_id, 'payroll.edit') then raise exception 'Only owners, managers and accountants can run payroll'; end if;
  _end := (_m + interval '1 month - 1 day')::date;
  select id into _rates from payroll_rates where hotel_id = _hotel_id and effective_from <= _end order by effective_from desc limit 1;
  if _rates is null then raise exception 'No statutory rates are set for that month'; end if;
  select coalesce(timezone, 'Africa/Nairobi') into _tz from hotels where id = _hotel_id;
  select * into _run from payroll_runs where hotel_id = _hotel_id and month = _m for update;
  if found and _run.status <> 'draft' then raise exception 'Payroll for % is already %', to_char(_m, 'FMMonth YYYY'), _run.status; end if;
  if not found then
    insert into payroll_runs (hotel_id, month, rates_id) values (_hotel_id, _m, _rates) returning * into _run;
  else
    update payroll_runs set rates_id = _rates where id = _run.id;
  end if;

  _prev := coalesce(current_setting('hotel_easy.rpc', true), '');
  perform set_config('hotel_easy.rpc', 'on', true);
  -- people no longer paid drop off the draft; everyone paid is (re)built, keeping typed adjustments
  delete from payslips ps where ps.run_id = _run.id
     and not exists (select 1 from staff s join staff_pay p on p.staff_id = s.id where s.id = ps.staff_id and (s.active or exists (
       select 1 from time_entries t where t.staff_id = s.id and (t.clock_in at time zone _tz)::date between _m and _end)));
  insert into payslips (run_id, hotel_id, staff_id, full_name, department, job_title, kra_pin, nssf_no, sha_no, id_no, pay_type, rate,
                        pay_method, pay_account, statutory, days_worked, hours_worked, house_allowance, other_allowance)
  select _run.id, _hotel_id, s.id, s.full_name, s.department, s.job_title, p.kra_pin, p.nssf_no, p.sha_no, p.id_no, p.pay_type, p.rate,
         p.pay_method, case when p.pay_method = 'bank' then concat_ws(' ', p.bank_name, p.pay_account) else coalesce(p.pay_account, s.phone) end,
         p.statutory,
         coalesce((select count(distinct (t.clock_in at time zone _tz)::date) from time_entries t
                    where t.staff_id = s.id and (t.clock_in at time zone _tz)::date between _m and _end), 0),
         coalesce((select round(sum(extract(epoch from coalesce(t.clock_out, t.clock_in) - t.clock_in) / 3600.0)::numeric, 2) from time_entries t
                    where t.staff_id = s.id and (t.clock_in at time zone _tz)::date between _m and _end), 0),
         p.house_allowance, p.other_allowance
    from staff s join staff_pay p on p.staff_id = s.id
   where s.hotel_id = _hotel_id
     and (s.active or exists (select 1 from time_entries t where t.staff_id = s.id and (t.clock_in at time zone _tz)::date between _m and _end))
  on conflict (run_id, staff_id) do update set
    full_name = excluded.full_name, department = excluded.department, job_title = excluded.job_title, kra_pin = excluded.kra_pin,
    nssf_no = excluded.nssf_no, sha_no = excluded.sha_no, id_no = excluded.id_no, pay_type = excluded.pay_type, rate = excluded.rate,
    pay_method = excluded.pay_method, pay_account = excluded.pay_account, statutory = excluded.statutory,
    days_worked = excluded.days_worked, hours_worked = excluded.hours_worked,
    house_allowance = excluded.house_allowance, other_allowance = excluded.other_allowance;
  perform set_config('hotel_easy.rpc', _prev, true);
  return _run.id;
end $function$;

CREATE OR REPLACE FUNCTION public.payslip_calc()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _r payroll_rates; _run payroll_runs; _hourly numeric; _ded numeric;
begin
  select * into _run from payroll_runs where id = new.run_id;
  if tg_op = 'UPDATE' and coalesce(current_setting('hotel_easy.rpc', true), '') <> 'on' then
    if _run.status <> 'draft' then raise exception 'This payroll is approved; reopen it to make changes'; end if;
    -- only the adjustments may be typed in
    if (new.staff_id, new.full_name, new.pay_type, new.rate, new.statutory, new.days_worked, new.hours_worked, new.run_id)
       is distinct from (old.staff_id, old.full_name, old.pay_type, old.rate, old.statutory, old.days_worked, old.hours_worked, old.run_id)
       and not has_hotel_role(new.hotel_id, array['owner', 'manager']::hotel_role[], 'payroll.edit') then
      raise exception 'Only owners and managers can change pay, days or hours on a payslip';
    end if;
  end if;
  select * into _r from payroll_rates where id = _run.rates_id;

  new.basic := round(case new.pay_type
    when 'monthly' then new.rate
    when 'daily' then new.rate * new.days_worked
    else new.rate * new.hours_worked end, 2);
  _hourly := case new.pay_type when 'monthly' then new.rate / nullif(_r.hours_per_month, 0)
                               when 'daily' then new.rate / 8 else new.rate end;
  new.overtime_pay := round(coalesce(_hourly, 0) * new.overtime_hours * _r.overtime_multiplier, 2);
  new.gross := new.basic + new.house_allowance + new.other_allowance + new.overtime_pay + new.bonus;

  if new.statutory and new.gross > 0 then
    new.nssf_tier1 := round(least(new.gross, _r.nssf_lel) * _r.nssf_rate, 2);
    new.nssf_tier2 := round(greatest(least(new.gross, _r.nssf_uel) - _r.nssf_lel, 0) * _r.nssf_rate, 2);
    new.shif := round(greatest(new.gross * _r.shif_rate, _r.shif_min), 2);
    new.ahl := round(new.gross * _r.ahl_rate, 2);
    new.taxable := greatest(new.gross - new.nssf_tier1 - new.nssf_tier2 - new.shif - new.ahl, 0);
    new.tax_before_relief := paye_on(new.taxable, _r.paye_bands);
    new.personal_relief := least(_r.personal_relief, new.tax_before_relief);
    new.paye := new.tax_before_relief - new.personal_relief;
    new.employer_nssf := new.nssf_tier1 + new.nssf_tier2;
    new.employer_ahl := round(new.gross * _r.ahl_employer_rate, 2);
    new.nita := _r.nita_per_employee;
  else
    new.nssf_tier1 := 0; new.nssf_tier2 := 0; new.shif := 0; new.ahl := 0; new.taxable := 0; new.tax_before_relief := 0;
    new.personal_relief := 0; new.paye := 0; new.employer_nssf := 0; new.employer_ahl := 0; new.nita := 0;
  end if;
  _ded := new.nssf_tier1 + new.nssf_tier2 + new.shif + new.ahl + new.paye;
  if new.advances + new.other_deductions > new.gross - _ded then
    raise exception 'Deductions for % are more than their pay after tax (%)', new.full_name, to_char(new.gross - _ded, 'FM999,999,990.00');
  end if;
  new.net := new.gross - _ded - new.advances - new.other_deductions;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.pos_shift_report(_shift_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _s pos_shifts; _r jsonb;
begin
  select * into _s from pos_shifts where id = _shift_id;
  if not found or not (pos_viewer(_s.hotel_id) and (_s.user_id = auth.uid() or pos_admin(_s.hotel_id) or has_hotel_role_any(_s.hotel_id, array['accountant'], 'pos.shifts'))) then
    raise exception 'Shift not found';
  end if;
  select jsonb_build_object(
    'shift_id', _s.id, 'user_id', _s.user_id, 'opened_at', _s.opened_at, 'closed_at', _s.closed_at,
    'opening_float', _s.opening_float,
    'by_method', coalesce((select jsonb_object_agg(method, total) from (
        select method, sum(amount) total from pos_payments where shift_id = _s.id and voided_at is null group by method) x), '{}'::jsonb),
    'payments', (select count(*) from pos_payments where shift_id = _s.id and voided_at is null),
    'bills', (select count(distinct order_id) from pos_payments where shift_id = _s.id and voided_at is null),
    'expected_cash', _s.opening_float + coalesce((select sum(amount) from pos_payments where shift_id = _s.id and method = 'cash' and voided_at is null), 0),
    'voided_payments', (select count(*) from pos_payments where shift_id = _s.id and voided_at is not null)
  ) into _r;
  return _r;
end $function$;

CREATE OR REPLACE FUNCTION public.precheck_accept(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _p prechecks; _r reservations; _note text;
begin
  select * into _p from prechecks where id = _id for update;
  if not found or not has_hotel_role(_p.hotel_id, array['owner','manager','front_desk']::hotel_role[], 'precheck.edit') then raise exception 'Online check-in not found'; end if;
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
end $function$;

CREATE OR REPLACE FUNCTION public.precheck_link(_reservation_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _r reservations; _t text;
begin
  select * into _r from reservations where id = _reservation_id;
  if not found or not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[], 'precheck.edit') then raise exception 'Reservation not found'; end if;
  if _r.status <> 'confirmed' then raise exception 'Online check-in is for confirmed reservations that have not arrived yet'; end if;
  insert into prechecks (hotel_id, reservation_id) values (_r.hotel_id, _r.id) on conflict (reservation_id) do nothing;
  select token into _t from prechecks where reservation_id = _r.id;
  return _t;
end $function$;

CREATE OR REPLACE FUNCTION public.report_period(_hotel_id uuid, _from date, _to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _today date;
  _len int;
  _tz text;
  _out jsonb;
begin
  if not has_hotel_role_any(_hotel_id, array['owner', 'manager', 'accountant'], 'reports.view') then
    raise exception 'Only owners, managers and accountants can see reports';
  end if;
  if _from is null or _to is null or _from > _to then
    raise exception 'Choose a start date on or before the end date';
  end if;
  _today := hotel_today(_hotel_id);
  if _from > _today then
    raise exception 'Reports cover the past and today; use the dashboard forecast for future nights';
  end if;
  _to := least(_to, _today);
  if _to - _from > 366 then
    raise exception 'Choose a period of at most one year';
  end if;
  _len := _to - _from + 1;
  select coalesce(timezone, 'Africa/Nairobi') into _tz from hotels where id = _hotel_id;

  _out := jsonb_build_object(
    'kpis', report_kpis(_hotel_id, _from, _to),
    'previous', report_kpis(_hotel_id, _from - _len, _from - 1),

    'daily', (
      with days as (select g::date d from generate_series(_from, _to, interval '1 day') g),
           l as (select * from report_lines(_hotel_id, _from, _to)),
           n as (select d, count(*) sold from report_nights(_hotel_id, _from, _to) group by d),
           rm as (select count(*) c from rooms where hotel_id = _hotel_id),
           pay as (
             select (received_at at time zone _tz)::date d, sum(amount) amt from payments
              where hotel_id = _hotel_id and voided_at is null
                and (received_at at time zone _tz)::date between _from and _to group by 1
             union all
             select (received_at at time zone _tz)::date, sum(amount) from pos_payments
              where hotel_id = _hotel_id and voided_at is null and method <> 'room'
                and (received_at at time zone _tz)::date between _from and _to group by 1)
      select coalesce(jsonb_agg(jsonb_build_object(
               'date', days.d,
               'rooms_sold', coalesce(n.sold, 0),
               'occupancy', case when rm.c > 0 then round(coalesce(n.sold, 0)::numeric / rm.c, 4) else 0 end,
               'room_revenue', coalesce((select sum(net) from l where l.d = days.d and grp = 'rooms'), 0),
               'fnb_revenue', coalesce((select sum(net) from l where l.d = days.d and grp = 'fnb'), 0),
               'other_revenue', coalesce((select sum(net) from l where l.d = days.d and grp = 'other'), 0),
               'vat', coalesce((select sum(vat) from l where l.d = days.d), 0),
               'levy', coalesce((select sum(levy) from l where l.d = days.d), 0),
               'collected', coalesce((select sum(amt) from pay where pay.d = days.d), 0)
             ) order by days.d), '[]'::jsonb)
        from days cross join rm left join n on n.d = days.d),

    'departments', (
      select coalesce(jsonb_agg(x order by x->>'grp', (x->>'net')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('grp', grp, 'dept', dept, 'net', sum(net), 'vat', sum(vat), 'levy', sum(levy),
                                  'gross', sum(gross), 'lines', count(*)) x
          from report_lines(_hotel_id, _from, _to) group by grp, dept) s),

    'outlets', (
      select coalesce(jsonb_agg(to_jsonb(s) - 'sort' order by s.sort, s.outlet), '[]'::jsonb) from (
        select ou.name outlet, ou.kind, ou.sort,
               count(o.id) bills, coalesce(sum(o.guests), 0) covers,
               coalesce(sum(o.net_amount), 0) net, coalesce(sum(o.service_charge), 0) service_charge,
               coalesce(sum(o.vat_amount), 0) vat, coalesce(sum(o.levy_amount), 0) levy,
               coalesce(sum(o.total), 0) total, coalesce(sum(o.discount_amount), 0) discounts,
               coalesce(sum(o.total) filter (where exists (
                   select 1 from pos_payments p where p.order_id = o.id and p.method = 'room' and p.voided_at is null)), 0) room_charged,
               case when count(o.id) > 0 then round(sum(o.total) / count(o.id), 2) else 0 end avg_bill
          from pos_outlets ou
          join pos_orders o on o.outlet_id = ou.id and o.status = 'paid'
               and (o.closed_at at time zone _tz)::date between _from and _to
         where ou.hotel_id = _hotel_id
         group by ou.id, ou.name, ou.kind, ou.sort) s),

    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object('source', src, 'method', method, 'count', cnt, 'amount', amt)
                                order by src, amt desc), '[]'::jsonb) from (
        select 'front_desk' src, method::text, count(*) cnt, sum(amount) amt from payments
         where hotel_id = _hotel_id and voided_at is null
           and (received_at at time zone _tz)::date between _from and _to group by method
        union all
        select 'pos', method::text, count(*), sum(amount) from pos_payments
         where hotel_id = _hotel_id and voided_at is null
           and (received_at at time zone _tz)::date between _from and _to group by method) s),

    'sources', (
      with n as (select r.source::text source, count(distinct r.id) stays, count(*) nights
                   from report_nights(_hotel_id, _from, _to) x join reservations r on r.id = x.reservation_id
                  group by 1),
           rv as (select r.source::text source, sum(l.net) revenue
                    from report_lines(_hotel_id, _from, _to) l join reservations r on r.id = l.reservation_id
                   where l.grp = 'rooms' group by 1)
      select coalesce(jsonb_agg(jsonb_build_object(
               'source', n.source, 'stays', n.stays, 'nights', n.nights, 'revenue', coalesce(rv.revenue, 0),
               'adr', round(coalesce(rv.revenue, 0) / n.nights, 2)) order by n.nights desc), '[]'::jsonb)
        from n left join rv on rv.source = n.source),

    'room_types', (
      with n as (select r.room_type_id, count(*) nights
                   from report_nights(_hotel_id, _from, _to) x join reservations r on r.id = x.reservation_id
                  group by 1),
           rv as (select r.room_type_id, sum(l.net) revenue
                    from report_lines(_hotel_id, _from, _to) l join reservations r on r.id = l.reservation_id
                   where l.grp = 'rooms' group by 1),
           rc as (select room_type_id, count(*) c from rooms where hotel_id = _hotel_id group by 1)
      select coalesce(jsonb_agg(jsonb_build_object(
               'room_type', t.name, 'rooms', coalesce(rc.c, 0), 'nights', coalesce(n.nights, 0),
               'occupancy', case when coalesce(rc.c, 0) > 0 then round(coalesce(n.nights, 0)::numeric / (rc.c * _len), 4) else 0 end,
               'revenue', coalesce(rv.revenue, 0),
               'adr', case when coalesce(n.nights, 0) > 0 then round(coalesce(rv.revenue, 0) / n.nights, 2) else 0 end)
             order by t.name), '[]'::jsonb)
        from room_types t
        left join n on n.room_type_id = t.id left join rv on rv.room_type_id = t.id left join rc on rc.room_type_id = t.id
       where t.hotel_id = _hotel_id),

    'nationalities', (
      with n as (select * from report_nights(_hotel_id, _from, _to))
      select coalesce(jsonb_agg(jsonb_build_object('nationality', nat, 'guests', guests, 'nights', nights)
                                order by nights desc, nat), '[]'::jsonb) from (
        select coalesce(nullif(trim(g.nationality), ''), 'Not recorded') nat,
               count(distinct g.id) guests, count(*) nights
          from n join reservations r on r.id = n.reservation_id join guests g on g.id = r.guest_id
         group by 1 order by 3 desc limit 15) s),

    'stays', (
      select jsonb_build_object(
        'arrivals', count(*) filter (where status in ('checked_in', 'checked_out') and check_in between _from and _to),
        'avg_length_of_stay', coalesce(round(avg(nights) filter (where status in ('checked_in', 'checked_out') and check_in between _from and _to), 1), 0),
        'avg_lead_days', coalesce(round(avg(check_in - (created_at at time zone _tz)::date)
                           filter (where status in ('checked_in', 'checked_out') and check_in between _from and _to), 1), 0),
        'avg_guests', coalesce(round(avg(adults + children) filter (where status in ('checked_in', 'checked_out') and check_in between _from and _to), 1), 0),
        'new_bookings', count(*) filter (where (created_at at time zone _tz)::date between _from and _to),
        'cancellations', count(*) filter (where status = 'cancelled' and (cancelled_at at time zone _tz)::date between _from and _to),
        'no_shows', count(*) filter (where status = 'no_show' and check_in between _from and _to))
        from reservations where hotel_id = _hotel_id),

    'debtors', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'reservation_id', r.id, 'code', r.code, 'status', r.status,
               'guest', trim(g.first_name || ' ' || g.last_name), 'phone', g.phone,
               'room', rm.room_number, 'check_in', r.check_in, 'check_out', r.check_out,
               'charges', b.charges_total, 'paid', b.payments_total, 'balance', b.balance)
             order by r.status desc, b.balance desc), '[]'::jsonb)
        from reservation_balances b
        join reservations r on r.id = b.reservation_id
        join guests g on g.id = r.guest_id
        left join rooms rm on rm.id = r.room_id
       where b.hotel_id = _hotel_id and r.status in ('checked_in', 'checked_out') and b.balance > 0.009),

    'staff', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'bills', bills, 'sales', sales, 'voids', voids, 'comps', comps)
                                order by sales desc), '[]'::jsonb) from (
        select coalesce(nullif(trim(p.full_name), ''), 'Unknown') name,
               count(distinct o.id) filter (where o.status = 'paid') bills,
               coalesce(sum(o.total) filter (where o.status = 'paid'), 0) sales,
               (select count(*) from pos_order_items i join pos_orders o2 on o2.id = i.order_id
                 where o2.waiter_id = o.waiter_id and o2.hotel_id = _hotel_id and i.status = 'void' and i.voided_at is not null
                   and (i.voided_at at time zone _tz)::date between _from and _to) voids,
               (select count(*) from pos_order_items i join pos_orders o2 on o2.id = i.order_id
                 where o2.waiter_id = o.waiter_id and o2.hotel_id = _hotel_id and i.comped
                   and (o2.opened_at at time zone _tz)::date between _from and _to) comps
          from pos_orders o left join profiles p on p.id = o.waiter_id
         where o.hotel_id = _hotel_id and o.status = 'paid'
           and (o.closed_at at time zone _tz)::date between _from and _to
         group by o.waiter_id, p.full_name) s)
  );
  return _out;
end $function$;

CREATE OR REPLACE FUNCTION public.request_create_staff(_reservation_id uuid, _type_id uuid, _details text DEFAULT NULL::text, _wanted_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _r reservations; _t request_types; _id uuid;
begin
  select * into _r from reservations where id = _reservation_id;
  if not found or not has_hotel_role_any(_r.hotel_id, array['owner','manager','front_desk'], 'requests.edit') then raise exception 'Reservation not found'; end if;
  if _r.status <> 'checked_in' then raise exception 'That guest is not checked in'; end if;
  select * into _t from request_types where id = _type_id and hotel_id = _r.hotel_id;
  if not found then raise exception 'Choose a request type'; end if;
  insert into guest_requests (hotel_id, reservation_id, room_id, type_id, label, department, details, wanted_at, from_guest, status, acknowledged_at, handled_by)
  values (_r.hotel_id, _r.id, _r.room_id, _t.id, _t.label, _t.department, nullif(trim(_details), ''), _wanted_at, false, 'acknowledged', now(), auth.uid())
  returning id into _id;
  return _id;
end $function$;

CREATE OR REPLACE FUNCTION public.request_update(_id uuid, _status text, _reply text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _q guest_requests;
begin
  select * into _q from guest_requests where id = _id for update;
  if not found or not request_staff(_q.hotel_id, _q.department, 'requests.edit') then raise exception 'Request not found'; end if;
  if _status not in ('acknowledged', 'done', 'cancelled', 'new') then raise exception 'Unknown status'; end if;
  if length(coalesce(_reply, '')) > 300 then raise exception 'Keep the reply under 300 characters'; end if;
  update guest_requests set status = _status, reply = coalesce(nullif(trim(_reply), ''), reply), handled_by = auth.uid(),
         acknowledged_at = case when _status in ('acknowledged', 'done') then coalesce(acknowledged_at, now()) else acknowledged_at end,
         done_at = case when _status = 'done' then now() when _status = 'new' then null else done_at end
   where id = _id;
end $function$;

CREATE OR REPLACE FUNCTION public.room_link_reset(_room_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _t text;
begin
  if not has_hotel_role((select hotel_id from rooms where id = _room_id), array['owner','manager']::hotel_role[], 'requests.settings') then raise exception 'Room not found'; end if;
  update room_links set token = replace(gen_random_uuid()::text, '-', ''), created_at = now() where room_id = _room_id returning token into _t;
  return _t;
end $function$;

CREATE OR REPLACE FUNCTION public.staff_hours_report(_hotel_id uuid, _from date, _to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _tz text;
begin
  if not has_hotel_role_any(_hotel_id, array['owner', 'manager', 'accountant'], 'reports.view|payroll.view') then
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
end $function$;

CREATE OR REPLACE FUNCTION public.stay_link_key(_reservation_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _r reservations;
begin
  select * into _r from reservations where id = _reservation_id;
  if not found or not has_hotel_role_any(_r.hotel_id, array['owner','manager','front_desk'], 'reservations.edit') then raise exception 'Reservation not found'; end if;
  if _r.status <> 'checked_in' then raise exception 'The guest page works while the guest is checked in'; end if;
  insert into stay_keys (reservation_id, hotel_id) values (_r.id, _r.hotel_id) on conflict do nothing;
  return (select key from stay_keys where reservation_id = _r.id);
end $function$;

CREATE OR REPLACE FUNCTION public.void_charge(_charge_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _c folio_charges;
begin
  select * into _c from folio_charges where id = _charge_id for update;
  if not found or not is_hotel_member(_c.hotel_id) then raise exception 'Charge not found'; end if;
  if _c.voided_at is not null then raise exception 'Already voided'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Give a reason for voiding'; end if;
  if not (has_hotel_role(_c.hotel_id, array['owner','manager','accountant']::hotel_role[], 'billing.void')
          or (_c.posted_by = auth.uid() and _c.posted_at > now() - interval '15 minutes'
              and has_hotel_role(_c.hotel_id, array['front_desk']::hotel_role[], 'billing.create'))) then
    raise exception 'Only a manager or accountant can void this charge (staff can void their own entries within 15 minutes)';
  end if;
  update folio_charges set voided_at = now(), voided_by = auth.uid(), void_reason = trim(_reason) where id = _c.id;
  perform log_activity(_c.hotel_id, 'billing', format('Voided charge "%s" (%s): %s', _c.description, to_char(_c.amount, 'FM999,999,990'), trim(_reason)), _c.reservation_id);
end $function$;

CREATE OR REPLACE FUNCTION public.void_payment(_payment_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _p payments;
begin
  select * into _p from payments where id = _payment_id for update;
  if not found or not is_hotel_member(_p.hotel_id) then raise exception 'Payment not found'; end if;
  if _p.voided_at is not null then raise exception 'Already voided'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Give a reason for voiding'; end if;
  if not (has_hotel_role(_p.hotel_id, array['owner','manager','accountant']::hotel_role[], 'billing.void')
          or (_p.received_by = auth.uid() and _p.received_at > now() - interval '15 minutes'
              and has_hotel_role(_p.hotel_id, array['front_desk']::hotel_role[], 'billing.create'))) then
    raise exception 'Only a manager or accountant can void this payment (staff can void their own entries within 15 minutes)';
  end if;
  update payments set voided_at = now(), voided_by = auth.uid(), void_reason = trim(_reason) where id = _p.id;
  perform log_activity(_p.hotel_id, 'billing', format('Voided %s payment of %s: %s', _p.method, to_char(_p.amount, 'FM999,999,990'), trim(_reason)), _p.reservation_id);
end $function$;

CREATE OR REPLACE FUNCTION public.expense_copy_recurring(_hotel_id uuid, _month date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _from date := date_trunc('month', _month)::date; _prev date := (date_trunc('month', _month) - interval '1 month')::date; _n int;
begin
  if not fin_staff(_hotel_id, 'finance.edit') then raise exception 'Only owners, managers and accountants can add expenses'; end if;
  insert into expenses (hotel_id, spent_on, category_id, supplier_id, payee, description, amount, vat_amount, due_on, recurring, status)
  select e.hotel_id,
         least(_from + (extract(day from e.spent_on)::int - 1), (_from + interval '1 month - 1 day')::date),
         e.category_id, e.supplier_id, e.payee, e.description, e.amount, e.vat_amount,
         case when e.due_on is not null then least(_from + (extract(day from e.due_on)::int - 1), (_from + interval '1 month - 1 day')::date) end,
         true, 'unpaid'
    from expenses e
   where e.hotel_id = _hotel_id and e.recurring and e.status <> 'void'
     and e.spent_on >= _prev and e.spent_on < _from
     and not exists (select 1 from expenses x where x.hotel_id = _hotel_id and x.recurring and x.status <> 'void'
                       and x.spent_on >= _from and x.spent_on < (_from + interval '1 month')::date
                       and x.description = e.description and x.category_id = e.category_id);
  get diagnostics _n = row_count;
  return _n;
end $function$;

CREATE OR REPLACE FUNCTION public.expense_from_receipt(_batch uuid, _due_on date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _h uuid; _sup uuid; _ref text; _total numeric; _id uuid; _cat uuid; _when date; _n int; _po int;
begin
  select m.hotel_id, m.supplier_id, m.reference, sum(m.value), (min(m.created_at) at time zone min(h.timezone))::date, count(*), max(p.number)
    into _h, _sup, _ref, _total, _when, _n, _po
    from stock_movements m join hotels h on h.id = m.hotel_id left join purchase_orders p on p.id = m.po_id
   where m.batch_id = _batch and m.kind = 'receive'
   group by m.hotel_id, m.supplier_id, m.reference;
  if _h is null then raise exception 'Delivery not found'; end if;
  if not (fin_staff(_h, 'finance.edit') or inv_staff(_h)) then raise exception 'You cannot record supplier bills'; end if;
  if _sup is null then raise exception 'This delivery has no supplier; add the bill by hand'; end if;
  if coalesce(_total, 0) <= 0 then raise exception 'This delivery has no cost'; end if;
  select id into _cat from expense_categories where hotel_id = _h and grp = 'stock' and active order by sort limit 1;
  if _cat is null then raise exception 'Add an expense category of type "Stock purchases" first'; end if;
  insert into expenses (hotel_id, spent_on, category_id, supplier_id, description, amount, reference, due_on, receipt_batch, status)
  values (_h, _when, _cat, _sup, format('Goods received: %s item%s%s', _n, case when _n = 1 then '' else 's' end, coalesce(' (PO #' || _po || ')', '')),
          _total, _ref, _due_on, _batch, 'unpaid')
  returning id into _id;
  return _id;
end $function$;

alter policy bs_w on public.booking_settings using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'online.edit')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'online.edit'));
alter policy bud_sel on public.budgets using (fin_staff(hotel_id, 'finance.view'));
alter policy bud_w on public.budgets using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'finance.admin')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'finance.admin'));
alter policy bd_sel on public.business_days using (has_hotel_role_any(hotel_id, ARRAY['owner'::text, 'manager'::text, 'front_desk'::text, 'accountant'::text], 'audit.view'));
alter policy co_ins on public.companies with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'accountant'::hotel_role], 'companies.edit'));
alter policy co_sel on public.companies using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role, 'accountant'::hotel_role], 'companies.view'));
alter policy co_upd on public.companies using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'accountant'::hotel_role], 'companies.edit')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'accountant'::hotel_role], 'companies.edit'));
alter policy cl_sel on public.company_ledger using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'accountant'::hotel_role], 'companies.ledger'));
alter policy cr_all on public.company_rates using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'accountant'::hotel_role], 'companies.edit')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'accountant'::hotel_role], 'companies.edit'));
alter policy cr_sel on public.company_rates using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role, 'accountant'::hotel_role], 'companies.view'));
alter policy eo_sel on public.email_outbox using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role], 'online.view'));
alter policy es_sel on public.email_settings using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role], 'online.view'));
alter policy es_upd on public.email_settings using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'online.edit')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'online.edit'));
alter policy ecat_sel on public.expense_categories using (fin_staff(hotel_id, 'finance.view'));
alter policy ecat_w on public.expense_categories using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'finance.admin')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'finance.admin'));
alter policy exp_ins on public.expenses with check (fin_staff(hotel_id, 'finance.edit'));
alter policy exp_sel on public.expenses using (fin_staff(hotel_id, 'finance.view'));
alter policy exp_upd on public.expenses using (fin_staff(hotel_id, 'finance.edit')) with check (fin_staff(hotel_id, 'finance.edit'));
alter policy charges_insert on public.folio_charges with check ((has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role, 'accountant'::hotel_role], 'billing.create') AND (voided_at IS NULL) AND (kind <> 'room'::charge_kind) AND (posted_by = auth.uid())));
alter policy charges_select on public.folio_charges using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role, 'accountant'::hotel_role], 'billing.view'));
alter policy ft_sel on public.folio_transfers using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role, 'accountant'::hotel_role], 'billing.view'));
alter policy fb_sel on public.guest_feedback using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role, 'accountant'::hotel_role], 'online.view'));
alter policy fb_upd on public.guest_feedback using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role], 'online.reply')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role], 'online.reply'));
alter policy gr_sel on public.guest_requests using (request_staff(hotel_id, department, 'requests.view'));
alter policy guests_delete on public.guests using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'guests.delete'));
alter policy guests_insert on public.guests with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role], 'guests.create'));
alter policy guests_select on public.guests using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role, 'accountant'::hotel_role, 'restaurant'::hotel_role], 'guests.view'));
alter policy guests_update on public.guests using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role], 'guests.edit')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role], 'guests.edit'));
alter policy inv_delete on public.hotel_invitations using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'team.invite'));
alter policy inv_insert on public.hotel_invitations with check ((has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'team.invite') AND ((role <> 'manager'::hotel_role) OR has_hotel_role(hotel_id, ARRAY['owner'::hotel_role]))));
alter policy inv_select on public.hotel_invitations using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'team.invite'));
alter policy hotels_update on public.hotels using (has_hotel_role(id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'settings.edit')) with check (has_hotel_role(id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'settings.edit'));
alter policy hk_insert on public.housekeeping_tasks with check (has_hotel_role_any(hotel_id, ARRAY['owner'::text, 'manager'::text, 'front_desk'::text, 'housekeeping'::text], 'housekeeping.edit'));
alter policy hk_select on public.housekeeping_tasks using (has_hotel_role_any(hotel_id, ARRAY['owner'::text, 'manager'::text, 'front_desk'::text, 'housekeeping'::text], 'housekeeping.view'));
alter policy hk_update on public.housekeeping_tasks using (has_hotel_role_any(hotel_id, ARRAY['owner'::text, 'manager'::text, 'front_desk'::text, 'housekeeping'::text], 'housekeeping.edit')) with check (has_hotel_role_any(hotel_id, ARRAY['owner'::text, 'manager'::text, 'front_desk'::text, 'housekeeping'::text], 'housekeeping.edit'));
alter policy invoices_select on public.invoices using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role, 'accountant'::hotel_role], 'billing.view'));
alter policy mt_update on public.maintenance_tickets using ((has_hotel_role_any(hotel_id, ARRAY['owner'::text, 'manager'::text, 'maintenance'::text, 'front_desk'::text], 'maintenance.edit') OR (assigned_to = auth.uid()))) with check ((has_hotel_role_any(hotel_id, ARRAY['owner'::text, 'manager'::text, 'maintenance'::text, 'front_desk'::text], 'maintenance.edit') OR (assigned_to = auth.uid())));
alter policy payments_insert on public.payments with check ((has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role, 'accountant'::hotel_role], 'billing.create') AND (voided_at IS NULL) AND (received_by = auth.uid()) AND ((amount > (0)::numeric) OR has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'accountant'::hotel_role], 'billing.create'))));
alter policy payments_select on public.payments using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role, 'accountant'::hotel_role], 'billing.view'));
alter policy prates_sel on public.payroll_rates using (payroll_staff(hotel_id, 'payroll.view'));
alter policy prates_w on public.payroll_rates using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role], 'payroll.rates')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role], 'payroll.rates'));
alter policy pruns_del on public.payroll_runs using (payroll_staff(hotel_id, 'payroll.edit'));
alter policy pruns_sel on public.payroll_runs using ((payroll_staff(hotel_id, 'payroll.view') OR payroll_run_has_mine(id)));
alter policy pslip_sel on public.payslips using ((payroll_staff(hotel_id, 'payroll.view') OR payslip_is_mine(staff_id, run_id)));
alter policy pslip_upd on public.payslips using (payroll_staff(hotel_id, 'payroll.edit')) with check (payroll_staff(hotel_id, 'payroll.edit'));
alter policy shifts_sel on public.pos_shifts using (((user_id = auth.uid()) OR has_hotel_role_any(hotel_id, ARRAY['owner'::text, 'manager'::text, 'accountant'::text], 'pos.shifts')));
alter policy pc_sel on public.prechecks using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role], 'precheck.view'));
alter policy pc_upd on public.prechecks using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role], 'precheck.edit')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role], 'precheck.edit'));
alter policy rp_all on public.rate_plans using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'rates.edit')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'rates.edit'));
alter policy rsp_all on public.rate_season_prices using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'rates.edit')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'rates.edit'));
alter policy rs_all on public.rate_seasons using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'rates.edit')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'rates.edit'));
alter policy rt_all on public.request_types using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'requests.settings')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'requests.settings'));
alter policy res_insert on public.reservations with check ((has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role], 'reservations.create') AND (status = 'confirmed'::reservation_status)));
alter policy res_update on public.reservations using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role], 'reservations.edit')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role], 'reservations.edit'));
alter policy rl_sel on public.room_links using (has_hotel_role_any(hotel_id, ARRAY['owner'::text, 'manager'::text, 'front_desk'::text], 'requests.view'));
alter policy room_types_write on public.room_types using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'rooms.edit')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'rooms.edit'));
alter policy rooms_delete on public.rooms using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'rooms.delete'));
alter policy rooms_insert on public.rooms with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role], 'rooms.create'));
alter policy rooms_update on public.rooms using (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role, 'housekeeping'::hotel_role], 'rooms.status|rooms.edit')) with check (has_hotel_role(hotel_id, ARRAY['owner'::hotel_role, 'manager'::hotel_role, 'front_desk'::hotel_role, 'housekeeping'::hotel_role], 'rooms.status|rooms.edit'));
alter policy pay_sel on public.staff_pay using (has_hotel_role_any(hotel_id, ARRAY['owner'::text, 'manager'::text, 'accountant'::text], 'payroll.view'));
alter policy te_sel on public.time_entries using ((rota_clocker(hotel_id) OR has_hotel_role_any(hotel_id, ARRAY['accountant'::text], 'payroll.view|staff.clock') OR (EXISTS ( SELECT 1
   FROM staff s
  WHERE ((s.id = time_entries.staff_id) AND (s.user_id = auth.uid()))))));
