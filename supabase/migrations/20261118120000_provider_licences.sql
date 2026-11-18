-- HotelEasy provider console: licence plans, one licence per hotel company, and enforcement.
--
-- The service provider (people in public.platform_admins) registers hotel companies, picks a plan (which pages
-- the hotel may use, users included, price), sets the licence period and the number of users, and can renew,
-- change or suspend it.
--
-- Enforced in the database, not only hidden on screen:
--   - licence not started, ended or suspended: every check for that hotel fails (staff can't use the app,
--     the booking page and WhatsApp bot stop); the app shows "Licence expired, contact your provider";
--   - pages not in the plan: permission checks for those modules fail, also for the owner;
--   - users: no new invitations or members beyond the licence's user limit.
-- Hotels that exist before this update get an unlimited licence (no lock-outs on day one).
-- Become a provider admin once, in the SQL editor (replace the email):
--   insert into public.platform_admins (user_id) select id from auth.users where email = 'you@example.com';
-- Runs after 20261118090000_whatsapp_resume.sql (needs platform_admins from 20261117120000_website.sql).

-- ---------------------------------------------------------------- safety: platform_admins may be missing
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;
grant execute on function public.is_platform_admin() to anon, authenticated;

create or replace function public.provider_guard() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Only the HotelEasy provider team can do this'; end if;
end $$;

-- ---------------------------------------------------------------- tables
create table if not exists public.license_plans (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(btrim(name)) between 1 and 60),
  description     text check (description is null or length(description) <= 300),
  price           numeric(12,2) not null default 0 check (price >= 0),
  currency        text not null default 'KES' check (currency ~ '^[A-Z]{3}$'),
  billing_period  text not null default 'month' check (billing_period in ('month', 'year')),
  staff_included  int not null default 5 check (staff_included between 1 and 10000),
  modules         text[] not null default '{}',       -- pages included (permission_catalog.module); core pages always on
  active          boolean not null default true,
  sort            int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.hotel_licenses (
  hotel_id     uuid primary key references public.hotels(id) on delete cascade,
  plan_id      uuid references public.license_plans(id) on delete set null,
  status       text not null default 'active' check (status in ('active', 'suspended')),
  starts_on    date,
  ends_on      date,                                    -- last day of use (null = no end)
  staff_limit  int check (staff_limit is null or staff_limit between 1 and 10000),   -- app users incl. owner (null = no limit)
  source       text not null default 'provider' check (source in ('provider', 'self_signup', 'existing')),
  owner_name   text,
  owner_email  text,
  owner_phone  text,
  notes        text check (notes is null or length(notes) <= 2000),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table if not exists public.license_history (
  id        uuid primary key default gen_random_uuid(),
  hotel_id  uuid not null references public.hotels(id) on delete cascade,
  action    text not null,
  details   jsonb not null default '{}',
  by_user   uuid,
  at        timestamptz not null default now()
);
create index if not exists license_history_hotel on public.license_history (hotel_id, at desc);

create table if not exists public.provider_settings (
  id                  int primary key default 1 check (id = 1),
  allow_self_signup   boolean not null default true,
  trial_days          int not null default 14 check (trial_days between 0 and 365),     -- 0 = no end date
  trial_staff_limit   int not null default 5 check (trial_staff_limit between 1 and 10000),
  trial_plan_id       uuid references public.license_plans(id) on delete set null,
  warn_days           int not null default 7 check (warn_days between 1 and 60),
  support_name        text,
  support_email       text,
  support_phone       text,
  updated_at          timestamptz not null default now()
);
insert into public.provider_settings (id) values (1) on conflict do nothing;

alter table public.license_plans enable row level security;
alter table public.hotel_licenses enable row level security;
alter table public.license_history enable row level security;
alter table public.provider_settings enable row level security;
revoke all on public.license_plans, public.hotel_licenses, public.license_history, public.provider_settings from anon, authenticated;

-- every existing hotel: unlimited licence, so nobody is locked out when this goes live
insert into public.hotel_licenses (hotel_id, status, starts_on, ends_on, staff_limit, source)
select h.id, 'active', null, null, null, 'existing' from public.hotels h
on conflict (hotel_id) do nothing;

-- ---------------------------------------------------------------- the checks
create or replace function public.hotel_today(_hotel_id uuid) returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select timezone from hotels where id = _hotel_id), 'Africa/Nairobi'))::date
$$;

