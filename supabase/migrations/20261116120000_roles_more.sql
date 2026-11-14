-- Roles, part 2: finer rights for risky buttons, "who can do this", and a "new permissions" marker.
-- New permissions: reservations.checkin / checkout / rate, billing.refund, pos.discount, reports.export.
-- Built-in roles keep exactly what they could do before. Existing custom roles get the new rights they already had
-- through the broader permission (so nothing changes for them until the owner unticks).

alter table public.permission_catalog add column if not exists added_at timestamptz not null default '2026-11-01 00:00+03';
alter table public.permission_catalog alter column added_at set default now();
alter table public.hotels add column if not exists roles_reviewed_at timestamptz;

insert into public.permission_catalog (key, module, module_label, action, label, sort, default_roles, added_at) values
  ('dashboard.view','dashboard','Dashboard','view','See the dashboard',1,array['owner','manager','front_desk','housekeeping','restaurant','accountant','maintenance','storekeeper'],'2026-11-01 00:00+03'),
  ('reservations.view','reservations','Reservations','view','See bookings and the calendar',2,array['owner','manager','front_desk','housekeeping','restaurant','accountant','maintenance','storekeeper'],'2026-11-01 00:00+03'),
  ('reservations.create','reservations','Reservations','create','Make bookings',3,array['owner','manager','front_desk'],'2026-11-01 00:00+03'),
  ('reservations.edit','reservations','Reservations','edit','Change bookings (dates, room, guest details)',4,array['owner','manager','front_desk'],'2026-11-01 00:00+03'),
  ('reservations.checkin','reservations','Reservations','checkin','Check guests in',5,array['owner','manager','front_desk'],now()),
  ('reservations.checkout','reservations','Reservations','checkout','Check guests out',6,array['owner','manager','front_desk'],now()),
  ('reservations.rate','reservations','Reservations','rate','Change the room rate by hand instead of season prices',7,array['owner','manager','front_desk'],now()),
  ('reservations.delete','reservations','Reservations','delete','Cancel bookings and mark no-shows',8,array['owner','manager','front_desk'],'2026-11-01 00:00+03'),
  ('precheck.view','precheck','Online check-in','view','See online check-in forms',9,array['owner','manager','front_desk'],'2026-11-01 00:00+03'),
  ('precheck.edit','precheck','Online check-in','edit','Send links and accept forms',10,array['owner','manager','front_desk'],'2026-11-01 00:00+03'),
  ('requests.view','requests','Guest requests','view','See guest requests',11,array['owner','manager','front_desk','housekeeping','maintenance','restaurant'],'2026-11-01 00:00+03'),
  ('requests.edit','requests','Guest requests','edit','Answer and log requests',12,array['owner','manager','front_desk','housekeeping','maintenance','restaurant'],'2026-11-01 00:00+03'),
  ('requests.settings','requests','Guest requests','settings','Request types and room QR codes',13,array['owner','manager'],'2026-11-01 00:00+03'),
  ('audit.view','audit','Night audit','view','See day checks and manager''s reports',14,array['owner','manager','front_desk','accountant'],'2026-11-01 00:00+03'),
  ('audit.create','audit','Night audit','create','Close the day',15,array['owner','manager','front_desk'],'2026-11-01 00:00+03'),
  ('audit.delete','audit','Night audit','delete','Reopen a closed day',16,array['owner','manager'],'2026-11-01 00:00+03'),
  ('rates.view','rates','Rates & seasons','view','See prices, seasons and meal plans',17,array['owner','manager','front_desk','accountant'],'2026-11-01 00:00+03'),
  ('rates.edit','rates','Rates & seasons','edit','Change prices, seasons and meal plans',18,array['owner','manager'],'2026-11-01 00:00+03'),
  ('rooms.view','rooms','Rooms','view','See rooms',19,array['owner','manager','front_desk','housekeeping','restaurant','accountant','maintenance','storekeeper'],'2026-11-01 00:00+03'),
  ('rooms.status','rooms','Rooms','status','Change room status (clean, dirty, out of order)',20,array['owner','manager','front_desk','housekeeping'],'2026-11-01 00:00+03'),
  ('rooms.create','rooms','Rooms','create','Add rooms and room types',21,array['owner','manager'],'2026-11-01 00:00+03'),
  ('rooms.edit','rooms','Rooms','edit','Edit rooms and room types',22,array['owner','manager'],'2026-11-01 00:00+03'),
  ('rooms.delete','rooms','Rooms','delete','Delete rooms',23,array['owner','manager'],'2026-11-01 00:00+03'),
  ('guests.view','guests','Guests','view','See guest profiles',24,array['owner','manager','front_desk','accountant','restaurant'],'2026-11-01 00:00+03'),
  ('guests.create','guests','Guests','create','Add guests',25,array['owner','manager','front_desk'],'2026-11-01 00:00+03'),
  ('guests.edit','guests','Guests','edit','Edit guest profiles',26,array['owner','manager','front_desk'],'2026-11-01 00:00+03'),
  ('guests.delete','guests','Guests','delete','Delete guests',27,array['owner','manager'],'2026-11-01 00:00+03'),
  ('billing.view','billing','Billing & payments','view','See bills, payments and invoices',28,array['owner','manager','front_desk','accountant'],'2026-11-01 00:00+03'),
  ('billing.create','billing','Billing & payments','create','Add charges, take payments, issue invoices',29,array['owner','manager','front_desk','accountant'],'2026-11-01 00:00+03'),
  ('billing.refund','billing','Billing & payments','refund','Give refunds',30,array['owner','manager','accountant'],now()),
  ('billing.void','billing','Billing & payments','void','Void any charge or payment',31,array['owner','manager','accountant'],'2026-11-01 00:00+03'),
  ('companies.view','companies','Company accounts','view','See companies and their rates',32,array['owner','manager','front_desk','accountant'],'2026-11-01 00:00+03'),
  ('companies.ledger','companies','Company accounts','ledger','See company balances and statements',33,array['owner','manager','accountant'],'2026-11-01 00:00+03'),
  ('companies.edit','companies','Company accounts','edit','Add companies and rates, ledger entries, go over credit limits',34,array['owner','manager','accountant'],'2026-11-01 00:00+03'),
  ('online.view','online','Online booking & reviews','view','See online bookings, reviews and sent emails',35,array['owner','manager','front_desk','accountant'],'2026-11-01 00:00+03'),
  ('online.reply','online','Online booking & reviews','reply','Reply to reviews, send feedback links, resend emails',36,array['owner','manager','front_desk'],'2026-11-01 00:00+03'),
  ('online.edit','online','Online booking & reviews','edit','Booking page and email settings',37,array['owner','manager'],'2026-11-01 00:00+03'),
  ('pos.view','pos','Restaurant & bar POS','view','See orders and bills',38,array['owner','manager','front_desk','restaurant','accountant'],'2026-11-01 00:00+03'),
  ('pos.create','pos','Restaurant & bar POS','create','Take orders and payments, run own cash shift',39,array['owner','manager','front_desk','restaurant'],'2026-11-01 00:00+03'),
  ('pos.discount','pos','Restaurant & bar POS','discount','Discounts and service charge on bills',40,array['owner','manager'],now()),
  ('pos.admin','pos','Restaurant & bar POS','admin','Menu and tables, voids and comps, approve with PIN',41,array['owner','manager'],'2026-11-01 00:00+03'),
  ('pos.shifts','pos','Restaurant & bar POS','shifts','See everyone''s cash shifts',42,array['owner','manager','accountant'],'2026-11-01 00:00+03'),
  ('kds.view','kds','Kitchen & bar screen','view','Use the kitchen and bar screen',43,array['owner','manager','front_desk','restaurant'],'2026-11-01 00:00+03'),
  ('owner.view','owner','Owner overview','view','See the owner overview',44,array['owner','manager','accountant'],'2026-11-01 00:00+03'),
  ('reports.view','reports','Reports','view','See reports',45,array['owner','manager','accountant'],'2026-11-01 00:00+03'),
  ('reports.export','reports','Reports','export','Download reports and lists as spreadsheets (CSV)',46,array['owner','manager','accountant','storekeeper'],now()),
  ('finance.view','finance','Expenses & profit','view','See expenses and profit',47,array['owner','manager','accountant'],'2026-11-01 00:00+03'),
  ('finance.edit','finance','Expenses & profit','edit','Add and edit expenses',48,array['owner','manager','accountant'],'2026-11-01 00:00+03'),
  ('finance.admin','finance','Expenses & profit','admin','Approve expenses, categories and budget',49,array['owner','manager'],'2026-11-01 00:00+03'),
  ('housekeeping.view','housekeeping','Housekeeping','view','See cleaning tasks',50,array['owner','manager','front_desk','housekeeping'],'2026-11-01 00:00+03'),
  ('housekeeping.edit','housekeeping','Housekeeping','edit','Create, assign and complete tasks',51,array['owner','manager','front_desk','housekeeping'],'2026-11-01 00:00+03'),
  ('maintenance.view','maintenance','Maintenance','view','See and report problems',52,array['owner','manager','front_desk','housekeeping','restaurant','accountant','maintenance','storekeeper'],'2026-11-01 00:00+03'),
  ('maintenance.edit','maintenance','Maintenance','edit','Assign and update tickets',53,array['owner','manager','maintenance','front_desk'],'2026-11-01 00:00+03'),
  ('inventory.view','inventory','Inventory','view','See stock',54,array['owner','manager','accountant','storekeeper','restaurant'],'2026-11-01 00:00+03'),
  ('inventory.waste','inventory','Inventory','waste','Record waste',55,array['owner','manager','storekeeper','restaurant'],'2026-11-01 00:00+03'),
  ('inventory.edit','inventory','Inventory','edit','Stock moves, receiving, counts, suppliers and orders',56,array['owner','manager','storekeeper'],'2026-11-01 00:00+03'),
  ('inventory.admin','inventory','Inventory','admin','Approve orders, recipes and store locations',57,array['owner','manager'],'2026-11-01 00:00+03'),
  ('staff.view','staff','Staff & rota','view','See staff and the rota',58,array['owner','manager','front_desk','accountant'],'2026-11-01 00:00+03'),
  ('staff.clock','staff','Staff & rota','clock','Clock staff in and out',59,array['owner','manager','front_desk'],'2026-11-01 00:00+03'),
  ('staff.edit','staff','Staff & rota','edit','Staff list, rota and leave',60,array['owner','manager'],'2026-11-01 00:00+03'),
  ('payroll.view','payroll','Payroll','view','See pay rates, payroll and payslips',61,array['owner','manager','accountant'],'2026-11-01 00:00+03'),
  ('payroll.edit','payroll','Payroll','edit','Run and approve payroll',62,array['owner','manager','accountant'],'2026-11-01 00:00+03'),
  ('payroll.rates','payroll','Payroll','rates','Statutory rates (PAYE, NSSF, SHIF)',63,array['owner'],'2026-11-01 00:00+03'),
  ('settings.view','settings','Settings','view','See hotel settings',64,array['owner','manager','front_desk','housekeeping','restaurant','accountant','maintenance','storekeeper'],'2026-11-01 00:00+03'),
  ('settings.edit','settings','Settings','edit','Hotel details, tax and bill settings',65,array['owner','manager'],'2026-11-01 00:00+03'),
  ('team.invite','team','Team','invite','Invite people and cancel invitations',66,array['owner','manager'],'2026-11-01 00:00+03')
