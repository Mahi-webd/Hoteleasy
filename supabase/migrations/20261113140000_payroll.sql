-- =====================================================================
-- HotelEasy – Payroll and payslips (Kenya)
--
--   * Statutory rates live in a table with an "effective from" date, so
--     a new law (e.g. a change to PAYE bands) is a new row, not new code.
--     Starter rates (in force November 2026):
--       PAYE: 10% to 24,000 · 25% to 32,333 · 30% to 500,000 ·
--             32.5% to 800,000 · 35% above; personal relief 2,400/month
--       NSSF Year 4 (from Feb 2026): 6% + 6%, LEL 9,000, UEL 108,000
--       SHIF: 2.75% of gross, minimum 300 (employee only)
--       Affordable Housing Levy: 1.5% employee + 1.5% employer
--       NSSF, SHIF and the housing levy come off before PAYE.
--       NITA: 50 per employee per month (employer)
--   * Payroll details per person (KRA PIN, NSSF and SHA numbers, how
--     they are paid, allowances) sit with the private pay rate.
--   * A monthly run makes one payslip per paid staff member from the
--     pay rate and the time clock; adjustments (overtime, bonus,
--     advances) are entered while it is a draft; every figure is
--     worked out in the database.
--   * A manager approves the run; staff then see their own payslips.
--   * Marking it paid records the net wages as a paid expense and the
--     PAYE, NSSF, SHIF, housing levy and NITA as bills due on the 9th.
--
-- Run AFTER 20261113100000_staff_rota.sql.
-- =====================================================================

create table public.payroll_rates (
  id                 uuid primary key default gen_random_uuid(),
  hotel_id           uuid not null references public.hotels(id) on delete cascade,
  effective_from     date not null,
  paye_bands         jsonb not null,
  personal_relief    numeric(12,2) not null default 2400,
  nssf_rate          numeric(6,4) not null default 0.06,
  nssf_lel           numeric(12,2) not null default 9000,
  nssf_uel           numeric(12,2) not null default 108000,
  shif_rate          numeric(6,4) not null default 0.0275,
  shif_min           numeric(12,2) not null default 300,
  ahl_rate           numeric(6,4) not null default 0.015,
  ahl_employer_rate  numeric(6,4) not null default 0.015,
  nita_per_employee  numeric(12,2) not null default 50,
  overtime_multiplier numeric(4,2) not null default 1.5,
  hours_per_month    numeric(6,2) not null default 225,
  note               text,
  created_at         timestamptz not null default now(),
  unique (hotel_id, effective_from)
);

