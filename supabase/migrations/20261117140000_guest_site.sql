-- Guest website: more content for the public booking page (/book/<slug>).
-- A photo gallery for the hotel, up to three feature blocks (e.g. restaurant, pool, experiences)
-- and a photo gallery per room type. Photos are links to images already online (https only),
-- like the existing main photo.

create or replace function public.all_https(_urls text[])
returns boolean language sql immutable as $$
  select coalesce(bool_and(u ~* '^https://[^\s]+$'), true) from unnest(_urls) u
$$;

-- [{ "title": "...", "text": "...", "photo_url": "https://..." }], at most 3, title required
create or replace function public.valid_site_features(_f jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(_f) = 'array' and jsonb_array_length(_f) <= 3
     and coalesce((select bool_and(
           jsonb_typeof(x) = 'object'
           and length(trim(coalesce(x->>'title', ''))) between 1 and 80
           and length(coalesce(x->>'text', '')) <= 600
           and (x->>'photo_url' is null or x->>'photo_url' ~* '^https://[^\s]+$'))
         from jsonb_array_elements(_f) x), true)
$$;

alter table public.booking_settings add column if not exists gallery text[] not null default '{}';
alter table public.booking_settings add column if not exists features jsonb not null default '[]';
alter table public.room_types add column if not exists gallery text[] not null default '{}';

alter table public.booking_settings drop constraint if exists booking_settings_gallery_ok;
alter table public.booking_settings add constraint booking_settings_gallery_ok
  check (coalesce(array_length(gallery, 1), 0) <= 12 and public.all_https(gallery));
alter table public.booking_settings drop constraint if exists booking_settings_features_ok;
alter table public.booking_settings add constraint booking_settings_features_ok check (public.valid_site_features(features));
alter table public.room_types drop constraint if exists room_types_gallery_ok;
alter table public.room_types add constraint room_types_gallery_ok
  check (coalesce(array_length(gallery, 1), 0) <= 8 and public.all_https(gallery));

-- Same as before, plus gallery, features and each room type's gallery.
create or replace function public.public_hotel(_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _h hotels; _s booking_settings;
begin
  select s.* into _s from booking_settings s where s.slug = lower(trim(_slug)) and s.enabled;
  if not found then return null; end if;
  select * into _h from hotels where id = _s.hotel_id;
  return jsonb_build_object(
    'name', _h.name, 'city', _h.city, 'address', _h.address, 'country', _h.country, 'phone', _h.phone, 'email', _h.email,
    'currency', _h.currency, 'checkin_time', to_char(_h.checkin_time, 'HH24:MI'), 'checkout_time', to_char(_h.checkout_time, 'HH24:MI'),
    'prices_include_tax', _h.prices_include_vat, 'tax_rate', _h.vat_rate + _h.tourism_levy_rate,
    'today', (now() at time zone _h.timezone)::date,
    'headline', _s.headline, 'description', _s.description, 'photo_url', _s.photo_url, 'policies', _s.policies,
    'payment_instructions', _s.payment_instructions, 'whatsapp', _s.whatsapp, 'free_cancel_days', _s.free_cancel_days,
    'min_nights', _s.min_nights, 'max_nights', _s.max_nights, 'max_advance_days', _s.max_advance_days,
    'gallery', to_jsonb(_s.gallery), 'features', _s.features,
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
