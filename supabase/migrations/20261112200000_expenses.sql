-- =====================================================================
-- HotelEasy – Expenses, bills, budgets and profit & loss
--
--   * Expense categories in P&L groups (cost of sales, payroll,
--     utilities, repairs, marketing, admin, other; "stock" for supplier
--     bills for goods that go into inventory, which reach the P&L only
--     when the stock is used).
--   * Expenses / supplier bills: paid now or later, VAT you can claim,
--     due dates, monthly repeats, void with a reason. A bill can be made
--     straight from a goods-received note.
--   * Monthly budgets per category and revenue targets.
--   * pnl_report(): revenue (same rules as Reports), cost of sales
--     (stock used + cost-of-sales expenses), operating expenses,
--     profit, budget vs actual, VAT estimate, bills to pay.
--   Owners, managers and accountants only.
--
-- Run AFTER 20261112160000_online_booking.sql.
-- =====================================================================

create or replace function public.fin_staff(_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_hotel_role_any(_hotel_id, array['owner', 'manager', 'accountant']);
$$;

create table public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references public.hotels(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  grp         text not null check (grp in ('cost_of_sales', 'payroll', 'utilities', 'repairs', 'marketing', 'admin', 'other', 'stock')),
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  unique (hotel_id, name)
);

create type public.expense_method as enum ('cash', 'mpesa', 'bank_transfer', 'card', 'cheque', 'other');

create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        uuid not null references public.hotels(id) on delete cascade,
  number          int not null,
  spent_on        date not null,
  category_id     uuid not null references public.expense_categories(id) on delete restrict,
  supplier_id     uuid references public.suppliers(id) on delete set null,
  payee           text,
  description     text not null check (length(trim(description)) > 0),
  amount          numeric(14,2) not null check (amount > 0),
  vat_amount      numeric(14,2) not null default 0 check (vat_amount >= 0),
  net_amount      numeric(14,2) generated always as (amount - vat_amount) stored,
  reference       text,
  due_on          date,
  paid_on         date,
  paid_method     public.expense_method,
  paid_reference  text,
  recurring       boolean not null default false,
  receipt_batch   uuid,
  status          text not null default 'unpaid' check (status in ('unpaid', 'paid', 'void')),
  void_reason     text,
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (hotel_id, number),
  check (vat_amount <= amount),
  check ((status = 'paid') = (paid_on is not null and paid_method is not null) or status = 'void'),
  check (status <> 'void' or coalesce(trim(void_reason), '') <> '')
);
create index on public.expenses (hotel_id, spent_on);
create index on public.expenses (hotel_id, status, due_on);
create unique index expenses_one_bill_per_receipt on public.expenses (receipt_batch) where receipt_batch is not null and status <> 'void';
create trigger t_expenses_upd before update on public.expenses for each row execute function public.touch_updated_at();

create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references public.hotels(id) on delete cascade,
  month        date not null check (extract(day from month) = 1),
  category_id  uuid references public.expense_categories(id) on delete cascade,
  revenue_grp  text check (revenue_grp in ('rooms', 'fnb', 'other')),
  amount       numeric(14,2) not null check (amount >= 0),
  check ((category_id is null) <> (revenue_grp is null))
);
create unique index budgets_cat on public.budgets (hotel_id, month, category_id) where category_id is not null;
create unique index budgets_rev on public.budgets (hotel_id, month, revenue_grp) where revenue_grp is not null;

