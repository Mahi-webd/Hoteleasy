-- =====================================================================
-- Paying first must not stop the kitchen.
-- Guests often pay before the food comes (bar, café, counter). A paid bill is closed for money (prices,
-- quantities and items stay locked), but the kitchen / bar must still be able to Start, mark Ready and the
-- waiter mark Served. Before this, the "closed bill" guard on order lines refused those status changes
-- ("This bill is closed"). A cancelled (void) bill stays untouchable: nothing there should be cooked.
-- Table QR follows the food after payment too (the diner's tracker and the waiters' "food ready").
-- Run AFTER 20261119170000_table_qr_kitchen_status.sql.
-- =====================================================================

-- ---------------------------------------------------------------- kitchen / bar / waiter progress
create or replace function public.pos_set_item_status(_item_ids uuid[], _status public.pos_item_status)
returns void language plpgsql security definer set search_path = public as $$
declare _hotel uuid;
begin
  if _status not in ('preparing', 'ready', 'served', 'sent') then raise exception 'Not allowed here'; end if;
  select distinct hotel_id into _hotel from pos_order_items where id = any(_item_ids) limit 1;
  if _hotel is null or not pos_staff(_hotel) then raise exception 'Items not found'; end if;
  if exists (select 1 from pos_order_items i join pos_orders o on o.id = i.order_id
              where i.id = any(_item_ids) and o.status = 'void') then
    raise exception 'This bill was cancelled, so there is nothing to prepare';
  end if;
  -- only the progress columns change here; the closed-bill guard still protects prices and quantities
  perform set_config('hotel_easy.rpc', 'on', true);
  update pos_order_items set status = _status,
         ready_at = case when _status = 'ready' then now() else ready_at end,
         served_at = case when _status = 'served' then now() else served_at end
   where id = any(_item_ids) and hotel_id = _hotel and status in ('sent', 'preparing', 'ready', 'served');
  perform set_config('hotel_easy.rpc', '', true);
end $$;

-- ---------------------------------------------------------------- what is still coming to a table
/** Orders whose food a table may still be waiting for: the open bill, and bills paid in the last 18 hours
    (the kitchen screen's window) that still have dishes to make or were served in the last 30 minutes. */
create or replace function public.table_food_orders(_table_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select o.id from pos_orders o
   where o.table_id = _table_id
     and (o.status = 'open'
          or (o.status = 'paid' and o.opened_at > now() - interval '18 hours'
              and exists (select 1 from pos_order_items i where i.order_id = o.id and i.status <> 'void'
                           and (i.status in ('sent', 'preparing', 'ready') or i.served_at > now() - interval '30 minutes'))))
$$;
revoke execute on function public.table_food_orders(uuid) from public, anon, authenticated;

/** Every dish and drink on its way to the table (for the diner's tracker). */
create or replace function public.table_food_json(_table_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'qty', i.quantity, 'status', i.status, 'station', i.station,
           'sent_at', i.sent_at, 'ready_at', i.ready_at, 'served_at', i.served_at) order by i.added_at), '[]')
    from pos_order_items i where i.order_id in (select table_food_orders(_table_id)) and i.status <> 'void'
$$;
revoke execute on function public.table_food_json(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- the diner's page (replaces step 2's)
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
    'order', table_order_json(_ord), 'bill', table_bill_json(_t.id), 'food', table_food_json(_t.id));
end $$;
grant execute on function public.public_table(text) to anon, authenticated;

-- ---------------------------------------------------------------- the waiters' map (replaces the kitchen-status version)
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
                  'call', (select table_call_json(c) || jsonb_build_object('by_id', c.acknowledged_by,
                                    'by_name', case when c.acknowledged_by is not null then staff_short_name(c.acknowledged_by) end)
                             from table_calls c where c.table_id = t.id and c.status in ('open', 'on_way')),
                  'order', (select table_order_json(x) from table_orders x where x.table_id = t.id and x.status = 'pending'),
                  'bill', (select jsonb_build_object('id', p.id, 'number', p.number, 'total', p.total, 'paid', p.paid_total)
                             from pos_orders p where p.table_id = t.id and p.status = 'open'),
                  -- the food side, open bill and bills already paid alike
                  'kitchen', (select jsonb_build_object(
                                'order_ids', coalesce((select jsonb_agg(x) from table_food_orders(t.id) x), '[]'),
                                'waiting', count(*) filter (where i.status = 'sent'),
                                'preparing', count(*) filter (where i.status = 'preparing'),
                                'ready_since', min(i.ready_at) filter (where i.status = 'ready'),
                                'ready', coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'qty', i.quantity, 'station', i.station)
                                                    order by i.ready_at) filter (where i.status = 'ready'), '[]'))
                              from pos_order_items i where i.order_id in (select table_food_orders(t.id)) and i.status in ('sent', 'preparing', 'ready')))
                order by t.sort, t.name)
         from pos_tables t left join table_links l on l.table_id = t.id
        where t.outlet_id = o.id and t.active), '[]'))
      order by o.sort, o.name)
      from pos_outlets o where o.hotel_id = _hotel_id and o.active), '[]');
end $$;
grant execute on function public.table_qr_board(uuid) to authenticated;
