-- =====================================================================
-- Table QR: show staff WHO is on the way ("Ravi on the way"), so two waiters don't both go and the
-- manager sees who took each table. Names are only given to staff of the same hotel (the board checks
-- tableqr.view); the diner's page never shows staff names.
-- Run AFTER 20261119120000_table_orders.sql.
-- =====================================================================

/** A staff member's short display name: their name, else the part of their email before the @. */
create or replace function public.staff_short_name(_user_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(p.full_name), ''), nullif(split_part(u.email::text, '@', 1), ''), 'Staff')
    from auth.users u left join profiles p on p.id = u.id where u.id = _user_id
$$;
revoke execute on function public.staff_short_name(uuid) from public, anon, authenticated;

/** Live table map (replaces step 2's): the open call now says who is on the way. */
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
                  'bill', (select jsonb_build_object('number', p.number, 'total', p.total, 'paid', p.paid_total)
                             from pos_orders p where p.table_id = t.id and p.status = 'open'))
                order by t.sort, t.name)
         from pos_tables t left join table_links l on l.table_id = t.id
        where t.outlet_id = o.id and t.active), '[]'))
      order by o.sort, o.name)
      from pos_outlets o where o.hotel_id = _hotel_id and o.active), '[]');
end $$;
grant execute on function public.table_qr_board(uuid) to authenticated;

/** Response times (replaces step 1's): staff shown by the same short name as on the board. */
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
      'by_staff', coalesce((select jsonb_agg(jsonb_build_object('name', staff_short_name(x.acknowledged_by), 'calls', n, 'avg_response_s', a) order by n desc)
                   from (select acknowledged_by, count(*) n, round(avg(ack_s)) a from c where acknowledged_by is not null group by acknowledged_by) x), '[]')));
end $$;
grant execute on function public.table_qr_report(uuid, date, date) to authenticated;