/** May this hotel use HotelEasy today? (no licence row = yes, for safety) */
create or replace function public.hotel_access_ok(_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select l.status = 'active'
       and (l.starts_on is null or l.starts_on <= public.hotel_today(_hotel_id))
       and (l.ends_on is null or l.ends_on >= public.hotel_today(_hotel_id))
      from hotel_licenses l where l.hotel_id = _hotel_id), true)
$$;

/** Pages that are always on, whatever the plan: the dashboard, settings and the team. */
create or replace function public.core_modules() returns text[] language sql immutable as $$
  select array['dashboard', 'settings', 'team']
$$;

/** The pages this hotel's plan includes (null = all). */
create or replace function public.hotel_modules(_hotel_id uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select p.modules || public.core_modules()
    from hotel_licenses l join license_plans p on p.id = l.plan_id where l.hotel_id = _hotel_id
$$;

/** Is any of these permissions ('a.view|b.edit') in a page the plan includes? */
create or replace function public.hotel_module_ok(_hotel_id uuid, _perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when m is null then true
              else exists (select 1 from unnest(string_to_array(coalesce(_perm, ''), '|')) x where split_part(x, '.', 1) = any(m)) end
    from (select public.hotel_modules(_hotel_id) m) t
$$;

create or replace function public.is_hotel_member(_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hotel_members where hotel_id = _hotel_id and user_id = auth.uid())
     and public.hotel_access_ok(_hotel_id);
$$;
create or replace function public.has_hotel_role(_hotel_id uuid, _roles public.hotel_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hotel_members
    where hotel_id = _hotel_id and user_id = auth.uid() and custom_role_id is null and role = any(_roles))
     and public.hotel_access_ok(_hotel_id);
$$;
create or replace function public.has_hotel_role_any(_hotel_id uuid, _roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hotel_members
    where hotel_id = _hotel_id and user_id = auth.uid() and custom_role_id is null and role::text = any(_roles))
     and public.hotel_access_ok(_hotel_id);
$$;
create or replace function public.has_hotel_role(_hotel_id uuid, _roles public.hotel_role[], _perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hotel_members m left join public.hotel_roles r on r.id = m.custom_role_id
    where m.hotel_id = _hotel_id and m.user_id = auth.uid()
      and case when m.custom_role_id is null then m.role = any(_roles)
               else coalesce(r.permissions && string_to_array(_perm, '|'), false) end)
     and public.hotel_access_ok(_hotel_id) and public.hotel_module_ok(_hotel_id, _perm);
$$;
create or replace function public.has_hotel_role_any(_hotel_id uuid, _roles text[], _perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hotel_members m left join public.hotel_roles r on r.id = m.custom_role_id
    where m.hotel_id = _hotel_id and m.user_id = auth.uid()
      and case when m.custom_role_id is null then m.role::text = any(_roles)
               else coalesce(r.permissions && string_to_array(_perm, '|'), false) end)
     and public.hotel_access_ok(_hotel_id) and public.hotel_module_ok(_hotel_id, _perm);
$$;
create or replace function public.has_perm(_hotel_id uuid, _perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hotel_members m left join public.hotel_roles r on r.id = m.custom_role_id
    where m.hotel_id = _hotel_id and m.user_id = auth.uid()
      and case when m.role = 'owner' then true
               when m.custom_role_id is not null then coalesce(r.permissions && string_to_array(_perm, '|'), false)
               else exists (select 1 from public.permission_catalog c where c.key = any(string_to_array(_perm, '|')) and m.role::text = any(c.default_roles)) end)
     and public.hotel_access_ok(_hotel_id) and public.hotel_module_ok(_hotel_id, _perm);
$$;
-- what can I do here? (only pages in the plan)
create or replace function public.my_permissions(_hotel_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'role', m.role, 'custom_role_id', m.custom_role_id, 'custom_role_name', r.name,
    'permissions', coalesce((select array_agg(k order by s) from (
        select c.key k, c.sort s from permission_catalog c
         where public.hotel_module_ok(_hotel_id, c.key)
           and case when m.role = 'owner' then true
                    when m.custom_role_id is not null then c.key = any(r.permissions)
                    else m.role::text = any(c.default_roles) end) x), '{}'))
  from hotel_members m left join hotel_roles r on r.id = m.custom_role_id
  where m.hotel_id = _hotel_id and m.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------- the licence as the hotel sees it
create or replace function public.hotel_license_info(_hotel_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from hotel_members where hotel_id = _hotel_id and user_id = auth.uid()) or public.is_platform_admin() then
    (select jsonb_build_object(
      'state', case when l.hotel_id is null then 'active'
                    when l.status = 'suspended' then 'suspended'
                    when l.starts_on is not null and l.starts_on > t.today then 'not_started'
                    when l.ends_on is not null and l.ends_on < t.today then 'expired'
                    when l.ends_on is not null and l.ends_on - t.today < s.warn_days then 'expiring'
                    else 'active' end,
      'starts_on', l.starts_on, 'ends_on', l.ends_on,
      'days_left', case when l.ends_on is not null then l.ends_on - t.today end,
      'staff_limit', l.staff_limit,
      'staff_used', (select count(*) from hotel_members where hotel_id = _hotel_id)
                  + (select count(*) from hotel_invitations where hotel_id = _hotel_id and accepted_at is null),
      'plan_name', p.name, 'modules', public.hotel_modules(_hotel_id), 'core_modules', public.core_modules(),
      'support', jsonb_build_object('name', s.support_name, 'email', s.support_email, 'phone', s.support_phone))
     from (select public.hotel_today(_hotel_id) today) t
     cross join provider_settings s
     left join hotel_licenses l on l.hotel_id = _hotel_id
     left join license_plans p on p.id = l.plan_id
     where s.id = 1)
  end
$$;

/** My hotels with each one's licence: works even when a licence has ended, so the app can say so. */
create or replace function public.my_hotels()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'hotel_id', m.hotel_id, 'role', m.role, 'custom_role_id', m.custom_role_id,
    'hotels', to_jsonb(h), 'license', public.hotel_license_info(h.id)) order by m.created_at), '[]'::jsonb)
  from hotel_members m join hotels h on h.id = m.hotel_id
  where m.user_id = auth.uid()
