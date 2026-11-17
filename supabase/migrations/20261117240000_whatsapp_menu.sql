-- WhatsApp: a free menu bot (no AI) as the default, the AI bot as an option per hotel.
-- Menu bot: buttons and a short menu (rooms & prices, check availability, my booking, location & contact,
-- talk to staff), answered only from HotelEasy's data. Needs no Anthropic key. Runs after 20261117230000_whatsapp.sql.

alter table public.whatsapp_settings add column if not exists bot_mode text not null default 'menu';
alter table public.whatsapp_settings drop constraint if exists whatsapp_settings_bot_mode_ok;
alter table public.whatsapp_settings add constraint whatsapp_settings_bot_mode_ok check (bot_mode in ('menu', 'ai'));

-- what the menu bot is waiting for in a chat (dates for availability, a booking code), for 30 minutes
alter table public.whatsapp_conversations add column if not exists menu_state text check (menu_state in ('avail', 'booking'));
alter table public.whatsapp_conversations add column if not exists menu_state_at timestamptz;

-- ---------------------------------------------------------------- settings (now with bot_mode)
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
    'ready', s.phone_number_id is not null and coalesce(c.access_token, '') <> '' and coalesce(c.app_secret, '') <> '')
  end
  from (select _hotel_id id) h left join whatsapp_settings s on s.hotel_id = h.id left join whatsapp_credentials c on c.hotel_id = h.id
$$;

