-- =====================================================================
-- HotelEasy: night audit & day close
--  * checks before closing a day: arrivals still to come, guests who
--    should have left, open restaurant bills and cash shifts, room nights
--    missing from bills
--  * closing a day stores its figures (occupancy, revenue, money taken by
--    method, restaurant sales, arrivals/departures, guest and company
--    balances, cash counts) for the daily manager's report
--  * money records dated on a closed day are locked: voids are refused and
--    later rate changes don't rewrite closed nights; an owner or manager
--    can reopen the latest closed day with a reason
-- =====================================================================

create table public.business_days (
  hotel_id    uuid not null references public.hotels(id) on delete cascade,
  day         date not null,
  closed_at   timestamptz not null default now(),
  closed_by   uuid references auth.users(id) on delete set null default auth.uid(),
  summary     jsonb not null,
  notes       text check (notes is null or length(notes) <= 2000),
  primary key (hotel_id, day)
);
alter table public.business_days enable row level security;
revoke all on public.business_days from anon;
create policy bd_sel on public.business_days for select to authenticated
  using (public.has_hotel_role_any(hotel_id, array['owner','manager','front_desk','accountant']));
-- (written only by day_close / day_reopen)

create or replace function public.last_closed_day(_hotel_id uuid)
returns date language sql stable security definer set search_path = public as $$
  select max(day) from business_days where hotel_id = _hotel_id
$$;

-- ---------------------------------------------------------------------
-- Locks
-- ---------------------------------------------------------------------
create or replace function public.lock_folio_charges()
returns trigger language plpgsql security definer set search_path = public as $$
declare _closed date; _d date;
begin
  _closed := last_closed_day(old.hotel_id);
  if _closed is null then return new; end if;
  _d := coalesce(old.stay_date, (old.posted_at at time zone (select timezone from hotels where id = old.hotel_id))::date);
  if _d > _closed then return new; end if;
  if new.voided_at is not null and old.voided_at is null then
    raise exception 'DAY_CLOSED: % is closed by the night audit. Post a correction today instead, or ask a manager to reopen the day.', to_char(_d, 'Dy DD Mon');
  end if;
  if (new.unit_price, new.quantity, new.amount) is distinct from (old.unit_price, old.quantity, old.amount) then
    return old;   -- a closed night keeps the price it was audited at
  end if;
  return new;
end $$;
create trigger lock_folio_charges before update on public.folio_charges for each row execute function public.lock_folio_charges();

create or replace function public.lock_payments()
returns trigger language plpgsql security definer set search_path = public as $$
declare _closed date; _d date; _tz text;
begin
  _closed := last_closed_day(old.hotel_id);
  if _closed is null then return new; end if;
  select timezone into _tz from hotels where id = old.hotel_id;
  _d := (old.received_at at time zone _tz)::date;
  if _d <= _closed and new.voided_at is not null and old.voided_at is null then
    raise exception 'DAY_CLOSED: % is closed by the night audit. Record a refund today instead, or ask a manager to reopen the day.', to_char(_d, 'Dy DD Mon');
  end if;
  return new;
end $$;
create trigger lock_payments before update on public.payments for each row execute function public.lock_payments();
create trigger lock_pos_payments before update on public.pos_payments for each row execute function public.lock_payments();

create or replace function public.lock_pos_orders()
returns trigger language plpgsql security definer set search_path = public as $$
declare _closed date; _d date;
begin
  if old.status = 'open' or new.status = old.status then return new; end if;
  _closed := last_closed_day(old.hotel_id);
  if _closed is null or old.closed_at is null then return new; end if;
  _d := (old.closed_at at time zone (select timezone from hotels where id = old.hotel_id))::date;
  if _d <= _closed then
    raise exception 'DAY_CLOSED: bill #% was settled on %, which is closed by the night audit.', old.number, to_char(_d, 'Dy DD Mon');
  end if;
  return new;
end $$;
create trigger lock_pos_orders before update on public.pos_orders for each row execute function public.lock_pos_orders();

