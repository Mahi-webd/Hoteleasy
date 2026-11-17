-- Hotel website addresses, made safe for many hotels on one live system.
--
-- 1. Old addresses keep working. When a hotel changes its page address (slug), the old one is kept
--    and /book/<old> sends guests to /book/<new>. Another hotel can never take a hotel's old address,
--    so shared links, QR codes and emails never open the wrong hotel.
-- 2. Reserved addresses. Words the app or the platform uses (admin, api, demo, login…) can't be a
--    hotel's address. New hotels skip them automatically.
-- 3. Own domain. A hotel can have its own web address (e.g. lakesidelodge.co.ke); visiting it opens
--    that hotel's website. public_site_for_host() finds the hotel for a web address.
-- Runs after 20261117190000_site_photos.sql.

-- ---------------------------------------------------------------- reserved words
create or replace function public.is_reserved_slug(_s text)
returns boolean language sql immutable as $$
  select lower(coalesce(_s, '')) = any (array[
    'admin', 'api', 'app', 'assets', 'auth', 'billing', 'book', 'booking', 'checkin', 'dashboard', 'demo', 'docs',
    'feedback', 'help', 'hoteleasy', 'invoice', 'login', 'logout', 'mail', 'null', 'pricing', 'register',
    'reset-password', 'settings', 'signin', 'signup', 'static', 'stay', 'support', 'test', 'undefined', 'www'])
$$;

-- ---------------------------------------------------------------- old addresses
create table if not exists public.booking_slug_history (
  slug        text primary key,
  hotel_id    uuid not null references public.hotels(id) on delete cascade,
  changed_at  timestamptz not null default now()
);
create index if not exists booking_slug_history_hotel on public.booking_slug_history (hotel_id);
alter table public.booking_slug_history enable row level security;
revoke all on public.booking_slug_history from anon, authenticated;
grant select on public.booking_slug_history to authenticated;   -- staff see their own hotel's old addresses (policy below)
drop policy if exists bsh_sel on public.booking_slug_history;
create policy bsh_sel on public.booking_slug_history for select to authenticated using (public.is_hotel_member(hotel_id));

create or replace function public.booking_slug_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.slug := lower(trim(new.slug));
  if tg_op = 'UPDATE' and new.slug = old.slug then return new; end if;
  if public.is_reserved_slug(new.slug) then
    raise exception 'The address "%" is reserved. Please choose another one.', new.slug;
  end if;
  if exists (select 1 from booking_slug_history h where h.slug = new.slug and h.hotel_id <> new.hotel_id) then
    raise exception 'The address "%" was used by another hotel. Please choose another one.', new.slug;
  end if;
  if tg_op = 'UPDATE' then
    -- keep the old address for this hotel; going back to an old address of its own is fine
    insert into booking_slug_history (slug, hotel_id) values (old.slug, old.hotel_id)
    on conflict (slug) do update set hotel_id = excluded.hotel_id, changed_at = now();
    delete from booking_slug_history where slug = new.slug and hotel_id = new.hotel_id;
  end if;
  return new;
end $$;
drop trigger if exists t_booking_slug_guard on public.booking_settings;
create trigger t_booking_slug_guard before insert or update of slug on public.booking_settings
  for each row execute function public.booking_slug_guard();

