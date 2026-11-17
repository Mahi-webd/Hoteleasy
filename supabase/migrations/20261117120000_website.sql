-- HotelEasy marketing website: content managed from the website's admin panel
-- (plans and prices, hotels using HotelEasy, FAQs, contact details) and
-- subscriptions paid through Stripe.
--
-- Who can edit: "platform admins" — the HotelEasy team, not hotel staff.
-- Add yourself once, in the SQL editor:
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'you@example.com';

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- nobody reads or writes this through the API; it is managed in the SQL editor
revoke all on public.platform_admins from anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;
revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to anon, authenticated;

-- ---------------------------------------------------------------- content

create table if not exists public.site_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name text not null check (length(btrim(name)) between 1 and 40),
  description text not null default '' check (length(description) <= 160),
  -- null = priced on request ("Talk to us")
  price_monthly_cents integer check (price_monthly_cents is null or price_monthly_cents between 100 and 10000000),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  -- a yearly subscription costs this many months (10 = two months free)
  yearly_months integer not null default 10 check (yearly_months between 1 and 12),
  features text[] not null default '{}' check (cardinality(features) <= 20),
  featured boolean not null default false,
  badge text check (badge is null or length(badge) <= 30),
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  -- a small image saved inline (the admin panel shrinks uploads first) or an https link
  logo text not null check (
    (logo like 'data:image/%' and length(logo) <= 300000) or (logo ~ '^https://' and length(logo) <= 500)
  ),
  url text check (url is null or (url ~ '^https?://' and length(url) <= 300)),
  city text check (city is null or length(city) <= 60),
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(btrim(question)) between 3 and 200),
  answer text not null check (length(btrim(answer)) between 3 and 1500),
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  contact_email text check (contact_email is null or contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9 ]{7,20}$'),
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{7,20}$'),
  trial_days integer not null default 14 check (trial_days between 0 and 60),
  clients_heading text not null default 'Trusted by hotels across Kenya' check (length(clients_heading) <= 80),
  show_clients boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (1) on conflict do nothing;

create or replace function public.site_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['site_plans', 'site_clients', 'site_faqs', 'site_settings'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.site_touch()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('drop policy if exists %I_admin on public.%I', t, t);
    execute format('create policy %I_admin on public.%I for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin())', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
-- the public reads only what is switched on
create policy site_plans_read on public.site_plans for select to anon, authenticated using (active);
create policy site_clients_read on public.site_clients for select to anon, authenticated using (active);
create policy site_faqs_read on public.site_faqs for select to anon, authenticated using (active);
create policy site_settings_read on public.site_settings for select to anon, authenticated using (true);
revoke all on public.site_plans, public.site_clients, public.site_faqs, public.site_settings from anon;
grant select on public.site_plans, public.site_clients, public.site_faqs, public.site_settings to anon;
revoke insert, update, delete on public.site_settings from authenticated;
grant update on public.site_settings to authenticated;

-- only one plan can be the highlighted one
create or replace function public.site_plans_one_featured()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.featured then update public.site_plans set featured = false where id <> new.id and featured; end if;
  return new;
end $$;
drop trigger if exists site_plans_one_featured on public.site_plans;
create trigger site_plans_one_featured after insert or update of featured on public.site_plans
  for each row when (new.featured) execute function public.site_plans_one_featured();

-- everything the public website needs, in one request
create or replace function public.site_content()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'plans', coalesce((select jsonb_agg(jsonb_build_object(
        'slug', slug, 'name', name, 'description', description, 'price_monthly_cents', price_monthly_cents,
        'currency', currency, 'yearly_months', yearly_months, 'features', to_jsonb(features),
        'featured', featured, 'badge', badge) order by sort, created_at)
      from public.site_plans where active), '[]'::jsonb),
    'clients', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'logo', logo, 'url', url, 'city', city) order by sort, created_at)
      from public.site_clients where active), '[]'::jsonb),
    'faqs', coalesce((select jsonb_agg(jsonb_build_object('q', question, 'a', answer) order by sort, created_at)
      from public.site_faqs where active), '[]'::jsonb),
    'settings', (select jsonb_build_object('contact_email', contact_email, 'whatsapp', whatsapp, 'phone', phone,
        'trial_days', trial_days, 'clients_heading', clients_heading, 'show_clients', show_clients)
      from public.site_settings where id = 1)
  )
