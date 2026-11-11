-- =====================================================================
-- HotelEasy phase 5: Restaurant & Bar POS
--
-- Outlets (restaurant, bar, room service, pool bar…), menu with modifiers,
-- orders sent to kitchen/bar screens, bills with discount and per-outlet
-- service charge, payments (cash, M-Pesa, card) or charge to a checked-in
-- guest's room bill, manager-PIN approvals for voids/comps/discounts,
-- and cashier shifts with X / Z reports.
--
-- Run AFTER 20261111140000_operations.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Who can do what (text roles, see has_hotel_role_any)
-- ---------------------------------------------------------------------
create or replace function public.pos_staff(_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_hotel_role_any(_hotel_id, array['owner','manager','front_desk','restaurant']);
$$;
create or replace function public.pos_viewer(_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_hotel_role_any(_hotel_id, array['owner','manager','front_desk','restaurant','accountant']);
$$;
create or replace function public.pos_admin(_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_hotel_role_any(_hotel_id, array['owner','manager']);
$$;

-- ---------------------------------------------------------------------
-- Outlets, tables, menu
-- ---------------------------------------------------------------------
create type public.outlet_kind as enum ('restaurant', 'bar', 'room_service', 'pool_bar', 'cafe', 'other');
create type public.pos_station as enum ('kitchen', 'bar', 'none');
create type public.tax_category as enum ('standard', 'zero_rated', 'exempt');

create table public.pos_outlets (
  id                   uuid primary key default gen_random_uuid(),
  hotel_id             uuid not null references public.hotels(id) on delete cascade,
  name                 text not null check (length(trim(name)) > 0),
  kind                 public.outlet_kind not null default 'restaurant',
  service_charge_rate  numeric(5,4) not null default 0 check (service_charge_rate >= 0 and service_charge_rate <= 0.3),
  active               boolean not null default true,
  sort                 int not null default 0,
  created_at           timestamptz not null default now(),
  unique (hotel_id, name)
);

create table public.pos_tables (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references public.hotels(id) on delete cascade,
  outlet_id  uuid not null references public.pos_outlets(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  seats      int not null default 4 check (seats between 1 and 50),
  active     boolean not null default true,
  sort       int not null default 0,
  unique (outlet_id, name)
);

create table public.menu_categories (
  id        uuid primary key default gen_random_uuid(),
  hotel_id  uuid not null references public.hotels(id) on delete cascade,
  name      text not null check (length(trim(name)) > 0),
  station   public.pos_station not null default 'kitchen',
  sort      int not null default 0,
  unique (hotel_id, name)
);

create table public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid not null references public.hotels(id) on delete cascade,
  category_id   uuid not null references public.menu_categories(id) on delete restrict,
  name          text not null check (length(trim(name)) > 0),
  description   text,
  price         numeric(12,2) not null check (price >= 0),
  tax_category  public.tax_category not null default 'standard',
  item_code     text,                                 -- for eTIMS later
  station       public.pos_station,                    -- null = use category's
  charge_kind   public.charge_kind not null default 'food', -- food or drinks on the room bill
  outlet_ids    uuid[] not null default '{}',          -- empty = sold everywhere
  available     boolean not null default true,         -- false = 86'd / sold out
  active        boolean not null default true,
  sort          int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint menu_items_kind check (charge_kind in ('food', 'drinks', 'other', 'service'))
);
create index on public.menu_items (hotel_id, category_id);
create trigger t_menu_items_upd before update on public.menu_items for each row execute function public.touch_updated_at();

create table public.modifier_groups (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references public.hotels(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  min_choices int not null default 0 check (min_choices >= 0),
  max_choices int not null default 1 check (max_choices >= 1),
  sort        int not null default 0,
  constraint modifier_groups_range check (max_choices >= min_choices)
);

create table public.modifier_options (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.modifier_groups(id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  price_delta  numeric(12,2) not null default 0,
  sort         int not null default 0
);

create table public.menu_item_modifier_groups (
  item_id   uuid not null references public.menu_items(id) on delete cascade,
  group_id  uuid not null references public.modifier_groups(id) on delete cascade,
  sort      int not null default 0,
  primary key (item_id, group_id)
);

-- ---------------------------------------------------------------------
-- Manager PINs (approve voids, comps, discounts at the waiter's screen)
-- ---------------------------------------------------------------------
create table public.staff_pins (
  hotel_id    uuid not null references public.hotels(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  pin_hash    text not null,
  updated_at  timestamptz not null default now(),
  primary key (hotel_id, user_id)
);

create table public.pin_attempts (
  id         bigserial primary key,
  hotel_id   uuid not null,
  user_id    uuid,
  ok         boolean not null,
  at         timestamptz not null default now()
);
create index on public.pin_attempts (user_id, at);

create or replace function public.set_my_pin(_hotel_id uuid, _pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not pos_admin(_hotel_id) then raise exception 'Only managers and owners set an approval PIN'; end if;
  if _pin !~ '^[0-9]{4,6}$' then raise exception 'PIN must be 4 to 6 digits'; end if;
  if exists (select 1 from staff_pins where hotel_id = _hotel_id and user_id <> auth.uid()
             and pin_hash = crypt(_pin, pin_hash)) then
    raise exception 'Choose a different PIN';
  end if;
  insert into staff_pins (hotel_id, user_id, pin_hash) values (_hotel_id, auth.uid(), crypt(_pin, gen_salt('bf')))
  on conflict (hotel_id, user_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
end $$;

create or replace function public.has_my_pin(_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_pins where hotel_id = _hotel_id and user_id = auth.uid());
$$;

-- Returns the approving manager, or raises. Five wrong PINs in 10 minutes locks the caller out.
create or replace function public.approve_with_pin(_hotel_id uuid, _pin text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare _mgr uuid;
begin
  if (select count(*) from pin_attempts where user_id = auth.uid() and not ok and at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many wrong PINs. Try again in 10 minutes.';
  end if;
  select p.user_id into _mgr
    from staff_pins p join hotel_members m on m.hotel_id = p.hotel_id and m.user_id = p.user_id
   where p.hotel_id = _hotel_id and m.role::text in ('owner', 'manager')
     and coalesce(_pin, '') <> '' and p.pin_hash = crypt(_pin, p.pin_hash);
  insert into pin_attempts (hotel_id, user_id, ok) values (_hotel_id, auth.uid(), _mgr is not null);
  return _mgr;  -- null = wrong PIN; callers return 'wrong_pin' so this attempt is kept

end $$;
revoke execute on function public.approve_with_pin(uuid, text) from public, anon, authenticated;

-- A manager approves their own actions without typing a PIN.
create or replace function public.approver(_hotel_id uuid, _pin text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if pos_admin(_hotel_id) then return auth.uid(); end if;
  return approve_with_pin(_hotel_id, _pin);
end $$;
revoke execute on function public.approver(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Shifts
-- ---------------------------------------------------------------------
create table public.pos_shifts (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        uuid not null references public.hotels(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade default auth.uid(),
  opened_at       timestamptz not null default now(),
  opening_float   numeric(12,2) not null default 0 check (opening_float >= 0),
  closed_at       timestamptz,
  closed_by       uuid references auth.users(id) on delete set null,
  counted_cash    numeric(12,2),
  expected_cash   numeric(12,2),
  variance        numeric(12,2),
  z_report        jsonb,
  notes           text
);
create unique index pos_shifts_one_open on public.pos_shifts (hotel_id, user_id) where closed_at is null;

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
create type public.pos_order_type as enum ('dine_in', 'takeaway', 'room_service');
create type public.pos_order_status as enum ('open', 'paid', 'void');
create type public.pos_item_status as enum ('new', 'sent', 'preparing', 'ready', 'served', 'void');

create table public.pos_orders (
  id                    uuid primary key default gen_random_uuid(),
  hotel_id              uuid not null references public.hotels(id) on delete cascade,
  outlet_id             uuid not null references public.pos_outlets(id) on delete restrict,
  number                int not null,
  order_type            public.pos_order_type not null default 'dine_in',
  table_id              uuid references public.pos_tables(id) on delete set null,
  reservation_id        uuid references public.reservations(id) on delete set null,  -- room service / guest
  label                 text,          -- walk-in name, "Takeaway – Kevin"
  guests                int not null default 1 check (guests between 1 and 200),
  status                public.pos_order_status not null default 'open',
  waiter_id             uuid references auth.users(id) on delete set null default auth.uid(),
  discount_kind         text check (discount_kind in ('percent', 'amount')),
  discount_value        numeric(12,2) not null default 0 check (discount_value >= 0),
  discount_reason       text,
  discount_approved_by  uuid references auth.users(id) on delete set null,
  service_charge_rate   numeric(5,4) not null default 0,
  items_gross           numeric(14,2) not null default 0,
  discount_amount       numeric(14,2) not null default 0,
  net_amount            numeric(14,2) not null default 0,
  vat_amount            numeric(14,2) not null default 0,
  levy_amount           numeric(14,2) not null default 0,
  service_charge        numeric(14,2) not null default 0,
  total                 numeric(14,2) not null default 0,
  paid_total            numeric(14,2) not null default 0,
  notes                 text,
  opened_at             timestamptz not null default now(),
  closed_at             timestamptz,
  void_reason           text,
  voided_by             uuid references auth.users(id) on delete set null,
  updated_at            timestamptz not null default now(),
  unique (hotel_id, number)
);
create index on public.pos_orders (hotel_id, status);
create index on public.pos_orders (hotel_id, opened_at desc);
create unique index pos_orders_one_open_per_table on public.pos_orders (table_id) where status = 'open' and table_id is not null;
create trigger t_pos_orders_upd before update on public.pos_orders for each row execute function public.touch_updated_at();

create table public.pos_order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.pos_orders(id) on delete cascade,
  hotel_id       uuid not null references public.hotels(id) on delete cascade,
  menu_item_id   uuid references public.menu_items(id) on delete set null,
  name           text not null,
  unit_price     numeric(12,2) not null check (unit_price >= 0),  -- incl. modifiers
  quantity       numeric(10,2) not null default 1 check (quantity > 0),
  modifiers      jsonb not null default '[]',    -- [{group, name, price_delta}]
  notes          text,
  station        public.pos_station not null default 'kitchen',
  tax_category   public.tax_category not null default 'standard',
  charge_kind    public.charge_kind not null default 'food',
  status         public.pos_item_status not null default 'new',
  comped         boolean not null default false,
  comp_reason    text,
  void_reason    text,
  approved_by    uuid references auth.users(id) on delete set null,
  added_by       uuid references auth.users(id) on delete set null default auth.uid(),
  added_at       timestamptz not null default now(),
  sent_at        timestamptz,
  ready_at       timestamptz,
  served_at      timestamptz,
  voided_at      timestamptz,
  -- worked out by pos_recalc
  gross          numeric(14,2) not null default 0,
  net            numeric(14,2) not null default 0,
  vat            numeric(14,2) not null default 0,
  levy           numeric(14,2) not null default 0
);
create index on public.pos_order_items (order_id);
create index on public.pos_order_items (hotel_id, status) where status in ('sent', 'preparing', 'ready');

create type public.pos_payment_method as enum ('cash', 'mpesa', 'card', 'room', 'other');

create table public.pos_payments (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        uuid not null references public.hotels(id) on delete cascade,
  order_id        uuid not null references public.pos_orders(id) on delete cascade,
  shift_id        uuid references public.pos_shifts(id) on delete set null,
  method          public.pos_payment_method not null,
  amount          numeric(14,2) not null check (amount > 0),
  tendered        numeric(14,2),
  change_given    numeric(14,2),
  reference       text,
  reservation_id  uuid references public.reservations(id) on delete set null,
  received_by     uuid references auth.users(id) on delete set null default auth.uid(),
  received_at     timestamptz not null default now(),
  voided_at       timestamptz,
  void_reason     text,
  constraint pos_payments_mpesa check (method <> 'mpesa' or reference ~ '^[A-Z0-9]{10}$'),
  constraint pos_payments_room check (method <> 'room' or reservation_id is not null)
);
create index on public.pos_payments (order_id);
create index on public.pos_payments (hotel_id, received_at);
create unique index pos_payments_mpesa_once on public.pos_payments (hotel_id, reference) where method = 'mpesa' and voided_at is null;

-- Room charges posted from the POS keep the POS's own tax split.
alter table public.folio_charges add column pos_order_id uuid references public.pos_orders(id) on delete set null;

create or replace function public.compute_charge_amounts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _h hotels;
  _line numeric;
  _tax numeric;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from reservations where id = new.reservation_id and hotel_id = new.hotel_id) then
      raise exception 'Reservation does not belong to this hotel';
    end if;
    -- POS postings arrive with their tax already worked out
    if new.pos_order_id is not null and coalesce(current_setting('hotel_easy.rpc', true), '') = 'on' then
      return new;
    end if;
    select * into _h from hotels where id = new.hotel_id;
    new.vat_rate := _h.vat_rate;
    new.levy_rate := _h.tourism_levy_rate;
    new.price_includes_tax := _h.prices_include_vat;
  end if;
  if tg_op = 'UPDATE' and new.pos_order_id is not null then
    return new;
  end if;
  _line := round(new.quantity * new.unit_price, 2);
  _tax := new.vat_rate + new.levy_rate;
  if new.price_includes_tax then
    new.amount := _line;
    new.net_amount := round(_line / (1 + _tax), 2);
    new.vat_amount := round(new.net_amount * new.vat_rate, 2);
    new.levy_amount := new.amount - new.net_amount - new.vat_amount;
  else
    new.net_amount := _line;
    new.vat_amount := round(_line * new.vat_rate, 2);
    new.levy_amount := round(_line * new.levy_rate, 2);
    new.amount := new.net_amount + new.vat_amount + new.levy_amount;
  end if;
  return new;
end $$;

-- M-Pesa codes may not repeat between front desk and POS either.
create or replace function public.mpesa_code_used(_hotel_id uuid, _code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from payments where hotel_id = _hotel_id and method = 'mpesa' and reference = upper(_code) and voided_at is null)
      or exists (select 1 from pos_payments where hotel_id = _hotel_id and method = 'mpesa' and reference = upper(_code) and voided_at is null);
$$;

create or replace function public.check_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.method = 'mpesa' then
    new.reference := upper(trim(new.reference));
    if exists (select 1 from pos_payments where hotel_id = new.hotel_id and method = 'mpesa' and reference = new.reference and voided_at is null) then
      raise exception 'payments_mpesa_once: code already used in the POS';
    end if;
  end if;
  if not exists (select 1 from reservations where id = new.reservation_id and hotel_id = new.hotel_id) then
    raise exception 'Reservation does not belong to this hotel';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------
create or replace function public.pos_check_refs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'pos_tables' then
    if not exists (select 1 from pos_outlets where id = new.outlet_id and hotel_id = new.hotel_id) then
      raise exception 'Outlet does not belong to this hotel'; end if;
  elsif tg_table_name = 'menu_items' then
    if not exists (select 1 from menu_categories where id = new.category_id and hotel_id = new.hotel_id) then
      raise exception 'Category does not belong to this hotel'; end if;
  elsif tg_table_name = 'pos_orders' then
    if tg_op = 'INSERT' then
      perform pg_advisory_xact_lock(hashtext('pos-' || new.hotel_id::text));
      new.number := coalesce((select max(number) from pos_orders where hotel_id = new.hotel_id), 0) + 1;
      new.service_charge_rate := (select service_charge_rate from pos_outlets where id = new.outlet_id);
    end if;
    if not exists (select 1 from pos_outlets where id = new.outlet_id and hotel_id = new.hotel_id) then
      raise exception 'Outlet does not belong to this hotel'; end if;
    if new.table_id is not null and not exists (select 1 from pos_tables where id = new.table_id and outlet_id = new.outlet_id) then
      raise exception 'Table is not in this outlet'; end if;
    if new.reservation_id is not null and not exists (select 1 from reservations where id = new.reservation_id and hotel_id = new.hotel_id) then
      raise exception 'Reservation does not belong to this hotel'; end if;
  end if;
  return new;
end $$;
create trigger pos_tables_refs before insert or update on public.pos_tables for each row execute function public.pos_check_refs();
create trigger menu_items_refs before insert or update on public.menu_items for each row execute function public.pos_check_refs();
create trigger pos_orders_refs before insert or update on public.pos_orders for each row execute function public.pos_check_refs();

-- Order lines: added only to open orders; price, quantity and modifiers frozen once sent;
-- voids/comps only through the approval functions.
create or replace function public.pos_guard_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare _o pos_orders; _rpc boolean := coalesce(current_setting('hotel_easy.rpc', true), '') = 'on';
        _m menu_items; _mods jsonb; _delta numeric; _n int; _bad text;
begin
  select * into _o from pos_orders where id = coalesce(new.order_id, old.order_id);
  if _o.status <> 'open' and not _rpc then raise exception 'This bill is closed'; end if;
  if tg_op = 'INSERT' then
    new.hotel_id := _o.hotel_id;
    if _rpc then return new; end if;  -- split copies keep their snapshot
    if new.status <> 'new' or new.comped then raise exception 'New lines start unsent'; end if;
    if new.menu_item_id is null then
      if not pos_admin(_o.hotel_id) then raise exception 'Only managers can add an open-price item'; end if;
      if coalesce(trim(new.name), '') = '' then raise exception 'Name the item'; end if;
      new.modifiers := '[]';
      return new;
    end if;
    select * into _m from menu_items where id = new.menu_item_id and hotel_id = _o.hotel_id;
    if not found or not _m.active then raise exception 'Item not on the menu'; end if;
    if not _m.available then raise exception '% is sold out', _m.name; end if;
    if cardinality(_m.outlet_ids) > 0 and not (_o.outlet_id = any(_m.outlet_ids)) then
      raise exception '% is not sold in this outlet', _m.name;
    end if;
    -- modifiers arrive as [{"id": option id}, …]; the server fills names and prices
    select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'group', g.name, 'name', o.name, 'price_delta', o.price_delta) order by g.sort, o.sort), '[]'::jsonb),
           coalesce(sum(o.price_delta), 0), count(*)
      into _mods, _delta, _n
      from modifier_options o
      join modifier_groups g on g.id = o.group_id
      join menu_item_modifier_groups mg on mg.group_id = g.id and mg.item_id = _m.id
     where o.id in (select (x->>'id')::uuid from jsonb_array_elements(coalesce(new.modifiers, '[]'::jsonb)) x);
    if _n <> jsonb_array_length(coalesce(new.modifiers, '[]'::jsonb)) then raise exception 'Unknown option for %', _m.name; end if;
    select string_agg(g.name, ', ') into _bad
      from menu_item_modifier_groups mg join modifier_groups g on g.id = mg.group_id
     where mg.item_id = _m.id
       and (select count(*) from jsonb_array_elements(_mods) x where x->>'group' = g.name) not between g.min_choices and g.max_choices;
    if _bad is not null then raise exception 'Choose: %', _bad; end if;
    new.name := _m.name;
    new.unit_price := _m.price + _delta;
    new.modifiers := _mods;
    new.station := coalesce(_m.station, (select station from menu_categories where id = _m.category_id));
    new.tax_category := _m.tax_category;
    new.charge_kind := _m.charge_kind;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.status <> 'new' and not _rpc then raise exception 'Sent items can only be voided with approval'; end if;
    return old;
  end if;
  if not _rpc then
    if (new.unit_price, new.modifiers, new.name, new.menu_item_id, new.station, new.tax_category, new.charge_kind, new.hotel_id)
       is distinct from (old.unit_price, old.modifiers, old.name, old.menu_item_id, old.station, old.tax_category, old.charge_kind, old.hotel_id) then
      raise exception 'Prices and options can''t be edited; remove and re-add the item';
    end if;
    if old.status <> 'new' and new.quantity <> old.quantity then
      raise exception 'Sent items can''t be changed; void and re-add instead';
    end if;
    if new.status = 'void' or old.status = 'void' or new.comped is distinct from old.comped
       or new.order_id <> old.order_id then
      raise exception 'Voids, comps and moves need approval';
    end if;
    if new.status = 'new' and old.status <> 'new' then raise exception 'Already sent'; end if;
  end if;
  return new;
end $$;
create trigger pos_items_guard before insert or update or delete on public.pos_order_items
  for each row execute function public.pos_guard_item();

-- Discounts and status changes on orders only through functions.
create or replace function public.pos_guard_order()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('hotel_easy.rpc', true), '') <> 'on' then
    if new.status is distinct from old.status
       or (new.discount_kind, new.discount_value) is distinct from (old.discount_kind, old.discount_value)
       or new.paid_total <> old.paid_total or new.total <> old.total or new.service_charge_rate <> old.service_charge_rate then
      raise exception 'Use the bill actions to change totals, discounts or status';
    end if;
    if old.status <> 'open' then raise exception 'This bill is closed'; end if;
  end if;
  return new;
end $$;
create trigger pos_orders_guard before update on public.pos_orders for each row execute function public.pos_guard_order();

-- ---------------------------------------------------------------------
-- Totals: per line net / VAT / levy, discount spread over lines,
-- service charge on the net and itself subject to VAT (not levy).
-- ---------------------------------------------------------------------
create or replace function public.pos_recalc(_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _prev text := coalesce(current_setting('hotel_easy.rpc', true), '');
  _o pos_orders; _h hotels;
  _items numeric; _disc numeric; _f numeric;
  _net numeric; _vat numeric; _levy numeric; _svc numeric; _total numeric;
begin
  select * into _o from pos_orders where id = _order_id;
  select * into _h from hotels where id = _o.hotel_id;
  select coalesce(sum(round(quantity * unit_price, 2)), 0) into _items
    from pos_order_items where order_id = _order_id and status <> 'void' and not comped;
  _disc := case _o.discount_kind
             when 'percent' then round(_items * least(_o.discount_value, 100) / 100, 2)
             when 'amount' then least(_o.discount_value, _items)
             else 0 end;
  _f := case when _items > 0 then (_items - _disc) / _items else 0 end;

  perform set_config('hotel_easy.rpc', 'on', true);
  update pos_order_items i set
    gross = case when i.status = 'void' or i.comped then 0 else round(round(i.quantity * i.unit_price, 2) * _f, 2) end
  where i.order_id = _order_id;
  update pos_order_items i set
    net = case when _h.prices_include_vat
               then round(i.gross / (1 + (case when i.tax_category = 'standard' then _h.vat_rate else 0 end) + _h.tourism_levy_rate), 2)
               else i.gross end
  where i.order_id = _order_id;
  update pos_order_items i set
    vat = round(i.net * case when i.tax_category = 'standard' then _h.vat_rate else 0 end, 2),
    levy = case when _h.prices_include_vat
                then i.gross - i.net - round(i.net * case when i.tax_category = 'standard' then _h.vat_rate else 0 end, 2)
                else round(i.net * _h.tourism_levy_rate, 2) end
  where i.order_id = _order_id;

  select coalesce(sum(net), 0), coalesce(sum(vat), 0), coalesce(sum(levy), 0)
    into _net, _vat, _levy from pos_order_items where order_id = _order_id;
  _svc := round(_net * _o.service_charge_rate, 2);
  _vat := _vat + round(_svc * _h.vat_rate, 2);
  _total := _net + _vat + _levy + _svc;

  update pos_orders set items_gross = _items, discount_amount = _disc, net_amount = _net, vat_amount = _vat,
         levy_amount = _levy, service_charge = _svc, total = _total
   where id = _order_id;
  perform set_config('hotel_easy.rpc', _prev, true);
end $$;
revoke execute on function public.pos_recalc(uuid) from public, anon, authenticated;

create or replace function public.pos_items_recalc()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pos_recalc(coalesce(new.order_id, old.order_id));
  if tg_op = 'UPDATE' and new.order_id <> old.order_id then perform pos_recalc(old.order_id); end if;
  return null;
end $$;
create trigger pos_items_recalc after insert or delete or update of quantity, unit_price, status, comped, order_id, tax_category
  on public.pos_order_items for each row execute function public.pos_items_recalc();

-- =====================================================================
-- Actions (RPC)
-- =====================================================================

-- Send all new lines to the kitchen / bar.
create or replace function public.pos_send_order(_order_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare _o pos_orders; _n int;
begin
  select * into _o from pos_orders where id = _order_id;
  if not found or not pos_staff(_o.hotel_id) then raise exception 'Order not found'; end if;
  if _o.status <> 'open' then raise exception 'This bill is closed'; end if;
  update pos_order_items set status = case when station = 'none' then 'served'::pos_item_status else 'sent'::pos_item_status end,
         sent_at = now(), served_at = case when station = 'none' then now() end
   where order_id = _order_id and status = 'new';
  get diagnostics _n = row_count;
  return _n;
end $$;

-- Kitchen / bar screens move lines along.
create or replace function public.pos_set_item_status(_item_ids uuid[], _status public.pos_item_status)
returns void language plpgsql security definer set search_path = public as $$
declare _hotel uuid;
begin
  if _status not in ('preparing', 'ready', 'served', 'sent') then raise exception 'Not allowed here'; end if;
  select distinct hotel_id into _hotel from pos_order_items where id = any(_item_ids) limit 1;
  if _hotel is null or not pos_staff(_hotel) then raise exception 'Items not found'; end if;
  update pos_order_items set status = _status,
         ready_at = case when _status = 'ready' then now() else ready_at end,
         served_at = case when _status = 'served' then now() else served_at end
   where id = any(_item_ids) and hotel_id = _hotel and status in ('sent', 'preparing', 'ready', 'served');
end $$;

-- Void a sent line, or comp it (free of charge). Needs a manager.
create or replace function public.pos_void_item(_item_id uuid, _reason text, _pin text default null, _comp boolean default false,
                                                _quantity numeric default null)
returns text language plpgsql security definer set search_path = public as $$
declare _i pos_order_items; _o pos_orders; _mgr uuid; _q numeric;
begin
  select * into _i from pos_order_items where id = _item_id;
  if not found or not pos_staff(_i.hotel_id) then raise exception 'Item not found'; end if;
  select * into _o from pos_orders where id = _i.order_id;
  if _o.status <> 'open' then raise exception 'This bill is closed'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Give a reason'; end if;
  if _i.status = 'void' then raise exception 'Already voided'; end if;
  _q := coalesce(_quantity, _i.quantity);
  if _q <= 0 or _q > _i.quantity then raise exception 'Quantity must be between 1 and %', _i.quantity; end if;
  if _i.status = 'new' and not _comp then
    delete from pos_order_items where id = _i.id;  -- not made yet: just remove
    return 'ok';
  end if;
  _mgr := approver(_i.hotel_id, _pin);
  if _mgr is null then return 'wrong_pin'; end if;
  perform set_config('hotel_easy.rpc', 'on', true);
  if _q < _i.quantity then
    -- part of the line: keep the rest, put the voided/comped part on its own line
    update pos_order_items set quantity = quantity - _q where id = _i.id;
    insert into pos_order_items (order_id, hotel_id, menu_item_id, name, unit_price, quantity, modifiers, notes, station, tax_category,
                                 charge_kind, status, comped, comp_reason, void_reason, approved_by, added_by, added_at, sent_at, ready_at, served_at, voided_at)
    values (_i.order_id, _i.hotel_id, _i.menu_item_id, _i.name, _i.unit_price, _q, _i.modifiers, _i.notes, _i.station, _i.tax_category,
            _i.charge_kind, case when _comp then _i.status else 'void'::pos_item_status end, _comp,
            case when _comp then trim(_reason) end, case when _comp then null else trim(_reason) end, _mgr, _i.added_by, _i.added_at,
            _i.sent_at, _i.ready_at, _i.served_at, case when _comp then null else now() end);
  elsif _comp then
    update pos_order_items set comped = true, comp_reason = trim(_reason), approved_by = _mgr where id = _i.id;
  else
    update pos_order_items set status = 'void', void_reason = trim(_reason), approved_by = _mgr, voided_at = now() where id = _i.id;
  end if;
  perform set_config('hotel_easy.rpc', 'off', true);
  perform log_activity(_i.hotel_id, 'pos', format('%s on bill #%s: %s× %s (%s)', case when _comp then 'Comp' else 'Void' end, _o.number, _q, _i.name, trim(_reason)), _o.id);
  return 'ok';
end $$;

create or replace function public.pos_set_discount(_order_id uuid, _kind text, _value numeric, _reason text, _pin text default null)
returns text language plpgsql security definer set search_path = public as $$
declare _o pos_orders; _mgr uuid;
begin
  select * into _o from pos_orders where id = _order_id;
  if not found or not pos_staff(_o.hotel_id) then raise exception 'Order not found'; end if;
  if _o.status <> 'open' then raise exception 'This bill is closed'; end if;
  if _kind is not null and _kind not in ('percent', 'amount') then raise exception 'Unknown discount type'; end if;
  if _kind = 'percent' and (_value < 0 or _value > 100) then raise exception 'Percent must be 0–100'; end if;
  if _kind is not null and coalesce(trim(_reason), '') = '' then raise exception 'Give a reason'; end if;
  _mgr := approver(_o.hotel_id, _pin);
  if _mgr is null then return 'wrong_pin'; end if;
  perform set_config('hotel_easy.rpc', 'on', true);
  update pos_orders set discount_kind = _kind, discount_value = coalesce(_value, 0),
         discount_reason = nullif(trim(coalesce(_reason, '')), ''), discount_approved_by = case when _kind is null then null else _mgr end
   where id = _order_id;
  perform set_config('hotel_easy.rpc', 'off', true);
  perform pos_recalc(_order_id);
  if _kind is not null then
    perform log_activity(_o.hotel_id, 'pos', format('Discount on bill #%s: %s%s (%s)', _o.number,
            case when _kind = 'percent' then _value::text || '%' else to_char(_value, 'FM999,999,990') end, '', trim(_reason)), _o.id);
  end if;
  return 'ok';
end $$;

create or replace function public.pos_set_service_charge(_order_id uuid, _rate numeric, _pin text default null)
returns text language plpgsql security definer set search_path = public as $$
declare _o pos_orders;
begin
  select * into _o from pos_orders where id = _order_id;
  if not found or not pos_staff(_o.hotel_id) then raise exception 'Order not found'; end if;
  if _o.status <> 'open' then raise exception 'This bill is closed'; end if;
  if _rate < 0 or _rate > 0.3 then raise exception 'Service charge must be 0–30%%'; end if;
  if approver(_o.hotel_id, _pin) is null then return 'wrong_pin'; end if;
  perform set_config('hotel_easy.rpc', 'on', true);
  update pos_orders set service_charge_rate = _rate where id = _order_id;
  perform set_config('hotel_easy.rpc', 'off', true);
  perform pos_recalc(_order_id);
  return 'ok';
end $$;

-- Move lines to another (new or existing open) bill: split by item.
create or replace function public.pos_move_items(_item_ids uuid[], _to_order uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _from pos_orders; _to uuid;
begin
  select o.* into _from from pos_orders o join pos_order_items i on i.order_id = o.id where i.id = _item_ids[1];
  if not found or not pos_staff(_from.hotel_id) then raise exception 'Items not found'; end if;
  if _from.status <> 'open' then raise exception 'This bill is closed'; end if;
  if _to_order is null then
    insert into pos_orders (hotel_id, outlet_id, order_type, reservation_id, label, guests, waiter_id)
    values (_from.hotel_id, _from.outlet_id, case when _from.order_type = 'dine_in' then 'takeaway'::pos_order_type else _from.order_type end,
            _from.reservation_id, coalesce(_from.label, 'Split from #' || _from.number), 1, auth.uid())
    returning id into _to;
    update pos_orders set label = 'Split from #' || _from.number || coalesce(' · ' || (select name from pos_tables where id = _from.table_id), '')
     where id = _to;
  else
    if not exists (select 1 from pos_orders where id = _to_order and hotel_id = _from.hotel_id and status = 'open') then
      raise exception 'Target bill is not open'; end if;
    _to := _to_order;
  end if;
  perform set_config('hotel_easy.rpc', 'on', true);
  update pos_order_items set order_id = _to where id = any(_item_ids) and order_id = _from.id;
  perform set_config('hotel_easy.rpc', 'off', true);
  return _to;
end $$;

-- Payments (cash / M-Pesa / card / other). Needs an open shift.
create or replace function public.pos_pay(_order_id uuid, _method public.pos_payment_method, _amount numeric,
                                          _tendered numeric default null, _reference text default null)
returns public.pos_orders language plpgsql security definer set search_path = public as $$
declare _o pos_orders; _shift uuid; _due numeric; _ref text;
begin
  select * into _o from pos_orders where id = _order_id for update;
  if not found or not pos_staff(_o.hotel_id) then raise exception 'Order not found'; end if;
  if _o.status <> 'open' then raise exception 'This bill is closed'; end if;
  if _method = 'room' then raise exception 'Use charge to room'; end if;
  if exists (select 1 from pos_order_items where order_id = _order_id and status = 'new') then
    raise exception 'Send or remove unsent items before taking payment';
  end if;
  select id into _shift from pos_shifts where hotel_id = _o.hotel_id and user_id = auth.uid() and closed_at is null;
  if _shift is null then raise exception 'NO_SHIFT: Open your cash shift before taking payment'; end if;
  _due := _o.total - _o.paid_total;
  if _due <= 0.009 then
    perform set_config('hotel_easy.rpc', 'on', true);
    update pos_orders set status = 'paid', closed_at = now() where id = _o.id returning * into _o;
    perform set_config('hotel_easy.rpc', 'off', true);
    return _o;
  end if;
  if _amount <= 0 then raise exception 'Amount must be more than zero'; end if;
  if _amount > _due + 0.009 then raise exception 'That is more than the % still due', to_char(_due, 'FM999,999,990.00'); end if;
  _ref := nullif(upper(trim(coalesce(_reference, ''))), '');
  if _method = 'mpesa' then
    if _ref is null or _ref !~ '^[A-Z0-9]{10}$' then raise exception 'payments_mpesa_code'; end if;
    if mpesa_code_used(_o.hotel_id, _ref) then raise exception 'payments_mpesa_once'; end if;
  end if;
  insert into pos_payments (hotel_id, order_id, shift_id, method, amount, tendered, change_given, reference)
  values (_o.hotel_id, _o.id, _shift, _method, _amount,
          case when _method = 'cash' then greatest(coalesce(_tendered, _amount), _amount) end,
          case when _method = 'cash' then greatest(coalesce(_tendered, _amount), _amount) - _amount end,
          case when _method = 'mpesa' then _ref else nullif(trim(coalesce(_reference, '')), '') end);
  perform set_config('hotel_easy.rpc', 'on', true);
  update pos_orders set paid_total = paid_total + _amount,
         status = case when paid_total + _amount >= total - 0.009 then 'paid'::pos_order_status else 'open'::pos_order_status end,
         closed_at = case when paid_total + _amount >= total - 0.009 then now() end
   where id = _o.id returning * into _o;
  perform set_config('hotel_easy.rpc', 'off', true);
  return _o;
end $$;

-- Charge what's left on the bill to a checked-in guest's room.
create or replace function public.pos_charge_to_room(_order_id uuid, _reservation_id uuid)
returns public.pos_orders language plpgsql security definer set search_path = public as $$
declare _o pos_orders; _r reservations; _room text; _due numeric; _outlet text; _f numeric; _svc_net numeric; _svc_vat numeric;
begin
  select * into _o from pos_orders where id = _order_id for update;
  if not found or not pos_staff(_o.hotel_id) then raise exception 'Order not found'; end if;
  if _o.status <> 'open' then raise exception 'This bill is closed'; end if;
  if exists (select 1 from pos_order_items where order_id = _order_id and status = 'new') then
    raise exception 'Send or remove unsent items before charging';
  end if;
  select * into _r from reservations where id = _reservation_id and hotel_id = _o.hotel_id;
  if not found or _r.status <> 'checked_in' then raise exception 'That guest is not checked in'; end if;
  select room_number into _room from rooms where id = _r.room_id;
  select name into _outlet from pos_outlets where id = _o.outlet_id;
  _due := _o.total - _o.paid_total;
  if _due <= 0 then raise exception 'Nothing left to charge'; end if;
  _f := _due / nullif(_o.total, 0);   -- share of the bill still unpaid

  perform set_config('hotel_easy.rpc', 'on', true);
  -- One folio line per kind (food / drinks / other), keeping the POS tax split.
  insert into folio_charges (hotel_id, reservation_id, kind, description, quantity, unit_price,
                             vat_rate, levy_rate, price_includes_tax, net_amount, vat_amount, levy_amount, amount, pos_order_id)
  select _o.hotel_id, _r.id, k.kind,
         format('%s bill #%s – %s', _outlet, _o.number, initcap(k.kind::text)),
         1, round((k.net + k.vat + k.levy) * _f, 2),
         (select vat_rate from hotels where id = _o.hotel_id), (select tourism_levy_rate from hotels where id = _o.hotel_id), true,
         round(k.net * _f, 2), round(k.vat * _f, 2), round(k.levy * _f, 2), round((k.net + k.vat + k.levy) * _f, 2), _o.id
  from (select charge_kind as kind, sum(net) net, sum(vat) vat, sum(levy) levy
          from pos_order_items where order_id = _o.id and status <> 'void' and not comped and gross > 0
         group by charge_kind) k;
  if _o.service_charge > 0 then
    _svc_net := round(_o.service_charge * _f, 2);
    _svc_vat := round(_o.service_charge * (select vat_rate from hotels where id = _o.hotel_id) * _f, 2);
    insert into folio_charges (hotel_id, reservation_id, kind, description, quantity, unit_price,
                               vat_rate, levy_rate, price_includes_tax, net_amount, vat_amount, levy_amount, amount, pos_order_id)
    values (_o.hotel_id, _r.id, 'service', format('%s bill #%s – Service charge', _outlet, _o.number), 1, _svc_net + _svc_vat,
            (select vat_rate from hotels where id = _o.hotel_id), 0, true, _svc_net, _svc_vat, 0, _svc_net + _svc_vat, _o.id);
  end if;

  -- rounding: put any cent difference on the largest line
  update folio_charges set amount = amount + d.diff, unit_price = unit_price + d.diff, net_amount = net_amount + d.diff
    from (select _due - sum(amount) diff from folio_charges where pos_order_id = _o.id and voided_at is null) d
   where folio_charges.id = (select id from folio_charges where pos_order_id = _o.id and voided_at is null order by amount desc limit 1)
     and d.diff <> 0;
  insert into pos_payments (hotel_id, order_id, method, amount, reservation_id, reference)
  values (_o.hotel_id, _o.id, 'room', _due, _r.id, 'Room ' || coalesce(_room, '?'));
  update pos_orders set paid_total = total, status = 'paid', closed_at = now(),
         reservation_id = coalesce(reservation_id, _r.id)
   where id = _o.id returning * into _o;
  perform set_config('hotel_easy.rpc', 'off', true);
  perform log_activity(_o.hotel_id, 'pos', format('Bill #%s (%s) charged to room %s', _o.number, to_char(_due, 'FM999,999,990'), _room), _r.id);
  return _o;
end $$;

-- Void a whole open bill (nothing paid), or reopen a paid one (manager).
create or replace function public.pos_void_order(_order_id uuid, _reason text, _pin text default null)
returns text language plpgsql security definer set search_path = public as $$
declare _o pos_orders; _mgr uuid;
begin
  select * into _o from pos_orders where id = _order_id for update;
  if not found or not pos_staff(_o.hotel_id) then raise exception 'Order not found'; end if;
  if _o.status <> 'open' then raise exception 'Only open bills can be voided (reopen a paid bill first)'; end if;
  if _o.paid_total > 0 then raise exception 'Part of this bill is paid; void those payments first'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Give a reason'; end if;
  if exists (select 1 from pos_order_items where order_id = _o.id and status <> 'new' and status <> 'void') then
    _mgr := approver(_o.hotel_id, _pin);
    if _mgr is null then return 'wrong_pin'; end if;
  end if;
  perform set_config('hotel_easy.rpc', 'on', true);
  update pos_order_items set status = 'void', void_reason = trim(_reason), approved_by = _mgr, voided_at = now()
   where order_id = _o.id and status <> 'void';
  update pos_orders set status = 'void', void_reason = trim(_reason), voided_by = coalesce(_mgr, auth.uid()), closed_at = now(), table_id = null
   where id = _o.id;
  perform set_config('hotel_easy.rpc', 'off', true);
  perform log_activity(_o.hotel_id, 'pos', format('Bill #%s voided: %s', _o.number, trim(_reason)), _o.id);
  return 'ok';
end $$;

create or replace function public.pos_reopen_order(_order_id uuid, _reason text, _pin text default null)
returns text language plpgsql security definer set search_path = public as $$
declare _o pos_orders; _mgr uuid; _tbl uuid;
begin
  select * into _o from pos_orders where id = _order_id for update;
  if not found or not pos_staff(_o.hotel_id) then raise exception 'Order not found'; end if;
  if _o.status <> 'paid' then raise exception 'Only paid bills can be reopened'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Give a reason'; end if;
  _mgr := approver(_o.hotel_id, _pin);
  if _mgr is null then return 'wrong_pin'; end if;
  perform set_config('hotel_easy.rpc', 'on', true);
  update pos_payments set voided_at = now(), void_reason = 'Bill reopened: ' || trim(_reason)
   where order_id = _o.id and voided_at is null;
  update folio_charges set voided_at = now(), voided_by = _mgr, void_reason = 'POS bill reopened: ' || trim(_reason)
   where pos_order_id = _o.id and voided_at is null;
  -- free the table only if nobody else has opened it since
  _tbl := _o.table_id;
  if _tbl is not null and exists (select 1 from pos_orders where table_id = _tbl and status = 'open' and id <> _o.id) then _tbl := null; end if;
  update pos_orders set status = 'open', paid_total = 0, closed_at = null, table_id = _tbl where id = _o.id;
  perform set_config('hotel_easy.rpc', 'off', true);
  perform log_activity(_o.hotel_id, 'pos', format('Bill #%s reopened: %s', _o.number, trim(_reason)), _o.id);
  return 'ok';
end $$;

-- ---------------------------------------------------------------------
-- Shifts: open, X report (live), close with blind count → Z report
-- ---------------------------------------------------------------------
create or replace function public.pos_shift_report(_shift_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _s pos_shifts; _r jsonb;
begin
  select * into _s from pos_shifts where id = _shift_id;
  if not found or not (pos_viewer(_s.hotel_id) and (_s.user_id = auth.uid() or pos_admin(_s.hotel_id) or has_hotel_role_any(_s.hotel_id, array['accountant']))) then
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
end $$;

create or replace function public.pos_open_shift(_hotel_id uuid, _float numeric)
returns public.pos_shifts language plpgsql security definer set search_path = public as $$
declare _s pos_shifts;
begin
  if not pos_staff(_hotel_id) then raise exception 'Not allowed'; end if;
  if exists (select 1 from pos_shifts where hotel_id = _hotel_id and user_id = auth.uid() and closed_at is null) then
    raise exception 'You already have an open shift';
  end if;
  insert into pos_shifts (hotel_id, user_id, opening_float) values (_hotel_id, auth.uid(), greatest(coalesce(_float, 0), 0)) returning * into _s;
  return _s;
end $$;

create or replace function public.pos_close_shift(_shift_id uuid, _counted numeric, _notes text default null)
returns public.pos_shifts language plpgsql security definer set search_path = public as $$
declare _s pos_shifts; _rep jsonb;
begin
  select * into _s from pos_shifts where id = _shift_id for update;
  if not found or not (_s.user_id = auth.uid() or pos_admin(_s.hotel_id)) then raise exception 'Shift not found'; end if;
  if _s.closed_at is not null then raise exception 'Shift already closed'; end if;
  if _counted is null or _counted < 0 then raise exception 'Enter the cash you counted'; end if;
  _rep := pos_shift_report(_s.id);
  update pos_shifts set closed_at = now(), closed_by = auth.uid(), counted_cash = _counted,
         expected_cash = (_rep->>'expected_cash')::numeric, variance = _counted - (_rep->>'expected_cash')::numeric,
         z_report = _rep || jsonb_build_object('counted_cash', _counted, 'variance', _counted - (_rep->>'expected_cash')::numeric, 'closed_at', now()),
         notes = nullif(trim(coalesce(_notes, '')), '')
   where id = _s.id returning * into _s;
  perform log_activity(_s.hotel_id, 'pos', format('Cash shift closed: expected %s, counted %s (%s%s)',
          to_char(_s.expected_cash, 'FM999,999,990'), to_char(_counted, 'FM999,999,990'),
          case when _s.variance >= 0 then '+' else '' end, to_char(_s.variance, 'FM999,999,990')), _s.id);
  return _s;
end $$;

-- ---------------------------------------------------------------------
-- Starter data: four outlets + a Kenyan sample menu (optional)
-- ---------------------------------------------------------------------
create or replace function public.pos_setup_defaults(_hotel_id uuid, _with_menu boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare _rest uuid; _bar uuid; _rs uuid; _pool uuid;
        c_break uuid; c_main uuid; c_side uuid; c_soft uuid; c_hot uuid; c_beer uuid; c_spirit uuid;
        g_cook uuid; g_side uuid; g_mixer uuid; i uuid;
begin
  if not pos_admin(_hotel_id) then raise exception 'Only managers can set up the POS'; end if;
  insert into pos_outlets (hotel_id, name, kind, sort) values (_hotel_id, 'Restaurant', 'restaurant', 1) on conflict do nothing returning id into _rest;
  insert into pos_outlets (hotel_id, name, kind, sort) values (_hotel_id, 'Bar', 'bar', 2) on conflict do nothing returning id into _bar;
  insert into pos_outlets (hotel_id, name, kind, sort) values (_hotel_id, 'Room service', 'room_service', 3) on conflict do nothing;
  insert into pos_outlets (hotel_id, name, kind, sort) values (_hotel_id, 'Pool bar', 'pool_bar', 4) on conflict do nothing returning id into _pool;
  if _rest is not null then
    insert into pos_tables (hotel_id, outlet_id, name, seats, sort)
    select _hotel_id, _rest, 'T' || g, case when g <= 6 then 4 else 2 end, g from generate_series(1, 10) g;
  end if;
  if _bar is not null then
    insert into pos_tables (hotel_id, outlet_id, name, seats, sort)
    select _hotel_id, _bar, 'B' || g, 4, g from generate_series(1, 6) g;
  end if;
  if _pool is not null then
    insert into pos_tables (hotel_id, outlet_id, name, seats, sort)
    select _hotel_id, _pool, 'P' || g, 4, g from generate_series(1, 4) g;
  end if;
  if not _with_menu or exists (select 1 from menu_items where hotel_id = _hotel_id) then return; end if;

  insert into menu_categories (hotel_id, name, station, sort) values (_hotel_id, 'Breakfast', 'kitchen', 1) returning id into c_break;
  insert into menu_categories (hotel_id, name, station, sort) values (_hotel_id, 'Mains', 'kitchen', 2) returning id into c_main;
  insert into menu_categories (hotel_id, name, station, sort) values (_hotel_id, 'Sides', 'kitchen', 3) returning id into c_side;
  insert into menu_categories (hotel_id, name, station, sort) values (_hotel_id, 'Soft drinks', 'bar', 4) returning id into c_soft;
  insert into menu_categories (hotel_id, name, station, sort) values (_hotel_id, 'Hot drinks', 'bar', 5) returning id into c_hot;
  insert into menu_categories (hotel_id, name, station, sort) values (_hotel_id, 'Beer', 'bar', 6) returning id into c_beer;
  insert into menu_categories (hotel_id, name, station, sort) values (_hotel_id, 'Spirits', 'bar', 7) returning id into c_spirit;

  insert into modifier_groups (hotel_id, name, min_choices, max_choices, sort) values (_hotel_id, 'How cooked?', 1, 1, 1) returning id into g_cook;
  insert into modifier_options (group_id, name, sort) values (g_cook, 'Medium', 1), (g_cook, 'Well done', 2), (g_cook, 'Medium rare', 3);
  insert into modifier_groups (hotel_id, name, min_choices, max_choices, sort) values (_hotel_id, 'Side', 1, 1, 2) returning id into g_side;
  insert into modifier_options (group_id, name, price_delta, sort) values (g_side, 'Ugali', 0, 1), (g_side, 'Chips', 0, 2), (g_side, 'Rice', 0, 3), (g_side, 'Chapati (2)', 100, 4);
  insert into modifier_groups (hotel_id, name, min_choices, max_choices, sort) values (_hotel_id, 'Mixer', 0, 2, 3) returning id into g_mixer;
  insert into modifier_options (group_id, name, price_delta, sort) values (g_mixer, 'Coke', 100, 1), (g_mixer, 'Tonic', 120, 2), (g_mixer, 'Ice', 0, 3);

  insert into menu_items (hotel_id, category_id, name, price, charge_kind, sort) values
    (_hotel_id, c_break, 'Full English breakfast', 1200, 'food', 1),
    (_hotel_id, c_break, 'Spanish omelette', 650, 'food', 2),
    (_hotel_id, c_break, 'Mandazi (3)', 200, 'food', 3);
  insert into menu_items (hotel_id, category_id, name, price, charge_kind, sort) values (_hotel_id, c_main, 'Nyama choma (500 g)', 1400, 'food', 1) returning id into i;
  insert into menu_item_modifier_groups values (i, g_cook, 1), (i, g_side, 2);
  insert into menu_items (hotel_id, category_id, name, price, charge_kind, sort) values (_hotel_id, c_main, 'Beef stew', 950, 'food', 2) returning id into i;
  insert into menu_item_modifier_groups values (i, g_side, 1);
  insert into menu_items (hotel_id, category_id, name, price, charge_kind, sort) values (_hotel_id, c_main, 'Tilapia fry', 1350, 'food', 3) returning id into i;
  insert into menu_item_modifier_groups values (i, g_side, 1);
  insert into menu_items (hotel_id, category_id, name, price, charge_kind, sort) values
    (_hotel_id, c_main, 'Chicken pilau', 900, 'food', 4),
    (_hotel_id, c_main, 'Vegetable curry', 800, 'food', 5),
    (_hotel_id, c_side, 'Chips masala', 450, 'food', 1),
    (_hotel_id, c_side, 'Kachumbari', 200, 'food', 2),
    (_hotel_id, c_side, 'Sukuma wiki', 250, 'food', 3),
    (_hotel_id, c_soft, 'Soda 500 ml', 150, 'drinks', 1),
    (_hotel_id, c_soft, 'Water 500 ml', 100, 'drinks', 2),
    (_hotel_id, c_soft, 'Fresh passion juice', 300, 'drinks', 3),
    (_hotel_id, c_hot, 'Kenyan tea', 150, 'drinks', 1),
    (_hotel_id, c_hot, 'Kenyan coffee', 250, 'drinks', 2),
    (_hotel_id, c_beer, 'Tusker lager', 350, 'drinks', 1),
    (_hotel_id, c_beer, 'White Cap', 350, 'drinks', 2),
    (_hotel_id, c_beer, 'Guinness', 400, 'drinks', 3);
  insert into menu_items (hotel_id, category_id, name, price, charge_kind, sort) values (_hotel_id, c_spirit, 'Gin (single)', 400, 'drinks', 1) returning id into i;
  insert into menu_item_modifier_groups values (i, g_mixer, 1);
  insert into menu_items (hotel_id, category_id, name, price, charge_kind, sort) values (_hotel_id, c_spirit, 'Whisky (single)', 450, 'drinks', 2) returning id into i;
  insert into menu_item_modifier_groups values (i, g_mixer, 1);
end $$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.pos_outlets enable row level security;
alter table public.pos_tables enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.menu_item_modifier_groups enable row level security;
alter table public.staff_pins enable row level security;
alter table public.pin_attempts enable row level security;
alter table public.pos_shifts enable row level security;
alter table public.pos_orders enable row level security;
alter table public.pos_order_items enable row level security;
alter table public.pos_payments enable row level security;
revoke all on public.pos_outlets, public.pos_tables, public.menu_categories, public.menu_items, public.modifier_groups,
  public.modifier_options, public.menu_item_modifier_groups, public.staff_pins, public.pin_attempts, public.pos_shifts,
  public.pos_orders, public.pos_order_items, public.pos_payments from anon;

-- setup: viewable by POS staff, editable by managers
create policy outlets_sel on public.pos_outlets for select to authenticated using (public.pos_viewer(hotel_id));
create policy outlets_w on public.pos_outlets for all to authenticated using (public.pos_admin(hotel_id)) with check (public.pos_admin(hotel_id));
create policy tables_sel on public.pos_tables for select to authenticated using (public.pos_viewer(hotel_id));
create policy tables_w on public.pos_tables for all to authenticated using (public.pos_admin(hotel_id)) with check (public.pos_admin(hotel_id));
create policy mcat_sel on public.menu_categories for select to authenticated using (public.pos_viewer(hotel_id));
create policy mcat_w on public.menu_categories for all to authenticated using (public.pos_admin(hotel_id)) with check (public.pos_admin(hotel_id));
create policy mitem_sel on public.menu_items for select to authenticated using (public.pos_viewer(hotel_id));
create policy mitem_w on public.menu_items for all to authenticated using (public.pos_admin(hotel_id)) with check (public.pos_admin(hotel_id));
-- staff can mark an item sold out / back in
create policy mitem_86 on public.menu_items for update to authenticated using (public.pos_staff(hotel_id)) with check (public.pos_staff(hotel_id));
create or replace function public.menu_items_staff_limits()
returns trigger language plpgsql as $$
begin
  if not pos_admin(new.hotel_id) and (new.name, new.price, new.category_id, new.tax_category, new.station, new.outlet_ids, new.active, new.charge_kind, new.item_code)
       is distinct from (old.name, old.price, old.category_id, old.tax_category, old.station, old.outlet_ids, old.active, old.charge_kind, old.item_code) then
    raise exception 'Only managers can edit the menu (staff can mark items sold out)';
  end if;
  return new;
end $$;
create trigger menu_items_staff_limits before update on public.menu_items for each row execute function public.menu_items_staff_limits();

create policy mgrp_sel on public.modifier_groups for select to authenticated using (public.pos_viewer(hotel_id));
create policy mgrp_w on public.modifier_groups for all to authenticated using (public.pos_admin(hotel_id)) with check (public.pos_admin(hotel_id));
create policy mopt_sel on public.modifier_options for select to authenticated
  using (exists (select 1 from public.modifier_groups g where g.id = group_id and public.pos_viewer(g.hotel_id)));
create policy mopt_w on public.modifier_options for all to authenticated
  using (exists (select 1 from public.modifier_groups g where g.id = group_id and public.pos_admin(g.hotel_id)))
  with check (exists (select 1 from public.modifier_groups g where g.id = group_id and public.pos_admin(g.hotel_id)));
create policy mimg_sel on public.menu_item_modifier_groups for select to authenticated
  using (exists (select 1 from public.menu_items m where m.id = item_id and public.pos_viewer(m.hotel_id)));
create policy mimg_w on public.menu_item_modifier_groups for all to authenticated
  using (exists (select 1 from public.menu_items m where m.id = item_id and public.pos_admin(m.hotel_id)))
  with check (exists (select 1 from public.menu_items m where m.id = item_id and public.pos_admin(m.hotel_id))
              and exists (select 1 from public.modifier_groups g join public.menu_items m on m.hotel_id = g.hotel_id where g.id = group_id and m.id = item_id));
-- PINs and attempts: never readable from the app
-- (no policies = no access; functions above are SECURITY DEFINER)

create policy shifts_sel on public.pos_shifts for select to authenticated
  using (user_id = auth.uid() or public.has_hotel_role_any(hotel_id, array['owner','manager','accountant']));

create policy orders_sel on public.pos_orders for select to authenticated using (public.pos_viewer(hotel_id));
create policy orders_ins on public.pos_orders for insert to authenticated
  with check (public.pos_staff(hotel_id) and status = 'open' and paid_total = 0 and discount_value = 0);
create policy orders_upd on public.pos_orders for update to authenticated
  using (public.pos_staff(hotel_id)) with check (public.pos_staff(hotel_id));

create policy oitems_sel on public.pos_order_items for select to authenticated using (public.pos_viewer(hotel_id));
create policy oitems_ins on public.pos_order_items for insert to authenticated
  with check (exists (select 1 from public.pos_orders o where o.id = order_id and public.pos_staff(o.hotel_id)));
create policy oitems_upd on public.pos_order_items for update to authenticated
  using (public.pos_staff(hotel_id)) with check (public.pos_staff(hotel_id));
create policy oitems_del on public.pos_order_items for delete to authenticated using (public.pos_staff(hotel_id));

create policy ppay_sel on public.pos_payments for select to authenticated using (public.pos_viewer(hotel_id));
-- inserts only through pos_pay / pos_charge_to_room

do $$
declare f text;
begin
  foreach f in array array[
    'pos_send_order(uuid)', 'pos_set_item_status(uuid[], public.pos_item_status)', 'pos_void_item(uuid, text, text, boolean, numeric)',
    'pos_set_discount(uuid, text, numeric, text, text)', 'pos_set_service_charge(uuid, numeric, text)', 'pos_move_items(uuid[], uuid)',
    'pos_pay(uuid, public.pos_payment_method, numeric, numeric, text)', 'pos_charge_to_room(uuid, uuid)', 'pos_void_order(uuid, text, text)',
    'pos_reopen_order(uuid, text, text)', 'pos_shift_report(uuid)', 'pos_open_shift(uuid, numeric)', 'pos_close_shift(uuid, numeric, text)',
    'pos_setup_defaults(uuid, boolean)', 'set_my_pin(uuid, text)', 'has_my_pin(uuid)', 'mpesa_code_used(uuid, text)',
    'pos_staff(uuid)', 'pos_viewer(uuid)', 'pos_admin(uuid)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.pos_orders, public.pos_order_items, public.menu_items;
  end if;
end $$;
