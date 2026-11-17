-- WhatsApp bot (Meta WhatsApp Business Platform, Cloud API), one WhatsApp number per hotel.
--
-- Guests write to the hotel's WhatsApp number; Meta sends the message to the Edge Function `whatsapp`
-- (…/functions/v1/whatsapp/<hook_key>, a separate address per hotel). The bot answers from that hotel's own
-- data only, or a staff member answers from the WhatsApp inbox in HotelEasy.
--
-- Reply-only, to keep Meta charges at zero where possible: HotelEasy never starts a conversation and never
-- sends templates. It only answers inside the 24-hour window that opens when the guest writes. Meta gives each
-- business number 1,000 free replies ("service messages") a month (from 1 Oct 2026); the hotel can stop the
-- bot at that limit so the bill stays at zero. Unused free replies don't carry over.
--
-- Secrets (access token, app secret) live in whatsapp_credentials, which the app can never read; only the
-- Edge Function (service role) uses them.

insert into public.permission_catalog (key, module, module_label, action, label, sort, default_roles, added_at) values
  ('whatsapp.view', 'whatsapp', 'WhatsApp', 'view', 'See WhatsApp conversations with guests', 69, array['owner','manager','front_desk'], now()),
  ('whatsapp.reply', 'whatsapp', 'WhatsApp', 'reply', 'Reply to guests on WhatsApp and take over from the bot', 70, array['owner','manager','front_desk'], now()),
  ('whatsapp.edit', 'whatsapp', 'WhatsApp', 'edit', 'Connect the WhatsApp number and set up the bot', 71, array['owner','manager'], now())
on conflict (key) do nothing;

-- ---------------------------------------------------------------- settings (no secrets)
create table if not exists public.whatsapp_settings (
  hotel_id           uuid primary key references public.hotels(id) on delete cascade,
  enabled            boolean not null default false,
  bot_enabled        boolean not null default true,
  phone_number_id    text unique check (phone_number_id is null or phone_number_id ~ '^[0-9]{6,25}$'),
  waba_id            text check (waba_id is null or waba_id ~ '^[0-9]{6,25}$'),
  display_number     text,
  hook_key           text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  verify_token       text not null default replace(gen_random_uuid()::text, '-', ''),
  bot_name           text check (bot_name is null or length(bot_name) <= 40),
  instructions       text check (instructions is null or length(instructions) <= 4000),   -- extra facts for the bot
  handoff_message    text check (handoff_message is null or length(handoff_message) <= 500),
  free_limit         int not null default 1000 check (free_limit between 0 and 100000),
  stop_at_free_limit boolean not null default true,
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);
alter table public.whatsapp_settings enable row level security;
revoke all on public.whatsapp_settings from anon, authenticated;   -- read through whatsapp_settings_get()

create table if not exists public.whatsapp_credentials (
  hotel_id      uuid primary key references public.hotels(id) on delete cascade,
  access_token  text,
  app_secret    text,
  updated_at    timestamptz not null default now()
);
alter table public.whatsapp_credentials enable row level security;
revoke all on public.whatsapp_credentials from anon, authenticated;

-- ---------------------------------------------------------------- inbox
create table if not exists public.whatsapp_conversations (
  id               uuid primary key default gen_random_uuid(),
  hotel_id         uuid not null references public.hotels(id) on delete cascade,
  wa_id            text not null check (wa_id ~ '^[0-9]{6,20}$'),     -- guest's WhatsApp number, digits only
  name             text,
  mode             text not null default 'bot' check (mode in ('bot', 'staff')),
  unread           int not null default 0,
  last_inbound_at  timestamptz,
  last_message_at  timestamptz not null default now(),
  last_preview     text,
  created_at       timestamptz not null default now(),
  unique (hotel_id, wa_id)
);
create index if not exists whatsapp_conversations_hotel on public.whatsapp_conversations (hotel_id, last_message_at desc);

create table if not exists public.whatsapp_messages (
  id               uuid primary key default gen_random_uuid(),
  hotel_id         uuid not null references public.hotels(id) on delete cascade,
  conversation_id  uuid not null references public.whatsapp_conversations(id) on delete cascade,
  direction        text not null check (direction in ('in', 'out')),
  sender           text not null check (sender in ('guest', 'bot', 'staff')),
  body             text not null,
  wa_message_id    text unique,                 -- Meta's id: the same guest message is never handled twice
  status           text not null default 'received' check (status in ('received', 'pending', 'sent', 'failed')),
  error            text,
  staff_id         uuid,
  created_at       timestamptz not null default now()
);
create index if not exists whatsapp_messages_conv on public.whatsapp_messages (conversation_id, created_at);
create index if not exists whatsapp_messages_month on public.whatsapp_messages (hotel_id, created_at) where direction = 'out' and status = 'sent';

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
revoke all on public.whatsapp_conversations, public.whatsapp_messages from anon, authenticated;
grant select on public.whatsapp_conversations, public.whatsapp_messages to authenticated;
drop policy if exists wac_sel on public.whatsapp_conversations;
create policy wac_sel on public.whatsapp_conversations for select to authenticated using (public.has_perm(hotel_id, 'whatsapp.view'));
drop policy if exists wam_sel on public.whatsapp_messages;
create policy wam_sel on public.whatsapp_messages for select to authenticated using (public.has_perm(hotel_id, 'whatsapp.view'));

