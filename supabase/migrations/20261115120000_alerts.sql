-- =====================================================================
-- HotelEasy: alerts & owner overview
--  * hotel_alerts(hotel): what needs attention right now, worked out live
--    from the data (no background jobs), each with who should see it and
--    which screen fixes it
--  * owner_overview(): every hotel the person owns or manages on one page:
--    occupancy, arrivals, revenue today and month to date against last
--    month, money collected, money owed, and alert counts
-- =====================================================================

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

-- Every hotel the person owns or manages (accountants too), side by side.
create or replace function public.owner_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _out jsonb := '[]'; _m record; _today date; _k jsonb; _mtd jsonb; _lm jsonb; _a jsonb; _first date; _lm_first date;
begin
  for _m in select m.hotel_id, m.role::text role, h.* from hotel_members m join hotels h on h.id = m.hotel_id
             where m.user_id = auth.uid() and m.role::text in ('owner', 'manager', 'accountant') order by h.name loop
    _today := (now() at time zone _m.timezone)::date;
    _first := date_trunc('month', _today)::date;
    _lm_first := (_first - interval '1 month')::date;
    _k := report_kpis(_m.hotel_id, _today, _today);
    _mtd := report_kpis(_m.hotel_id, _first, _today);
    _lm := report_kpis(_m.hotel_id, _lm_first, least(_lm_first + (_today - _first), _first - 1));
    _a := hotel_alerts(_m.hotel_id);
    _out := _out || jsonb_build_object(
      'hotel_id', _m.hotel_id, 'name', _m.name, 'city', _m.city, 'currency', _m.currency, 'role', _m.role, 'today', _today,
      'rooms', (select count(*) from rooms where hotel_id = _m.hotel_id),
      'in_house', (select count(*) from reservations where hotel_id = _m.hotel_id and status = 'checked_in'),
      'arrivals', (select count(*) from reservations where hotel_id = _m.hotel_id and status in ('confirmed', 'checked_in') and check_in = _today),
      'arrivals_left', (select count(*) from reservations where hotel_id = _m.hotel_id and status = 'confirmed' and check_in = _today),
      'departures', (select count(*) from reservations where hotel_id = _m.hotel_id and check_out = _today and status in ('checked_in', 'checked_out')),
      'out_of_service', (select count(*) from rooms where hotel_id = _m.hotel_id and status in ('maintenance', 'out_of_order')),
      'today', _k, 'mtd', _mtd, 'last_month', _lm,
      'debtors', (select coalesce(sum(b.balance), 0) from reservations r join reservation_balances b on b.reservation_id = r.id
                   where r.hotel_id = _m.hotel_id and r.status = 'checked_out' and b.balance > 0)
               + (select coalesce(sum(greatest(company_balance(c.id), 0)), 0) from companies c where c.hotel_id = _m.hotel_id),
      'bills_due', (select coalesce(sum(amount), 0) from expenses where hotel_id = _m.hotel_id and status = 'unpaid' and due_on <= _today + 7),
      'next_7_days', (select coalesce(jsonb_agg(jsonb_build_object('date', d::date,
                         'occupied', (select count(*) from reservations r where r.hotel_id = _m.hotel_id and r.status in ('confirmed', 'checked_in')
                                       and r.check_in <= d::date and r.check_out > d::date)) order by d), '[]'::jsonb)
                       from generate_series(_today, _today + 6, interval '1 day') d),
      'alerts', _a,
      'alerts_high', (select count(*) from jsonb_array_elements(_a) a where a->>'severity' = 'high'));
  end loop;
  return _out;
end $$;
grant execute on function public.owner_overview() to authenticated;