$$;
revoke execute on function public.hotel_license_info(uuid), public.my_hotels() from public, anon;
grant execute on function public.hotel_license_info(uuid), public.my_hotels() to authenticated;

-- ---------------------------------------------------------------- new hotels and users
/** Self sign-up: allowed only when the provider allows it; such hotels get a trial licence. */
create or replace function public.hotels_licence_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('hotel_easy.provider', true), '') <> 'on'
     and not coalesce((select allow_self_signup from provider_settings where id = 1), true) then
    raise exception 'LICENCE: New hotels are registered by your HotelEasy provider. Please contact them to open an account.';
  end if;
  return new;
end $$;
create or replace function public.hotels_licence_after() returns trigger language plpgsql security definer set search_path = public as $$
declare _s provider_settings; _today date;
begin
  if coalesce(current_setting('hotel_easy.provider', true), '') = 'on' then return new; end if;   -- the provider adds the licence
  select * into _s from provider_settings where id = 1;
  _today := (now() at time zone coalesce(new.timezone, 'Africa/Nairobi'))::date;
  insert into hotel_licenses (hotel_id, plan_id, status, starts_on, ends_on, staff_limit, source, owner_email)
  values (new.id, _s.trial_plan_id, 'active', _today, case when coalesce(_s.trial_days, 0) > 0 then _today + _s.trial_days - 1 end,
          coalesce(_s.trial_staff_limit, 5), 'self_signup', (select email from auth.users where id = auth.uid()))
  on conflict (hotel_id) do nothing;
  insert into license_history (hotel_id, action, details, by_user) values (new.id, 'trial started',
    jsonb_build_object('days', _s.trial_days, 'staff_limit', _s.trial_staff_limit), auth.uid());
  return new;
end $$;
drop trigger if exists hotels_licence_before on public.hotels;
create trigger hotels_licence_before before insert on public.hotels for each row execute function public.hotels_licence_before();
drop trigger if exists hotels_licence_after on public.hotels;
create trigger hotels_licence_after after insert on public.hotels for each row execute function public.hotels_licence_after();

/** Users with an app login (members + pending invitations), against the licence's limit. */
create or replace function public.hotel_users_used(_hotel_id uuid) returns int language sql stable security definer set search_path = public as $$
  select ((select count(*) from hotel_members where hotel_id = _hotel_id)
        + (select count(*) from hotel_invitations where hotel_id = _hotel_id and accepted_at is null))::int
$$;

