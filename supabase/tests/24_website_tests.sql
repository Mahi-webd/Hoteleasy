\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–23. Website content, the admin panel's rights, and checkout pricing.
create or replace function pg_temp.as_user(_id uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(_id::text,''), false);
  execute case when _id is null then 'set role anon' else 'set role authenticated' end; end $$;
create or replace function pg_temp.expect_err(_sql text, _pattern text, _label text) returns void language plpgsql as $$
begin
  begin execute _sql; exception when others then
    if sqlerrm ~* _pattern then raise notice 'PASS (blocked) %: %', _label, sqlerrm; return; end if;
    raise exception 'FAIL: % failed with the wrong error: %', _label, sqlerrm;
  end;
  raise exception 'FAIL: % was allowed', _label;
end $$;
create or replace function pg_temp.expect(_cond boolean, _label text) returns void language plpgsql as $$
begin if not coalesce(_cond, false) then raise exception 'FAIL: %', _label; end if; raise notice 'PASS %', _label; end $$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;
reset role;
insert into public.platform_admins (user_id) values ('bbbbbbbb-0000-0000-0000-000000000002');

-- the public website
select pg_temp.as_user(null);
select pg_temp.expect(jsonb_array_length(public.site_content()->'plans') = 3
  and (public.site_content()->'plans'->0->>'price_monthly_cents')::int = 7500
  and (public.site_content()->'plans'->1->>'price_monthly_cents')::int = 12500
  and (public.site_content()->'plans'->2->'price_monthly_cents') = 'null'::jsonb, 'visitors see Starter $75, Growth $125 and Group on request');
select pg_temp.expect((public.site_content()->'plans'->1->>'featured')::boolean and jsonb_array_length(public.site_content()->'faqs') = 7
  and (public.site_content()->'settings'->>'trial_days')::int = 14, 'visitors see the highlighted plan, FAQs and settings');
select pg_temp.expect(not public.is_platform_admin(), 'a visitor is not an admin');
select pg_temp.expect_err($$insert into public.site_plans (slug, name) values ('x', 'X')$$, 'permission denied|row-level', 'a visitor adding a plan');
select pg_temp.expect_err($$select * from public.site_subscriptions$$, 'permission denied', 'a visitor reading subscriptions');
select pg_temp.expect_err($$select public.site_checkout_plan('starter')$$, 'permission denied', 'a visitor asking for checkout prices directly');

-- hotel staff are not website admins
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect(not public.is_platform_admin(), 'hotel staff are not admins');
select pg_temp.expect_err($$insert into public.site_plans (slug, name) values ('x', 'X')$$, 'row-level', 'hotel staff adding a plan');
update public.site_plans set price_monthly_cents = 100 where slug = 'starter';
select pg_temp.expect((select price_monthly_cents from public.site_plans where slug = 'starter') = 7500, 'hotel staff cannot change a price');
update public.site_settings set trial_days = 0;
reset role;
select pg_temp.expect((select trial_days from public.site_settings) = 14, 'hotel staff cannot change settings');
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_err($$select * from public.platform_admins$$, 'permission denied', 'staff reading the admin list');

-- the HotelEasy team
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect(public.is_platform_admin(), 'a platform admin is recognised');
update public.site_plans set price_monthly_cents = 8000 where slug = 'starter';
select pg_temp.expect((select price_monthly_cents from public.site_plans where slug = 'starter') = 8000, 'the admin changes a price');
insert into public.site_plans (slug, name, price_monthly_cents, featured, sort) values ('pro', 'Pro', 19900, true, 4);
select pg_temp.expect((select count(*) from public.site_plans where featured) = 1 and (select featured from public.site_plans where slug = 'pro'),
  'only one plan is highlighted at a time');
select pg_temp.expect_err($$insert into public.site_plans (slug, name, price_monthly_cents) values ('Bad Slug', 'X', 100)$$, 'check', 'a slug with spaces');
select pg_temp.expect_err($$insert into public.site_plans (slug, name, price_monthly_cents) values ('cheap', 'X', 5)$$, 'check', 'a price under $1');
update public.site_plans set active = false where slug = 'pro';
insert into public.site_clients (name, logo, url, city, sort) values
  ('Olsupat Lodge', 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=', 'https://example.com', 'Narok', 1),
  ('Riverside Cottages', 'https://cdn.example.com/logo.png', null, 'Naivasha', 2);
select pg_temp.expect_err($$insert into public.site_clients (name, logo) values ('X', 'javascript:alert(1)')$$, 'check', 'a logo that is not an image');
select pg_temp.expect_err($$insert into public.site_clients (name, logo) values ('X', 'http://insecure.example.com/a.png')$$, 'check', 'a logo over plain http');
select pg_temp.expect_err($$insert into public.site_clients (name, logo, url) values ('X', 'https://a.example/b.png', 'javascript:alert(1)')$$, 'check', 'a link that is not a web address');
update public.site_settings set contact_email = 'hello@hoteleasy.co.ke', whatsapp = '+254 700 000 000', trial_days = 7;
select pg_temp.expect_err($$update public.site_settings set contact_email = 'not-an-email'$$, 'check', 'a bad contact email');
select pg_temp.expect_err($$insert into public.site_settings (id) values (2)$$, 'permission denied|check', 'a second settings row');
select pg_temp.expect((select count(*) from public.site_plans) = 4, 'the admin also sees switched-off plans');

select pg_temp.as_user(null);
select pg_temp.expect(jsonb_array_length(public.site_content()->'plans') = 3 and jsonb_array_length(public.site_content()->'clients') = 2
  and public.site_content()->'clients'->0->>'name' = 'Olsupat Lodge' and public.site_content()->'settings'->>'whatsapp' = '+254 700 000 000',
  'visitors see the new price, logos in order and the contact details, but not the switched-off plan');
select pg_temp.expect(not (public.site_content()->'plans'->1->>'featured')::boolean, 'the old highlight moved to the switched-off plan');

-- checkout reads the price on the server
reset role; set role service_role;
select pg_temp.expect((public.site_checkout_plan('starter')->>'price_monthly_cents')::int = 8000
  and (public.site_checkout_plan('starter')->>'trial_days')::int = 7, 'checkout gets the live price and trial');
select pg_temp.expect(public.site_checkout_plan('pro') is null and public.site_checkout_plan('nope') is null, 'no checkout for switched-off or unknown plans');
reset role;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect((select count(*) from public.site_subscriptions) = 0, 'the admin can read subscriptions');
select pg_temp.expect_err($$insert into public.site_subscriptions (plan_slug, billing_interval, amount_cents) values ('starter', 'month', 1)$$, 'permission denied', 'the admin cannot fake a subscription');
reset role;
