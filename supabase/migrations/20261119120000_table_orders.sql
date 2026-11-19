-- =====================================================================
-- Table QR step 2: diners order from their phone (a waiter confirms it before it reaches the kitchen),
-- see their bill, and pay it with an M-Pesa prompt on their own phone.
--
-- Multi-tenant like step 1: everything is per hotel; staff go through has_perm (licence + plan);
-- the diner's side only works with the table's secret token, and only when the manager has switched
-- ordering / paying on for that outlet (both off by default).
-- No WhatsApp or other message is ever sent by any of this.
-- Run AFTER 20261119090000_table_qr.sql (and 20261116150000_mpesa.sql).
-- =====================================================================

alter table public.pos_outlets add column if not exists table_order_enabled boolean not null default false;
alter table public.pos_outlets add column if not exists table_pay_enabled boolean not null default false;

-- ---------------------------------------------------------------- orders waiting for a waiter
create table if not exists public.table_orders (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid not null references public.hotels(id) on delete cascade,
  outlet_id     uuid not null references public.pos_outlets(id) on delete cascade,
  table_id      uuid not null references public.pos_tables(id) on delete cascade,
  lines         jsonb not null,            -- [{menu_item_id, name, price, qty, notes}] — prices from the menu
  note          text check (note is null or length(note) <= 300),
  total         numeric(14,2) not null default 0,
  status        text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  reason        text,                      -- why the waiter said no
  pos_order_id  uuid references public.pos_orders(id) on delete set null,
  created_at    timestamptz not null default clock_timestamp(),
  decided_at    timestamptz,
  decided_by    uuid references auth.users(id) on delete set null
);
create index if not exists table_orders_hotel on public.table_orders (hotel_id, created_at desc);
create unique index if not exists table_orders_one_pending on public.table_orders (table_id) where status = 'pending';

alter table public.table_orders enable row level security;
revoke all on public.table_orders from anon;
drop policy if exists to_sel on public.table_orders;
create policy to_sel on public.table_orders for select to authenticated using (public.has_perm(hotel_id, 'tableqr.view'));

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'table_orders') then
    alter publication supabase_realtime add table public.table_orders;
  end if;
end $$;

-- ---------------------------------------------------------------- helpers
/** Can a diner order this item alone? (not when it needs options only a waiter can take) */
create or replace function public.menu_item_self_order(_item_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from menu_item_modifier_groups mg join modifier_groups g on g.id = mg.group_id
                      where mg.item_id = _item_id and g.min_choices > 0)
$$;

create or replace function public.table_order_json(_o table_orders)
returns jsonb language sql stable as $$
  select case when _o.id is null then null else jsonb_build_object(
    'id', _o.id, 'lines', _o.lines, 'note', _o.note, 'total', _o.total, 'status', _o.status, 'reason', _o.reason,
    'created_at', _o.created_at, 'decided_at', _o.decided_at) end
$$;

/** The open POS bill of a table, as the diner may see it (no staff names, no internal notes). */
create or replace function public.table_bill_json(_table_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('number', o.number, 'items_gross', o.items_gross, 'discount', o.discount_amount,
    'service_charge', o.service_charge, 'total', o.total, 'paid', o.paid_total, 'due', greatest(0, o.total - o.paid_total),
    'unsent', exists (select 1 from pos_order_items i where i.order_id = o.id and i.status = 'new'),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.quantity, 'amount', i.gross, 'comped', i.comped) order by i.added_at)
                         from pos_order_items i where i.order_id = o.id and i.status <> 'void'), '[]'))
  from pos_orders o where o.table_id = _table_id and o.status = 'open'
