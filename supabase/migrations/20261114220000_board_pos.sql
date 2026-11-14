-- =====================================================================
-- HotelEasy: board meals at the restaurant
--  * a POS bill can be a meal-plan guest's breakfast, lunch or dinner
--  * food on it is covered up to the plan's allowance per person (or all
--    of it when the plan sets no allowance); drinks and anything above
--    the allowance are charged as usual
--  * covered food is not restaurant revenue: it was already billed on the
--    room as the plan's meal line, so it isn't counted twice
-- =====================================================================

alter table public.rate_plans add column if not exists breakfast_allowance numeric(12,2) check (breakfast_allowance is null or breakfast_allowance >= 0);
alter table public.rate_plans add column if not exists lunch_allowance numeric(12,2) check (lunch_allowance is null or lunch_allowance >= 0);
alter table public.rate_plans add column if not exists dinner_allowance numeric(12,2) check (dinner_allowance is null or dinner_allowance >= 0);

alter table public.pos_orders add column if not exists board_reservation_id uuid references public.reservations(id) on delete set null;
alter table public.pos_orders add column if not exists board_meal text check (board_meal is null or board_meal in ('breakfast', 'lunch', 'dinner'));
alter table public.pos_orders add column if not exists board_covers int check (board_covers is null or board_covers between 1 and 50);
alter table public.pos_orders add column if not exists board_allowance numeric(12,2);
alter table public.pos_orders add column if not exists board_covered numeric(14,2) not null default 0;
alter table public.pos_orders add column if not exists board_date date;
create index on public.pos_orders (board_reservation_id, board_date, board_meal) where board_reservation_id is not null;

create or replace function public.pos_guard_board()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('hotel_easy.rpc', true), '') <> 'on'
     and (new.board_reservation_id, new.board_meal, new.board_covers, new.board_allowance, new.board_covered, new.board_date)
         is distinct from (old.board_reservation_id, old.board_meal, old.board_covers, old.board_allowance, old.board_covered, old.board_date) then
    raise exception 'Use "Board meal" on the bill to change this';
  end if;
  return new;
end $$;
create trigger pos_orders_guard_board before update on public.pos_orders for each row execute function public.pos_guard_board();

create or replace function public.pos_recalc(_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _prev text := coalesce(current_setting('hotel_easy.rpc', true), '');
  _o pos_orders; _h hotels;
  _items numeric; _disc numeric; _f numeric;
  _food numeric; _cap numeric; _covered numeric := 0; _bf numeric := 1; _after numeric;
  _net numeric; _vat numeric; _levy numeric; _svc numeric; _total numeric;
begin
  select * into _o from pos_orders where id = _order_id;
  select * into _h from hotels where id = _o.hotel_id;
  select coalesce(sum(round(quantity * unit_price, 2)), 0) into _items
    from pos_order_items where order_id = _order_id and status <> 'void' and not comped;
  -- Board meal: the guest's plan covers food up to its allowance (already billed on the room).
  if _o.board_reservation_id is not null then
    select coalesce(sum(round(quantity * unit_price, 2)), 0) into _food
      from pos_order_items where order_id = _order_id and status <> 'void' and not comped and charge_kind = 'food';
    _cap := _o.board_allowance;           -- null = all the food
    _covered := least(_food, coalesce(_cap, _food));
    _bf := case when _food > 0 then (_food - _covered) / _food else 1 end;
  end if;
  _after := _items - _covered;
  _disc := case _o.discount_kind
             when 'percent' then round(_after * least(_o.discount_value, 100) / 100, 2)
             when 'amount' then least(_o.discount_value, _after)
             else 0 end;
  _f := case when _after > 0 then (_after - _disc) / _after else 0 end;

  perform set_config('hotel_easy.rpc', 'on', true);
  update pos_order_items i set
    gross = case when i.status = 'void' or i.comped then 0
                 else round(round(i.quantity * i.unit_price, 2) * case when i.charge_kind = 'food' then _bf else 1 end * _f, 2) end
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

  update pos_orders set items_gross = _items, discount_amount = _disc, board_covered = _covered, net_amount = _net, vat_amount = _vat,
         levy_amount = _levy, service_charge = _svc, total = _total
   where id = _order_id;
  perform set_config('hotel_easy.rpc', _prev, true);
end $$;
revoke execute on function public.pos_recalc(uuid) from public, anon, authenticated;


-- In-house guests whose plan includes this meal today, with how many of
-- them have already eaten it.
create or replace function public.board_guests(_hotel_id uuid, _meal text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _today date;
begin
  if not pos_staff(_hotel_id) then raise exception 'Hotel not found'; end if;
  if _meal not in ('breakfast', 'lunch', 'dinner') then raise exception 'Choose breakfast, lunch or dinner'; end if;
  _today := (now() at time zone (select timezone from hotels where id = _hotel_id))::date;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'reservation_id', r.id, 'code', r.code, 'room', rm.room_number, 'guest', trim(g.first_name || ' ' || g.last_name),
      'pax', r.adults + r.children, 'plan', p.name, 'plan_code', p.code,
      'allowance', case _meal when 'breakfast' then p.breakfast_allowance when 'lunch' then p.lunch_allowance else p.dinner_allowance end,
      'used', (select coalesce(sum(o.board_covers), 0) from pos_orders o where o.board_reservation_id = r.id and o.board_meal = _meal
                 and o.board_date = _today and o.status <> 'void'))
      order by rm.room_number), '[]'::jsonb)
    from reservations r join rate_plans p on p.id = r.rate_plan_id join guests g on g.id = r.guest_id left join rooms rm on rm.id = r.room_id
    where r.hotel_id = _hotel_id and r.status = 'checked_in'
      and case _meal when 'breakfast' then p.breakfast when 'lunch' then p.lunch else p.dinner end);