create or replace function public.payroll_rates_defaults(_hotel_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into payroll_rates (hotel_id, effective_from, paye_bands, note)
  values (_hotel_id, '2026-02-01',
    '[{"upto":24000,"rate":0.10},{"upto":32333,"rate":0.25},{"upto":500000,"rate":0.30},{"upto":800000,"rate":0.325},{"upto":null,"rate":0.35}]',
    'Finance Act 2023 PAYE bands (unchanged by Finance Act 2026); NSSF Year 4; SHIF and housing levy deductible before PAYE')
  on conflict (hotel_id, effective_from) do nothing;
$$;
revoke execute on function public.payroll_rates_defaults(uuid) from public, anon, authenticated;
select public.payroll_rates_defaults(id) from public.hotels;
create or replace function public.hotels_payroll_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform payroll_rates_defaults(new.id); return new; end $$;
create trigger hotels_payroll_defaults after insert on public.hotels for each row execute function public.hotels_payroll_defaults();

-- Payroll details sit with the private pay rate
alter table public.staff_pay
  add column if not exists statutory        boolean not null default true,
  add column if not exists house_allowance  numeric(12,2) not null default 0 check (house_allowance >= 0),
  add column if not exists other_allowance  numeric(12,2) not null default 0 check (other_allowance >= 0),
  add column if not exists kra_pin          text,
  add column if not exists nssf_no          text,
  add column if not exists sha_no           text,
  add column if not exists id_no            text,
  add column if not exists pay_method       text not null default 'mpesa' check (pay_method in ('mpesa', 'bank', 'cash')),
  add column if not exists pay_account      text,
  add column if not exists bank_name        text;
-- casual workers usually aren't on statutory deductions until they become regular employees
update public.staff_pay p set statutory = false from public.staff s where s.id = p.staff_id and s.employment = 'casual';

create table public.payroll_runs (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references public.hotels(id) on delete cascade,
  month        date not null check (extract(day from month) = 1),
  status       text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
  rates_id     uuid not null references public.payroll_rates(id),
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  approved_by  uuid references auth.users(id) on delete set null,
  approved_at  timestamptz,
  paid_on      date,
  created_at   timestamptz not null default now(),
  unique (hotel_id, month)
);

create table public.payslips (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references public.payroll_runs(id) on delete cascade,
  hotel_id          uuid not null references public.hotels(id) on delete cascade,
  staff_id          uuid not null references public.staff(id) on delete restrict,
  -- snapshot
  full_name         text not null,
  department        text,
  job_title         text,
  kra_pin           text,
  nssf_no           text,
  sha_no            text,
  id_no             text,
  pay_type          text not null,
  rate              numeric(12,2) not null,
  pay_method        text,
  pay_account       text,
  statutory         boolean not null,
  days_worked       numeric(6,2) not null default 0,
  hours_worked      numeric(8,2) not null default 0,
  -- editable while draft
  overtime_hours    numeric(8,2) not null default 0 check (overtime_hours >= 0),
  bonus             numeric(12,2) not null default 0 check (bonus >= 0),
  advances          numeric(12,2) not null default 0 check (advances >= 0),
  other_deductions  numeric(12,2) not null default 0 check (other_deductions >= 0),
  note              text,
  -- worked out
  basic             numeric(12,2) not null default 0,
  house_allowance   numeric(12,2) not null default 0,
  other_allowance   numeric(12,2) not null default 0,
  overtime_pay      numeric(12,2) not null default 0,
  gross             numeric(12,2) not null default 0,
  nssf_tier1        numeric(12,2) not null default 0,
  nssf_tier2        numeric(12,2) not null default 0,
  shif              numeric(12,2) not null default 0,
  ahl               numeric(12,2) not null default 0,
  taxable           numeric(12,2) not null default 0,
  tax_before_relief numeric(12,2) not null default 0,
  personal_relief   numeric(12,2) not null default 0,
  paye              numeric(12,2) not null default 0,
  net               numeric(12,2) not null default 0,
  employer_nssf     numeric(12,2) not null default 0,
  employer_ahl      numeric(12,2) not null default 0,
  nita              numeric(12,2) not null default 0,
  unique (run_id, staff_id)
);
create index on public.payslips (staff_id);

-- ---------------------------------------------------------------------
-- The calculation
-- ---------------------------------------------------------------------
create or replace function public.paye_on(_taxable numeric, _bands jsonb)
returns numeric language plpgsql immutable as $$
declare _b jsonb; _prev numeric := 0; _top numeric; _tax numeric := 0;
begin
  if _taxable <= 0 then return 0; end if;
  for _b in select * from jsonb_array_elements(_bands) loop
    _top := nullif(_b->>'upto', '')::numeric;
    if _top is null or _taxable <= _top then
      _tax := _tax + (_taxable - _prev) * (_b->>'rate')::numeric;
      return round(_tax, 2);
    end if;
    _tax := _tax + (_top - _prev) * (_b->>'rate')::numeric;
    _prev := _top;
  end loop;
  return round(_tax, 2);
end $$;

create or replace function public.payslip_calc()
returns trigger language plpgsql security definer set search_path = public as $$
declare _r payroll_rates; _run payroll_runs; _hourly numeric; _ded numeric;
begin
  select * into _run from payroll_runs where id = new.run_id;
  if tg_op = 'UPDATE' and coalesce(current_setting('hotel_easy.rpc', true), '') <> 'on' then
    if _run.status <> 'draft' then raise exception 'This payroll is approved; reopen it to make changes'; end if;
    -- only the adjustments may be typed in
    if (new.staff_id, new.full_name, new.pay_type, new.rate, new.statutory, new.days_worked, new.hours_worked, new.run_id)
       is distinct from (old.staff_id, old.full_name, old.pay_type, old.rate, old.statutory, old.days_worked, old.hours_worked, old.run_id)
       and not has_hotel_role(new.hotel_id, array['owner', 'manager']::hotel_role[]) then
      raise exception 'Only owners and managers can change pay, days or hours on a payslip';
    end if;
  end if;
  select * into _r from payroll_rates where id = _run.rates_id;

  new.basic := round(case new.pay_type
    when 'monthly' then new.rate
    when 'daily' then new.rate * new.days_worked
    else new.rate * new.hours_worked end, 2);
  _hourly := case new.pay_type when 'monthly' then new.rate / nullif(_r.hours_per_month, 0)
                               when 'daily' then new.rate / 8 else new.rate end;
  new.overtime_pay := round(coalesce(_hourly, 0) * new.overtime_hours * _r.overtime_multiplier, 2);
  new.gross := new.basic + new.house_allowance + new.other_allowance + new.overtime_pay + new.bonus;

  if new.statutory and new.gross > 0 then
    new.nssf_tier1 := round(least(new.gross, _r.nssf_lel) * _r.nssf_rate, 2);
    new.nssf_tier2 := round(greatest(least(new.gross, _r.nssf_uel) - _r.nssf_lel, 0) * _r.nssf_rate, 2);
    new.shif := round(greatest(new.gross * _r.shif_rate, _r.shif_min), 2);
    new.ahl := round(new.gross * _r.ahl_rate, 2);
    new.taxable := greatest(new.gross - new.nssf_tier1 - new.nssf_tier2 - new.shif - new.ahl, 0);
    new.tax_before_relief := paye_on(new.taxable, _r.paye_bands);
    new.personal_relief := least(_r.personal_relief, new.tax_before_relief);
    new.paye := new.tax_before_relief - new.personal_relief;
    new.employer_nssf := new.nssf_tier1 + new.nssf_tier2;
    new.employer_ahl := round(new.gross * _r.ahl_employer_rate, 2);
    new.nita := _r.nita_per_employee;
  else
    new.nssf_tier1 := 0; new.nssf_tier2 := 0; new.shif := 0; new.ahl := 0; new.taxable := 0; new.tax_before_relief := 0;
    new.personal_relief := 0; new.paye := 0; new.employer_nssf := 0; new.employer_ahl := 0; new.nita := 0;
  end if;
  _ded := new.nssf_tier1 + new.nssf_tier2 + new.shif + new.ahl + new.paye;
  if new.advances + new.other_deductions > new.gross - _ded then
    raise exception 'Deductions for % are more than their pay after tax (%)', new.full_name, to_char(new.gross - _ded, 'FM999,999,990.00');
  end if;
  new.net := new.gross - _ded - new.advances - new.other_deductions;
  return new;
end $$;
create trigger payslip_calc before insert or update on public.payslips for each row execute function public.payslip_calc();

-- ---------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------
create or replace function public.payroll_staff(_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_hotel_role_any(_hotel_id, array['owner', 'manager', 'accountant']);
$$;

-- Make (or refresh) the draft run for a month.
create or replace function public.payroll_generate(_hotel_id uuid, _month date)
returns uuid language plpgsql security definer set search_path = public as $$
declare _m date := date_trunc('month', _month)::date; _end date; _run payroll_runs; _rates uuid; _tz text; _prev text;
begin
  if not payroll_staff(_hotel_id) then raise exception 'Only owners, managers and accountants can run payroll'; end if;
  _end := (_m + interval '1 month - 1 day')::date;
  select id into _rates from payroll_rates where hotel_id = _hotel_id and effective_from <= _end order by effective_from desc limit 1;
  if _rates is null then raise exception 'No statutory rates are set for that month'; end if;
  select coalesce(timezone, 'Africa/Nairobi') into _tz from hotels where id = _hotel_id;
  select * into _run from payroll_runs where hotel_id = _hotel_id and month = _m for update;
  if found and _run.status <> 'draft' then raise exception 'Payroll for % is already %', to_char(_m, 'FMMonth YYYY'), _run.status; end if;
  if not found then
    insert into payroll_runs (hotel_id, month, rates_id) values (_hotel_id, _m, _rates) returning * into _run;
  else
    update payroll_runs set rates_id = _rates where id = _run.id;
  end if;

  _prev := coalesce(current_setting('hotel_easy.rpc', true), '');
  perform set_config('hotel_easy.rpc', 'on', true);
  -- people no longer paid drop off the draft; everyone paid is (re)built, keeping typed adjustments
  delete from payslips ps where ps.run_id = _run.id
     and not exists (select 1 from staff s join staff_pay p on p.staff_id = s.id where s.id = ps.staff_id and (s.active or exists (
       select 1 from time_entries t where t.staff_id = s.id and (t.clock_in at time zone _tz)::date between _m and _end)));
  insert into payslips (run_id, hotel_id, staff_id, full_name, department, job_title, kra_pin, nssf_no, sha_no, id_no, pay_type, rate,
                        pay_method, pay_account, statutory, days_worked, hours_worked, house_allowance, other_allowance)
  select _run.id, _hotel_id, s.id, s.full_name, s.department, s.job_title, p.kra_pin, p.nssf_no, p.sha_no, p.id_no, p.pay_type, p.rate,
         p.pay_method, case when p.pay_method = 'bank' then concat_ws(' ', p.bank_name, p.pay_account) else coalesce(p.pay_account, s.phone) end,
         p.statutory,
         coalesce((select count(distinct (t.clock_in at time zone _tz)::date) from time_entries t
                    where t.staff_id = s.id and (t.clock_in at time zone _tz)::date between _m and _end), 0),
         coalesce((select round(sum(extract(epoch from coalesce(t.clock_out, t.clock_in) - t.clock_in) / 3600.0)::numeric, 2) from time_entries t
                    where t.staff_id = s.id and (t.clock_in at time zone _tz)::date between _m and _end), 0),
         p.house_allowance, p.other_allowance
    from staff s join staff_pay p on p.staff_id = s.id
   where s.hotel_id = _hotel_id
     and (s.active or exists (select 1 from time_entries t where t.staff_id = s.id and (t.clock_in at time zone _tz)::date between _m and _end))
  on conflict (run_id, staff_id) do update set
    full_name = excluded.full_name, department = excluded.department, job_title = excluded.job_title, kra_pin = excluded.kra_pin,
    nssf_no = excluded.nssf_no, sha_no = excluded.sha_no, id_no = excluded.id_no, pay_type = excluded.pay_type, rate = excluded.rate,
    pay_method = excluded.pay_method, pay_account = excluded.pay_account, statutory = excluded.statutory,
    days_worked = excluded.days_worked, hours_worked = excluded.hours_worked,
    house_allowance = excluded.house_allowance, other_allowance = excluded.other_allowance;
  perform set_config('hotel_easy.rpc', _prev, true);
  return _run.id;
end $$;

create or replace function public.payroll_set_status(_run_id uuid, _action text, _paid_on date default null)
returns void language plpgsql security definer set search_path = public as $$
declare _run payroll_runs; _t record; _cat_wage uuid; _cat_stat uuid; _due date; _lbl text; _n int; _eom date;
begin
  select * into _run from payroll_runs where id = _run_id for update;
  if not found or not payroll_staff(_run.hotel_id) then raise exception 'Payroll not found'; end if;
  _lbl := to_char(_run.month, 'FMMonth YYYY');
  if _action = 'approve' then
    if not has_hotel_role(_run.hotel_id, array['owner', 'manager']::hotel_role[]) then raise exception 'A manager or the owner must approve payroll'; end if;
    if _run.status <> 'draft' then raise exception 'Only a draft can be approved'; end if;
    select count(*) into _n from payslips where run_id = _run_id;
    if _n = 0 then raise exception 'There are no payslips in this payroll'; end if;
    update payroll_runs set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = _run_id;
    perform log_activity(_run.hotel_id, 'staff', format('Payroll for %s approved (%s payslips)', _lbl, _n), _run_id);
  elsif _action = 'reopen' then
    if not has_hotel_role(_run.hotel_id, array['owner', 'manager']::hotel_role[]) then raise exception 'A manager or the owner must reopen payroll'; end if;
    if _run.status <> 'approved' then raise exception 'Only an approved, unpaid payroll can be reopened'; end if;
    update payroll_runs set status = 'draft', approved_by = null, approved_at = null where id = _run_id;
  elsif _action = 'paid' then
    if _run.status <> 'approved' then raise exception 'Approve the payroll before marking it paid'; end if;
    select sum(net) net, sum(paye) paye, sum(nssf_tier1 + nssf_tier2 + employer_nssf) nssf, sum(shif) shif,
           sum(ahl + employer_ahl) ahl, sum(nita) nita into _t from payslips where run_id = _run_id;
    select id into _cat_wage from expense_categories where hotel_id = _run.hotel_id and name = 'Salaries and wages';
    select id into _cat_stat from expense_categories where hotel_id = _run.hotel_id and name = 'NSSF, SHIF and housing levy';
    if _cat_wage is null then select id into _cat_wage from expense_categories where hotel_id = _run.hotel_id and grp = 'payroll' and active order by sort limit 1; end if;
    if _cat_stat is null then _cat_stat := _cat_wage; end if;
    if _cat_wage is null then raise exception 'Add an expense category in the "Staff costs" group first'; end if;
    _due := (_run.month + interval '1 month' + interval '8 days')::date;   -- the 9th of the next month
    _eom := (_run.month + interval '1 month - 1 day')::date;               -- wages are a cost of the payroll month
    if _t.net > 0 then
      insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, status, paid_on, paid_method)
      values (_run.hotel_id, _eom, _cat_wage, 'Staff', format('Net wages, %s', _lbl), _t.net, 'paid', coalesce(_paid_on, current_date), 'bank_transfer');
    end if;
    if _t.paye > 0 then insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, due_on, status)
      values (_run.hotel_id, _eom, _cat_wage, 'KRA', format('PAYE, %s', _lbl), _t.paye, _due, 'unpaid'); end if;
    if _t.nssf > 0 then insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, due_on, status)
      values (_run.hotel_id, _eom, _cat_stat, 'NSSF', format('NSSF (staff + employer), %s', _lbl), _t.nssf, _due, 'unpaid'); end if;
    if _t.shif > 0 then insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, due_on, status)
      values (_run.hotel_id, _eom, _cat_stat, 'Social Health Authority', format('SHIF, %s', _lbl), _t.shif, _due, 'unpaid'); end if;
    if _t.ahl > 0 then insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, due_on, status)
      values (_run.hotel_id, _eom, _cat_stat, 'KRA', format('Housing levy (staff + employer), %s', _lbl), _t.ahl, _due, 'unpaid'); end if;
    if _t.nita > 0 then insert into expenses (hotel_id, spent_on, category_id, payee, description, amount, due_on, status)
      values (_run.hotel_id, _eom, _cat_stat, 'NITA', format('NITA levy, %s', _lbl), _t.nita, _due, 'unpaid'); end if;
    update payroll_runs set status = 'paid', paid_on = coalesce(_paid_on, current_date) where id = _run_id;
    perform log_activity(_run.hotel_id, 'staff', format('Payroll for %s paid: net %s', _lbl, to_char(_t.net, 'FM999,999,990.00')), _run_id);
  else
    raise exception 'Unknown action';
  end if;