-- ---------------------------------------------------------------------
-- Checks before closing a day
-- ---------------------------------------------------------------------
create or replace function public.day_checks(_hotel_id uuid, _day date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _h hotels; _today date; _blocking jsonb := '[]'; _warn jsonb := '[]'; _list jsonb; _n int; _last date;
begin
  if not has_hotel_role_any(_hotel_id, array['owner','manager','front_desk','accountant']) then raise exception 'Hotel not found'; end if;
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
end $$;
grant execute on function public.day_checks(uuid, date) to authenticated;

-- The figures for one day.
create or replace function public.day_figures(_hotel_id uuid, _day date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _h hotels; _from timestamptz; _to timestamptz;
begin
  select * into _h from hotels where id = _hotel_id;
  _from := _day::timestamp at time zone _h.timezone;
  _to := (_day + 1)::timestamp at time zone _h.timezone;
  return jsonb_build_object(
    'day', _day, 'hotel', jsonb_build_object('name', _h.name, 'currency', _h.currency, 'city', _h.city),
    'kpis', report_kpis(_hotel_id, _day, _day),
    'mtd', report_kpis(_hotel_id, date_trunc('month', _day)::date, _day),
    'rooms', (select count(*) from rooms where hotel_id = _hotel_id),
    'out_of_service', (select count(*) from rooms where hotel_id = _hotel_id and status in ('maintenance', 'out_of_order')),
    'in_house', (select count(*) from reservations where hotel_id = _hotel_id and status in ('checked_in', 'checked_out') and check_in <= _day and check_out > _day),
    'guests', (select coalesce(sum(adults + children), 0) from reservations where hotel_id = _hotel_id and status in ('checked_in', 'checked_out') and check_in <= _day and check_out > _day),
    'arrivals', (select count(*) from reservations where hotel_id = _hotel_id and status in ('checked_in', 'checked_out') and check_in = _day),
    'departures', (select count(*) from reservations where hotel_id = _hotel_id and status = 'checked_out' and check_out = _day),
    'no_shows', (select count(*) from reservations where hotel_id = _hotel_id and status = 'no_show' and check_in = _day),
    'cancellations', (select count(*) from reservations where hotel_id = _hotel_id and status = 'cancelled' and cancelled_at >= _from and cancelled_at < _to),
    'new_bookings', (select count(*) from reservations where hotel_id = _hotel_id and created_at >= _from and created_at < _to),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('method', m, 'amount', amt) order by amt desc), '[]'::jsonb) from (
        select m, sum(a) amt from (
          select method::text m, amount a from payments where hotel_id = _hotel_id and voided_at is null and received_at >= _from and received_at < _to
          union all
          select method::text, amount from pos_payments where hotel_id = _hotel_id and voided_at is null and method <> 'room' and received_at >= _from and received_at < _to
          union all
          select coalesce(method::text, 'bank_transfer'), -amount from company_ledger where hotel_id = _hotel_id and voided_at is null and kind = 'payment' and entry_date = _day
        ) x group by m) y),
    'pos', (select coalesce(jsonb_agg(jsonb_build_object('outlet', o.name, 'bills', s.n, 'sales', s.t) order by o.name), '[]'::jsonb)
              from pos_outlets o join (select outlet_id, count(*) n, sum(total) t from pos_orders
                                         where hotel_id = _hotel_id and status = 'paid' and closed_at >= _from and closed_at < _to group by 1) s on s.outlet_id = o.id),
    'shifts', (select coalesce(jsonb_agg(jsonb_build_object('opened_at', opened_at, 'closed_at', closed_at, 'expected', expected_cash, 'counted', counted_cash, 'variance', variance,
                 'by', (select coalesce(raw_user_meta_data->>'full_name', email) from auth.users u where u.id = s.user_id))), '[]'::jsonb)
               from pos_shifts s where hotel_id = _hotel_id and closed_at >= _from and closed_at < _to),
    'guest_ledger', (select coalesce(sum(b.balance), 0) from reservations r join reservation_balances b on b.reservation_id = r.id where r.hotel_id = _hotel_id and r.status = 'checked_in'),
    'deposits', (select coalesce(-sum(b.balance), 0) from reservations r join reservation_balances b on b.reservation_id = r.id where r.hotel_id = _hotel_id and r.status = 'confirmed' and b.balance < 0),
    'guest_debts', (select coalesce(sum(b.balance), 0) from reservations r join reservation_balances b on b.reservation_id = r.id where r.hotel_id = _hotel_id and r.status = 'checked_out' and b.balance > 0),
    'city_ledger', (select coalesce(sum(amount), 0) from company_ledger where hotel_id = _hotel_id and voided_at is null and entry_date <= _day),
    'voids', (select count(*) from folio_charges where hotel_id = _hotel_id and voided_at >= _from and voided_at < _to)
             + (select count(*) from payments where hotel_id = _hotel_id and voided_at >= _from and voided_at < _to));
