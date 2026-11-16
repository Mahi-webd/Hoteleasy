-- "Ask HotelEasy": an assistant that explains how to use HotelEasy, from the in-app guides.
-- The Edge Function `assistant` calls Claude; this file keeps the log, the limits and the feedback.

create table if not exists public.assistant_log (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  screen text,
  question text not null,
  answer text,
  input_tokens int,
  output_tokens int,
  helpful boolean,
  created_at timestamptz not null default now()
);
create index if not exists assistant_log_hotel on public.assistant_log (hotel_id, created_at desc);
create index if not exists assistant_log_user on public.assistant_log (user_id, created_at desc);
alter table public.assistant_log enable row level security;
-- people see their own questions; owners and managers see their hotel's (to spot what needs training)
drop policy if exists al_sel on public.assistant_log;
create policy al_sel on public.assistant_log for select to authenticated using (
  user_id = auth.uid() or public.has_hotel_role(hotel_id, array['owner','manager']::hotel_role[], 'settings.edit'));
grant select on public.assistant_log to authenticated;

alter table public.hotels add column if not exists assistant_enabled boolean not null default true;

-- Called by the Edge Function with the user's login: may they ask now? Returns who they are, for the answer.
create or replace function public.assistant_begin(_hotel_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _p jsonb; _n_user int; _n_hotel int; _name text; _h hotels;
begin
  if not is_hotel_member(_hotel_id) then raise exception 'Not a member of this hotel'; end if;
  select * into _h from hotels where id = _hotel_id;
  if not _h.assistant_enabled then return jsonb_build_object('ok', false, 'message', 'The assistant is switched off for this hotel.'); end if;
  select count(*) into _n_user from assistant_log where user_id = auth.uid() and created_at > now() - interval '1 hour';
  if _n_user >= 40 then return jsonb_build_object('ok', false, 'message', 'That''s a lot of questions this hour. Please try again a little later, or open Guides.'); end if;
  select count(*) into _n_hotel from assistant_log where hotel_id = _hotel_id and created_at > now() - interval '1 day';
  if _n_hotel >= 1000 then return jsonb_build_object('ok', false, 'message', 'Your hotel has reached today''s limit of questions. Guides still work.'); end if;
  _p := my_permissions(_hotel_id);
  select coalesce(nullif(split_part(full_name, ' ', 1), ''), 'there') into _name from profiles where id = auth.uid();
  return jsonb_build_object('ok', true, 'hotel', _h.name, 'currency', _h.currency, 'first_name', coalesce(_name, 'there'),
    'role', _p->>'role', 'custom_role', _p->>'custom_role_name', 'permissions', _p->'permissions');
end $$;
grant execute on function public.assistant_begin(uuid) to authenticated;

-- The Edge Function records each answer (service role)
create or replace function public.assistant_record(_hotel_id uuid, _user_id uuid, _screen text, _question text, _answer text,
  _input_tokens int, _output_tokens int) returns uuid language sql security definer set search_path = public as $$
  insert into assistant_log (hotel_id, user_id, screen, question, answer, input_tokens, output_tokens)
  values (_hotel_id, _user_id, left(_screen, 40), left(_question, 2000), left(_answer, 8000), _input_tokens, _output_tokens)
  returning id;
$$;
revoke all on function public.assistant_record(uuid, uuid, text, text, text, int, int) from public, anon, authenticated;
grant execute on function public.assistant_record(uuid, uuid, text, text, text, int, int) to service_role;

-- 👍 / 👎 on an answer (own answers only)
create or replace function public.assistant_feedback(_id uuid, _helpful boolean) returns void language sql security definer set search_path = public as $$
  update assistant_log set helpful = _helpful where id = _id and user_id = auth.uid();
$$;
grant execute on function public.assistant_feedback(uuid, boolean) to authenticated;
