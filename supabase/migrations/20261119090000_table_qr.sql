-- =====================================================================
-- Table QR (step 1): a diner scans the QR code on their restaurant table, sees the menu with prices
-- and taps "Call waiter", "Bring the bill" or "Water / other". Staff see a live table map with sound.
--
-- Multi-tenant: every row carries hotel_id; staff reads go through has_perm (which also checks the
-- licence and the provider plan); the public side only works with a table's secret token, and only
-- while the hotel's licence is active, its plan includes "Table QR", and the outlet and table are on.
-- Run AFTER 20261118120000_provider_licences.sql.
-- =====================================================================

-- ---------------------------------------------------------------- permissions (a "Table QR" page in plans)
insert into public.permission_catalog (key, module, module_label, action, label, sort, default_roles, added_at) values
  ('tableqr.view', 'tableqr', 'Table QR', 'view', 'See the live table map and waiter calls', 36, array['owner','manager','front_desk','restaurant'], now()),
  ('tableqr.respond', 'tableqr', 'Table QR', 'respond', 'Answer waiter calls (On my way / Done)', 37, array['owner','manager','front_desk','restaurant'], now()),
  ('tableqr.admin', 'tableqr', 'Table QR', 'admin', 'Switch table QR on or off, print and renew QR codes, see response times', 38, array['owner','manager'], now())
on conflict (key) do nothing;

-- ---------------------------------------------------------------- on/off per outlet
alter table public.pos_outlets add column if not exists table_qr_enabled boolean not null default true;