-- ---------------------------------------------------------------- free replies this month
/** Replies sent this calendar month (hotel time); Meta's free tier is per number per month. */
create or replace function public.whatsapp_sent_this_month(_hotel_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from whatsapp_messages m join hotels h on h.id = m.hotel_id
   where m.hotel_id = _hotel_id and m.direction = 'out' and m.status = 'sent'
     and m.created_at >= (date_trunc('month', now() at time zone h.timezone) at time zone h.timezone)
$$;
revoke execute on function public.whatsapp_sent_this_month(uuid) from public, anon;
grant execute on function public.whatsapp_sent_this_month(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- settings: owners and managers
create or replace function public.whatsapp_settings_get(_hotel_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.has_perm(_hotel_id, 'whatsapp.view') then jsonb_build_object(
    'enabled', coalesce(s.enabled, false), 'bot_enabled', coalesce(s.bot_enabled, true),
    'phone_number_id', s.phone_number_id, 'waba_id', s.waba_id, 'display_number', s.display_number,
    'bot_name', s.bot_name, 'instructions', s.instructions, 'handoff_message', s.handoff_message,
    'free_limit', coalesce(s.free_limit, 1000), 'stop_at_free_limit', coalesce(s.stop_at_free_limit, true),
    'sent_this_month', public.whatsapp_sent_this_month(_hotel_id),
    'can_edit', public.has_perm(_hotel_id, 'whatsapp.edit'),
    -- what to paste into Meta: only for people who may set it up
    'hook_key', case when public.has_perm(_hotel_id, 'whatsapp.edit') then s.hook_key end,
    'verify_token', case when public.has_perm(_hotel_id, 'whatsapp.edit') then s.verify_token end,
    'has_access_token', coalesce(c.access_token, '') <> '', 'has_app_secret', coalesce(c.app_secret, '') <> '',
    'ready', s.phone_number_id is not null and coalesce(c.access_token, '') <> '' and coalesce(c.app_secret, '') <> '')
  end
  from (select _hotel_id id) h left join whatsapp_settings s on s.hotel_id = h.id left join whatsapp_credentials c on c.hotel_id = h.id
$$;

create or replace function public.whatsapp_settings_save(_hotel_id uuid, _enabled boolean, _bot_enabled boolean,
  _phone_number_id text, _waba_id text, _display_number text, _bot_name text, _instructions text, _handoff_message text,
  _free_limit int, _stop_at_free_limit boolean, _access_token text default null, _app_secret text default null)
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
  insert into whatsapp_settings (hotel_id) values (_hotel_id) on conflict do nothing;
  update whatsapp_settings set
    enabled = coalesce(_enabled, false), bot_enabled = coalesce(_bot_enabled, true),
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

/** A new webhook address and verify token (e.g. if they were shared by mistake). Meta must be updated after. */
create or replace function public.whatsapp_new_hook(_hotel_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm(_hotel_id, 'whatsapp.edit') then raise exception 'Only an owner or manager can do this'; end if;
  insert into whatsapp_settings (hotel_id) values (_hotel_id) on conflict do nothing;
  update whatsapp_settings set hook_key = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    verify_token = replace(gen_random_uuid()::text, '-', ''), updated_at = now(), updated_by = auth.uid()
  where hotel_id = _hotel_id;
  return whatsapp_settings_get(_hotel_id);
end $$;

grant execute on function public.whatsapp_settings_get(uuid),
  public.whatsapp_settings_save(uuid, boolean, boolean, text, text, text, text, text, text, int, boolean, text, text),
  public.whatsapp_new_hook(uuid) to authenticated;

-- ---------------------------------------------------------------- inbox actions (staff)
create or replace function public.whatsapp_set_mode(_conversation_id uuid, _mode text)
returns void language plpgsql security definer set search_path = public as $$
declare _h uuid;
begin
  select hotel_id into _h from whatsapp_conversations where id = _conversation_id;
  if _h is null or not public.has_perm(_h, 'whatsapp.reply') then raise exception 'You can''t change this conversation'; end if;
  if _mode not in ('bot', 'staff') then raise exception 'Unknown mode'; end if;
  update whatsapp_conversations set mode = _mode where id = _conversation_id;
end $$;

create or replace function public.whatsapp_mark_read(_conversation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _h uuid;
begin
  select hotel_id into _h from whatsapp_conversations where id = _conversation_id;
  if _h is null or not public.has_perm(_h, 'whatsapp.view') then return; end if;
  update whatsapp_conversations set unread = 0 where id = _conversation_id;
end $$;

/**
 * A staff reply, step 1 (called by the Edge Function as the signed-in staff member): checks the rights,
 * the 24-hour window and the free limit, and records the message as pending. The function then sends it.
 */
create or replace function public.whatsapp_staff_reply_begin(_conversation_id uuid, _body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _c whatsapp_conversations; _s whatsapp_settings; _id uuid;
begin
  select * into _c from whatsapp_conversations where id = _conversation_id;
  if _c.id is null or not public.has_perm(_c.hotel_id, 'whatsapp.reply') then raise exception 'You can''t reply in this conversation'; end if;
  select * into _s from whatsapp_settings where hotel_id = _c.hotel_id;
  if not coalesce(_s.enabled, false) then raise exception 'WhatsApp is switched off for this hotel'; end if;
  _body := btrim(coalesce(_body, ''));
  if _body = '' then raise exception 'Write a message first'; end if;
  if length(_body) > 4000 then raise exception 'The message is too long (4,000 characters at most)'; end if;
  if _c.last_inbound_at is null or _c.last_inbound_at < now() - interval '24 hours' then
    raise exception 'WINDOW: More than 24 hours since the guest last wrote. WhatsApp only allows a free reply after the guest writes again.';
  end if;
  if _s.stop_at_free_limit and public.whatsapp_sent_this_month(_c.hotel_id) >= _s.free_limit then
    raise exception 'WINDOW: This month''s % free replies are used up. Switch off "Stop at the free limit" in WhatsApp setup to keep replying (Meta then charges per message).', _s.free_limit;
  end if;
  insert into whatsapp_messages (hotel_id, conversation_id, direction, sender, body, status, staff_id)
  values (_c.hotel_id, _c.id, 'out', 'staff', _body, 'pending', auth.uid()) returning id into _id;
  update whatsapp_conversations set mode = 'staff', unread = 0, last_message_at = now(), last_preview = left(_body, 120) where id = _c.id;
  return jsonb_build_object('message_id', _id, 'hotel_id', _c.hotel_id, 'to', _c.wa_id);
end $$;
grant execute on function public.whatsapp_set_mode(uuid, text), public.whatsapp_mark_read(uuid), public.whatsapp_staff_reply_begin(uuid, text) to authenticated;

-- ---------------------------------------------------------------- Edge Function only (service role)
/** Everything the webhook needs for one hotel, found by the secret part of its webhook address. */
create or replace function public.whatsapp_hook(_hook_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'hotel_id', s.hotel_id, 'enabled', s.enabled, 'bot_enabled', s.bot_enabled, 'phone_number_id', s.phone_number_id,
    'verify_token', s.verify_token, 'app_secret', c.app_secret, 'access_token', c.access_token,
    'bot_name', s.bot_name, 'instructions', s.instructions, 'handoff_message', s.handoff_message,
    'free_limit', s.free_limit, 'stop_at_free_limit', s.stop_at_free_limit,
    'sent_this_month', public.whatsapp_sent_this_month(s.hotel_id),
    'slug', (select b.slug from booking_settings b where b.hotel_id = s.hotel_id and b.enabled),
    'hotel_name', (select name from hotels where id = s.hotel_id))
  from whatsapp_settings s left join whatsapp_credentials c on c.hotel_id = s.hotel_id
  where s.hook_key = _hook_key
$$;

create or replace function public.whatsapp_hotel_send(_hotel_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('phone_number_id', s.phone_number_id, 'access_token', c.access_token, 'enabled', s.enabled)
  from whatsapp_settings s join whatsapp_credentials c on c.hotel_id = s.hotel_id where s.hotel_id = _hotel_id
$$;

/** A guest's message. Returns the conversation and recent history, or duplicate=true if Meta sent it twice. */
create or replace function public.whatsapp_inbound(_hotel_id uuid, _wa_id text, _name text, _wa_message_id text, _body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _c whatsapp_conversations; _mid uuid;
begin
  if exists (select 1 from whatsapp_messages where wa_message_id = _wa_message_id) then
    return jsonb_build_object('duplicate', true);
  end if;
  insert into whatsapp_conversations (hotel_id, wa_id, name) values (_hotel_id, _wa_id, nullif(btrim(_name), ''))
  on conflict (hotel_id, wa_id) do update set name = coalesce(nullif(btrim(excluded.name), ''), whatsapp_conversations.name)
  returning * into _c;
  insert into whatsapp_messages (hotel_id, conversation_id, direction, sender, body, wa_message_id, status)
  values (_hotel_id, _c.id, 'in', 'guest', left(coalesce(_body, ''), 4000), _wa_message_id, 'received') returning id into _mid;
  update whatsapp_conversations set unread = unread + 1, last_inbound_at = now(), last_message_at = now(),
    last_preview = left(coalesce(_body, ''), 120) where id = _c.id returning * into _c;
  return jsonb_build_object('duplicate', false, 'conversation_id', _c.id, 'message_id', _mid, 'mode', _c.mode,
    'history', coalesce((select jsonb_agg(jsonb_build_object('sender', x.sender, 'body', x.body) order by x.created_at) from (
      select sender, body, created_at from whatsapp_messages
       where conversation_id = _c.id and (direction = 'in' or status = 'sent') and created_at > now() - interval '3 days'
       order by created_at desc limit 16) x), '[]'::jsonb));
end $$;

/** True while this is still the guest's newest message (several quick messages get one reply). */
create or replace function public.whatsapp_is_latest(_conversation_id uuid, _message_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from whatsapp_messages m where m.conversation_id = _conversation_id and m.direction = 'in'
                       and m.created_at > (select created_at from whatsapp_messages where id = _message_id))
$$;

/** History for the bot after a pause (all messages since, so a burst of messages is answered together). */
create or replace function public.whatsapp_history(_conversation_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('mode', (select mode from whatsapp_conversations where id = _conversation_id),
    'history', coalesce((select jsonb_agg(jsonb_build_object('sender', x.sender, 'body', x.body) order by x.created_at) from (
      select sender, body, created_at from whatsapp_messages
       where conversation_id = _conversation_id and (direction = 'in' or status = 'sent') and created_at > now() - interval '3 days'
       order by created_at desc limit 16) x), '[]'::jsonb))
$$;

create or replace function public.whatsapp_outbound(_hotel_id uuid, _conversation_id uuid, _sender text, _body text,
  _wa_message_id text, _status text, _error text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  insert into whatsapp_messages (hotel_id, conversation_id, direction, sender, body, wa_message_id, status, error)
  values (_hotel_id, _conversation_id, 'out', _sender, left(_body, 4000), _wa_message_id, _status, left(_error, 500)) returning id into _id;
  update whatsapp_conversations set last_message_at = now(), last_preview = left(_body, 120) where id = _conversation_id;
  return _id;
end $$;

create or replace function public.whatsapp_mark_sent(_message_id uuid, _wa_message_id text, _ok boolean, _error text)
returns void language sql security definer set search_path = public as $$
  update whatsapp_messages set status = case when _ok then 'sent' else 'failed' end, wa_message_id = _wa_message_id, error = left(_error, 500)
   where id = _message_id
$$;

/** The bot hands the conversation to staff (the guest asked for a person, or the bot can't help). */
create or replace function public.whatsapp_handoff(_conversation_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare _c whatsapp_conversations;
begin
  update whatsapp_conversations set mode = 'staff' where id = _conversation_id returning * into _c;
  if _c.id is not null then
    perform log_activity(_c.hotel_id, 'whatsapp', 'WhatsApp: ' || coalesce(_c.name, '+' || _c.wa_id) || ' needs a person' ||
      coalesce(' (' || left(nullif(btrim(_reason), ''), 120) || ')', ''));
  end if;
end $$;

revoke all on function public.whatsapp_hook(text), public.whatsapp_hotel_send(uuid),
  public.whatsapp_inbound(uuid, text, text, text, text), public.whatsapp_is_latest(uuid, uuid), public.whatsapp_history(uuid),
  public.whatsapp_outbound(uuid, uuid, text, text, text, text, text), public.whatsapp_mark_sent(uuid, text, boolean, text),
  public.whatsapp_handoff(uuid, text) from public, anon, authenticated;
grant execute on function public.whatsapp_hook(text), public.whatsapp_hotel_send(uuid),
  public.whatsapp_inbound(uuid, text, text, text, text), public.whatsapp_is_latest(uuid, uuid), public.whatsapp_history(uuid),
  public.whatsapp_outbound(uuid, uuid, text, text, text, text, text), public.whatsapp_mark_sent(uuid, text, boolean, text),
  public.whatsapp_handoff(uuid, text) to service_role;

-- live inbox
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.whatsapp_conversations'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.whatsapp_messages'; exception when duplicate_object then null; end;
  end if;
end $$;
