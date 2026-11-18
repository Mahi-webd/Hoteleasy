-- WhatsApp: a guest whose chat was handed to staff can get the menu back.
-- After "Talk to staff" the bot stays quiet so it doesn't talk over the team. If the guest then writes
-- "menu", "hi", "hello" or "habari" and no staff member has replied in the last 30 minutes, the bot takes the
-- chat back and shows the menu. Runs after 20261117250000_whatsapp_diagnostics.sql.

create or replace function public.whatsapp_chat_state(_conversation_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('mode', c.mode, 'wa_id', c.wa_id, 'name', c.name,
    'menu_state', case when c.menu_state_at > now() - interval '30 minutes' then c.menu_state end,
    'last_guest_text', (select body from whatsapp_messages m where m.conversation_id = c.id and m.direction = 'in' order by m.created_at desc limit 1),
    'last_staff_at', (select max(created_at) from whatsapp_messages m where m.conversation_id = c.id and m.sender = 'staff'),
    'history', coalesce((select jsonb_agg(jsonb_build_object('sender', x.sender, 'body', x.body) order by x.created_at) from (
      select sender, body, created_at from whatsapp_messages
       where conversation_id = c.id and (direction = 'in' or status = 'sent') and created_at > now() - interval '3 days'
       order by created_at desc limit 16) x), '[]'::jsonb))
  from whatsapp_conversations c where c.id = _conversation_id
$$;

/** The bot takes a chat back from staff (the guest asked for the menu and nobody from the team is replying). */
create or replace function public.whatsapp_resume_bot(_conversation_id uuid)
returns void language sql security definer set search_path = public as $$
  update whatsapp_conversations set mode = 'bot', menu_state = null, menu_state_at = null where id = _conversation_id
$$;

revoke all on function public.whatsapp_chat_state(uuid), public.whatsapp_resume_bot(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_chat_state(uuid), public.whatsapp_resume_bot(uuid) to service_role;