end $$;
revoke execute on function public.day_figures(uuid, date) from public, anon, authenticated;

-- A day's report: the stored one for closed days, live figures otherwise.
create or replace function public.day_report(_hotel_id uuid, _day date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _b business_days;
begin
  if not has_hotel_role_any(_hotel_id, array['owner','manager','front_desk','accountant']) then raise exception 'Hotel not found'; end if;
  select * into _b from business_days where hotel_id = _hotel_id and day = _day;
  if found then
    return _b.summary || jsonb_build_object('closed', true, 'closed_at', _b.closed_at, 'notes', _b.notes,
      'closed_by', (select coalesce(raw_user_meta_data->>'full_name', email) from auth.users where id = _b.closed_by));
  end if;
  return day_figures(_hotel_id, _day) || jsonb_build_object('closed', false);
end $$;
grant execute on function public.day_report(uuid, date) to authenticated;

create or replace function public.day_close(_hotel_id uuid, _day date, _notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _c jsonb; _r record;
begin
  if not has_hotel_role_any(_hotel_id, array['owner','manager','front_desk']) then raise exception 'Only owners, managers and front desk can close the day'; end if;
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
end $$;
grant execute on function public.day_close(uuid, date, text) to authenticated;

create or replace function public.day_reopen(_hotel_id uuid, _day date, _reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_hotel_role(_hotel_id, array['owner','manager']::hotel_role[]) then raise exception 'Only owners and managers can reopen a closed day'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Give a reason for reopening'; end if;
  if _day is distinct from last_closed_day(_hotel_id) then raise exception 'Only the latest closed day can be reopened'; end if;
  delete from business_days where hotel_id = _hotel_id and day = _day;
  perform log_activity(_hotel_id, 'audit', format('Night audit: %s reopened (%s)', to_char(_day, 'Dy DD Mon YYYY'), trim(_reason)), null);
end $$;
grant execute on function public.day_reopen(uuid, date, text) to authenticated;

create or replace function public.hotel_alerts(_hotel_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  _role text; _h hotels; _now timestamp; _today date; _hour int; _out jsonb := '[]'; _n int; _amt numeric; _cur text;
begin
  select role::text into _role from hotel_members where hotel_id = _hotel_id and user_id = auth.uid();
  if _role is null then raise exception 'Hotel not found'; end if;
  select * into _h from hotels where id = _hotel_id;
  _now := now() at time zone _h.timezone; _today := _now::date; _hour := extract(hour from _now)::int; _cur := _h.currency;

  -- helper: add an alert (only for the roles listed)
  -- severity: high (do it now), medium (today), low (when you can)

  -- Front office -------------------------------------------------------
  select count(*) into _n from reservations where hotel_id = _hotel_id and status = 'checked_in' and check_out < _today;
  if _n > 0 then _out := _out || jsonb_build_object('key', 'overstay', 'severity', 'high', 'count', _n, 'page', 'reservations',
       'title', format('%s guest%s past their check-out date', _n, case when _n = 1 then ' is' else 's are' end),
       'detail', 'Check them out or extend the stay so the room and bill are right.', 'roles', '{owner,manager,front_desk}'); end if;

  select count(*) into _n from reservations where hotel_id = _hotel_id and status = 'confirmed' and check_in < _today;
  if _n > 0 then _out := _out || jsonb_build_object('key', 'noshow', 'severity', 'medium', 'count', _n, 'page', 'reservations',
       'title', format('%s arrival%s from earlier days never checked in', _n, case when _n = 1 then '' else 's' end),
       'detail', 'Check them in, move the dates, or mark them as no-shows.', 'roles', '{owner,manager,front_desk}'); end if;

  select count(*) into _n from reservations where hotel_id = _hotel_id and status = 'confirmed' and check_in = _today and room_id is null;
  if _n > 0 then _out := _out || jsonb_build_object('key', 'unassigned', 'severity', case when _hour >= 11 then 'high' else 'medium' end, 'count', _n, 'page', 'reservations',
       'title', format('%s arrival%s today without a room', _n, case when _n = 1 then '' else 's' end),
       'detail', 'Assign rooms so housekeeping knows what to prepare.', 'roles', '{owner,manager,front_desk}'); end if;

  select count(*) into _n from reservations r join rooms rm on rm.id = r.room_id
   where r.hotel_id = _hotel_id and r.status = 'confirmed' and r.check_in = _today and rm.status in ('dirty', 'cleaning');
  if _n > 0 then _out := _out || jsonb_build_object('key', 'dirty_arrivals', 'severity', case when _hour >= 12 then 'high' else 'medium' end, 'count', _n, 'page', 'housekeeping',
       'title', format('%s room%s for today''s arrivals not clean yet', _n, case when _n = 1 then '' else 's' end),
       'detail', format('Check-in starts at %s.', to_char(_h.checkin_time, 'HH24:MI')), 'roles', '{owner,manager,front_desk,housekeeping}'); end if;

  select count(*) into _n from prechecks p join reservations r on r.id = p.reservation_id
   where p.hotel_id = _hotel_id and r.status = 'confirmed' and r.check_in <= _today + 1 and p.submitted_at is not null and p.reviewed_at is null;
  if _n > 0 then _out := _out || jsonb_build_object('key', 'precheck_review', 'severity', 'low', 'count', _n, 'page', 'online-checkin',
       'title', format('%s online check-in%s to review', _n, case when _n = 1 then '' else 's' end),
       'detail', 'Guests arriving today or tomorrow sent their details.', 'roles', '{owner,manager,front_desk}'); end if;

  select count(*) into _n from guest_requests where hotel_id = _hotel_id and status = 'new' and created_at < now() - interval '15 minutes'
     and (_role in ('owner', 'manager', 'front_desk') or department = _role);
  if _n > 0 then _out := _out || jsonb_build_object('key', 'requests_waiting', 'severity', 'high', 'count', _n, 'page', 'requests',
       'title', format('%s guest request%s waiting over 15 minutes', _n, case when _n = 1 then '' else 's' end),
       'detail', 'Tap "On it" so the guest knows someone is coming.', 'roles', '{owner,manager,front_desk,housekeeping,maintenance,restaurant}'); end if;

  if exists (select 1 from business_days where hotel_id = _hotel_id) and _hour >= 10
     and not exists (select 1 from business_days where hotel_id = _hotel_id and day >= _today - 1) then
    _out := _out || jsonb_build_object('key', 'day_not_closed', 'severity', 'medium', 'count', 1, 'page', 'audit',
       'title', format('Night audit for %s not done', to_char((select max(day) + 1 from business_days where hotel_id = _hotel_id), 'Dy DD Mon')),
       'detail', 'Close the day so the figures are final and locked.', 'roles', '{owner,manager,front_desk,accountant}');
  end if;

  -- Housekeeping & maintenance -----------------------------------------
  if _hour >= 14 then
    select count(*) into _n from rooms where hotel_id = _hotel_id and status = 'dirty';
    if _n > 0 then _out := _out || jsonb_build_object('key', 'dirty_late', 'severity', 'medium', 'count', _n, 'page', 'housekeeping',
         'title', format('%s room%s still dirty after 2 pm', _n, case when _n = 1 then '' else 's' end),
         'detail', 'Clean rooms can be sold to walk-ins tonight.', 'roles', '{owner,manager,housekeeping}'); end if;
  end if;

  select count(*) into _n from maintenance_tickets where hotel_id = _hotel_id and status in ('open', 'in_progress')
     and priority in ('urgent', 'high') and created_at < now() - interval '24 hours';
  if _n > 0 then _out := _out || jsonb_build_object('key', 'repairs_old', 'severity', 'medium', 'count', _n, 'page', 'maintenance',
       'title', format('%s urgent repair%s open more than a day', _n, case when _n = 1 then '' else 's' end),
       'detail', 'High-priority tickets waiting since yesterday or earlier.', 'roles', '{owner,manager,maintenance}'); end if;

  select count(*) into _n from rooms where hotel_id = _hotel_id and status in ('maintenance', 'out_of_order');
  if _n > 0 then _out := _out || jsonb_build_object('key', 'rooms_out', 'severity', 'low', 'count', _n, 'page', 'rooms',
       'title', format('%s room%s out of service', _n, case when _n = 1 then '' else 's' end),
       'detail', 'Rooms that can''t be sold until repaired.', 'roles', '{owner,manager,maintenance}'); end if;

  -- Restaurant ---------------------------------------------------------
  select count(*) into _n from pos_orders where hotel_id = _hotel_id and status = 'open' and opened_at < (_today::timestamp at time zone _h.timezone);
  if _n > 0 then _out := _out || jsonb_build_object('key', 'pos_old_bills', 'severity', 'medium', 'count', _n, 'page', 'pos',
       'title', format('%s restaurant bill%s left open from before today', _n, case when _n = 1 then '' else 's' end),
       'detail', 'Close, charge to a room or void them so sales are right.', 'roles', '{owner,manager,restaurant}'); end if;

  select count(*) into _n from pos_shifts where hotel_id = _hotel_id and closed_at is null and opened_at < now() - interval '16 hours';
  if _n > 0 then _out := _out || jsonb_build_object('key', 'pos_shift_open', 'severity', 'medium', 'count', _n, 'page', 'pos',
       'title', format('%s cash shift%s open over 16 hours', _n, case when _n = 1 then '' else 's' end),
       'detail', 'Count the cash and close the shift.', 'roles', '{owner,manager,restaurant}'); end if;

  -- Stock --------------------------------------------------------------
  select count(*) into _n from stock_items i
   where i.hotel_id = _hotel_id and i.active and i.reorder_level > 0
     and coalesce((select sum(qty) from stock_levels l where l.item_id = i.id), 0) < i.reorder_level;
  if _n > 0 then _out := _out || jsonb_build_object('key', 'low_stock', 'severity', 'low', 'count', _n, 'page', 'inventory',
       'title', format('%s stock item%s below reorder level', _n, case when _n = 1 then '' else 's' end),
       'detail', 'Time to order.', 'roles', '{owner,manager,storekeeper,restaurant}'); end if;

  -- Money --------------------------------------------------------------
  select count(*), coalesce(sum(b.balance), 0) into _n, _amt
    from reservations r join reservation_balances b on b.reservation_id = r.id
   where r.hotel_id = _hotel_id and r.status = 'checked_out' and b.balance > 0.009;
  if _n > 0 then _out := _out || jsonb_build_object('key', 'guest_debts', 'severity', 'medium', 'count', _n, 'page', 'billing',
       'title', format('%s %s owed by %s guest%s who left', _cur, to_char(_amt, 'FM999,999,990'), _n, case when _n = 1 then '' else 's' end),
       'detail', 'Collect it or move it to a company account.', 'roles', '{owner,manager,accountant,front_desk}'); end if;

  select count(*) into _n from companies c where c.hotel_id = _hotel_id and c.active and c.credit_limit is not null and company_balance(c.id) > c.credit_limit;
  if _n > 0 then _out := _out || jsonb_build_object('key', 'company_limit', 'severity', 'medium', 'count', _n, 'page', 'companies',
       'title', format('%s compan%s over the credit limit', _n, case when _n = 1 then 'y' else 'ies' end),
       'detail', 'Ask for payment before taking more bookings on account.', 'roles', '{owner,manager,accountant,front_desk}'); end if;

  select count(*), coalesce(sum((company_ageing_one(c.id, _today)->>'d60')::numeric + (company_ageing_one(c.id, _today)->>'d90')::numeric
                               + (company_ageing_one(c.id, _today)->>'d90p')::numeric), 0) into _n, _amt
    from companies c where c.hotel_id = _hotel_id
     and (company_ageing_one(c.id, _today)->>'d60')::numeric + (company_ageing_one(c.id, _today)->>'d90')::numeric + (company_ageing_one(c.id, _today)->>'d90p')::numeric > 0;
  if _n > 0 then _out := _out || jsonb_build_object('key', 'company_late', 'severity', 'medium', 'count', _n, 'page', 'companies',
       'title', format('%s %s from companies over 30 days late', _cur, to_char(_amt, 'FM999,999,990')),
       'detail', format('%s compan%s; send statements and follow up.', _n, case when _n = 1 then 'y' else 'ies' end), 'roles', '{owner,manager,accountant}'); end if;

  select count(*), coalesce(sum(amount), 0) into _n, _amt from expenses where hotel_id = _hotel_id and status = 'unpaid' and due_on < _today;
  if _n > 0 then _out := _out || jsonb_build_object('key', 'bills_overdue', 'severity', 'high', 'count', _n, 'page', 'finance',
       'title', format('%s bill%s overdue (%s %s)', _n, case when _n = 1 then '' else 's' end, _cur, to_char(_amt, 'FM999,999,990')),
       'detail', 'Including KRA, NSSF and SHIF payments: late payment brings penalties.', 'roles', '{owner,manager,accountant}'); end if;

  select count(*), coalesce(sum(amount), 0) into _n, _amt from expenses where hotel_id = _hotel_id and status = 'unpaid' and due_on between _today and _today + 3;
  if _n > 0 then _out := _out || jsonb_build_object('key', 'bills_due', 'severity', 'low', 'count', _n, 'page', 'finance',
       'title', format('%s bill%s due in the next 3 days (%s %s)', _n, case when _n = 1 then '' else 's' end, _cur, to_char(_amt, 'FM999,999,990')),
       'detail', 'Plan the payments.', 'roles', '{owner,manager,accountant}'); end if;

  -- People -------------------------------------------------------------
  if extract(day from _today) >= 5 and not exists (
       select 1 from payroll_runs where hotel_id = _hotel_id and month = date_trunc('month', _today - interval '1 month')::date and status = 'paid')
     and exists (select 1 from staff_pay sp join staff s on s.id = sp.staff_id where s.hotel_id = _hotel_id and s.active) then
    _out := _out || jsonb_build_object('key', 'payroll', 'severity', case when extract(day from _today) >= 9 then 'high' else 'medium' end, 'count', 1, 'page', 'staff',
       'title', format('%s payroll not paid yet', to_char(_today - interval '1 month', 'FMMonth')),
       'detail', 'PAYE, NSSF, SHIF and housing levy are due by the 9th.', 'roles', '{owner,manager,accountant}');
  end if;

  select count(*) into _n from leave_requests where hotel_id = _hotel_id and status = 'requested';
  if _n > 0 then _out := _out || jsonb_build_object('key', 'leave', 'severity', 'low', 'count', _n, 'page', 'staff',
       'title', format('%s leave request%s to answer', _n, case when _n = 1 then '' else 's' end),
       'detail', 'Staff are waiting to hear back.', 'roles', '{owner,manager}'); end if;

  -- Emails -------------------------------------------------------------
  select count(*) into _n from email_outbox where hotel_id = _hotel_id and status = 'failed' and created_at > now() - interval '7 days';
  if _n > 0 then _out := _out || jsonb_build_object('key', 'emails_failed', 'severity', 'low', 'count', _n, 'page', 'online',
       'title', format('%s guest email%s failed this week', _n, case when _n = 1 then '' else 's' end),
       'detail', 'Open the email log to see why and try again.', 'roles', '{owner,manager,front_desk}'); end if;

  return (select coalesce(jsonb_agg(a - 'roles' order by case a->>'severity' when 'high' then 0 when 'medium' then 1 else 2 end, a->>'title'), '[]'::jsonb)
            from jsonb_array_elements(_out) a where _role = any (string_to_array(btrim(a->>'roles', '{}'), ',')));
end $$;
grant execute on function public.hotel_alerts(uuid) to authenticated;