on conflict (key) do update set module = excluded.module, module_label = excluded.module_label, action = excluded.action,
  label = excluded.label, sort = excluded.sort, default_roles = excluded.default_roles;

-- existing custom roles keep what they could already do
update public.hotel_roles r set permissions = (select array_agg(distinct p order by p) from unnest(r.permissions
  || case when 'reservations.edit' = any(r.permissions) then array['reservations.checkin','reservations.checkout','reservations.rate'] else '{}' end
  || case when 'reservations.create' = any(r.permissions) then array['reservations.rate'] else '{}' end
  || case when 'billing.create' = any(r.permissions) then array['billing.refund'] else '{}' end
  || case when 'pos.admin' = any(r.permissions) then array['pos.discount'] else '{}' end
  || case when r.permissions && array['reports.view','finance.view','inventory.edit','companies.ledger','staff.view'] then array['reports.export'] else '{}' end) p);

-- check-in and check-out are now separate rights

CREATE OR REPLACE FUNCTION public.check_in_reservation(_reservation_id uuid, _room_id uuid DEFAULT NULL::uuid)
 RETURNS reservations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _r reservations;
  _room rooms;
  _g text;
begin
  select * into _r from reservations where id = _reservation_id for update;
  if not found then raise exception 'Reservation not found'; end if;
  if not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[], 'reservations.checkin') then
    raise exception 'You do not have permission to check guests in';
  end if;
  if _r.status <> 'confirmed' then
    raise exception 'Only confirmed reservations can be checked in (this one is %)', replace(_r.status::text, '_', ' ');
  end if;
  if _r.check_in > (now() at time zone (select timezone from hotels where id = _r.hotel_id))::date then
    raise exception 'This reservation starts on %; it cannot be checked in early. Change the dates first.', to_char(_r.check_in, 'DD Mon YYYY');
  end if;

  perform set_config('hotel_easy.rpc', 'on', true);

  if _room_id is not null and _room_id is distinct from _r.room_id then
    update reservations set room_id = _room_id where id = _r.id;  -- exclusion constraint guards overlaps
  end if;
  select * into _r from reservations where id = _reservation_id;
  if _r.room_id is null then raise exception 'Assign a room before checking in'; end if;

  select * into _room from rooms where id = _r.room_id for update;
  if _room.status = 'occupied' then
    raise exception 'Room % is still occupied', _room.room_number;
  end if;
  if _room.status in ('maintenance', 'out_of_order') then
    raise exception 'Room % is not usable (%)', _room.room_number, replace(_room.status::text, '_', ' ');
  end if;

  update reservations set status = 'checked_in', checked_in_at = now() where id = _r.id returning * into _r;
  update rooms set status = 'occupied' where id = _room.id;

  select trim(first_name || ' ' || last_name) into _g from guests where id = _r.guest_id;
  perform log_activity(_r.hotel_id, 'checkin', format('%s checked in to room %s', _g, _room.room_number), _r.id);
  perform set_config('hotel_easy.rpc', 'off', true);
  return _r;
