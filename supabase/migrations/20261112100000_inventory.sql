-- =====================================================================
-- HotelEasy – Inventory & stock
--
--   * Stores (main store, kitchen, bar, housekeeping…), each POS outlet
--     draws from one store.
--   * Stock items with units, reorder levels and a weighted average cost.
--   * Suppliers, purchase orders (storekeeper drafts, manager approves),
--     goods received with or without an order.
--   * Transfers between stores, issues to departments, waste.
--   * Stock counts that post their differences as adjustments
--     (a manager approves, or a storekeeper with a manager PIN).
--   * Recipes on menu items: sending an order to the kitchen/bar takes
--     the ingredients out of the outlet's store and records the cost.
--   * Every change is a row in stock_movements; levels follow from it.
--   * New staff role: storekeeper.
--
-- Run AFTER 20261111180000_reports.sql.
-- =====================================================================

alter type public.hotel_role add value if not exists 'storekeeper';

create or replace function public.inv_viewer(_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_hotel_role_any(_hotel_id, array['owner','manager','accountant','storekeeper','restaurant']);
$$;
create or replace function public.inv_staff(_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_hotel_role_any(_hotel_id, array['owner','manager','storekeeper']);
$$;
create or replace function public.inv_admin(_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_hotel_role_any(_hotel_id, array['owner','manager']);
$$;

-- ---------------------------------------------------------------------
-- Setup tables
-- ---------------------------------------------------------------------
create table public.stock_locations (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references public.hotels(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  kind        text not null default 'main' check (kind in ('main', 'kitchen', 'bar', 'housekeeping', 'other')),
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  unique (hotel_id, name)
);

alter table public.pos_outlets add column if not exists stock_location_id uuid references public.stock_locations(id) on delete set null;

create table public.suppliers (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       uuid not null references public.hotels(id) on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  contact_name   text,
  phone          text,
  email          text,
  kra_pin        text,
  payment_terms  text,
  notes          text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (hotel_id, name)
);

create table public.stock_items (
  id                     uuid primary key default gen_random_uuid(),
  hotel_id               uuid not null references public.hotels(id) on delete cascade,
  name                   text not null check (length(trim(name)) > 0),
  sku                    text,
  category               text not null default 'Food',
  unit                   text not null default 'pcs' check (length(trim(unit)) > 0),
  reorder_level          numeric(14,3) not null default 0 check (reorder_level >= 0),
  reorder_qty            numeric(14,3) not null default 0 check (reorder_qty >= 0),
  avg_cost               numeric(14,4) not null default 0 check (avg_cost >= 0),
  last_cost              numeric(14,4),
  preferred_supplier_id  uuid references public.suppliers(id) on delete set null,
  active                 boolean not null default true,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create unique index stock_items_name on public.stock_items (hotel_id, lower(trim(name)));
create trigger t_stock_items_upd before update on public.stock_items for each row execute function public.touch_updated_at();

-- Cost is set by receipts only.
create or replace function public.stock_items_guard()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('hotel_easy.rpc', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.avg_cost := 0; new.last_cost := null;
    elsif (new.avg_cost, new.last_cost) is distinct from (old.avg_cost, old.last_cost) then
      raise exception 'Cost comes from goods received; record a receipt instead';
    end if;
  end if;
  return new;
end $$;
create trigger stock_items_guard before insert or update on public.stock_items for each row execute function public.stock_items_guard();

create table public.stock_levels (
  item_id      uuid not null references public.stock_items(id) on delete cascade,
  location_id  uuid not null references public.stock_locations(id) on delete cascade,
  hotel_id     uuid not null references public.hotels(id) on delete cascade,
  qty          numeric(14,3) not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (item_id, location_id)
);
create index on public.stock_levels (hotel_id);

create table public.menu_item_recipes (
  menu_item_id   uuid not null references public.menu_items(id) on delete cascade,
  stock_item_id  uuid not null references public.stock_items(id) on delete restrict,
  hotel_id       uuid not null references public.hotels(id) on delete cascade,
  qty            numeric(14,4) not null check (qty > 0),
  primary key (menu_item_id, stock_item_id)
);

create or replace function public.inv_same_hotel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'menu_item_recipes' then
    if not exists (select 1 from menu_items where id = new.menu_item_id and hotel_id = new.hotel_id)
       or not exists (select 1 from stock_items where id = new.stock_item_id and hotel_id = new.hotel_id) then
      raise exception 'Item belongs to another hotel';
    end if;
  elsif tg_table_name = 'stock_items' then
    if new.preferred_supplier_id is not null and not exists (select 1 from suppliers where id = new.preferred_supplier_id and hotel_id = new.hotel_id) then
      raise exception 'Supplier belongs to another hotel';
    end if;
  elsif tg_table_name = 'pos_outlets' then
    if new.stock_location_id is not null and not exists (select 1 from stock_locations where id = new.stock_location_id and hotel_id = new.hotel_id) then
      raise exception 'Store belongs to another hotel';
    end if;
  end if;
  return new;
end $$;
create trigger recipes_refs before insert or update on public.menu_item_recipes for each row execute function public.inv_same_hotel();
create trigger stock_items_refs before insert or update on public.stock_items for each row execute function public.inv_same_hotel();
create trigger outlets_store_ref before insert or update of stock_location_id on public.pos_outlets for each row execute function public.inv_same_hotel();

-- ---------------------------------------------------------------------
-- Purchase orders
-- ---------------------------------------------------------------------
create type public.po_status as enum ('draft', 'approved', 'partly_received', 'received', 'cancelled');

create table public.purchase_orders (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references public.hotels(id) on delete cascade,
  number       int not null,
  supplier_id  uuid not null references public.suppliers(id) on delete restrict,
  location_id  uuid not null references public.stock_locations(id) on delete restrict,
  status       public.po_status not null default 'draft',
  expected_on  date,
  notes        text,
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  approved_by  uuid references auth.users(id) on delete set null,
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (hotel_id, number)
);
create trigger t_po_upd before update on public.purchase_orders for each row execute function public.touch_updated_at();

create table public.purchase_order_lines (
  id            uuid primary key default gen_random_uuid(),
  po_id         uuid not null references public.purchase_orders(id) on delete cascade,
  hotel_id      uuid not null references public.hotels(id) on delete cascade,
  item_id       uuid not null references public.stock_items(id) on delete restrict,
  qty           numeric(14,3) not null check (qty > 0),
  unit_cost     numeric(14,4) not null default 0 check (unit_cost >= 0),
  qty_received  numeric(14,3) not null default 0,
  unique (po_id, item_id)
);

create or replace function public.po_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare _rpc boolean := coalesce(current_setting('hotel_easy.rpc', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if not _rpc then
      new.status := 'draft'; new.approved_by := null; new.approved_at := null; new.created_by := auth.uid();
    end if;
    new.number := coalesce((select max(number) from purchase_orders where hotel_id = new.hotel_id), 0) + 1;
    if not exists (select 1 from suppliers where id = new.supplier_id and hotel_id = new.hotel_id)
       or not exists (select 1 from stock_locations where id = new.location_id and hotel_id = new.hotel_id) then
      raise exception 'Supplier or store belongs to another hotel';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'Only draft orders can be deleted; cancel it instead'; end if;
    return old;
  end if;
  if not _rpc then
    if new.status is distinct from old.status or new.approved_by is distinct from old.approved_by or new.number <> old.number then
      raise exception 'Use Approve, Receive or Cancel to change an order';
    end if;
    if old.status <> 'draft' then raise exception 'Only draft orders can be edited'; end if;
  end if;
  if (new.supplier_id, new.location_id) is distinct from (old.supplier_id, old.location_id)
     and (not exists (select 1 from suppliers where id = new.supplier_id and hotel_id = new.hotel_id)
          or not exists (select 1 from stock_locations where id = new.location_id and hotel_id = new.hotel_id)) then
    raise exception 'Supplier or store belongs to another hotel';
  end if;
  return new;
end $$;
create trigger po_guard before insert or update or delete on public.purchase_orders for each row execute function public.po_guard();

create or replace function public.po_line_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare _rpc boolean := coalesce(current_setting('hotel_easy.rpc', true), '') = 'on';
        _po purchase_orders;
begin
  select * into _po from purchase_orders where id = coalesce(new.po_id, old.po_id);
  if not _rpc then
    if _po.status <> 'draft' then raise exception 'Only draft orders can be edited'; end if;
    if tg_op <> 'DELETE' then new.qty_received := coalesce(old.qty_received, 0); end if;
  end if;
  if tg_op <> 'DELETE' then
    new.hotel_id := _po.hotel_id;
    if not exists (select 1 from stock_items where id = new.item_id and hotel_id = _po.hotel_id) then
      raise exception 'Item belongs to another hotel';
    end if;
    return new;
  end if;
  return old;
end $$;
create trigger po_line_guard before insert or update or delete on public.purchase_order_lines for each row execute function public.po_line_guard();

-- ---------------------------------------------------------------------
-- Movements (the ledger) and levels
-- ---------------------------------------------------------------------
create type public.stock_move_kind as enum ('opening', 'receive', 'transfer_out', 'transfer_in', 'issue', 'waste', 'sale', 'adjust', 'return');

create table public.stock_movements (
  id                 uuid primary key default gen_random_uuid(),
  hotel_id           uuid not null references public.hotels(id) on delete cascade,
  item_id            uuid not null references public.stock_items(id) on delete cascade,
  location_id        uuid not null references public.stock_locations(id) on delete cascade,
  kind               public.stock_move_kind not null,
  qty                numeric(14,3) not null check (qty <> 0),
  unit_cost          numeric(14,4) not null default 0,
  value              numeric(14,2) generated always as (round(qty * unit_cost, 2)) stored,
  batch_id           uuid not null default gen_random_uuid(),
  reference          text,
  note               text,
  department         text,
  supplier_id        uuid references public.suppliers(id) on delete set null,
  po_id              uuid references public.purchase_orders(id) on delete set null,
  pos_order_item_id  uuid references public.pos_order_items(id) on delete set null,
  count_id           uuid,
  created_by         uuid references auth.users(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now()
);
create index on public.stock_movements (hotel_id, created_at desc);
create index on public.stock_movements (item_id, created_at desc);
create index on public.stock_movements (batch_id);

create or replace function public.stock_movement_apply()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then raise exception 'Stock movements cannot be changed; record a correction instead'; end if;
  insert into stock_levels (item_id, location_id, hotel_id, qty) values (new.item_id, new.location_id, new.hotel_id, new.qty)
  on conflict (item_id, location_id) do update set qty = stock_levels.qty + excluded.qty, updated_at = now();
  return new;
end $$;
create trigger stock_movement_apply after insert or update or delete on public.stock_movements
  for each row execute function public.stock_movement_apply();

-- ---------------------------------------------------------------------
-- Counts
-- ---------------------------------------------------------------------
create table public.stock_counts (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references public.hotels(id) on delete cascade,
  number       int not null,
  location_id  uuid not null references public.stock_locations(id) on delete restrict,
  status       text not null default 'open' check (status in ('open', 'posted', 'cancelled')),
  note         text,
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  posted_by    uuid references auth.users(id) on delete set null,
  approved_by  uuid references auth.users(id) on delete set null,
  posted_at    timestamptz,
  variance_value numeric(14,2),
  unique (hotel_id, number)
);
create unique index stock_counts_one_open on public.stock_counts (location_id) where status = 'open';

create table public.stock_count_lines (
  count_id   uuid not null references public.stock_counts(id) on delete cascade,
  item_id    uuid not null references public.stock_items(id) on delete cascade,
  hotel_id   uuid not null references public.hotels(id) on delete cascade,
  expected   numeric(14,3),
  counted    numeric(14,3) check (counted is null or counted >= 0),
  unit_cost  numeric(14,4),
  primary key (count_id, item_id)
);

create or replace function public.count_line_guard()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('hotel_easy.rpc', true), '') <> 'on' then
    if (select status from stock_counts where id = new.count_id) <> 'open' then raise exception 'This count is closed'; end if;
    if (new.expected, new.unit_cost, new.item_id, new.count_id, new.hotel_id)
       is distinct from (old.expected, old.unit_cost, old.item_id, old.count_id, old.hotel_id) then
      raise exception 'Only the counted quantity can be entered';
    end if;
  end if;
  return new;
end $$;
create trigger count_line_guard before update on public.stock_count_lines for each row execute function public.count_line_guard();

-- ---------------------------------------------------------------------
-- POS: recipe cost and stock deduction when an order goes to the kitchen
-- ---------------------------------------------------------------------
alter table public.pos_order_items add column if not exists cost numeric(12,2) not null default 0;

create or replace function public.recipe_cost(_menu_item_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(r.qty * s.avg_cost), 0) from menu_item_recipes r join stock_items s on s.id = r.stock_item_id
   where r.menu_item_id = _menu_item_id;
$$;

create or replace function public.pos_item_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare _loc uuid;
begin
  if tg_op = 'INSERT' then
    -- split lines from a part-void arrive already sent: share of the cost, no new deduction
    if new.status <> 'new' then new.cost := round(recipe_cost(new.menu_item_id) * new.quantity, 2); end if;
    return new;
  end if;
  if old.status = 'new' and new.status not in ('new', 'void') then
    new.cost := round(recipe_cost(new.menu_item_id) * new.quantity, 2);
    select ou.stock_location_id into _loc from pos_orders o join pos_outlets ou on ou.id = o.outlet_id where o.id = new.order_id;
    if _loc is not null then
      insert into stock_movements (hotel_id, item_id, location_id, kind, qty, unit_cost, pos_order_item_id, note)
      select new.hotel_id, r.stock_item_id, _loc, 'sale', -(r.qty * new.quantity), s.avg_cost, new.id, new.name
        from menu_item_recipes r join stock_items s on s.id = r.stock_item_id
       where r.menu_item_id = new.menu_item_id;
    end if;
  elsif old.status <> 'new' and new.quantity <> old.quantity and old.quantity > 0 then
    new.cost := round(old.cost * new.quantity / old.quantity, 2);
  end if;
  return new;
end $$;
create trigger pos_item_stock before insert or update on public.pos_order_items for each row execute function public.pos_item_stock();

-- ---------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------
create or replace function public.inv_check_location(_hotel_id uuid, _loc uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if _loc is null or not exists (select 1 from stock_locations where id = _loc and hotel_id = _hotel_id) then
    raise exception 'Choose a store';
  end if;
end $$;

-- Goods received (with or without a purchase order), or opening stock.
-- _lines: [{"item_id":…, "qty":…, "unit_cost":…}]
create or replace function public.inv_receive(_hotel_id uuid, _location_id uuid, _lines jsonb, _supplier_id uuid default null,
                                             _po_id uuid default null, _reference text default null, _note text default null,
                                             _opening boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _batch uuid := gen_random_uuid();
  _l jsonb; _item stock_items; _qty numeric; _cost numeric; _onhand numeric;
  _po purchase_orders; _total numeric := 0; _n int := 0; _prev text;
begin
  if not inv_staff(_hotel_id) then raise exception 'Only managers and storekeepers can receive stock'; end if;
  perform inv_check_location(_hotel_id, _location_id);
  if _supplier_id is not null and not exists (select 1 from suppliers where id = _supplier_id and hotel_id = _hotel_id) then
    raise exception 'Supplier not found';
  end if;
  if _po_id is not null then
    select * into _po from purchase_orders where id = _po_id and hotel_id = _hotel_id for update;
    if not found then raise exception 'Purchase order not found'; end if;
    if _po.status not in ('approved', 'partly_received') then raise exception 'Only approved orders can be received'; end if;
    _supplier_id := _po.supplier_id;
  end if;
  if _lines is null or jsonb_array_length(_lines) = 0 then raise exception 'Add at least one item'; end if;
  _prev := coalesce(current_setting('hotel_easy.rpc', true), '');
  perform set_config('hotel_easy.rpc', 'on', true);
  for _l in select * from jsonb_array_elements(_lines) loop
    _qty := (_l->>'qty')::numeric; _cost := coalesce((_l->>'unit_cost')::numeric, 0);
    if _qty is null or _qty = 0 then continue; end if;
    if _qty < 0 then raise exception 'Quantities must be positive'; end if;
    if _cost < 0 then raise exception 'Cost cannot be negative'; end if;
    select * into _item from stock_items where id = (_l->>'item_id')::uuid and hotel_id = _hotel_id for update;
    if not found then raise exception 'Item not found'; end if;
    select coalesce(sum(qty), 0) into _onhand from stock_levels where item_id = _item.id;
    update stock_items set
      avg_cost = case when _onhand <= 0 then _cost else round((_onhand * avg_cost + _qty * _cost) / (_onhand + _qty), 4) end,
      last_cost = _cost
     where id = _item.id;
    insert into stock_movements (hotel_id, item_id, location_id, kind, qty, unit_cost, batch_id, reference, note, supplier_id, po_id)
    values (_hotel_id, _item.id, _location_id, case when _opening then 'opening' else 'receive' end::stock_move_kind,
            _qty, _cost, _batch, nullif(trim(_reference), ''), nullif(trim(_note), ''), _supplier_id, _po_id);
    if _po_id is not null then
      update purchase_order_lines set qty_received = qty_received + _qty where po_id = _po_id and item_id = _item.id;
      if not found then
        insert into purchase_order_lines (po_id, hotel_id, item_id, qty, unit_cost, qty_received)
        values (_po_id, _hotel_id, _item.id, _qty, _cost, _qty);
      end if;
    end if;
    _total := _total + round(_qty * _cost, 2); _n := _n + 1;
  end loop;
  if _n = 0 then raise exception 'Add at least one item'; end if;
  if _po_id is not null then
    update purchase_orders set status = case when exists (select 1 from purchase_order_lines where po_id = _po_id and qty_received < qty)
                                             then 'partly_received' else 'received' end::po_status
     where id = _po_id;
  end if;
  perform set_config('hotel_easy.rpc', _prev, true);
  perform log_activity(_hotel_id, 'inventory', format('%s: %s items, %s', case when _opening then 'Opening stock' else 'Goods received' end,
          _n, to_char(_total, 'FM999,999,990.00')) || coalesce(' from ' || (select name from suppliers where id = _supplier_id), '')
          || coalesce(' (PO #' || _po.number || ')', ''), _batch);
  return _batch;
end $$;

-- Transfers, issues to departments, waste, returns to supplier.
-- _kind: 'transfer' | 'issue' | 'waste' | 'return'
create or replace function public.inv_move(_hotel_id uuid, _kind text, _location_id uuid, _lines jsonb,
                                          _to_location_id uuid default null, _department text default null,
                                          _note text default null, _supplier_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _batch uuid := gen_random_uuid();
  _l jsonb; _item stock_items; _qty numeric; _have numeric; _n int := 0; _val numeric := 0;
begin
  if _kind = 'waste' then
    if not (inv_staff(_hotel_id) or has_hotel_role_any(_hotel_id, array['restaurant'])) then
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
end $$;

-- Purchase orders
create or replace function public.inv_po_set_status(_po_id uuid, _action text)
returns void language plpgsql security definer set search_path = public as $$
declare _po purchase_orders; _prev text;
begin
  select * into _po from purchase_orders where id = _po_id for update;
  if not found or not inv_staff(_po.hotel_id) then raise exception 'Order not found'; end if;
  _prev := coalesce(current_setting('hotel_easy.rpc', true), '');
  perform set_config('hotel_easy.rpc', 'on', true);
  if _action = 'approve' then
    if not inv_admin(_po.hotel_id) then raise exception 'A manager must approve purchase orders'; end if;
    if _po.status <> 'draft' then raise exception 'Only drafts can be approved'; end if;
    if not exists (select 1 from purchase_order_lines where po_id = _po_id) then raise exception 'Add items first'; end if;
    update purchase_orders set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = _po_id;
    perform log_activity(_po.hotel_id, 'inventory', format('PO #%s approved', _po.number), _po_id);
  elsif _action = 'cancel' then
    if _po.status in ('received', 'cancelled') then raise exception 'This order is closed'; end if;
    if _po.status <> 'draft' and not inv_admin(_po.hotel_id) then raise exception 'A manager must cancel approved orders'; end if;
    update purchase_orders set status = 'cancelled' where id = _po_id;
    perform log_activity(_po.hotel_id, 'inventory', format('PO #%s cancelled', _po.number), _po_id);
  elsif _action = 'close' then
    -- supplier won't deliver the rest
    if _po.status <> 'partly_received' then raise exception 'Only part-received orders can be closed'; end if;
    update purchase_orders set status = 'received' where id = _po_id;
  else
    raise exception 'Unknown action';
  end if;
  perform set_config('hotel_easy.rpc', _prev, true);
end $$;

-- Counts
create or replace function public.inv_count_start(_hotel_id uuid, _location_id uuid, _note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  if not inv_staff(_hotel_id) then raise exception 'Only managers and storekeepers can count stock'; end if;
  perform inv_check_location(_hotel_id, _location_id);
  if exists (select 1 from stock_counts where location_id = _location_id and status = 'open') then
    raise exception 'A count is already open for this store';
  end if;
  insert into stock_counts (hotel_id, number, location_id, note)
  values (_hotel_id, coalesce((select max(number) from stock_counts where hotel_id = _hotel_id), 0) + 1, _location_id, nullif(trim(_note), ''))
  returning id into _id;
  insert into stock_count_lines (count_id, item_id, hotel_id)
  select _id, s.id, _hotel_id from stock_items s
   where s.hotel_id = _hotel_id
     and (s.active or exists (select 1 from stock_levels l where l.item_id = s.id and l.location_id = _location_id and l.qty <> 0));
  return _id;
end $$;

-- Post: differences become adjustments. Returns 'wrong_pin' or the variance value.
create or replace function public.inv_count_post(_count_id uuid, _pin text default null)
returns text language plpgsql security definer set search_path = public as $$
declare _c stock_counts; _mgr uuid; _batch uuid := gen_random_uuid(); _var numeric; _prev text;
begin
  select * into _c from stock_counts where id = _count_id for update;
  if not found or not inv_staff(_c.hotel_id) then raise exception 'Count not found'; end if;
  if _c.status <> 'open' then raise exception 'This count is closed'; end if;
  if not exists (select 1 from stock_count_lines where count_id = _count_id and counted is not null) then
    raise exception 'Enter at least one counted quantity';
  end if;
  _mgr := approver(_c.hotel_id, _pin);
  if _mgr is null then return 'wrong_pin'; end if;
  _prev := coalesce(current_setting('hotel_easy.rpc', true), '');
  perform set_config('hotel_easy.rpc', 'on', true);
  update stock_count_lines cl set
    expected = coalesce((select qty from stock_levels l where l.item_id = cl.item_id and l.location_id = _c.location_id), 0),
    unit_cost = (select avg_cost from stock_items where id = cl.item_id)
   where count_id = _count_id;
  insert into stock_movements (hotel_id, item_id, location_id, kind, qty, unit_cost, batch_id, count_id, note)
  select _c.hotel_id, item_id, _c.location_id, 'adjust', counted - expected, unit_cost, _batch, _count_id, 'Stock count #' || _c.number
    from stock_count_lines where count_id = _count_id and counted is not null and counted <> expected;
  select coalesce(sum(round((counted - expected) * unit_cost, 2)), 0) into _var
    from stock_count_lines where count_id = _count_id and counted is not null;
  update stock_counts set status = 'posted', posted_by = auth.uid(), approved_by = _mgr, posted_at = now(), variance_value = _var
   where id = _count_id;
  perform set_config('hotel_easy.rpc', _prev, true);
  perform log_activity(_c.hotel_id, 'inventory', format('Stock count #%s posted at %s: difference %s', _c.number,
          (select name from stock_locations where id = _c.location_id), to_char(_var, 'FM999,999,990.00')), _count_id);
  return _var::text;
end $$;

create or replace function public.inv_count_cancel(_count_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _c stock_counts;
begin
  select * into _c from stock_counts where id = _count_id;
  if not found or not inv_staff(_c.hotel_id) then raise exception 'Count not found'; end if;
  if _c.status <> 'open' then raise exception 'This count is closed'; end if;
  update stock_counts set status = 'cancelled' where id = _count_id;
end $$;

-- Cost report: theoretical food & beverage cost from recipes, consumption by kind, purchases.
create or replace function public.inv_cost_report(_hotel_id uuid, _from date, _to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _tz text;
begin
  if not has_hotel_role_any(_hotel_id, array['owner', 'manager', 'accountant', 'storekeeper']) then
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
end $$;

-- Starter stores, linked to the POS outlets, and a few common items.
create or replace function public.inv_setup_defaults(_hotel_id uuid, _with_items boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare _main uuid; _kit uuid; _bar uuid; _hk uuid;
begin
  if not inv_admin(_hotel_id) then raise exception 'Only owners and managers can set up inventory'; end if;
  insert into stock_locations (hotel_id, name, kind, sort) values
    (_hotel_id, 'Main store', 'main', 1), (_hotel_id, 'Kitchen', 'kitchen', 2),
    (_hotel_id, 'Bar', 'bar', 3), (_hotel_id, 'Housekeeping', 'housekeeping', 4)
  on conflict (hotel_id, name) do nothing;
  select id into _main from stock_locations where hotel_id = _hotel_id and name = 'Main store';
  select id into _kit from stock_locations where hotel_id = _hotel_id and name = 'Kitchen';
  select id into _bar from stock_locations where hotel_id = _hotel_id and name = 'Bar';
  update pos_outlets set stock_location_id = case when kind in ('bar', 'pool_bar') then _bar else _kit end
   where hotel_id = _hotel_id and stock_location_id is null;

  if _with_items and not exists (select 1 from stock_items where hotel_id = _hotel_id) then
    insert into stock_items (hotel_id, name, category, unit, reorder_level, reorder_qty) values
      (_hotel_id, 'Beef (steak cuts)', 'Meat', 'kg', 5, 10),
      (_hotel_id, 'Chicken (whole)', 'Meat', 'pcs', 6, 12),
      (_hotel_id, 'Tilapia (whole)', 'Fish', 'pcs', 6, 12),
      (_hotel_id, 'Maize flour', 'Dry goods', 'kg', 10, 24),
      (_hotel_id, 'Rice', 'Dry goods', 'kg', 10, 25),
      (_hotel_id, 'Potatoes', 'Vegetables', 'kg', 15, 50),
      (_hotel_id, 'Sukuma wiki', 'Vegetables', 'kg', 3, 10),
      (_hotel_id, 'Tomatoes', 'Vegetables', 'kg', 5, 15),
      (_hotel_id, 'Onions', 'Vegetables', 'kg', 5, 15),
      (_hotel_id, 'Cooking oil', 'Dry goods', 'l', 10, 20),
      (_hotel_id, 'Eggs', 'Dairy & eggs', 'pcs', 60, 180),
      (_hotel_id, 'Milk', 'Dairy & eggs', 'l', 10, 30),
      (_hotel_id, 'Kenyan tea leaves', 'Beverages', 'kg', 1, 3),
      (_hotel_id, 'Coffee beans', 'Beverages', 'kg', 1, 3),
      (_hotel_id, 'Tusker lager 500ml', 'Beer', 'btl', 48, 96),
      (_hotel_id, 'White Cap 500ml', 'Beer', 'btl', 24, 48),
      (_hotel_id, 'Soda 300ml', 'Soft drinks', 'btl', 48, 96),
      (_hotel_id, 'Mineral water 500ml', 'Soft drinks', 'btl', 48, 96),
      (_hotel_id, 'Gin 750ml', 'Spirits', 'btl', 2, 6),
      (_hotel_id, 'Whisky 750ml', 'Spirits', 'btl', 2, 6),
      (_hotel_id, 'Toilet paper', 'Housekeeping', 'roll', 50, 200),
      (_hotel_id, 'Bath soap', 'Housekeeping', 'pcs', 50, 200),
      (_hotel_id, 'Shampoo sachets', 'Housekeeping', 'pcs', 50, 200);
  end if;
  perform log_activity(_hotel_id, 'inventory', 'Inventory set up', null);
end $$;

-- ---------------------------------------------------------------------
-- Security
-- ---------------------------------------------------------------------
alter table public.stock_locations enable row level security;
alter table public.suppliers enable row level security;
alter table public.stock_items enable row level security;
alter table public.stock_levels enable row level security;
alter table public.menu_item_recipes enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_counts enable row level security;
alter table public.stock_count_lines enable row level security;
revoke all on public.stock_locations, public.suppliers, public.stock_items, public.stock_levels, public.menu_item_recipes,
  public.purchase_orders, public.purchase_order_lines, public.stock_movements, public.stock_counts, public.stock_count_lines from anon;

create policy sloc_sel on public.stock_locations for select to authenticated using (public.inv_viewer(hotel_id));
create policy sloc_w on public.stock_locations for all to authenticated using (public.inv_admin(hotel_id)) with check (public.inv_admin(hotel_id));
create policy sup_sel on public.suppliers for select to authenticated using (public.inv_viewer(hotel_id));
create policy sup_w on public.suppliers for all to authenticated using (public.inv_staff(hotel_id)) with check (public.inv_staff(hotel_id));
create policy sitem_sel on public.stock_items for select to authenticated using (public.inv_viewer(hotel_id));
create policy sitem_w on public.stock_items for all to authenticated using (public.inv_staff(hotel_id)) with check (public.inv_staff(hotel_id));
create policy slev_sel on public.stock_levels for select to authenticated using (public.inv_viewer(hotel_id));
create policy recipe_sel on public.menu_item_recipes for select to authenticated using (public.inv_viewer(hotel_id));
create policy recipe_w on public.menu_item_recipes for all to authenticated using (public.inv_admin(hotel_id)) with check (public.inv_admin(hotel_id));
create policy po_sel on public.purchase_orders for select to authenticated using (public.inv_viewer(hotel_id));
create policy po_w on public.purchase_orders for all to authenticated using (public.inv_staff(hotel_id)) with check (public.inv_staff(hotel_id));
create policy pol_sel on public.purchase_order_lines for select to authenticated using (public.inv_viewer(hotel_id));
create policy pol_w on public.purchase_order_lines for all to authenticated
  using (exists (select 1 from public.purchase_orders p where p.id = po_id and public.inv_staff(p.hotel_id)))
  with check (exists (select 1 from public.purchase_orders p where p.id = po_id and public.inv_staff(p.hotel_id)));
create policy smove_sel on public.stock_movements for select to authenticated using (public.inv_viewer(hotel_id));
create policy scount_sel on public.stock_counts for select to authenticated using (public.inv_viewer(hotel_id));
create policy scl_sel on public.stock_count_lines for select to authenticated using (public.inv_viewer(hotel_id));
create policy scl_upd on public.stock_count_lines for update to authenticated using (public.inv_staff(hotel_id)) with check (public.inv_staff(hotel_id));
-- movements, levels and counts are written only by the functions above

-- Outlet → store link is a manager setting (outlets_w policy already covers it).

do $$
declare f text;
begin
  foreach f in array array[
    'inv_viewer(uuid)', 'inv_staff(uuid)', 'inv_admin(uuid)',
    'inv_receive(uuid, uuid, jsonb, uuid, uuid, text, text, boolean)',
    'inv_move(uuid, text, uuid, jsonb, uuid, text, text, uuid)',
    'inv_po_set_status(uuid, text)', 'inv_count_start(uuid, uuid, text)', 'inv_count_post(uuid, text)',
    'inv_count_cancel(uuid)', 'inv_cost_report(uuid, date, date)', 'inv_setup_defaults(uuid, boolean)', 'recipe_cost(uuid)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.inv_check_location(uuid, uuid) from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.stock_levels;
  end if;
end $$;