-- ---------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------
create or replace function public.expenses_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare _admin boolean;
begin
  if tg_op = 'DELETE' then
    raise exception 'Expenses cannot be deleted; void them with a reason instead';
  end if;
  if not exists (select 1 from expense_categories where id = new.category_id and hotel_id = new.hotel_id) then
    raise exception 'Category belongs to another hotel';
  end if;
  if new.supplier_id is not null and not exists (select 1 from suppliers where id = new.supplier_id and hotel_id = new.hotel_id) then
    raise exception 'Supplier belongs to another hotel';
  end if;
  if new.payee is null and new.supplier_id is null then
    raise exception 'Say who was paid: choose a supplier or type a payee';
  end if;
  if new.status = 'paid' and new.paid_on is null then new.paid_on := new.spent_on; end if;
  if new.status <> 'paid' and new.status <> 'void' then new.paid_on := null; new.paid_method := null; new.paid_reference := null; end if;
  if tg_op = 'INSERT' then
    new.number := coalesce((select max(number) from expenses where hotel_id = new.hotel_id), 0) + 1;
    new.created_by := auth.uid();
    if new.status = 'void' then raise exception 'New expenses cannot be void'; end if;
    return new;
  end if;
  _admin := has_hotel_role(new.hotel_id, array['owner', 'manager']::hotel_role[]);
  if new.number <> old.number or new.hotel_id <> old.hotel_id or new.created_by is distinct from old.created_by
     or new.receipt_batch is distinct from old.receipt_batch then
    raise exception 'That cannot be changed';
  end if;
  if old.status = 'void' then raise exception 'This expense is void'; end if;
  if new.status = 'void' and not _admin then raise exception 'Only owners and managers can void expenses'; end if;
  -- a paid expense is locked, except to void it, or (owner/manager) to reopen it
  if old.status = 'paid' and new.status = 'paid'
     and (new.spent_on, new.category_id, new.supplier_id, new.payee, new.description, new.amount, new.vat_amount, new.reference,
          new.paid_on, new.paid_method, new.paid_reference)
         is distinct from
         (old.spent_on, old.category_id, old.supplier_id, old.payee, old.description, old.amount, old.vat_amount, old.reference,
          old.paid_on, old.paid_method, old.paid_reference)
     and not _admin then
    raise exception 'Paid expenses can only be changed by an owner or manager';
  end if;
  if old.status = 'paid' and new.status = 'unpaid' and not _admin then
    raise exception 'Only owners and managers can mark a paid expense as unpaid';
  end if;
  return new;
end $$;
create trigger expenses_guard before insert or update or delete on public.expenses for each row execute function public.expenses_guard();

create or replace function public.expenses_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform log_activity(new.hotel_id, 'expense', format('Expense #%s: %s, %s', new.number, new.description, to_char(new.amount, 'FM999,999,990.00')), new.id);
  elsif new.status <> old.status then
    perform log_activity(new.hotel_id, 'expense', format('Expense #%s %s%s', new.number,
      case new.status when 'paid' then 'paid' when 'void' then 'voided' else 'marked unpaid' end,
      case when new.status = 'void' then ': ' || new.void_reason else '' end), new.id);
  end if;
  return new;
end $$;
create trigger expenses_log after insert or update on public.expenses for each row execute function public.expenses_log();

create or replace function public.budgets_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.category_id is not null and not exists (select 1 from expense_categories where id = new.category_id and hotel_id = new.hotel_id) then
    raise exception 'Category belongs to another hotel';
  end if;
  return new;
end $$;
create trigger budgets_guard before insert or update on public.budgets for each row execute function public.budgets_guard();