end $function$;
CREATE OR REPLACE FUNCTION public.check_out_reservation(_reservation_id uuid, _allow_balance boolean DEFAULT false)
 RETURNS reservations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _r reservations;
  _num text;
  _g text;
  _today date;
  _bal numeric;
  _cur text;
  _share numeric;
  _co text;
begin
  select * into _r from reservations where id = _reservation_id for update;
  if not found then raise exception 'Reservation not found'; end if;
  if not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[], 'reservations.checkout') then
    raise exception 'You do not have permission to check guests out';
  end if;
  if _r.status <> 'checked_in' then
    raise exception 'Only checked-in guests can be checked out';
  end if;

  select (now() at time zone timezone)::date, currency into _today, _cur from hotels where id = _r.hotel_id;
  perform set_config('hotel_easy.rpc', 'on', true);

  if _r.check_out > greatest(_today, _r.check_in + 1) then
    update reservations set check_out = greatest(_today, _r.check_in + 1) where id = _r.id;
    select * into _r from reservations where id = _r.id;
  end if;

  -- Company-billed stays: the company's share goes to its account.
  _share := company_share(_r.id);
  if _share > 0.009 then
    perform company_transfer_internal(_r.id, _r.company_id, _share, has_hotel_role(_r.hotel_id, array['owner','manager']::hotel_role[], 'companies.edit'));
    select name into _co from companies where id = _r.company_id;
  end if;

  _bal := reservation_balance(_r.id);
  if _bal > 0.009 and not _allow_balance then
    perform set_config('hotel_easy.rpc', 'off', true);
    raise exception 'BALANCE_DUE: % % is still unpaid', _cur, to_char(_bal, 'FM999,999,990.00');
  end if;

  update reservations set status = 'checked_out', checked_out_at = now() where id = _r.id returning * into _r;
  update rooms set status = 'dirty' where id = _r.room_id returning room_number into _num;

  select trim(first_name || ' ' || last_name) into _g from guests where id = _r.guest_id;
  perform log_activity(_r.hotel_id, 'checkout',
    format('%s checked out of room %s%s%s', _g, _num,
           case when _co is not null then format(' (%s %s billed to %s)', _cur, to_char(_share, 'FM999,999,990'), _co) else '' end,
           case when _bal > 0.009 then format(' with %s %s owing', _cur, to_char(_bal, 'FM999,999,990')) else '' end), _r.id);
  perform set_config('hotel_easy.rpc', 'off', true);

  if exists (select 1 from folio_charges where reservation_id = _r.id and voided_at is null) then
    perform issue_invoice(_r.id);
  end if;
  return _r;