-- ---------------------------------------------------------------- one secret link per table
create table if not exists public.table_links (
  table_id   uuid primary key references public.pos_tables(id) on delete cascade,
  hotel_id   uuid not null references public.hotels(id) on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists table_links_hotel on public.table_links (hotel_id);

create or replace function public.tg_pos_table_link() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into table_links (table_id, hotel_id) values (new.id, new.hotel_id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists pos_tables_link on public.pos_tables;
create trigger pos_tables_link after insert on public.pos_tables for each row execute function public.tg_pos_table_link();
insert into public.table_links (table_id, hotel_id) select id, hotel_id from public.pos_tables on conflict do nothing;

alter table public.table_links enable row level security;
revoke all on public.table_links from anon;
drop policy if exists tl_sel on public.table_links;
create policy tl_sel on public.table_links for select to authenticated using (public.has_perm(hotel_id, 'tableqr.admin'));

-- ---------------------------------------------------------------- calls from the tables
create table if not exists public.table_calls (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        uuid not null references public.hotels(id) on delete cascade,
  outlet_id       uuid not null references public.pos_outlets(id) on delete cascade,
  table_id        uuid not null references public.pos_tables(id) on delete cascade,
  kind            text not null check (kind in ('waiter', 'bill', 'other')),
  pay_method      text check (pay_method in ('cash', 'card', 'mpesa')),
  note            text check (note is null or length(note) <= 200),
  status          text not null default 'open' check (status in ('open', 'on_way', 'done', 'cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  done_at         timestamptz,
  done_by         uuid references auth.users(id) on delete set null
);
create index if not exists table_calls_hotel on public.table_calls (hotel_id, created_at desc);
-- the safeguard: one open call per table at a time
create unique index if not exists table_calls_one_open on public.table_calls (table_id) where status in ('open', 'on_way');

alter table public.table_calls enable row level security;
revoke all on public.table_calls from anon;
drop policy if exists tc_sel on public.table_calls;
create policy tc_sel on public.table_calls for select to authenticated using (public.has_perm(hotel_id, 'tableqr.view'));
-- (changes go through the functions below)

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'table_calls') then
    alter publication supabase_realtime add table public.table_calls;
  end if;
end $$;

-- ---------------------------------------------------------------- the diner's side (no sign-in)
/** The table behind a token, if the hotel may use Table QR there right now. */
create or replace function public.table_link_live(_token text)
returns public.table_links language plpgsql stable security definer set search_path = public as $$
declare _l table_links;
begin
  select l.* into _l from table_links l
    join pos_tables t on t.id = l.table_id
    join pos_outlets o on o.id = t.outlet_id
   where l.token = _token and l.enabled and t.active and o.active and o.table_qr_enabled
     and public.hotel_access_ok(l.hotel_id) and public.hotel_module_ok(l.hotel_id, 'tableqr.view');
  return _l;
end $$;
revoke execute on function public.table_link_live(text) from public, anon, authenticated;

create or replace function public.table_call_json(_c table_calls)
returns jsonb language sql stable as $$
  select case when _c.id is null then null else jsonb_build_object(
    'id', _c.id, 'kind', _c.kind, 'pay_method', _c.pay_method, 'note', _c.note,
    'status', _c.status, 'created_at', _c.created_at, 'acknowledged_at', _c.acknowledged_at, 'done_at', _c.done_at) end
$$;

/** What the diner's phone shows: restaurant, table, menu with prices and the table's latest call. */
create or replace function public.public_table(_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _l table_links; _h hotels; _t pos_tables; _o pos_outlets; _c table_calls; _menu jsonb;
begin
  if coalesce(length(_token), 0) < 16 then return null; end if;
  _l := table_link_live(_token);
  if _l.table_id is null then
    -- known code but switched off / not in the plan / licence ended: a calm message, no details
    if exists (select 1 from table_links where token = _token) then return jsonb_build_object('off', true); end if;
    return null;
  end if;
  select * into _h from hotels where id = _l.hotel_id;
  select * into _t from pos_tables where id = _l.table_id;
  select * into _o from pos_outlets where id = _t.outlet_id;
  select * into _c from table_calls where table_id = _t.id order by created_at desc limit 1;
  if _c.id is not null and _c.status in ('done', 'cancelled') and coalesce(_c.done_at, _c.updated_at) < now() - interval '30 minutes' then _c := null; end if;

  select coalesce(jsonb_agg(jsonb_build_object('category', cat.name, 'items', cat.items) order by cat.sort, cat.name), '[]') into _menu
    from (select c.name, c.sort,
                 jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'description', i.description, 'price', i.price, 'available', i.available)
                           order by i.sort, i.name) items
            from menu_categories c join menu_items i on i.category_id = c.id
           where c.hotel_id = _h.id and i.hotel_id = _h.id and i.active
             and (cardinality(i.outlet_ids) = 0 or _o.id = any(i.outlet_ids))
           group by c.id, c.name, c.sort) cat;

  return jsonb_build_object('hotel', _h.name, 'currency', coalesce(_h.currency, 'KES'), 'outlet', _o.name,
    'table', _t.name, 'menu', _menu, 'call', table_call_json(_c));
end $$;

/** The diner taps a button. One open call per table: a second tap updates it instead of adding one. */
create or replace function public.public_table_call(_token text, _kind text, _note text default null, _pay_method text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _l table_links; _t pos_tables; _c table_calls; _recent int;
begin
  _l := table_link_live(_token);
  if _l.table_id is null then raise exception 'This table''s QR code isn''t active. Please wave to a waiter.'; end if;
  if _kind not in ('waiter', 'bill', 'other') then raise exception 'Unknown request'; end if;
  if _pay_method is not null and _pay_method not in ('cash', 'card', 'mpesa') then raise exception 'Unknown payment method'; end if;
  _note := nullif(left(trim(coalesce(_note, '')), 200), '');
  if _kind <> 'bill' then _pay_method := null; end if;
  select * into _t from pos_tables where id = _l.table_id;

  -- a little brake against someone pressing the button all evening
  select count(*) into _recent from table_calls where table_id = _t.id and created_at > now() - interval '1 hour';
  if _recent >= 15 then raise exception 'Too many calls from this table. Please wave to a waiter.'; end if;

  select * into _c from table_calls where table_id = _t.id and status in ('open', 'on_way') for update;
  if found then
    update table_calls set kind = _kind, note = coalesce(_note, case when _kind = kind then note end), pay_method = _pay_method,
           status = case when _kind = kind then status else 'open' end, updated_at = now()
     where id = _c.id returning * into _c;
  else
    insert into table_calls (hotel_id, outlet_id, table_id, kind, note, pay_method)
    values (_t.hotel_id, _t.outlet_id, _t.id, _kind, _note, _pay_method) returning * into _c;
  end if;
  return table_call_json(_c);
end $$;

create or replace function public.public_table_cancel(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _l table_links; _c table_calls;
begin
  _l := table_link_live(_token);
  if _l.table_id is null then return null; end if;
  update table_calls set status = 'cancelled', updated_at = now(), done_at = now()
   where table_id = _l.table_id and status = 'open' returning * into _c;
  return table_call_json(_c);
end $$;

grant execute on function public.public_table(text) to anon, authenticated;
grant execute on function public.public_table_call(text, text, text, text) to anon, authenticated;
grant execute on function public.public_table_cancel(text) to anon, authenticated;

-- ---------------------------------------------------------------- the staff side
/** Live table map: outlets → tables with their open call (and the QR token for admins). */
create or replace function public.table_qr_board(_hotel_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _admin boolean;
begin
  if not has_perm(_hotel_id, 'tableqr.view') then raise exception 'You don''t have access to Table QR'; end if;
  _admin := has_perm(_hotel_id, 'tableqr.admin');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'enabled', o.table_qr_enabled, 'tables',
      coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'seats', t.seats,
                  'enabled', coalesce(l.enabled, false),
                  'token', case when _admin then l.token end,
                  'call', (select table_call_json(c) from table_calls c where c.table_id = t.id and c.status in ('open', 'on_way')))
                order by t.sort, t.name)
         from pos_tables t left join table_links l on l.table_id = t.id
        where t.outlet_id = o.id and t.active), '[]'))
      order by o.sort, o.name)
      from pos_outlets o where o.hotel_id = _hotel_id and o.active), '[]');
end $$;