end $$;

create or replace function public.payroll_runs_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'Only a draft payroll can be deleted'; end if;
    return old;
  end if;
  return new;
end $$;
create trigger payroll_runs_guard before delete on public.payroll_runs for each row execute function public.payroll_runs_guard();

-- ---------------------------------------------------------------------
-- Security
-- ---------------------------------------------------------------------
alter table public.payroll_rates enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payslips enable row level security;
revoke all on public.payroll_rates, public.payroll_runs, public.payslips from anon;

create policy prates_sel on public.payroll_rates for select to authenticated using (public.payroll_staff(hotel_id));
create policy prates_w on public.payroll_rates for all to authenticated
  using (public.has_hotel_role(hotel_id, array['owner']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner']::public.hotel_role[]));
-- staff see their own payslips once a run is approved (helpers avoid policies that look at each other)
create or replace function public.payroll_run_has_mine(_run_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from payslips ps join staff s on s.id = ps.staff_id join payroll_runs r on r.id = ps.run_id
                  where ps.run_id = _run_id and s.user_id = auth.uid() and r.status <> 'draft');
$$;
create or replace function public.payslip_is_mine(_staff_id uuid, _run_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff s where s.id = _staff_id and s.user_id = auth.uid())
     and exists (select 1 from payroll_runs r where r.id = _run_id and r.status <> 'draft');
$$;
create policy pruns_sel on public.payroll_runs for select to authenticated
  using (public.payroll_staff(hotel_id) or public.payroll_run_has_mine(id));
create policy pruns_del on public.payroll_runs for delete to authenticated using (public.payroll_staff(hotel_id));
create policy pslip_sel on public.payslips for select to authenticated
  using (public.payroll_staff(hotel_id) or public.payslip_is_mine(staff_id, run_id));
create policy pslip_upd on public.payslips for update to authenticated using (public.payroll_staff(hotel_id)) with check (public.payroll_staff(hotel_id));

do $$
declare f text;
begin
  foreach f in array array['payroll_staff(uuid)', 'payroll_run_has_mine(uuid)', 'payslip_is_mine(uuid, uuid)', 'payroll_generate(uuid, date)', 'payroll_set_status(uuid, text, date)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