end $function$;

-- refunds (negative payments) need billing.refund
alter policy payments_insert on public.payments with check (
  has_hotel_role(hotel_id, array['owner','manager','front_desk','accountant']::hotel_role[], 'billing.create')
  and voided_at is null and received_by = auth.uid()
  and (amount > 0 or has_hotel_role(hotel_id, array['owner','manager','accountant']::hotel_role[], 'billing.refund')));

-- discounts and service charge: pos.discount (or a PIN from someone who has it)
create or replace function public.approve_with_pin(_hotel_id uuid, _pin text, _perm text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare _mgr uuid;
begin
  if (select count(*) from pin_attempts where user_id = auth.uid() and not ok and at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many wrong PINs. Try again in 10 minutes.';
  end if;
  select p.user_id into _mgr
    from staff_pins p join hotel_members m on m.hotel_id = p.hotel_id and m.user_id = p.user_id
    left join hotel_roles r on r.id = m.custom_role_id
   where p.hotel_id = _hotel_id
     and ((m.custom_role_id is null and m.role::text in ('owner', 'manager')) or r.permissions && string_to_array(_perm, '|'))
     and coalesce(_pin, '') <> '' and p.pin_hash = crypt(_pin, p.pin_hash);
  insert into pin_attempts (hotel_id, user_id, ok) values (_hotel_id, auth.uid(), _mgr is not null);
  return _mgr;
end $$;
create or replace function public.approve_with_pin(_hotel_id uuid, _pin text)
returns uuid language sql security definer set search_path = public as $$ select public.approve_with_pin(_hotel_id, _pin, 'pos.admin') $$;
create or replace function public.approver(_hotel_id uuid, _pin text, _perm text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if has_hotel_role_any(_hotel_id, array['owner','manager'], _perm) then return auth.uid(); end if;
  return approve_with_pin(_hotel_id, _pin, _perm);
end $$;

CREATE OR REPLACE FUNCTION public.pos_set_discount(_order_id uuid, _kind text, _value numeric, _reason text, _pin text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _o pos_orders; _mgr uuid;
begin
  select * into _o from pos_orders where id = _order_id;
  if not found or not pos_staff(_o.hotel_id) then raise exception 'Order not found'; end if;
  if _o.status <> 'open' then raise exception 'This bill is closed'; end if;
  if _kind is not null and _kind not in ('percent', 'amount') then raise exception 'Unknown discount type'; end if;
  if _kind = 'percent' and (_value < 0 or _value > 100) then raise exception 'Percent must be 0–100'; end if;
  if _kind is not null and coalesce(trim(_reason), '') = '' then raise exception 'Give a reason'; end if;
  _mgr := approver(_o.hotel_id, _pin, 'pos.discount');
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
end $function$;
CREATE OR REPLACE FUNCTION public.pos_set_service_charge(_order_id uuid, _rate numeric, _pin text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _o pos_orders;
begin
  select * into _o from pos_orders where id = _order_id;
  if not found or not pos_staff(_o.hotel_id) then raise exception 'Order not found'; end if;
  if _o.status <> 'open' then raise exception 'This bill is closed'; end if;
  if _rate < 0 or _rate > 0.3 then raise exception 'Service charge must be 0–30%%'; end if;
  if approver(_o.hotel_id, _pin, 'pos.discount') is null then return 'wrong_pin'; end if;
  perform set_config('hotel_easy.rpc', 'on', true);
  update pos_orders set service_charge_rate = _rate where id = _order_id;
  perform set_config('hotel_easy.rpc', 'off', true);
  perform pos_recalc(_order_id);
  return 'ok';
end $function$;

-- a hand-set room rate needs reservations.rate; season prices (what the booking screen quotes) are always fine
create or replace function public.reservations_rate_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare _q jsonb; _total numeric; d date;
begin
  if auth.uid() is null or coalesce(current_setting('hotel_easy.rpc', true), '') = 'on' then return new; end if;
  if tg_op = 'UPDATE' and new.rate_per_night is not distinct from old.rate_per_night
     and new.nightly_rates is not distinct from old.nightly_rates then return new; end if;
  if has_hotel_role(new.hotel_id, array['owner','manager','front_desk']::hotel_role[], 'reservations.rate') then return new; end if;
  _q := stay_quote(new.room_type_id, new.check_in, new.check_out, false, new.company_id);
  _total := 0;
  for d in select generate_series(new.check_in, new.check_out - 1, interval '1 day')::date loop
    _total := _total + coalesce((new.nightly_rates ->> d::text)::numeric, new.rate_per_night);
  end loop;
  if abs(_total - (_q->>'total')::numeric) > 1 then
    raise exception 'RATE: You can''t change the room rate. Use the season price or ask a manager.';
  end if;
  return new;
end $$;
drop trigger if exists reservations_rate_guard on public.reservations;
create trigger reservations_rate_guard before insert or update on public.reservations for each row execute function public.reservations_rate_guard();

-- the owner has looked at the new permissions
create or replace function public.roles_mark_reviewed(_hotel_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_hotel_role(_hotel_id, array['owner']::hotel_role[]) then raise exception 'Only the owner can do this'; end if;
  update hotels set roles_reviewed_at = now() where id = _hotel_id;
end $$;
grant execute on function public.roles_mark_reviewed(uuid), public.approver(uuid, text, text), public.approve_with_pin(uuid, text, text) to authenticated;

-- permissions added since the owner last looked (only matters once the hotel has custom roles)
create or replace function public.roles_new_permissions(_hotel_id uuid) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.key order by c.sort), '{}') from permission_catalog c, hotels h
   where h.id = _hotel_id and has_hotel_role(_hotel_id, array['owner']::hotel_role[])
     and exists (select 1 from hotel_roles r where r.hotel_id = _hotel_id)
     and c.added_at > greatest(coalesce(h.roles_reviewed_at, '-infinity'), (select min(created_at) from hotel_roles r where r.hotel_id = _hotel_id));
$$;
grant execute on function public.roles_new_permissions(uuid) to authenticated;
