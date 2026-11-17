-- WhatsApp setup help: remember the last call Meta made to each hotel's webhook and what happened,
-- so Setup can say "Meta reached us, but the app secret doesn't match" instead of leaving the owner guessing.
-- Runs after 20261117240000_whatsapp_menu.sql.

alter table public.whatsapp_settings add column if not exists last_hook_at timestamptz;
alter table public.whatsapp_settings add column if not exists last_hook_result text;      -- ok | bad_signature | no_secret | other_number | not_json | no_messages
alter table public.whatsapp_settings add column if not exists last_hook_detail text;      -- e.g. the phone number id Meta used

create or replace function public.whatsapp_hook_seen(_hook_key text, _result text, _detail text default null)
returns void language sql security definer set search_path = public as $$
  update whatsapp_settings set last_hook_at = now(), last_hook_result = left(_result, 40), last_hook_detail = left(_detail, 200)
   where hook_key = _hook_key
$$;
revoke all on function public.whatsapp_hook_seen(text, text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_hook_seen(text, text, text) to service_role;

create or replace function public.whatsapp_settings_get(_hotel_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.has_perm(_hotel_id, 'whatsapp.view') then jsonb_build_object(
    'enabled', coalesce(s.enabled, false), 'bot_enabled', coalesce(s.bot_enabled, true), 'bot_mode', coalesce(s.bot_mode, 'menu'),
    'phone_number_id', s.phone_number_id, 'waba_id', s.waba_id, 'display_number', s.display_number,
    'bot_name', s.bot_name, 'instructions', s.instructions, 'handoff_message', s.handoff_message,
    'free_limit', coalesce(s.free_limit, 1000), 'stop_at_free_limit', coalesce(s.stop_at_free_limit, true),
    'sent_this_month', public.whatsapp_sent_this_month(_hotel_id),
    'can_edit', public.has_perm(_hotel_id, 'whatsapp.edit'),
    'hook_key', case when public.has_perm(_hotel_id, 'whatsapp.edit') then s.hook_key end,
    'verify_token', case when public.has_perm(_hotel_id, 'whatsapp.edit') then s.verify_token end,
    'has_access_token', coalesce(c.access_token, '') <> '', 'has_app_secret', coalesce(c.app_secret, '') <> '',
    'ready', s.phone_number_id is not null and coalesce(c.access_token, '') <> '' and coalesce(c.app_secret, '') <> '',
    'last_hook_at', s.last_hook_at, 'last_hook_result', s.last_hook_result,
    'last_hook_detail', case when public.has_perm(_hotel_id, 'whatsapp.edit') then s.last_hook_detail end,
    'last_send_error', (select m.error from whatsapp_messages m where m.hotel_id = _hotel_id and m.direction = 'out' and m.status = 'failed'
                         and m.created_at > now() - interval '7 days' order by m.created_at desc limit 1))
  end
  from (select _hotel_id id) h left join whatsapp_settings s on s.hotel_id = h.id left join whatsapp_credentials c on c.hotel_id = h.id
$$;
