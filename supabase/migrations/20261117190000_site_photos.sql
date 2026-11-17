-- Photo upload for the guest website (Online → Website, Setup, room types).
-- Public bucket "site-photos": anyone can view a photo by its link (it is on a public website anyway),
-- only owners and managers with "online.edit" can add, replace or remove photos, and only in their
-- own hotel's folder: <hotel_id>/<anything>. JPEG, PNG and WebP up to 5 MB (the app shrinks photos first).
-- SVG is not allowed: it can carry scripts.

create or replace function public.can_edit_site_photos(_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare _hotel uuid;
begin
  begin
    _hotel := split_part(coalesce(_name, ''), '/', 1)::uuid;
  exception when others then
    return false;
  end;
  return public.has_hotel_role(_hotel, array['owner', 'manager']::public.hotel_role[], 'online.edit');
end $$;
revoke execute on function public.can_edit_site_photos(text) from public, anon;
grant execute on function public.can_edit_site_photos(text) to authenticated;

-- Supabase only (the local test database has no storage schema).
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'No storage schema here: skipping the site-photos bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('site-photos', 'site-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists site_photos_read on storage.objects';
  execute 'drop policy if exists site_photos_insert on storage.objects';
  execute 'drop policy if exists site_photos_update on storage.objects';
  execute 'drop policy if exists site_photos_delete on storage.objects';
  -- Listing a hotel's photos (the files themselves are public by link).
  execute $p$create policy site_photos_read on storage.objects for select to authenticated
             using (bucket_id = 'site-photos' and public.can_edit_site_photos(name))$p$;
  execute $p$create policy site_photos_insert on storage.objects for insert to authenticated
             with check (bucket_id = 'site-photos' and public.can_edit_site_photos(name))$p$;
  execute $p$create policy site_photos_update on storage.objects for update to authenticated
             using (bucket_id = 'site-photos' and public.can_edit_site_photos(name))
             with check (bucket_id = 'site-photos' and public.can_edit_site_photos(name))$p$;
  execute $p$create policy site_photos_delete on storage.objects for delete to authenticated
             using (bucket_id = 'site-photos' and public.can_edit_site_photos(name))$p$;
end $$;