$$;
revoke execute on function public.table_bill_json(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- the diner's page (replaces step 1's)
create or replace function public.public_table(_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _l table_links; _h hotels; _t pos_tables; _o pos_outlets; _c table_calls; _ord table_orders; _menu jsonb;
begin
  if coalesce(length(_token), 0) < 16 then return null; end if;
  _l := table_link_live(_token);
  if _l.table_id is null then
    if exists (select 1 from table_links where token = _token) then return jsonb_build_object('off', true); end if;
    return null;
  end if;
  select * into _h from hotels where id = _l.hotel_id;
  select * into _t from pos_tables where id = _l.table_id;
  select * into _o from pos_outlets where id = _t.outlet_id;
  select * into _c from table_calls where table_id = _t.id order by created_at desc limit 1;
  if _c.id is not null and _c.status in ('done', 'cancelled') and coalesce(_c.done_at, _c.updated_at) < now() - interval '30 minutes' then _c := null; end if;
  select * into _ord from table_orders where table_id = _t.id order by created_at desc limit 1;
  if _ord.id is not null and _ord.status <> 'pending' and coalesce(_ord.decided_at, _ord.created_at) < now() - interval '30 minutes' then _ord := null; end if;

  select coalesce(jsonb_agg(jsonb_build_object('category', cat.name, 'items', cat.items) order by cat.sort, cat.name), '[]') into _menu
    from (select c.name, c.sort,
                 jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'description', i.description, 'price', i.price,
                   'available', i.available, 'self_order', menu_item_self_order(i.id)) order by i.sort, i.name) items
            from menu_categories c join menu_items i on i.category_id = c.id
           where c.hotel_id = _h.id and i.hotel_id = _h.id and i.active
             and (cardinality(i.outlet_ids) = 0 or _o.id = any(i.outlet_ids))
           group by c.id, c.name, c.sort) cat;

  return jsonb_build_object('hotel', _h.name, 'currency', coalesce(_h.currency, 'KES'), 'outlet', _o.name,
    'table', _t.name, 'menu', _menu, 'call', table_call_json(_c),
    'can_order', _o.table_order_enabled, 'can_pay', _o.table_pay_enabled and mpesa_ready(_h.id),
    'order', table_order_json(_ord), 'bill', table_bill_json(_t.id));
end $$;