create or replace function public.members_licence_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare _limit int;
begin
  select staff_limit into _limit from hotel_licenses where hotel_id = new.hotel_id;
  if _limit is not null and (select count(*) from hotel_members where hotel_id = new.hotel_id) >= _limit then
    raise exception 'LICENCE: This hotel''s licence allows % users. Ask your HotelEasy provider for more.', _limit;
  end if;
  return new;
end $$;
drop trigger if exists members_licence_guard on public.hotel_members;
create trigger members_licence_guard before insert on public.hotel_members for each row execute function public.members_licence_guard();

-- owner invitations: only the provider creates them
alter table public.hotel_invitations drop constraint if exists hotel_invitations_role_check;
create or replace function public.invitations_licence_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare _limit int;
begin
  if new.role = 'owner' and coalesce(current_setting('hotel_easy.provider', true), '') <> 'on' then
    raise exception 'Only the HotelEasy provider can invite an owner';
  end if;
  if new.accepted_at is null then
    select staff_limit into _limit from hotel_licenses where hotel_id = new.hotel_id;
    if _limit is not null and public.hotel_users_used(new.hotel_id) >= _limit then
      raise exception 'LICENCE: This hotel''s licence allows % users (people with a login, including invitations not yet accepted). Ask your HotelEasy provider for more.', _limit;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists invitations_licence_guard on public.hotel_invitations;
create trigger invitations_licence_guard before insert on public.hotel_invitations for each row execute function public.invitations_licence_guard();

-- accepting invitations: one that doesn't fit the licence stays pending instead of breaking sign-in
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
    begin
      insert into hotel_members (hotel_id, user_id, role, custom_role_id)
      values (_inv.hotel_id, _uid, _inv.role, _inv.custom_role_id)
      on conflict (hotel_id, user_id) do nothing;
      update hotel_invitations set accepted_at = now() where id = _inv.id;
      perform log_activity(_inv.hotel_id, 'staff', format('%s joined as %s', _email, coalesce(_inv.role_name, replace(_inv.role::text, '_', ' '))));
      _n := _n + 1;
    exception when others then
      null;   -- e.g. the licence is full: leave it pending
    end;
  end loop;
  perform set_config('hotel_easy.rpc', '', true);
  return _n;
end $$;

-- ---------------------------------------------------------------- the provider console
create or replace function public.provider_modules()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_platform_admin() then (
    select jsonb_agg(jsonb_build_object('module', module, 'label', label, 'core', module = any(public.core_modules())) order by s)
      from (select module, min(module_label) label, min(sort) s from permission_catalog group by module) x) end
$$;

create or replace function public.provider_plans()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_platform_admin() then coalesce((
    select jsonb_agg(to_jsonb(p) || jsonb_build_object('hotels', (select count(*) from hotel_licenses l where l.plan_id = p.id)) order by p.sort, p.name)
      from license_plans p), '[]'::jsonb) end
$$;