$$;
revoke all on function public.site_content() from public;
grant execute on function public.site_content() to anon, authenticated;

-- ---------------------------------------------------------- subscriptions

create table if not exists public.site_subscriptions (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  email text,
  hotel_name text check (hotel_name is null or length(hotel_name) <= 120),
  plan_slug text not null,
  billing_interval text not null check (billing_interval in ('month', 'year')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'checkout' check (status in
    ('checkout', 'expired', 'trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused')),
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists site_subscriptions_status on public.site_subscriptions (status, created_at desc);
alter table public.site_subscriptions enable row level security;
drop trigger if exists site_subscriptions_touch on public.site_subscriptions;
create trigger site_subscriptions_touch before update on public.site_subscriptions for each row execute function public.site_touch();
create policy site_subscriptions_admin_read on public.site_subscriptions for select to authenticated using (public.is_platform_admin());
revoke all on public.site_subscriptions from anon, authenticated;
grant select on public.site_subscriptions to authenticated;
-- rows are written only by the billing Edge Function (service role)

-- the billing function asks for a plan's price here, so the browser can never set it
create or replace function public.site_checkout_plan(_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('slug', p.slug, 'name', p.name, 'price_monthly_cents', p.price_monthly_cents,
    'currency', p.currency, 'yearly_months', p.yearly_months, 'trial_days', s.trial_days)
  from public.site_plans p, public.site_settings s
  where p.slug = _slug and p.active and s.id = 1
$$;
revoke all on function public.site_checkout_plan(text) from public, anon, authenticated;
grant execute on function public.site_checkout_plan(text) to service_role;

-- ------------------------------------------------------------- starting content

insert into public.site_plans (slug, name, description, price_monthly_cents, features, featured, badge, sort) values
  ('starter', 'Starter', 'Guest houses and small hotels, up to 15 rooms', 7500,
    array['Front desk & room calendar', 'Folios with VAT & levy', 'M-Pesa STK push', 'Housekeeping on mobile', 'Your own booking page', 'Help assistant'],
    false, null, 1),
  ('growth', 'Growth', 'Hotels with a restaurant, up to 60 rooms', 12500,
    array['Everything in Starter', 'Restaurant POS & kitchen screen', 'Booking.com & Airbnb sync', 'Night audit & owner reports', 'Custom roles & manager PIN', 'Inventory & maintenance'],
    true, 'Most chosen', 2),
  ('group', 'Group', 'Several properties, or more than 60 rooms', null,
    array['Everything in Growth', 'Unlimited properties', 'One dashboard across hotels', 'Priority support', 'On-site setup and training'],
    false, null, 3)
on conflict (slug) do nothing;

insert into public.site_faqs (question, answer, sort)
select q, a, n from (values
  ('Do I need new computers or to install anything?', 'No. HotelEasy runs in the browser on the phones, tablets and PCs you already have. Your data is kept in the cloud and backed up.', 1),
  ('How does M-Pesa work?', 'You connect your own Paybill or Till through Safaricom Daraja. The guest gets a payment prompt on their phone and the money goes straight to your account — HotelEasy never holds it.', 2),
  ('Will it stop double bookings from Booking.com and Airbnb?', 'Yes. HotelEasy reads each channel''s calendar on a schedule and publishes yours back, so a room booked in one place is blocked in the others.', 3),
  ('Can I run more than one hotel?', 'Yes. Each property has its own rooms, staff and reports, and owners see one dashboard across all of them.', 4),
  ('Can I control what each person can do?', 'Completely. Use the built-in roles or create your own, and choose which pages and buttons each role can use. Discounts, refunds and voids need a manager PIN.', 5),
  ('How long does it take staff to learn?', 'Most staff are working on their first day. The built-in assistant answers “how do I…” questions on every page.', 6),
  ('How do I pay for HotelEasy?', 'By card through Stripe, monthly or yearly. You can cancel any time; your plan runs to the end of the period you paid for.', 7)
) v(q, a, n)
where not exists (select 1 from public.site_faqs);