drop function if exists public.whatsapp_settings_save(uuid, boolean, boolean, text, text, text, text, text, text, int, boolean, text, text);
create or replace function public.whatsapp_settings_save(_hotel_id uuid, _enabled boolean, _bot_enabled boolean,
  _phone_number_id text, _waba_id text, _display_number text, _bot_name text, _instructions text, _handoff_message text,
  _free_limit int, _stop_at_free_limit boolean, _access_token text default null, _app_secret text default null, _bot_mode text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _ready boolean;
begin
  if not public.has_perm(_hotel_id, 'whatsapp.edit') then raise exception 'Only an owner or manager can set up WhatsApp'; end if;
  _phone_number_id := nullif(regexp_replace(coalesce(_phone_number_id, ''), '\s', '', 'g'), '');
  _waba_id := nullif(regexp_replace(coalesce(_waba_id, ''), '\s', '', 'g'), '');
  if _phone_number_id is not null and _phone_number_id !~ '^[0-9]{6,25}$' then
    raise exception 'The Phone number ID is the long number from Meta (WhatsApp → API Setup), digits only';
  end if;
  if exists (select 1 from whatsapp_settings where phone_number_id = _phone_number_id and hotel_id <> _hotel_id) then
    raise exception 'This WhatsApp number is already connected to another hotel';
  end if;
  if _bot_mode is not null and _bot_mode not in ('menu', 'ai') then raise exception 'Unknown bot type'; end if;
  insert into whatsapp_settings (hotel_id) values (_hotel_id) on conflict do nothing;
  update whatsapp_settings set
    enabled = coalesce(_enabled, false), bot_enabled = coalesce(_bot_enabled, true), bot_mode = coalesce(_bot_mode, bot_mode),
    phone_number_id = _phone_number_id, waba_id = _waba_id, display_number = nullif(btrim(_display_number), ''),
    bot_name = nullif(btrim(_bot_name), ''), instructions = nullif(btrim(_instructions), ''),
    handoff_message = nullif(btrim(_handoff_message), ''),
    free_limit = greatest(0, coalesce(_free_limit, 1000)), stop_at_free_limit = coalesce(_stop_at_free_limit, true),
    updated_at = now(), updated_by = auth.uid()
  where hotel_id = _hotel_id;
  insert into whatsapp_credentials (hotel_id) values (_hotel_id) on conflict do nothing;
  update whatsapp_credentials set
    access_token = coalesce(nullif(btrim(_access_token), ''), access_token),
    app_secret = coalesce(nullif(btrim(_app_secret), ''), app_secret),
    updated_at = now()
  where hotel_id = _hotel_id;
  select _phone_number_id is not null and coalesce(c.access_token, '') <> '' and coalesce(c.app_secret, '') <> '' into _ready
    from whatsapp_credentials c where c.hotel_id = _hotel_id;
  if _enabled and not coalesce(_ready, false) then
    raise exception 'To switch WhatsApp on, fill in the Phone number ID, access token and app secret';
  end if;
  perform log_activity(_hotel_id, 'settings', case when _enabled then 'WhatsApp switched on' else 'WhatsApp settings saved' end);
  return whatsapp_settings_get(_hotel_id);
end $$;
grant execute on function public.whatsapp_settings_save(uuid, boolean, boolean, text, text, text, text, text, text, int, boolean, text, text, text) to authenticated;

-- ---------------------------------------------------------------- Edge Function only
create or replace function public.whatsapp_hook(_hook_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'hotel_id', s.hotel_id, 'enabled', s.enabled, 'bot_enabled', s.bot_enabled, 'bot_mode', s.bot_mode,
    'phone_number_id', s.phone_number_id, 'verify_token', s.verify_token, 'app_secret', c.app_secret, 'access_token', c.access_token,
    'bot_name', s.bot_name, 'instructions', s.instructions, 'handoff_message', s.handoff_message,
    'free_limit', s.free_limit, 'stop_at_free_limit', s.stop_at_free_limit,
    'sent_this_month', public.whatsapp_sent_this_month(s.hotel_id),
    'slug', (select b.slug from booking_settings b where b.hotel_id = s.hotel_id and b.enabled),
    'hotel_name', (select name from hotels where id = s.hotel_id))
  from whatsapp_settings s left join whatsapp_credentials c on c.hotel_id = s.hotel_id
  where s.hook_key = _hook_key
$$;

/** The chat's mode, the menu step it's on (if recent), the guest's number and their newest message. */
create or replace function public.whatsapp_chat_state(_conversation_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('mode', c.mode, 'wa_id', c.wa_id, 'name', c.name,
    'menu_state', case when c.menu_state_at > now() - interval '30 minutes' then c.menu_state end,
    'last_guest_text', (select body from whatsapp_messages m where m.conversation_id = c.id and m.direction = 'in' order by m.created_at desc limit 1),
    'history', coalesce((select jsonb_agg(jsonb_build_object('sender', x.sender, 'body', x.body) order by x.created_at) from (
      select sender, body, created_at from whatsapp_messages
       where conversation_id = c.id and (direction = 'in' or status = 'sent') and created_at > now() - interval '3 days'
       order by created_at desc limit 16) x), '[]'::jsonb))
  from whatsapp_conversations c where c.id = _conversation_id
$$;

create or replace function public.whatsapp_set_menu_state(_conversation_id uuid, _state text)
returns void language sql security definer set search_path = public as $$
  update whatsapp_conversations set menu_state = _state, menu_state_at = case when _state is null then null else now() end
   where id = _conversation_id
$$;

/** Current and upcoming bookings of the guest writing from this WhatsApp number (matched on the guest's phone). */
create or replace function public.whatsapp_my_bookings(_hotel_id uuid, _wa_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'check_in'), '[]'::jsonb) from (
    select jsonb_build_object('code', r.code, 'status', r.status, 'room_type', t.name, 'room', rm.room_number,
      'check_in', r.check_in, 'check_out', r.check_out, 'nights', r.nights, 'total', r.total_amount, 'currency', h.currency,
      'guest', trim(g.first_name || ' ' || g.last_name)) x
      from reservations r join guests g on g.id = r.guest_id join hotels h on h.id = r.hotel_id
      left join room_types t on t.id = r.room_type_id left join rooms rm on rm.id = r.room_id
     where r.hotel_id = _hotel_id and r.status in ('confirmed', 'checked_in')
       and r.check_out >= (now() at time zone h.timezone)::date
       and length(coalesce(_wa_id, '')) >= 9
       and (public.mpesa_phone(g.phone) = _wa_id or regexp_replace(coalesce(g.phone, ''), '[^0-9]', '', 'g') = _wa_id)
     order by r.check_in limit 3) b
$$;

revoke all on function public.whatsapp_hook(text), public.whatsapp_chat_state(uuid), public.whatsapp_set_menu_state(uuid, text),
  public.whatsapp_my_bookings(uuid, text) from public, anon, authenticated;
grant execute on function public.whatsapp_hook(text), public.whatsapp_chat_state(uuid), public.whatsapp_set_menu_state(uuid, text),
  public.whatsapp_my_bookings(uuid, text) to service_role;
-- public_booking (code + last name) is already open to the Edge Function's service role.