create or replace function public.table_call_update(_id uuid, _status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _c table_calls; _tname text;
begin
  select * into _c from table_calls where id = _id for update;
  if not found or not has_perm(_c.hotel_id, 'tableqr.respond') then raise exception 'Call not found'; end if;
  if _status not in ('on_way', 'done', 'cancelled') then raise exception 'Unknown status'; end if;
  if _c.status in ('done', 'cancelled') then return table_call_json(_c); end if; -- someone else got there first
  update table_calls set status = _status, updated_at = now(),
         acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by = coalesce(acknowledged_by, auth.uid()),
         done_at = case when _status in ('done', 'cancelled') then now() end,
         done_by = case when _status in ('done', 'cancelled') then auth.uid() end
   where id = _id returning * into _c;
  return table_call_json(_c);
end $$;

create or replace function public.table_qr_set_outlet(_outlet_id uuid, _enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare _o pos_outlets;
begin
  select * into _o from pos_outlets where id = _outlet_id;
  if not found or not has_perm(_o.hotel_id, 'tableqr.admin') then raise exception 'Outlet not found'; end if;
  update pos_outlets set table_qr_enabled = _enabled where id = _outlet_id;
  perform log_activity(_o.hotel_id, 'table_qr', format('Table QR %s for %s', case when _enabled then 'switched on' else 'switched off' end, _o.name));
end $$;

create or replace function public.table_qr_set_table(_table_id uuid, _enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare _t pos_tables;
begin
  select * into _t from pos_tables where id = _table_id;
  if not found or not has_perm(_t.hotel_id, 'tableqr.admin') then raise exception 'Table not found'; end if;
  insert into table_links (table_id, hotel_id, enabled) values (_t.id, _t.hotel_id, _enabled)
    on conflict (table_id) do update set enabled = excluded.enabled;
end $$;

/** New secret for a table: the old sticker stops working. */
create or replace function public.table_link_reset(_table_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare _t pos_tables; _tok text;
begin
  select * into _t from pos_tables where id = _table_id;
  if not found or not has_perm(_t.hotel_id, 'tableqr.admin') then raise exception 'Table not found'; end if;
  insert into table_links (table_id, hotel_id) values (_t.id, _t.hotel_id) on conflict (table_id) do nothing;
  update table_links set token = replace(gen_random_uuid()::text, '-', ''), created_at = now() where table_id = _t.id returning token into _tok;
  perform log_activity(_t.hotel_id, 'table_qr', format('New QR code for table %s', _t.name), _t.id);
  return _tok;
end $$;

/** Response times for the manager: how fast tables were answered, by outlet, kind and staff member. */
create or replace function public.table_qr_report(_hotel_id uuid, _from date, _to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _tz text;
begin
  if not has_perm(_hotel_id, 'tableqr.admin') then raise exception 'You don''t have access to Table QR reports'; end if;
  select coalesce(timezone, 'Africa/Nairobi') into _tz from hotels where id = _hotel_id;
  return (with c as (
      select tc.*, extract(epoch from (tc.acknowledged_at - tc.created_at)) ack_s, extract(epoch from (tc.done_at - tc.created_at)) done_s
        from table_calls tc
       where tc.hotel_id = _hotel_id and (tc.created_at at time zone _tz)::date between _from and _to and tc.status <> 'cancelled')
    select jsonb_build_object(
      'calls', (select count(*) from c),
      'answered', (select count(*) from c where acknowledged_at is not null),
      'avg_response_s', (select round(avg(ack_s)) from c),
      'avg_done_s', (select round(avg(done_s)) from c),
      'slow', (select count(*) from c where coalesce(ack_s, extract(epoch from now() - created_at)) > 300),
      'by_kind', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'calls', n, 'avg_response_s', a) order by n desc)
                   from (select kind, count(*) n, round(avg(ack_s)) a from c group by kind) x), '[]'),
      'by_outlet', coalesce((select jsonb_agg(jsonb_build_object('outlet', o.name, 'calls', n, 'avg_response_s', a) order by n desc)
                   from (select outlet_id, count(*) n, round(avg(ack_s)) a from c group by outlet_id) x join pos_outlets o on o.id = x.outlet_id), '[]'),
      'by_staff', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(p.full_name, 'Staff'), 'calls', n, 'avg_response_s', a) order by n desc)
                   from (select acknowledged_by, count(*) n, round(avg(ack_s)) a from c where acknowledged_by is not null group by acknowledged_by) x
                   left join profiles p on p.id = x.acknowledged_by), '[]')));
end $$;

grant execute on function public.table_qr_board(uuid) to authenticated;
grant execute on function public.table_call_update(uuid, text) to authenticated;
grant execute on function public.table_qr_set_outlet(uuid, boolean) to authenticated;
grant execute on function public.table_qr_set_table(uuid, boolean) to authenticated;
grant execute on function public.table_link_reset(uuid) to authenticated;
grant execute on function public.table_qr_report(uuid, date, date) to authenticated;