-- ---------------------------------------------------------------------
-- Starter categories
-- ---------------------------------------------------------------------
create or replace function public.expense_defaults(_hotel_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into expense_categories (hotel_id, name, grp, sort) values
    (_hotel_id, 'Stock purchases (into inventory)', 'stock', 1),
    (_hotel_id, 'Food bought for the kitchen', 'cost_of_sales', 2),
    (_hotel_id, 'Drinks bought for the bar', 'cost_of_sales', 3),
    (_hotel_id, 'Booking site commissions', 'cost_of_sales', 4),
    (_hotel_id, 'Salaries and wages', 'payroll', 10),
    (_hotel_id, 'NSSF, SHIF and housing levy', 'payroll', 11),
    (_hotel_id, 'Casual labour', 'payroll', 12),
    (_hotel_id, 'Electricity', 'utilities', 20),
    (_hotel_id, 'Water', 'utilities', 21),
    (_hotel_id, 'Gas and fuel', 'utilities', 22),
    (_hotel_id, 'Internet and phone', 'utilities', 23),
    (_hotel_id, 'Repairs and maintenance', 'repairs', 30),
    (_hotel_id, 'Cleaning and laundry supplies', 'repairs', 31),
    (_hotel_id, 'Guest amenities', 'repairs', 32),
    (_hotel_id, 'Marketing and advertising', 'marketing', 40),
    (_hotel_id, 'Rent', 'admin', 50),
    (_hotel_id, 'Licences and permits', 'admin', 51),
    (_hotel_id, 'Insurance', 'admin', 52),
    (_hotel_id, 'Bank and M-Pesa charges', 'admin', 53),
    (_hotel_id, 'Accounting and legal', 'admin', 54),
    (_hotel_id, 'Transport', 'other', 60),
    (_hotel_id, 'Other expenses', 'other', 70)
  on conflict (hotel_id, name) do nothing;
end $$;
revoke execute on function public.expense_defaults(uuid) from public, anon, authenticated;

select public.expense_defaults(id) from public.hotels;

create or replace function public.hotels_expense_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform expense_defaults(new.id); return new; end $$;
create trigger hotels_expense_defaults after insert on public.hotels for each row execute function public.hotels_expense_defaults();

-- ---------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------
-- A supplier bill for a goods-received note (unpaid, category "stock").
create or replace function public.expense_from_receipt(_batch uuid, _due_on date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _h uuid; _sup uuid; _ref text; _total numeric; _id uuid; _cat uuid; _when date; _n int; _po int;
begin
  select m.hotel_id, m.supplier_id, m.reference, sum(m.value), (min(m.created_at) at time zone min(h.timezone))::date, count(*), max(p.number)
    into _h, _sup, _ref, _total, _when, _n, _po
    from stock_movements m join hotels h on h.id = m.hotel_id left join purchase_orders p on p.id = m.po_id
   where m.batch_id = _batch and m.kind = 'receive'
   group by m.hotel_id, m.supplier_id, m.reference;
  if _h is null then raise exception 'Delivery not found'; end if;
  if not (fin_staff(_h) or inv_staff(_h)) then raise exception 'You cannot record supplier bills'; end if;
  if _sup is null then raise exception 'This delivery has no supplier; add the bill by hand'; end if;
  if coalesce(_total, 0) <= 0 then raise exception 'This delivery has no cost'; end if;
  select id into _cat from expense_categories where hotel_id = _h and grp = 'stock' and active order by sort limit 1;
  if _cat is null then raise exception 'Add an expense category of type "Stock purchases" first'; end if;
  insert into expenses (hotel_id, spent_on, category_id, supplier_id, description, amount, reference, due_on, receipt_batch, status)
  values (_h, _when, _cat, _sup, format('Goods received: %s item%s%s', _n, case when _n = 1 then '' else 's' end, coalesce(' (PO #' || _po || ')', '')),
          _total, _ref, _due_on, _batch, 'unpaid')
  returning id into _id;
  return _id;
end $$;

-- Copy last month's repeating expenses into this month as unpaid bills.
create or replace function public.expense_copy_recurring(_hotel_id uuid, _month date)
returns int language plpgsql security definer set search_path = public as $$
declare _from date := date_trunc('month', _month)::date; _prev date := (date_trunc('month', _month) - interval '1 month')::date; _n int;
begin
  if not fin_staff(_hotel_id) then raise exception 'Only owners, managers and accountants can add expenses'; end if;
  insert into expenses (hotel_id, spent_on, category_id, supplier_id, payee, description, amount, vat_amount, due_on, recurring, status)
  select e.hotel_id,
         least(_from + (extract(day from e.spent_on)::int - 1), (_from + interval '1 month - 1 day')::date),
         e.category_id, e.supplier_id, e.payee, e.description, e.amount, e.vat_amount,
         case when e.due_on is not null then least(_from + (extract(day from e.due_on)::int - 1), (_from + interval '1 month - 1 day')::date) end,
         true, 'unpaid'
    from expenses e
   where e.hotel_id = _hotel_id and e.recurring and e.status <> 'void'
     and e.spent_on >= _prev and e.spent_on < _from
     and not exists (select 1 from expenses x where x.hotel_id = _hotel_id and x.recurring and x.status <> 'void'
                       and x.spent_on >= _from and x.spent_on < (_from + interval '1 month')::date
                       and x.description = e.description and x.category_id = e.category_id);
  get diagnostics _n = row_count;
  return _n;
end $$;

-- ---------------------------------------------------------------------
-- Profit & loss
-- ---------------------------------------------------------------------
create or replace function public.pnl_report(_hotel_id uuid, _from date, _to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _tz text; _today date;
begin
  if not fin_staff(_hotel_id) then raise exception 'Only owners, managers and accountants can see profit and loss'; end if;
  if _from is null or _to is null or _from > _to or _to - _from > 366 then raise exception 'Choose a period of up to one year'; end if;
  select coalesce(timezone, 'Africa/Nairobi') into _tz from hotels where id = _hotel_id;
  _today := (now() at time zone _tz)::date;

  return jsonb_build_object(
    'from', _from, 'to', _to,
    -- one row per month and line
    'lines', (
      with months as (select generate_series(date_trunc('month', _from), date_trunc('month', _to), interval '1 month')::date m),
      rev as (
        select date_trunc('month', d)::date m, 'revenue' sec, grp line, null::uuid category_id, sum(net) amount
          from report_lines(_hotel_id, _from, least(_to, _today)) group by 1, 3),
      stock as (
        select date_trunc('month', (created_at at time zone _tz))::date m, case when kind = 'issue' then 'expenses' else 'cost_of_sales' end sec,
               case kind when 'sale' then 'stock_sold' when 'waste' then 'stock_waste' when 'issue' then 'stock_issued' else 'stock_counts' end line,
               null::uuid category_id, -sum(value) amount
          from stock_movements
         where hotel_id = _hotel_id and kind in ('sale', 'waste', 'issue', 'adjust')
           and (created_at at time zone _tz)::date between _from and _to
         group by 1, 2, 3),
      exp as (
        select date_trunc('month', e.spent_on)::date m, case c.grp when 'cost_of_sales' then 'cost_of_sales' else 'expenses' end sec,
               c.grp line, c.id category_id, sum(e.net_amount) amount
          from expenses e join expense_categories c on c.id = e.category_id
         where e.hotel_id = _hotel_id and e.status <> 'void' and c.grp <> 'stock' and e.spent_on between _from and _to
         group by 1, 2, 3, 4),
      bud as (
        select b.month m, case when b.revenue_grp is not null then 'revenue' when c.grp = 'cost_of_sales' then 'cost_of_sales' else 'expenses' end sec,
               coalesce(b.revenue_grp, c.grp) line, b.category_id, b.amount
          from budgets b left join expense_categories c on c.id = b.category_id
         where b.hotel_id = _hotel_id and b.month between date_trunc('month', _from)::date and _to),
      a as (select m, sec, line, category_id, sum(amount) actual from (select * from rev union all select * from stock union all select * from exp) x group by 1, 2, 3, 4),
      j as (
        select coalesce(a.m, bud.m) m, coalesce(a.sec, bud.sec) sec, coalesce(a.line, bud.line) line, coalesce(a.category_id, bud.category_id) category_id,
               coalesce(a.actual, 0) actual, bud.amount budget
          from a full join bud on bud.m = a.m and bud.sec = a.sec and bud.line = a.line and bud.category_id is not distinct from a.category_id)
      select coalesce(jsonb_agg(jsonb_build_object('month', j.m, 'section', j.sec, 'line', j.line, 'category_id', j.category_id,
                                                    'category', c.name, 'actual', round(j.actual, 2), 'budget', j.budget)
                                order by j.m, j.sec, j.line, c.sort), '[]'::jsonb)
        from j left join expense_categories c on c.id = j.category_id
       where j.m in (select m from months)),
    'vat', jsonb_build_object(
      'output', coalesce((select sum(vat) from report_lines(_hotel_id, _from, least(_to, _today))), 0),
      'levy', coalesce((select sum(levy) from report_lines(_hotel_id, _from, least(_to, _today))), 0),
      'input', coalesce((select sum(vat_amount) from expenses where hotel_id = _hotel_id and status <> 'void' and spent_on between _from and _to), 0)),
    'paid_out', (
      select coalesce(jsonb_agg(jsonb_build_object('method', paid_method, 'amount', amt, 'count', n) order by amt desc), '[]'::jsonb) from (
        select paid_method, sum(amount) amt, count(*) n from expenses
         where hotel_id = _hotel_id and status = 'paid' and paid_on between _from and _to group by 1) s),
    'payables', (
      select jsonb_build_object(
        'total', coalesce(sum(amount), 0), 'count', count(*),
        'overdue', coalesce(sum(amount) filter (where due_on < _today), 0),
        'due_7', coalesce(sum(amount) filter (where due_on between _today and _today + 7), 0),
        'later', coalesce(sum(amount) filter (where due_on > _today + 7 or due_on is null), 0))
        from expenses where hotel_id = _hotel_id and status = 'unpaid')
  );
end $$;

-- ---------------------------------------------------------------------
-- Security
-- ---------------------------------------------------------------------
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
revoke all on public.expense_categories, public.expenses, public.budgets from anon;

create policy ecat_sel on public.expense_categories for select to authenticated using (public.fin_staff(hotel_id));
create policy ecat_w on public.expense_categories for all to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]));
create policy exp_sel on public.expenses for select to authenticated using (public.fin_staff(hotel_id));
create policy exp_ins on public.expenses for insert to authenticated with check (public.fin_staff(hotel_id));
create policy exp_upd on public.expenses for update to authenticated using (public.fin_staff(hotel_id)) with check (public.fin_staff(hotel_id));
create policy bud_sel on public.budgets for select to authenticated using (public.fin_staff(hotel_id));
create policy bud_w on public.budgets for all to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]));

do $$
declare f text;
begin
  foreach f in array array['fin_staff(uuid)', 'expense_from_receipt(uuid, date)', 'expense_copy_recurring(uuid, date)', 'pnl_report(uuid, date, date)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