/** The diner sends their order. It waits for a waiter; prices are taken from the menu, not the phone. */
create or replace function public.public_table_order(_token text, _items jsonb, _note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _l table_links; _t pos_tables; _o pos_outlets; _x jsonb; _m menu_items; _qty int; _lines jsonb := '[]'; _total numeric := 0;
        _ord table_orders; _n int;
begin
  _l := table_link_live(_token);
  if _l.table_id is null then raise exception 'This table''s QR code isn''t active. Please wave to a waiter.'; end if;
  select * into _t from pos_tables where id = _l.table_id;
  select * into _o from pos_outlets where id = _t.outlet_id;
  if not _o.table_order_enabled then raise exception 'Ordering from the phone isn''t on here. Tap "Call waiter" to order.'; end if;
  if jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then raise exception 'Your order is empty'; end if;
  if jsonb_array_length(_items) > 30 then raise exception 'That''s a lot! Please order up to 30 different items at a time.'; end if;
  if exists (select 1 from table_orders where table_id = _t.id and status = 'pending') then
    raise exception 'Your last order is still with the waiter. Please wait a moment, or cancel it to change it.';
  end if;
  select count(*) into _n from table_orders where table_id = _t.id and created_at > now() - interval '1 hour';
  if _n >= 10 then raise exception 'Too many orders from this table. Please call a waiter.'; end if;

  for _x in select * from jsonb_array_elements(_items) loop
    _qty := coalesce((_x->>'qty')::int, 0);
    if _qty < 1 or _qty > 20 then raise exception 'Choose between 1 and 20 of each item'; end if;
    select * into _m from menu_items where id = (_x->>'menu_item_id')::uuid and hotel_id = _t.hotel_id;
    if not found or not _m.active or not (cardinality(_m.outlet_ids) = 0 or _o.id = any(_m.outlet_ids)) then
      raise exception 'Something in your order isn''t on this menu any more. Please refresh the page.';
    end if;
    if not _m.available then raise exception '% is sold out. Please remove it.', _m.name; end if;
    if not menu_item_self_order(_m.id) then raise exception '% needs a choice only your waiter can take. Please call a waiter for it.', _m.name; end if;
    _lines := _lines || jsonb_build_object('menu_item_id', _m.id, 'name', _m.name, 'price', _m.price, 'qty', _qty,
                                           'notes', nullif(left(trim(coalesce(_x->>'notes', '')), 120), ''));
    _total := _total + _m.price * _qty;
  end loop;

  insert into table_orders (hotel_id, outlet_id, table_id, lines, note, total)
  values (_t.hotel_id, _t.outlet_id, _t.id, _lines, nullif(left(trim(coalesce(_note, '')), 300), ''), _total)
  returning * into _ord;
  return table_order_json(_ord);
end $$;

create or replace function public.public_table_order_cancel(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _l table_links; _ord table_orders;
begin
  _l := table_link_live(_token);
  if _l.table_id is null then return null; end if;
  update table_orders set status = 'cancelled', decided_at = clock_timestamp()
   where table_id = _l.table_id and status = 'pending' returning * into _ord;
  return table_order_json(_ord);
end $$;

/** The diner pays the open bill with an M-Pesa prompt on their phone (the existing M-Pesa setup). */
create or replace function public.public_table_mpesa(_token text, _phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _l table_links; _t pos_tables; _out pos_outlets; _o pos_orders; _ph text; _due numeric; _n int; _q mpesa_requests;
begin
  _l := table_link_live(_token);
  if _l.table_id is null then raise exception 'This table''s QR code isn''t active. Please ask for the bill.'; end if;
  select * into _t from pos_tables where id = _l.table_id;
  select * into _out from pos_outlets where id = _t.outlet_id;
  if not _out.table_pay_enabled or not mpesa_ready(_t.hotel_id) then raise exception 'Paying from the phone isn''t on here. Please ask for the bill.'; end if;
  select * into _o from pos_orders where table_id = _t.id and status = 'open' for update;
  if not found then raise exception 'There''s no open bill for this table'; end if;
  if exists (select 1 from pos_order_items where order_id = _o.id and status = 'new') then
    raise exception 'Your waiter is still adding items to the bill. Please try again in a moment.';
  end if;
  _due := ceil(greatest(0, _o.total - _o.paid_total));
  if _due < 1 then raise exception 'This bill is already paid. Thank you!'; end if;
  select count(*) into _n from mpesa_requests where pos_order_id = _o.id and created_at > now() - interval '1 hour';
  if _n >= 5 then raise exception 'Too many payment attempts. Please ask your waiter.'; end if;
  if exists (select 1 from mpesa_requests where pos_order_id = _o.id and status in ('new', 'sent') and created_at > now() - interval '2 minutes') then
    raise exception 'A payment prompt was just sent. Check your phone, or try again in 2 minutes.';
  end if;
  _ph := mpesa_phone(_phone);
  if _ph is null then raise exception 'Enter a Safaricom number like 0712 345 678'; end if;
  -- the payment lands in the shift of the waiter who opened the bill (as if they had sent the prompt)
  insert into mpesa_requests (hotel_id, kind, pos_order_id, phone, amount, account_ref, description, created_by)
  values (_o.hotel_id, 'pos', _o.id, _ph, _due, 'POS' || _o.number, left('Bill ' || _o.number, 13), _o.waiter_id)
  returning * into _q;
  return jsonb_build_object('id', _q.id, 'token', _q.token, 'phone', _q.phone, 'amount', _q.amount);
end $$;

grant execute on function public.public_table(text) to anon, authenticated;
grant execute on function public.public_table_order(text, jsonb, text) to anon, authenticated;
grant execute on function public.public_table_order_cancel(text) to anon, authenticated;
grant execute on function public.public_table_mpesa(text, text) to anon, authenticated;

-- ---------------------------------------------------------------- the staff side
/** Waiter confirms (items go on the table's POS bill and to the kitchen) or rejects with a reason. */
create or replace function public.table_order_decide(_id uuid, _accept boolean, _reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _ord table_orders; _po pos_orders; _x jsonb;
begin
  select * into _ord from table_orders where id = _id for update;
  if not found or not has_perm(_ord.hotel_id, 'tableqr.respond') then raise exception 'Order not found'; end if;
  if _ord.status <> 'pending' then raise exception 'This order was already handled'; end if;
  if not _accept then
    update table_orders set status = 'rejected', reason = nullif(left(trim(coalesce(_reason, '')), 200), ''),
           decided_at = clock_timestamp(), decided_by = auth.uid() where id = _id returning * into _ord;
    return table_order_json(_ord);
  end if;
  if not has_perm(_ord.hotel_id, 'pos.create') then raise exception 'You need the POS (take orders) permission to confirm orders'; end if;

  select * into _po from pos_orders where table_id = _ord.table_id and status = 'open' for update;
  if not found then
    insert into pos_orders (hotel_id, outlet_id, table_id, order_type, label, waiter_id)
    values (_ord.hotel_id, _ord.outlet_id, _ord.table_id, 'dine_in', 'Table QR order', auth.uid()) returning * into _po;
  end if;
  -- the POS checks each item again (on the menu, not sold out, sold here) and freezes today's price
  for _x in select * from jsonb_array_elements(_ord.lines) loop
    insert into pos_order_items (order_id, hotel_id, menu_item_id, name, unit_price, quantity, notes, added_by)
    values (_po.id, _ord.hotel_id, (_x->>'menu_item_id')::uuid, _x->>'name', (_x->>'price')::numeric, (_x->>'qty')::int,
            nullif(concat_ws(' · ', nullif(_x->>'notes', ''), case when _x = _ord.lines->0 then _ord.note end), ''), auth.uid());
  end loop;
  perform pos_send_order(_po.id);
  update table_orders set status = 'confirmed', pos_order_id = _po.id, decided_at = clock_timestamp(), decided_by = auth.uid()
   where id = _id returning * into _ord;
  perform log_activity(_ord.hotel_id, 'table_qr', format('Table order confirmed: %s items on bill %s', jsonb_array_length(_ord.lines), _po.number), _po.id);
  return table_order_json(_ord) || jsonb_build_object('pos_order_number', _po.number);
end $$;

create or replace function public.table_qr_set_outlet_options(_outlet_id uuid, _order boolean, _pay boolean)
returns void language plpgsql security definer set search_path = public as $$
declare _o pos_outlets;
begin
  select * into _o from pos_outlets where id = _outlet_id;
  if not found or not has_perm(_o.hotel_id, 'tableqr.admin') then raise exception 'Outlet not found'; end if;
  update pos_outlets set table_order_enabled = _order, table_pay_enabled = _pay where id = _outlet_id;
  perform log_activity(_o.hotel_id, 'table_qr', format('Table QR for %s: phone ordering %s, M-Pesa from the phone %s', _o.name,
    case when _order then 'on' else 'off' end, case when _pay then 'on' else 'off' end));
end $$;

/** Live table map (replaces step 1's): adds the pending order, the open bill and the outlet options. */
create or replace function public.table_qr_board(_hotel_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _admin boolean;
begin
  if not has_perm(_hotel_id, 'tableqr.view') then raise exception 'You don''t have access to Table QR'; end if;
  _admin := has_perm(_hotel_id, 'tableqr.admin');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'enabled', o.table_qr_enabled,
      'order_enabled', o.table_order_enabled, 'pay_enabled', o.table_pay_enabled, 'tables',
      coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'seats', t.seats,
                  'enabled', coalesce(l.enabled, false),
                  'token', case when _admin then l.token end,
                  'call', (select table_call_json(c) from table_calls c where c.table_id = t.id and c.status in ('open', 'on_way')),
                  'order', (select table_order_json(x) from table_orders x where x.table_id = t.id and x.status = 'pending'),
                  'bill', (select jsonb_build_object('number', p.number, 'total', p.total, 'paid', p.paid_total)
                             from pos_orders p where p.table_id = t.id and p.status = 'open'))
                order by t.sort, t.name)
         from pos_tables t left join table_links l on l.table_id = t.id
        where t.outlet_id = o.id and t.active), '[]'))
      order by o.sort, o.name)
      from pos_outlets o where o.hotel_id = _hotel_id and o.active), '[]');
end $$;

grant execute on function public.table_order_decide(uuid, boolean, text) to authenticated;
grant execute on function public.table_qr_set_outlet_options(uuid, boolean, boolean) to authenticated;
grant execute on function public.table_qr_board(uuid) to authenticated;