end $$;
grant execute on function public.board_guests(uuid, text) to authenticated;

-- Mark a bill as a guest's board meal (or clear it with _reservation_id null).
create or replace function public.pos_set_board(_order_id uuid, _reservation_id uuid, _meal text default null, _covers int default null)
returns public.pos_orders language plpgsql security definer set search_path = public as $$
declare _o pos_orders; _r reservations; _p rate_plans; _today date; _used int; _pax int; _each numeric; _room text;
begin
  select * into _o from pos_orders where id = _order_id for update;
  if not found or not pos_staff(_o.hotel_id) then raise exception 'Order not found'; end if;
  if _o.status <> 'open' then raise exception 'This bill is closed'; end if;
  _today := (now() at time zone (select timezone from hotels where id = _o.hotel_id))::date;
  perform set_config('hotel_easy.rpc', 'on', true);
  if _reservation_id is null then
    update pos_orders set board_reservation_id = null, board_meal = null, board_covers = null, board_allowance = null, board_date = null
     where id = _o.id;
  else
    select * into _r from reservations where id = _reservation_id and hotel_id = _o.hotel_id;
    if not found or _r.status <> 'checked_in' then raise exception 'That guest is not checked in'; end if;
    select * into _p from rate_plans where id = _r.rate_plan_id;
    if _p.id is null then raise exception 'This guest is room only'; end if;
    if _meal not in ('breakfast', 'lunch', 'dinner') then raise exception 'Choose breakfast, lunch or dinner'; end if;
    if not (case _meal when 'breakfast' then _p.breakfast when 'lunch' then _p.lunch else _p.dinner end) then
      raise exception '% doesn''t include %', _p.name, _meal;
    end if;
    _pax := _r.adults + _r.children;
    select coalesce(sum(board_covers), 0) into _used from pos_orders
     where board_reservation_id = _r.id and board_meal = _meal and board_date = _today and status <> 'void' and id <> _o.id;
    _covers := coalesce(_covers, _pax - _used);
    if _covers < 1 then raise exception 'Everyone in this room has already had %', _meal; end if;
    if _used + _covers > _pax then
      raise exception 'Only % of % guests in this room still have % today', _pax - _used, _pax, _meal;
    end if;
    _each := case _meal when 'breakfast' then _p.breakfast_allowance when 'lunch' then _p.lunch_allowance else _p.dinner_allowance end;
    update pos_orders set board_reservation_id = _r.id, board_meal = _meal, board_covers = _covers,
           board_allowance = case when _each is null then null else _each * _covers end, board_date = _today,
           reservation_id = coalesce(reservation_id, _r.id)
     where id = _o.id;
    select room_number into _room from rooms where id = _r.room_id;
  end if;
  perform set_config('hotel_easy.rpc', 'off', true);
  perform pos_recalc(_o.id);
  select * into _o from pos_orders where id = _o.id;
  if _reservation_id is not null then
    perform log_activity(_o.hotel_id, 'pos', format('Bill #%s: %s %s for room %s (%s covered)', _o.number, _p.name, _meal, coalesce(_room, '?'),
            to_char(_o.board_covered, 'FM999,999,990')), _r.id);
  end if;
  return _o;
end $$;
grant execute on function public.pos_set_board(uuid, uuid, text, int) to authenticated;

-- A bill that is fully covered by the plan closes with nothing to pay.
create or replace function public.pos_close_board(_order_id uuid)
returns public.pos_orders language plpgsql security definer set search_path = public as $$
declare _o pos_orders;
begin
  select * into _o from pos_orders where id = _order_id for update;
  if not found or not pos_staff(_o.hotel_id) then raise exception 'Order not found'; end if;
  if _o.status <> 'open' then raise exception 'This bill is closed'; end if;
  if _o.board_reservation_id is null then raise exception 'This is not a board meal'; end if;
  if exists (select 1 from pos_order_items where order_id = _order_id and status = 'new') then raise exception 'Send or remove unsent items first'; end if;
  if _o.total - _o.paid_total > 0.009 then raise exception 'There is still % to pay', to_char(_o.total - _o.paid_total, 'FM999,999,990.00'); end if;
  perform set_config('hotel_easy.rpc', 'on', true);
  update pos_orders set status = 'paid', closed_at = now() where id = _o.id returning * into _o;
  perform set_config('hotel_easy.rpc', 'off', true);
  return _o;
end $$;
grant execute on function public.pos_close_board(uuid) to authenticated;