-- New hotels: skip taken, reserved and other hotels' old addresses.
create or replace function public.booking_slug_for(_name text, _hotel_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare _base text; _s text; _i int := 1;
begin
  _base := trim(both '-' from regexp_replace(lower(coalesce(_name, 'hotel')), '[^a-z0-9]+', '-', 'g'));
  _base := left(coalesce(nullif(_base, ''), 'hotel'), 40);
  if length(_base) < 3 then _base := _base || '-hotel'; end if;
  _base := trim(both '-' from _base);
  _s := _base;
  while exists (select 1 from booking_settings where slug = _s and hotel_id <> _hotel_id)
     or exists (select 1 from booking_slug_history where slug = _s and hotel_id <> _hotel_id)
     or public.is_reserved_slug(_s) loop
    _i := _i + 1; _s := _base || '-' || _i;
  end loop;
  return _s;
end $$;
revoke execute on function public.booking_slug_for(text, uuid) from public, anon;
grant execute on function public.booking_slug_for(text, uuid) to authenticated;

-- ---------------------------------------------------------------- own domain
alter table public.booking_settings add column if not exists custom_domain text;
alter table public.booking_settings drop constraint if exists booking_settings_domain_ok;
alter table public.booking_settings add constraint booking_settings_domain_ok check (
  custom_domain is null or (
    length(custom_domain) between 4 and 253
    and custom_domain = lower(custom_domain)
    and custom_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
    and custom_domain !~ '^www\.'));
create unique index if not exists booking_settings_domain_unique on public.booking_settings (custom_domain) where custom_domain is not null;

create or replace function public.booking_domain_tidy()
returns trigger language plpgsql as $$
begin
  -- "https://www.Lodge.co.ke/" -> "lodge.co.ke"
  new.custom_domain := nullif(regexp_replace(regexp_replace(regexp_replace(lower(trim(coalesce(new.custom_domain, ''))),
    '^https?://', ''), '[/:].*$', ''), '^www\.', ''), '');
  return new;
end $$;
drop trigger if exists t_booking_domain_tidy on public.booking_settings;
create trigger t_booking_domain_tidy before insert or update of custom_domain on public.booking_settings
  for each row execute function public.booking_domain_tidy();

/** The page address of the hotel whose website lives at this web address (null when none). */
create or replace function public.public_site_for_host(_host text)
returns text language sql stable security definer set search_path = public as $$
  select s.slug from booking_settings s
   where s.enabled and s.custom_domain is not null
     and s.custom_domain = regexp_replace(split_part(lower(trim(coalesce(_host, ''))), ':', 1), '^www\.', '')
   limit 1
$$;
revoke execute on function public.public_site_for_host(text) from public;
grant execute on function public.public_site_for_host(text) to anon, authenticated;

-- ---------------------------------------------------------------- public page
-- Same as in 20261117160000_guest_site_settings.sql; an old address now answers {"redirect": "<new address>"}.
create or replace function public.public_hotel(_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _h hotels; _s booking_settings; _new text;
begin
  select s.* into _s from booking_settings s where s.slug = lower(trim(_slug)) and s.enabled;
  if not found then
    select s.slug into _new from booking_slug_history h join booking_settings s on s.hotel_id = h.hotel_id
     where h.slug = lower(trim(_slug)) and s.enabled;
    return case when _new is not null then jsonb_build_object('redirect', _new) end;
  end if;
  select * into _h from hotels where id = _s.hotel_id;
  return jsonb_build_object(
    'name', _h.name, 'city', _h.city, 'address', _h.address, 'country', _h.country, 'phone', _h.phone, 'email', _h.email,
    'currency', _h.currency, 'checkin_time', to_char(_h.checkin_time, 'HH24:MI'), 'checkout_time', to_char(_h.checkout_time, 'HH24:MI'),
    'prices_include_tax', _h.prices_include_vat, 'tax_rate', _h.vat_rate + _h.tourism_levy_rate,
    'today', (now() at time zone _h.timezone)::date,
    'headline', _s.headline, 'description', _s.description, 'photo_url', _s.photo_url, 'policies', _s.policies,
    'payment_instructions', _s.payment_instructions, 'whatsapp', _s.whatsapp, 'free_cancel_days', _s.free_cancel_days,
    'min_nights', _s.min_nights, 'max_nights', _s.max_nights, 'max_advance_days', _s.max_advance_days,
    'gallery', to_jsonb(_s.gallery), 'features', _s.features, 'site', _s.site,
    'room_types', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', t.id, 'name', t.name, 'description', t.description, 'max_occupancy', t.max_occupancy,
               'amenities', t.amenities, 'photo_url', t.photo_url, 'gallery', to_jsonb(t.gallery),
               'rate', coalesce(t.online_rate, t.base_rate))
             order by coalesce(t.online_rate, t.base_rate), t.name), '[]'::jsonb)
        from room_types t
       where t.hotel_id = _h.id and t.online_bookable
         and exists (select 1 from rooms r where r.room_type_id = t.id)),
    'reviews', case when _s.show_reviews then (
      select jsonb_build_object(
        'count', count(*), 'average', round(avg(f.overall), 1),
        'recent', coalesce((select jsonb_agg(x) from (
            select jsonb_build_object('name', f2.public_name, 'overall', f2.overall, 'comment', f2.comment,
                                      'month', to_char(f2.submitted_at, 'Mon YYYY'), 'response', f2.response) x
              from guest_feedback f2
             where f2.hotel_id = _h.id and f2.published and f2.consent_publish and f2.submitted_at is not null
             order by f2.submitted_at desc limit 6) r), '[]'::jsonb))
        from guest_feedback f where f.hotel_id = _h.id and f.submitted_at is not null) end
  );
end $$;
