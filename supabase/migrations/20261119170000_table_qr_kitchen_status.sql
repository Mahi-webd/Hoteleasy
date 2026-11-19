-- =====================================================================
-- Table QR: follow the food from the kitchen to the table.
--  * The diner's page shows each dish and drink live: waiting → being prepared → ready, on its way → served
--    (whatever the kitchen / bar screen or the waiter sets in the POS).
--  * The waiters' live table map shows what the kitchen has made ready for each table (food waiting at the
--    pass), so the waiter can collect it and tap "Served" right there.
-- Same rules as before: per hotel, staff through has_perm, the diner only with the table's secret token.
-- Run AFTER 20261119150000_table_qr_staff_names.sql.
-- =====================================================================

/** The open POS bill of a table as the diner sees it (replaces step 2's): now with each line's progress. */
create or replace function public.table_bill_json(_table_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('number', o.number, 'items_gross', o.items_gross, 'discount', o.discount_amount,
    'service_charge', o.service_charge, 'total', o.total, 'paid', o.paid_total, 'due', greatest(0, o.total - o.paid_total),
    'unsent', exists (select 1 from pos_order_items i where i.order_id = o.id and i.status = 'new'),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'qty', i.quantity, 'amount', i.gross,
                         'comped', i.comped, 'status', i.status, 'station', i.station,
                         'sent_at', i.sent_at, 'ready_at', i.ready_at, 'served_at', i.served_at) order by i.added_at)
                         from pos_order_items i where i.order_id = o.id and i.status <> 'void'), '[]'))
  from pos_orders o where o.table_id = _table_id and o.status = 'open'
$$;
revoke execute on function public.table_bill_json(uuid) from public, anon, authenticated;

/** Live table map (replaces the staff-names version): the open bill now says what the kitchen is doing. */
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
                  'bill', (select jsonb_build_object('id', p.id, 'number', p.number, 'total', p.total, 'paid', p.paid_total,
                              'waiting', (select count(*) from pos_order_items i where i.order_id = p.id and i.status = 'sent'),
                              'preparing', (select count(*) from pos_order_items i where i.order_id = p.id and i.status = 'preparing'),
                              'ready_since', (select min(i.ready_at) from pos_order_items i where i.order_id = p.id and i.status = 'ready'),
                              'ready', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'qty', i.quantity, 'station', i.station) order by i.ready_at)
                                                   from pos_order_items i where i.order_id = p.id and i.status = 'ready'), '[]'))
                             from pos_orders p where p.table_id = t.id and p.status = 'open'))
                order by t.sort, t.name)
         from pos_tables t left join table_links l on l.table_id = t.id
        where t.outlet_id = o.id and t.active), '[]'))
      order by o.sort, o.name)
      from pos_outlets o where o.hotel_id = _hotel_id and o.active), '[]');
end $$;
grant execute on function public.table_qr_board(uuid) to authenticated;
