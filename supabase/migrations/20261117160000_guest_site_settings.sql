-- Guest website settings, managed by owners and managers in Online → Website.
-- One JSON document per hotel (booking_settings.site):
--   theme: lake | safari | coast | sand | custom      colors: { primary, accent, background } as #rrggbb (custom only)
--   heading_font: cormorant | marcellus | playfair | jost    logo_url
--   hero: { photos[] (≤6), tagline, waves }
--   sections: [{ key, on }] in page order (about, experiences, marquee, rooms, offers, book, gallery, reviews)
--   offers: [{ title, text, photo_url, from_date, to_date, min_nights, price, price_label }] (≤8)
--   marquee: [words] (≤8)    social: { instagram, facebook, tiktok, tripadvisor }
--   notice: { text, link }   seo: { title, description }
-- Every link must be https://. Runs after 20261117140000_guest_site.sql.

alter table public.booking_settings add column if not exists site jsonb not null default '{}';

create or replace function public.valid_site_settings(_j jsonb)
returns boolean language plpgsql immutable as $$
declare _u text; _o jsonb;
begin
  if jsonb_typeof(_j) <> 'object' or octet_length(_j::text) > 60000 then return false; end if;
  if _j ? 'theme' and coalesce(_j->>'theme', '') not in ('lake', 'safari', 'coast', 'sand', 'custom') then return false; end if;
  if _j ? 'heading_font' and coalesce(_j->>'heading_font', '') not in ('cormorant', 'marcellus', 'playfair', 'jost') then return false; end if;
  -- colours go into a style sheet: strictly #rrggbb
  for _u in select v #>> '{}' from jsonb_path_query(_j, '$.colors.*') v loop
    if _u is not null and _u !~ '^#[0-9a-fA-F]{6}$' then return false; end if;
  end loop;
  -- every link: https only
  for _u in
    select v #>> '{}' from jsonb_path_query(_j, '$.logo_url') v
    union all select v #>> '{}' from jsonb_path_query(_j, '$.hero.photos[*]') v
    union all select v #>> '{}' from jsonb_path_query(_j, '$.offers[*].photo_url') v
    union all select v #>> '{}' from jsonb_path_query(_j, '$.social.*') v
    union all select v #>> '{}' from jsonb_path_query(_j, '$.notice.link') v
  loop
    if _u is not null and _u <> '' and _u !~* '^https://[^\s"''<>]+$' then return false; end if;
  end loop;
  -- no script-style links anywhere
  if exists (select 1 from jsonb_path_query(_j, '$.**') v
              where jsonb_typeof(v) = 'string' and (v #>> '{}') ~* '^\s*(javascript|data|vbscript):') then return false; end if;
  if coalesce(jsonb_array_length(case when jsonb_typeof(_j->'hero'->'photos') = 'array' then _j->'hero'->'photos' end), 0) > 6 then return false; end if;
  if coalesce(jsonb_array_length(case when jsonb_typeof(_j->'marquee') = 'array' then _j->'marquee' end), 0) > 8 then return false; end if;
  if coalesce(jsonb_array_length(case when jsonb_typeof(_j->'offers') = 'array' then _j->'offers' end), 0) > 8 then return false; end if;
  for _o in select v from jsonb_path_query(_j, '$.offers[*]') v loop
    if jsonb_typeof(_o) <> 'object' or length(trim(coalesce(_o->>'title', ''))) not between 1 and 80 then return false; end if;
  end loop;
  return true;
exception when others then return false;  -- e.g. a date or number in the wrong shape
end $$;

alter table public.booking_settings drop constraint if exists booking_settings_site_ok;
alter table public.booking_settings add constraint booking_settings_site_ok check (public.valid_site_settings(site));

-- Same as in 20261117140000_guest_site.sql, plus 'site'.
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