create or replace function public.provider_plan_save(_id uuid, _name text, _description text, _price numeric, _currency text,
  _billing_period text, _staff_included int, _modules text[], _active boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare _bad text; _mods text[];
begin
  perform public.provider_guard();
  if length(btrim(coalesce(_name, ''))) = 0 then raise exception 'Give the plan a name'; end if;
  select string_agg(m, ', ') into _bad from unnest(coalesce(_modules, '{}')) m
   where not exists (select 1 from permission_catalog c where c.module = m);
  if _bad is not null then raise exception 'Unknown pages: %', _bad; end if;
  select coalesce(array_agg(distinct m), '{}') into _mods from unnest(coalesce(_modules, '{}')) m where m <> all(public.core_modules());
  if _id is null then
    insert into license_plans (name, description, price, currency, billing_period, staff_included, modules, active)
    values (btrim(_name), nullif(btrim(_description), ''), coalesce(_price, 0), upper(coalesce(nullif(btrim(_currency), ''), 'KES')),
            coalesce(_billing_period, 'month'), coalesce(_staff_included, 5), _mods, coalesce(_active, true))
    returning id into _id;
  else
    update license_plans set name = btrim(_name), description = nullif(btrim(_description), ''), price = coalesce(_price, 0),
      currency = upper(coalesce(nullif(btrim(_currency), ''), 'KES')), billing_period = coalesce(_billing_period, 'month'),
      staff_included = coalesce(_staff_included, 5), modules = _mods, active = coalesce(_active, true), updated_at = now()
    where id = _id;
    if not found then raise exception 'Plan not found'; end if;
  end if;
  return _id;
end $$;

create or replace function public.provider_plan_delete(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.provider_guard();
  if exists (select 1 from hotel_licenses where plan_id = _id) then
    raise exception 'Hotels are on this plan. Switch it off instead, or move those hotels to another plan first.';
  end if;
  delete from license_plans where id = _id;
end $$;

/** A hotel's licence and the people with a login, for the console. */
create or replace function public.provider_company_row(_hotel_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'hotel', jsonb_build_object('id', h.id, 'name', h.name, 'city', h.city, 'address', h.address, 'country', h.country, 'phone', h.phone,
                                'email', h.email, 'currency', h.currency, 'timezone', h.timezone, 'created_at', h.created_at),
    'license', jsonb_build_object('plan_id', l.plan_id, 'plan_name', p.name, 'status', l.status, 'starts_on', l.starts_on, 'ends_on', l.ends_on,
                                  'staff_limit', l.staff_limit, 'source', l.source, 'owner_name', l.owner_name, 'owner_email', l.owner_email,
                                  'owner_phone', l.owner_phone, 'notes', l.notes, 'price', p.price, 'currency', p.currency, 'billing_period', p.billing_period),
    'state', (public.hotel_license_info(h.id))->>'state',
    'days_left', case when l.ends_on is not null then l.ends_on - public.hotel_today(h.id) end,
    'users', public.hotel_users_used(h.id),
    'owner', (select jsonb_build_object('email', u.email, 'joined', true) from hotel_members m join auth.users u on u.id = m.user_id
               where m.hotel_id = h.id and m.role = 'owner' order by m.created_at limit 1),
    'owner_invite', (select jsonb_build_object('email', i.email, 'sent', i.created_at) from hotel_invitations i
                      where i.hotel_id = h.id and i.role = 'owner' and i.accepted_at is null order by i.created_at desc limit 1),
    'rooms', (select count(*) from rooms where hotel_id = h.id),
    'last_activity', (select max(created_at) from activity_log where hotel_id = h.id))
  from hotels h left join hotel_licenses l on l.hotel_id = h.id left join license_plans p on p.id = l.plan_id
  where h.id = _hotel_id
$$;
revoke execute on function public.provider_company_row(uuid) from public, anon, authenticated;

create or replace function public.provider_companies()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_platform_admin() then coalesce((
    select jsonb_agg(public.provider_company_row(h.id) order by h.created_at desc) from hotels h), '[]'::jsonb) end
$$;

create or replace function public.provider_company(_hotel_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_platform_admin() then public.provider_company_row(_hotel_id) || jsonb_build_object(
    'members', coalesce((select jsonb_agg(jsonb_build_object('email', u.email, 'role', m.role, 'since', m.created_at) order by m.created_at)
                 from hotel_members m join auth.users u on u.id = m.user_id where m.hotel_id = _hotel_id), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('email', i.email, 'role', i.role, 'sent', i.created_at) order by i.created_at)
                 from hotel_invitations i where i.hotel_id = _hotel_id and i.accepted_at is null), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('action', x.action, 'details', x.details, 'at', x.at, 'by', u.email) order by x.at desc)
                 from (select * from license_history where hotel_id = _hotel_id order by at desc limit 40) x left join auth.users u on u.id = x.by_user), '[]'::jsonb)) end
$$;

create or replace function public.provider_overview()
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (select h.id, (public.hotel_license_info(h.id))->>'state' st, l.ends_on, l.staff_limit, p.price, p.billing_period
               from hotels h left join hotel_licenses l on l.hotel_id = h.id left join license_plans p on p.id = l.plan_id)
  select case when public.is_platform_admin() then jsonb_build_object(
    'companies', (select count(*) from c),
    'active', (select count(*) from c where st in ('active', 'expiring')),
    'expiring', (select count(*) from c where st = 'expiring'),
    'expired', (select count(*) from c where st = 'expired'),
    'suspended', (select count(*) from c where st = 'suspended'),
    'not_started', (select count(*) from c where st = 'not_started'),
    'users', (select coalesce(sum(public.hotel_users_used(id)), 0) from c),
    'user_limit', (select coalesce(sum(staff_limit), 0) from c where staff_limit is not null),
    'monthly_revenue', (select coalesce(sum(case when billing_period = 'year' then price / 12 else price end), 0) from c where st in ('active', 'expiring')),
    'plans', (select count(*) from license_plans where active),
    'renew_soon', coalesce((select jsonb_agg(public.provider_company_row(id) order by ends_on)
                  from c where ends_on is not null and st in ('expiring', 'active', 'expired') and ends_on <= current_date + 30), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(public.provider_company_row(id)) from (select id from hotels order by created_at desc limit 5) r), '[]'::jsonb)) end
