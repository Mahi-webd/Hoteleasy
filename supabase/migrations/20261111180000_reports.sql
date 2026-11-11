-- =====================================================================
-- HotelEasy – Reports (management, revenue, tax, payments, bookings)
--
-- One read-only function, report_period(hotel, from, to), returns
-- everything the Reports screen shows as JSON. Owners, managers and
-- accountants only.
--
-- Counting rules (shown on the screen too):
--   * Room revenue counts on the night stayed (folio stay_date).
--   * Other guest-bill charges count on the day they were posted.
--   * POS bills count on the day they were paid (or charged to a room).
--     Their room-charge lines on guest bills are skipped, so nothing is
--     counted twice.
--   * Voided lines and voided payments are left out.
--   * A room is "sold" for a night when the stay is checked in or
--     checked out and covers that night.
--   * Revenue figures are net (before VAT and levy) unless marked gross.
--   * The period stops at today (hotel time); the dashboard forecasts.
-- =====================================================================

create or replace function public.hotel_today(_hotel_id uuid)
returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select timezone from hotels where id = _hotel_id), 'Africa/Nairobi'))::date;
$$;

-- Every revenue line in a period, from guest bills and POS bills.
create or replace function public.report_lines(_hotel_id uuid, _from date, _to date)
returns table (d date, grp text, dept text, outlet text, net numeric, vat numeric, levy numeric, gross numeric,
               reservation_id uuid)
language sql stable security definer set search_path = public as $$
  with h as (select coalesce(timezone, 'Africa/Nairobi') tz from hotels where id = _hotel_id)
  -- Guest bills (not POS room charges)
  select case when c.kind = 'room' then c.stay_date else (c.posted_at at time zone h.tz)::date end,
         case when c.kind = 'room' then 'rooms'
              when c.kind in ('food', 'drinks', 'minibar') then 'fnb'
              else 'other' end,
         c.kind::text, null::text,
         c.net_amount, c.vat_amount, c.levy_amount, c.amount, c.reservation_id
    from folio_charges c, h
   where c.hotel_id = _hotel_id and c.voided_at is null and c.pos_order_id is null
     and case when c.kind = 'room' then c.stay_date else (c.posted_at at time zone h.tz)::date end
         between _from and _to
  union all
  -- POS items on paid bills
  select (o.closed_at at time zone h.tz)::date, 'fnb', i.charge_kind::text, ou.name,
         i.net, i.vat, i.levy, i.net + i.vat + i.levy, o.reservation_id
    from pos_orders o join pos_order_items i on i.order_id = o.id
    join pos_outlets ou on ou.id = o.outlet_id, h
   where o.hotel_id = _hotel_id and o.status = 'paid' and i.status <> 'void' and not i.comped
     and (o.closed_at at time zone h.tz)::date between _from and _to
  union all
  -- POS service charge (VAT on it, no levy)
  select (o.closed_at at time zone h.tz)::date, 'fnb', 'service_charge', ou.name,
         o.service_charge,
         o.vat_amount - coalesce((select sum(vat) from pos_order_items x where x.order_id = o.id), 0),
         0,
         o.service_charge + o.vat_amount - coalesce((select sum(vat) from pos_order_items x where x.order_id = o.id), 0),
         o.reservation_id
    from pos_orders o join pos_outlets ou on ou.id = o.outlet_id, h
   where o.hotel_id = _hotel_id and o.status = 'paid' and o.service_charge <> 0
     and (o.closed_at at time zone h.tz)::date between _from and _to;
$$;

-- Rooms sold per night.
create or replace function public.report_nights(_hotel_id uuid, _from date, _to date)
returns table (d date, reservation_id uuid)
language sql stable security definer set search_path = public as $$
  select g::date, r.id
    from reservations r,
         generate_series(greatest(r.check_in, _from), least(r.check_out - 1, _to), interval '1 day') g
   where r.hotel_id = _hotel_id and r.status in ('checked_in', 'checked_out')
     and r.check_in <= _to and r.check_out > _from;
$$;

