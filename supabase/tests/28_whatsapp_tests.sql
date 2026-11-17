\set ON_ERROR_STOP 1
-- Run after 00, all migrations and tests 01–27. WhatsApp: settings and secrets, inbox rights, reply-only rules.
create or replace function pg_temp.as_user(_id uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(_id::text,''), false);
  execute case when _id is null then 'set role anon' else 'set role authenticated' end; end $$;
create or replace function pg_temp.expect_fail(_sql text, _label text) returns void language plpgsql as $$
begin
  begin execute _sql; exception when others then raise notice 'PASS (blocked) %: %', _label, sqlerrm; return; end;
  raise exception 'FAIL: % was allowed', _label;
end $$;
create or replace function pg_temp.expect(_cond boolean, _label text) returns void language plpgsql as $$
begin if not coalesce(_cond, false) then raise exception 'FAIL: %', _label; end if; raise notice 'PASS %', _label; end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
reset role;
create temp table wctx as select id h from public.hotels where name='Olsupat Lodge';
grant select on wctx to authenticated, anon;

-- Owner connects the number
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_fail($$select public.whatsapp_settings_save((select h from wctx), true, true, '123456789012', null, null, null, null, null, 1000, true)$$, 'switch on without keys');
select public.whatsapp_settings_save((select h from wctx), true, true, '123456789012', '998877665544', '+254 700 000000', 'Ole', 'Airport pickup 3,000', null, 1000, true, 'EAAG-test-token', 'app-secret-test');
select pg_temp.expect((public.whatsapp_settings_get((select h from wctx))->>'ready')::boolean, 'ready with number id, token and secret');
select pg_temp.expect(public.whatsapp_settings_get((select h from wctx))->>'hook_key' is not null, 'owner sees the webhook address');
select pg_temp.expect(not (public.whatsapp_settings_get((select h from wctx)) ? 'access_token'), 'token is never sent back');
select pg_temp.expect_fail($$select * from whatsapp_credentials$$, 'reading WhatsApp secrets');
select pg_temp.expect_fail($$select * from whatsapp_settings$$, 'reading settings table directly');

-- Front desk: sees the inbox, not the setup
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect(public.whatsapp_settings_get((select h from wctx))->>'hook_key' is null, 'front desk does not see the webhook address');
select pg_temp.expect_fail($$select public.whatsapp_settings_save((select h from wctx), false, true, null, null, null, null, null, null, 1000, true)$$, 'front desk changing setup');

-- A guest writes (as the Edge Function)
reset role;
set role service_role;
create temp table wmsg as select public.whatsapp_inbound((select h from wctx), '254711000111', 'Amina', 'wamid.TEST1', 'Do you have a room on Friday?') j;
select pg_temp.expect((select (j->>'duplicate')::boolean from wmsg) = false, 'first message stored');
select pg_temp.expect((public.whatsapp_inbound((select h from wctx), '254711000111', 'Amina', 'wamid.TEST1', 'Do you have a room on Friday?')->>'duplicate')::boolean, 'Meta retry is ignored');
select public.whatsapp_outbound((select h from wctx), ((select j from wmsg)->>'conversation_id')::uuid, 'bot', 'Yes, we do.', 'wamid.OUT1', 'sent', null);
select pg_temp.expect(public.whatsapp_sent_this_month((select h from wctx)) = 1, 'sent replies are counted');
reset role;
grant select on wmsg to authenticated;

-- Front desk replies inside the 24-hour window
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect((select count(*) from whatsapp_messages where hotel_id = (select h from wctx)) = 2, 'front desk sees the conversation');
select pg_temp.expect((public.whatsapp_staff_reply_begin(((select j from wmsg)->>'conversation_id')::uuid, 'Hello Amina!')->>'to') = '254711000111', 'staff reply inside the window');

-- Outside the window: blocked
reset role;
update whatsapp_conversations set last_inbound_at = now() - interval '25 hours' where id = ((select j from wmsg)->>'conversation_id')::uuid;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_fail($$select public.whatsapp_staff_reply_begin(((select j from wmsg)->>'conversation_id')::uuid, 'Late reply')$$, 'reply after 24 hours (would be charged)');

-- Free limit reached: blocked
reset role;
update whatsapp_conversations set last_inbound_at = now() where id = ((select j from wmsg)->>'conversation_id')::uuid;
update whatsapp_settings set free_limit = 1 where hotel_id = (select h from wctx);
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_fail($$select public.whatsapp_staff_reply_begin(((select j from wmsg)->>'conversation_id')::uuid, 'One more')$$, 'reply over the free limit');

-- Nobody outside the hotel, and no anonymous visitor
select pg_temp.as_user(null);
select pg_temp.expect_fail($$select * from whatsapp_messages$$, 'anonymous reading messages');
select pg_temp.expect_fail($$select public.whatsapp_hook('x')$$, 'anonymous calling the webhook lookup');
reset role;