$$;

/** Register a hotel company: the hotel, its licence, and an owner invitation (the provider is not added as staff). */
create or replace function public.provider_create_company(_plan_id uuid, _hotel jsonb, _owner jsonb, _license jsonb, _sample_rooms boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare _h uuid; _p license_plans; _email text; _std uuid; _dlx uuid; _ste uuid; i int; _limit int; _starts date; _ends date;
begin
  perform public.provider_guard();
  select * into _p from license_plans where id = _plan_id;
  if _p.id is null then raise exception 'Choose a plan'; end if;
  if length(btrim(coalesce(_hotel->>'name', ''))) = 0 then raise exception 'Enter the hotel name'; end if;
  _email := lower(btrim(coalesce(_owner->>'email', '')));
  if _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter the owner''s email address'; end if;
  _starts := coalesce(nullif(_license->>'starts_on', '')::date, current_date);
  _ends := nullif(_license->>'ends_on', '')::date;
  if _ends is not null and _ends < _starts then raise exception 'The licence must end after it starts'; end if;
  _limit := coalesce(nullif(_license->>'staff_limit', '')::int, _p.staff_included);
  if _limit < 1 then raise exception 'Allow at least 1 user (the owner)'; end if;
  if coalesce(_hotel->>'timezone', '') <> '' and not exists (select 1 from pg_timezone_names where name = _hotel->>'timezone') then
    raise exception 'Unknown time zone';
  end if;

  perform set_config('hotel_easy.provider', 'on', true);
  insert into hotels (name, city, address, country, phone, email, currency, timezone, created_by)
  values (btrim(_hotel->>'name'), nullif(btrim(_hotel->>'city'), ''), nullif(btrim(_hotel->>'address'), ''),
          coalesce(nullif(btrim(_hotel->>'country'), ''), 'Kenya'), nullif(btrim(_hotel->>'phone'), ''), nullif(btrim(_hotel->>'email'), ''),
          upper(coalesce(nullif(btrim(_hotel->>'currency'), ''), 'KES')), coalesce(nullif(_hotel->>'timezone', ''), 'Africa/Nairobi'), auth.uid())
  returning id into _h;

  insert into hotel_licenses (hotel_id, plan_id, status, starts_on, ends_on, staff_limit, source, owner_name, owner_email, owner_phone, notes, updated_by)
  values (_h, _p.id, 'active', _starts, _ends, _limit, 'provider', nullif(btrim(_owner->>'name'), ''), _email,
          nullif(btrim(_owner->>'phone'), ''), nullif(btrim(_license->>'notes'), ''), auth.uid());

  insert into hotel_invitations (hotel_id, email, role, invited_by) values (_h, _email, 'owner', auth.uid());

  if _sample_rooms then
    insert into room_types (hotel_id, name, base_rate, max_occupancy, amenities)
      values (_h, 'Standard', 6500, 2, array['WiFi','TV','Hot shower']) returning id into _std;
    insert into room_types (hotel_id, name, base_rate, max_occupancy, amenities)
      values (_h, 'Deluxe', 9500, 3, array['WiFi','TV','Hot shower','Balcony','Mini fridge']) returning id into _dlx;
    insert into room_types (hotel_id, name, base_rate, max_occupancy, amenities)
      values (_h, 'Suite', 15000, 4, array['WiFi','TV','Bathtub','Lounge','Mini bar']) returning id into _ste;
    for i in 1..6 loop insert into rooms (hotel_id, room_number, room_type_id, floor) values (_h, (100 + i)::text, _std, 1); end loop;
    for i in 1..4 loop insert into rooms (hotel_id, room_number, room_type_id, floor) values (_h, (200 + i)::text, _dlx, 2); end loop;
    for i in 1..2 loop insert into rooms (hotel_id, room_number, room_type_id, floor) values (_h, (300 + i)::text, _ste, 3); end loop;
  end if;

  insert into license_history (hotel_id, action, details, by_user) values (_h, 'registered', jsonb_build_object(
    'plan', _p.name, 'starts_on', _starts, 'ends_on', _ends, 'staff_limit', _limit, 'owner', _email), auth.uid());
  perform log_activity(_h, 'staff', 'Hotel registered by the HotelEasy provider');
  perform set_config('hotel_easy.provider', '', true);
  return _h;
end $$;

/** Change the plan, dates, user limit, status or notes (renew, extend, suspend, reactivate). */
create or replace function public.provider_license_save(_hotel_id uuid, _plan_id uuid, _starts_on date, _ends_on date,
  _staff_limit int, _status text, _notes text, _action text default 'updated')
returns jsonb language plpgsql security definer set search_path = public as $$
declare _old hotel_licenses;
begin
  perform public.provider_guard();
  if _status not in ('active', 'suspended') then raise exception 'Unknown status'; end if;
  if _ends_on is not null and _starts_on is not null and _ends_on < _starts_on then raise exception 'The licence must end after it starts'; end if;
  if _plan_id is not null and not exists (select 1 from license_plans where id = _plan_id) then raise exception 'Plan not found'; end if;
  select * into _old from hotel_licenses where hotel_id = _hotel_id;
  insert into hotel_licenses (hotel_id) values (_hotel_id) on conflict do nothing;
  update hotel_licenses set plan_id = _plan_id, starts_on = _starts_on, ends_on = _ends_on, staff_limit = _staff_limit,
    status = _status, notes = nullif(btrim(_notes), ''), updated_at = now(), updated_by = auth.uid()
  where hotel_id = _hotel_id;
  insert into license_history (hotel_id, action, details, by_user) values (_hotel_id, left(coalesce(_action, 'updated'), 40), jsonb_build_object(
    'plan', (select name from license_plans where id = _plan_id), 'starts_on', _starts_on, 'ends_on', _ends_on, 'staff_limit', _staff_limit,
    'status', _status, 'was', jsonb_build_object('ends_on', _old.ends_on, 'status', _old.status, 'staff_limit', _old.staff_limit,
                                                 'plan', (select name from license_plans where id = _old.plan_id))), auth.uid());
  return public.provider_company_row(_hotel_id);
end $$;

/** Fix the owner's email (a typo) while they haven't joined yet; sends a fresh invitation. */
create or replace function public.provider_owner_save(_hotel_id uuid, _name text, _email text, _phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.provider_guard();
  _email := lower(btrim(coalesce(_email, '')));
  if _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter the owner''s email address'; end if;
  update hotel_licenses set owner_name = nullif(btrim(_name), ''), owner_email = _email, owner_phone = nullif(btrim(_phone), ''),
    updated_at = now(), updated_by = auth.uid() where hotel_id = _hotel_id;
  if not exists (select 1 from hotel_members where hotel_id = _hotel_id and role = 'owner') then
    perform set_config('hotel_easy.provider', 'on', true);
    delete from hotel_invitations where hotel_id = _hotel_id and role = 'owner' and accepted_at is null;
    insert into hotel_invitations (hotel_id, email, role, invited_by) values (_hotel_id, _email, 'owner', auth.uid());
    perform set_config('hotel_easy.provider', '', true);
  end if;
  insert into license_history (hotel_id, action, details, by_user) values (_hotel_id, 'owner changed', jsonb_build_object('owner', _email), auth.uid());
  return public.provider_company_row(_hotel_id);
end $$;

create or replace function public.provider_settings_get()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_platform_admin() then (select to_jsonb(s) from provider_settings s where id = 1) end
$$;
create or replace function public.provider_settings_save(_allow_self_signup boolean, _trial_days int, _trial_staff_limit int,
  _trial_plan_id uuid, _warn_days int, _support_name text, _support_email text, _support_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.provider_guard();
  update provider_settings set allow_self_signup = coalesce(_allow_self_signup, true), trial_days = coalesce(_trial_days, 14),
    trial_staff_limit = coalesce(_trial_staff_limit, 5), trial_plan_id = _trial_plan_id, warn_days = coalesce(_warn_days, 7),
    support_name = nullif(btrim(_support_name), ''), support_email = nullif(btrim(_support_email), ''),
    support_phone = nullif(btrim(_support_phone), ''), updated_at = now()
  where id = 1;
  return public.provider_settings_get();
end $$;

/** For the sign-up page: may hotels open an account themselves, and whom to contact otherwise. */
create or replace function public.signup_info()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('allow_self_signup', allow_self_signup, 'trial_days', trial_days,
    'support', jsonb_build_object('name', support_name, 'email', support_email, 'phone', support_phone))
  from provider_settings where id = 1
$$;

revoke execute on function public.provider_modules(), public.provider_plans(),
  public.provider_plan_save(uuid, text, text, numeric, text, text, int, text[], boolean), public.provider_plan_delete(uuid),
  public.provider_companies(), public.provider_company(uuid), public.provider_overview(),
  public.provider_create_company(uuid, jsonb, jsonb, jsonb, boolean),
  public.provider_license_save(uuid, uuid, date, date, int, text, text, text), public.provider_owner_save(uuid, text, text, text),
  public.provider_settings_get(), public.provider_settings_save(boolean, int, int, uuid, int, text, text, text) from public, anon;
grant execute on function public.provider_modules(), public.provider_plans(),
  public.provider_plan_save(uuid, text, text, numeric, text, text, int, text[], boolean), public.provider_plan_delete(uuid),
  public.provider_companies(), public.provider_company(uuid), public.provider_overview(),
  public.provider_create_company(uuid, jsonb, jsonb, jsonb, boolean),
  public.provider_license_save(uuid, uuid, date, date, int, text, text, text), public.provider_owner_save(uuid, text, text, text),
  public.provider_settings_get(), public.provider_settings_save(boolean, int, int, uuid, int, text, text, text) to authenticated;
grant execute on function public.signup_info() to anon, authenticated;

-- ---------------------------------------------------------------- guest-facing pages stop with the licence
-- Same as in 20261117210000_site_addresses.sql, plus the licence check.
create or replace function public.public_hotel(_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _h hotels; _s booking_settings; _new text;
begin
  select s.* into _s from booking_settings s where s.slug = lower(trim(_slug)) and s.enabled;
  if not found then
    select s.slug into _new from booking_slug_history h join booking_settings s on s.hotel_id = h.hotel_id
     where h.slug = lower(trim(_slug)) and s.enabled;
    return case when _new is not null then jsonb_build_object('redirect', _new) end;
  end if;
  if not public.hotel_access_ok(_s.hotel_id) then return null; end if;
  select * into _h from hotels where id = _s.hotel_id;
  return jsonb_build_object(
    'name', _h.name, 'city', _h.city, 'address', _h.address, 'country', _h.country, 'phone', _h.phone, 'email', _h.email,
    'currency', _h.currency, 'checkin_time', to_char(_h.checkin_time, 'HH24:MI'), 'checkout_time', to_char(_h.checkout_time, 'HH24:MI'),
    'prices_include_tax', _h.prices_include_vat, 'tax_rate', _h.vat_rate + _h.tourism_levy_rate,
    'today', (now() at time zone _h.timezone)::date,
    'headline', _s.headline, 'description', _s.description, 'photo_url', _s.photo_url, 'policies', _s.policies,
    'payment_instructions', _s.payment_instructions, 'whatsapp', _s.whatsapp, 'free_cancel_days', _s.free_cancel_days,
    'min_nights', _s.min_nights, 'max_nights', _s.max_nights, 'max_advance_days', _s.max_advance_days,
    'gallery', to_jsonb(_s.gallery), 'features', _s.features, 'site', _s.site,
    'room_types', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', t.id, 'name', t.name, 'description', t.description, 'max_occupancy', t.max_occupancy,
               'amenities', t.amenities, 'photo_url', t.photo_url, 'gallery', to_jsonb(t.gallery),
               'rate', coalesce(t.online_rate, t.base_rate))
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

-- WhatsApp: no bot replies for a hotel whose licence has ended (same as 20261117240000, plus the licence check)
create or replace function public.whatsapp_hook(_hook_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'hotel_id', s.hotel_id, 'enabled', s.enabled and public.hotel_access_ok(s.hotel_id), 'bot_enabled', s.bot_enabled, 'bot_mode', s.bot_mode,
    'phone_number_id', s.phone_number_id, 'verify_token', s.verify_token, 'app_secret', c.app_secret, 'access_token', c.access_token,
    'bot_name', s.bot_name, 'instructions', s.instructions, 'handoff_message', s.handoff_message,
    'free_limit', s.free_limit, 'stop_at_free_limit', s.stop_at_free_limit,
    'sent_this_month', public.whatsapp_sent_this_month(s.hotel_id),
    'slug', (select b.slug from booking_settings b where b.hotel_id = s.hotel_id and b.enabled),
    'hotel_name', (select name from hotels where id = s.hotel_id))
  from whatsapp_settings s left join whatsapp_credentials c on c.hotel_id = s.hotel_id
  where s.hook_key = _hook_key
$$;