create or replace function public.report_kpis(_hotel_id uuid, _from date, _to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  _rooms int; _days int; _sold int;
  _room numeric; _fnb numeric; _other numeric; _vat numeric; _levy numeric; _gross numeric;
  _collected numeric;
begin
  select count(*) into _rooms from rooms where hotel_id = _hotel_id;
  _days := _to - _from + 1;
  select count(*) into _sold from report_nights(_hotel_id, _from, _to);
  select coalesce(sum(net) filter (where grp = 'rooms'), 0), coalesce(sum(net) filter (where grp = 'fnb'), 0),
         coalesce(sum(net) filter (where grp = 'other'), 0),
         coalesce(sum(vat), 0), coalesce(sum(levy), 0), coalesce(sum(gross), 0)
    into _room, _fnb, _other, _vat, _levy, _gross
    from report_lines(_hotel_id, _from, _to);
  select coalesce((select sum(p.amount) from payments p, hotels h
                    where h.id = _hotel_id and p.hotel_id = _hotel_id and p.voided_at is null
                      and (p.received_at at time zone h.timezone)::date between _from and _to), 0)
       + coalesce((select sum(p.amount) from pos_payments p, hotels h
                    where h.id = _hotel_id and p.hotel_id = _hotel_id and p.voided_at is null and p.method <> 'room'
                      and (p.received_at at time zone h.timezone)::date between _from and _to), 0)
    into _collected;
  return jsonb_build_object(
    'from', _from, 'to', _to, 'days', _days, 'rooms', _rooms,
    'room_nights_available', _rooms * _days,
    'room_nights_sold', _sold,
    'occupancy', case when _rooms * _days > 0 then round(_sold::numeric / (_rooms * _days), 4) else 0 end,
    'room_revenue', _room,
    'adr', case when _sold > 0 then round(_room / _sold, 2) else 0 end,
    'revpar', case when _rooms * _days > 0 then round(_room / (_rooms * _days), 2) else 0 end,
    'fnb_revenue', _fnb,
    'other_revenue', _other,
    'total_revenue', _room + _fnb + _other,
    'trevpar', case when _rooms * _days > 0 then round((_room + _fnb + _other) / (_rooms * _days), 2) else 0 end,
    'vat', _vat, 'levy', _levy, 'gross', _gross,
    'collected', _collected);
end $$;

create or replace function public.report_period(_hotel_id uuid, _from date, _to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  _today date;
  _len int;
  _tz text;
  _out jsonb;
begin
  if not has_hotel_role_any(_hotel_id, array['owner', 'manager', 'accountant']) then
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
end $$;

-- =====================================================================
-- Tax rounding: when prices include tax and the hotel charges no levy,
-- the leftover cent now goes to VAT, so reports never show -0.01 levy.
-- =====================================================================
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
    -- VAT is exact; the rounding cent goes to the levy, or to VAT when there is no levy
    if new.levy_rate = 0 then
      new.levy_amount := round(new.net_amount * new.levy_rate, 2);
      new.vat_amount := new.amount - new.net_amount - new.levy_amount;
    else
      new.vat_amount := round(new.net_amount * new.vat_rate, 2);
      new.levy_amount := new.amount - new.net_amount - new.vat_amount;
    end if;
  else
    new.net_amount := _line;
    new.vat_amount := round(_line * new.vat_rate, 2);
    new.levy_amount := round(_line * new.levy_rate, 2);
    new.amount := new.net_amount + new.vat_amount + new.levy_amount;
  end if;
  return new;
end $$;

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
    vat = case when not _h.prices_include_vat
                 then round(i.net * case when i.tax_category = 'standard' then _h.vat_rate else 0 end, 2)
               when _h.tourism_levy_rate = 0
                 then i.gross - i.net - round(i.net * _h.tourism_levy_rate, 2)
               else round(i.net * case when i.tax_category = 'standard' then _h.vat_rate else 0 end, 2) end,
    levy = case when not _h.prices_include_vat
                  then round(i.net * _h.tourism_levy_rate, 2)
                when _h.tourism_levy_rate = 0
                  then round(i.net * _h.tourism_levy_rate, 2)
                else i.gross - i.net - round(i.net * case when i.tax_category = 'standard' then _h.vat_rate else 0 end, 2) end
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

-- Repair earlier lines for hotels without a levy (totals don't change).
select set_config('hotel_easy.rpc', 'on', false);
update public.folio_charges set vat_amount = vat_amount + levy_amount, levy_amount = 0
 where levy_rate = 0 and levy_amount <> 0;
update public.pos_order_items i set vat = i.vat + i.levy, levy = 0
  from public.hotels h where h.id = i.hotel_id and h.tourism_levy_rate = 0 and i.levy <> 0;
update public.pos_orders o set vat_amount = o.vat_amount + o.levy_amount, levy_amount = 0
  from public.hotels h where h.id = o.hotel_id and h.tourism_levy_rate = 0 and o.levy_amount <> 0;
select set_config('hotel_easy.rpc', '', false);

-- Helpers are internal; only report_period is callable from the app.
revoke all on function public.report_lines(uuid, date, date) from public, anon, authenticated;
revoke all on function public.report_nights(uuid, date, date) from public, anon, authenticated;
revoke all on function public.report_kpis(uuid, date, date) from public, anon, authenticated;
revoke all on function public.report_period(uuid, date, date) from public, anon;
grant execute on function public.report_period(uuid, date, date) to authenticated;
grant execute on function public.hotel_today(uuid) to authenticated;
