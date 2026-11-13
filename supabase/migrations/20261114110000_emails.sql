-- =====================================================================
-- HotelEasy: booking emails
--  * confirmation, pre-arrival (with the online check-in link), thank-you
--    (with the feedback link) and cancellation emails, queued in
--    email_outbox by triggers on reservations
--  * emails are written at send time from current data (email_render)
--  * the send-emails Edge Function (supabase/functions/send-emails) claims
--    due emails with the service role, sends them through Resend and
--    reports back; pg_cron calls it every two minutes
-- =====================================================================

create table public.email_settings (
  hotel_id              uuid primary key references public.hotels(id) on delete cascade,
  enabled               boolean not null default false,
  app_url               text not null default 'https://hoteleasy.vercel.app' check (app_url ~ '^https?://[^ ]+$'),
  from_name             text check (from_name is null or length(from_name) <= 80),
  reply_to              text check (reply_to is null or reply_to ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  send_confirmation     boolean not null default true,
  send_prearrival       boolean not null default true,
  prearrival_days       int not null default 2 check (prearrival_days between 1 and 14),
  send_thankyou         boolean not null default true,
  send_cancellation     boolean not null default true,
  confirmation_note     text check (confirmation_note is null or length(confirmation_note) <= 2000),
  prearrival_note       text check (prearrival_note is null or length(prearrival_note) <= 2000),
  updated_at            timestamptz not null default now()
);
create trigger t_email_settings_upd before update on public.email_settings for each row execute function public.touch_updated_at();
insert into public.email_settings (hotel_id) select id from public.hotels on conflict do nothing;
create or replace function public.hotels_email_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin insert into email_settings (hotel_id) values (new.id) on conflict do nothing; return new; end $$;
create trigger hotels_email_defaults after insert on public.hotels for each row execute function public.hotels_email_defaults();

alter table public.email_settings enable row level security;
revoke all on public.email_settings from anon;
create policy es_sel on public.email_settings for select to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk']::public.hotel_role[]));
create policy es_upd on public.email_settings for update to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]))
  with check (public.has_hotel_role(hotel_id, array['owner','manager']::public.hotel_role[]));

create table public.email_outbox (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        uuid not null references public.hotels(id) on delete cascade,
  reservation_id  uuid references public.reservations(id) on delete cascade,
  kind            text not null check (kind in ('confirmation', 'prearrival', 'thankyou', 'cancellation', 'test')),
  to_email        text,
  subject         text,
  send_after      timestamptz not null default now(),
  status          text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped', 'cancelled')),
  attempts        int not null default 0,
  last_error      text,
  provider_id     text,
  claimed_at      timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);
create unique index email_outbox_one_per_kind on public.email_outbox (reservation_id, kind) where kind <> 'test';
create index email_outbox_due on public.email_outbox (status, send_after);
create index on public.email_outbox (hotel_id, created_at desc);

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon;
create policy eo_sel on public.email_outbox for select to authenticated
  using (public.has_hotel_role(hotel_id, array['owner','manager','front_desk']::public.hotel_role[]));
-- (changes go through the functions below)

-- ---------------------------------------------------------------------
-- Queueing
-- ---------------------------------------------------------------------
create or replace function public.prearrival_time(_r public.reservations)
returns timestamptz language sql stable security definer set search_path = public as $$
  select ((_r.check_in - coalesce(s.prearrival_days, 2))::timestamp + time '09:00') at time zone h.timezone
    from hotels h left join email_settings s on s.hotel_id = h.id where h.id = _r.hotel_id
$$;

create or replace function public.email_queue(_r public.reservations, _kind text, _at timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into email_outbox (hotel_id, reservation_id, kind, send_after)
  values (_r.hotel_id, _r.id, _kind, _at)
  on conflict (reservation_id, kind) where kind <> 'test'
  do update set send_after = excluded.send_after, status = 'queued', attempts = 0, last_error = null
    where email_outbox.status in ('queued', 'cancelled', 'skipped');
end $$;

create or replace function public.reservations_emails()
returns trigger language plpgsql security definer set search_path = public as $$
declare _today date; _pre timestamptz;
begin
  _today := (now() at time zone (select timezone from hotels where id = new.hotel_id))::date;
  _pre := prearrival_time(new);
  if tg_op = 'INSERT' then
    if new.status = 'confirmed' then
      if new.check_in > _today then perform email_queue(new, 'confirmation'); end if;
      if new.check_in > _today and _pre > now() + interval '6 hours' then perform email_queue(new, 'prearrival', _pre); end if;
    end if;
    return new;
  end if;
  if new.status = 'confirmed' and (new.check_in is distinct from old.check_in) then
    update email_outbox set send_after = _pre, status = case when _pre > now() then 'queued' else 'cancelled' end
     where reservation_id = new.id and kind = 'prearrival' and status in ('queued', 'cancelled');
  end if;
  if new.status is distinct from old.status then
    if new.status in ('cancelled', 'no_show', 'checked_in') then
      update email_outbox set status = 'cancelled' where reservation_id = new.id and status = 'queued' and kind in ('confirmation', 'prearrival');
    end if;
    if new.status = 'cancelled' and old.status = 'confirmed' then perform email_queue(new, 'cancellation'); end if;
    if new.status = 'checked_out' then perform email_queue(new, 'thankyou', now() + interval '3 hours'); end if;
  end if;
  return new;
end $$;
create trigger reservations_emails after insert or update of status, check_in on public.reservations
  for each row execute function public.reservations_emails();

-- Upcoming stays get their pre-arrival email.
insert into public.email_outbox (hotel_id, reservation_id, kind, send_after)
select r.hotel_id, r.id, 'prearrival', public.prearrival_time(r)
  from public.reservations r
 where r.status = 'confirmed' and public.prearrival_time(r) > now() + interval '6 hours'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Writing the emails
-- ---------------------------------------------------------------------
create or replace function public.html_esc(_t text)
returns text language sql immutable as $$
  select replace(replace(replace(replace(replace(coalesce(_t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), E'\n', '<br>')
$$;

create or replace function public.email_layout(_h public.hotels, _title text, _body text, _button_url text default null, _button text default null)
returns text language sql stable as $$
  select '<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">'
    || '<tr><td style="background:#0f172a;color:#ffffff;padding:20px 28px;font-size:20px;font-weight:bold">' || html_esc(_h.name) || '</td></tr>'
    || '<tr><td style="padding:28px">'
    || '<h1 style="font-size:22px;margin:0 0 16px">' || html_esc(_title) || '</h1>'
    || _body
    || case when _button_url is not null then
         '<p style="margin:24px 0"><a href="' || html_esc(_button_url) || '" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">' || html_esc(_button) || '</a></p>'
       else '' end
    || '</td></tr>'
    || '<tr><td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:18px">'
    || html_esc(_h.name) || coalesce(' · ' || html_esc(nullif(concat_ws(', ', _h.address, _h.city), '')), '')
    || coalesce('<br>Tel ' || html_esc(_h.phone), '') || coalesce(' · ' || html_esc(_h.email), '')
    || '</td></tr></table></td></tr></table></body></html>'
$$;

create or replace function public.email_row(_label text, _value text)
returns text language sql immutable as $$
  select '<tr><td style="padding:6px 0;color:#64748b;width:40%">' || html_esc(_label) || '</td><td style="padding:6px 0;font-weight:bold">' || html_esc(_value) || '</td></tr>'
$$;

-- What an email says right now: {to, subject, html, text, from_name, reply_to}, or {skip: reason}.
-- _preview ignores the on/off switches and booking status, for showing staff.
create or replace function public.email_compose(_hotel_id uuid, _reservation_id uuid, _kind text, _test_to text default null, _preview boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  _o record; _s email_settings; _h hotels; _r reservations; _g guests; _t room_types; _b booking_settings;
  _subject text; _title text; _body text; _url text; _btn text; _text text; _to text; _p prechecks; _f guest_feedback;
  _money text; _stay text;
begin
  select _hotel_id as hotel_id, _reservation_id as reservation_id, _kind as kind, _test_to as to_email into _o;
  select * into _s from email_settings where hotel_id = _o.hotel_id;
  select * into _h from hotels where id = _o.hotel_id;
  select * into _b from booking_settings where hotel_id = _o.hotel_id;

  if _o.kind = 'test' then
    _to := _o.to_email;
    _subject := format('Test email from %s', _h.name);
    _title := 'Emails are working';
    _body := '<p>This is a test from HotelEasy. Guests will receive booking emails from <b>' || html_esc(coalesce(_s.from_name, _h.name)) || '</b>'
          || coalesce(', and replies go to <b>' || html_esc(coalesce(_s.reply_to, _h.email)) || '</b>', '') || '.</p>';
    _text := 'This is a test email from HotelEasy.';
  else
    select * into _r from reservations where id = _o.reservation_id;
    if not found then return jsonb_build_object('skip', 'booking deleted'); end if;
    select * into _g from guests where id = _r.guest_id;
    select * into _t from room_types where id = _r.room_type_id;
    _to := lower(trim(_g.email));
    if _to is null or _to !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('skip', 'guest has no email address'); end if;
    if not _s.enabled and not _preview then return jsonb_build_object('skip', 'emails are switched off'); end if;
    if not _preview and ((_o.kind = 'confirmation' and not _s.send_confirmation) or (_o.kind = 'prearrival' and not _s.send_prearrival)
       or (_o.kind = 'thankyou' and not _s.send_thankyou) or (_o.kind = 'cancellation' and not _s.send_cancellation)) then
      return jsonb_build_object('skip', 'this email is switched off');
    end if;
    _money := _h.currency || ' ' || to_char(_r.total_amount, 'FM999,999,999,990.00');
    _stay := to_char(_r.check_in, 'Dy DD Mon YYYY') || ' → ' || to_char(_r.check_out, 'Dy DD Mon YYYY');
    select * into _p from prechecks where reservation_id = _r.id;

    if _o.kind = 'confirmation' then
      if not _preview and (_r.status <> 'confirmed') then return jsonb_build_object('skip', 'booking is no longer confirmed'); end if;
      _subject := format('Booking confirmed: %s, %s', _h.name, to_char(_r.check_in, 'DD Mon YYYY'));
      _title := format('Thank you, %s. Your booking is confirmed.', _g.first_name);
      _body := '<table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse">'
        || email_row('Booking code', _r.code) || email_row('Stay', _stay)
        || email_row('Nights', _r.nights::text) || email_row('Room', _t.name)
        || email_row('Guests', (_r.adults + _r.children)::text) || email_row('Total', _money)
        || email_row('Check-in', 'from ' || to_char(_h.checkin_time, 'HH24:MI')) || email_row('Check-out', 'by ' || to_char(_h.checkout_time, 'HH24:MI'))
        || '</table>'
        || coalesce('<h3 style="font-size:16px;margin:20px 0 6px">Payment</h3><p style="font-size:14px;line-height:21px">' || html_esc(nullif(_b.payment_instructions, '')) || '</p>', '')
        || case when _b.free_cancel_days is not null then '<p style="font-size:14px;line-height:21px">Free cancellation until '
             || to_char(_r.check_in - _b.free_cancel_days, 'DD Mon YYYY') || '.</p>' else '' end
        || coalesce('<p style="font-size:14px;line-height:21px">' || html_esc(nullif(_s.confirmation_note, '')) || '</p>', '')
        || case when _p.id is not null then '<p style="font-size:14px;line-height:21px">Save time on arrival: check in online before you come.</p>' else '' end;
      if _p.id is not null then _url := rtrim(_s.app_url, '/') || '/checkin/' || _p.token; _btn := 'Check in online'; end if;
      _text := format(E'Your booking at %s is confirmed.\nCode: %s\nStay: %s\nRoom: %s\nTotal: %s', _h.name, _r.code, _stay, _t.name, _money)
        || coalesce(E'\nCheck in online: ' || _url, '');

    elsif _o.kind = 'prearrival' then
      if not _preview and (_r.status <> 'confirmed') then return jsonb_build_object('skip', 'booking is no longer confirmed'); end if;
      _subject := format('See you on %s at %s', trim(to_char(_r.check_in, 'Day')), _h.name);
      _title := format('We look forward to welcoming you, %s', _g.first_name);
      _body := '<p style="font-size:14px;line-height:21px">Your stay starts on <b>' || to_char(_r.check_in, 'FMDay DD Month') || '</b>. Check-in is from <b>'
        || to_char(_h.checkin_time, 'HH24:MI') || '</b>.</p>'
        || '<table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse">'
        || email_row('Booking code', _r.code) || email_row('Room', _t.name) || email_row('Stay', _stay)
        || coalesce(email_row('Address', nullif(concat_ws(', ', _h.address, _h.city), '')), '') || '</table>'
        || coalesce('<p style="font-size:14px;line-height:21px">' || html_esc(nullif(_s.prearrival_note, '')) || '</p>', '')
        || case when _p.id is not null and _p.submitted_at is null then
             '<p style="font-size:14px;line-height:21px">Skip the paperwork at reception: fill in your details and sign the registration card online. It takes about two minutes.</p>'
           when _p.submitted_at is not null then '<p style="font-size:14px;line-height:21px">Thank you for checking in online. Please bring the ID or passport you entered.</p>'
           else '' end;
      if _p.id is not null and _p.submitted_at is null then _url := rtrim(_s.app_url, '/') || '/checkin/' || _p.token; _btn := 'Check in online'; end if;
      _text := format(E'Your stay at %s starts on %s (check-in from %s).\nBooking: %s', _h.name, to_char(_r.check_in, 'FMDay DD Month'), to_char(_h.checkin_time, 'HH24:MI'), _r.code)
        || coalesce(E'\nCheck in online: ' || _url, '');

    elsif _o.kind = 'thankyou' then
      if not _preview and (_r.status <> 'checked_out') then return jsonb_build_object('skip', 'guest has not checked out'); end if;
      select * into _f from guest_feedback where reservation_id = _r.id;
      if not _preview and (_f.submitted_at is not null) then return jsonb_build_object('skip', 'guest already left feedback'); end if;
      _subject := format('Thank you for staying at %s', _h.name);
      _title := format('Thank you for staying with us, %s', _g.first_name);
      _body := '<p style="font-size:14px;line-height:21px">We hope you enjoyed your stay and had a safe journey. '
        || case when _f.id is not null then 'Would you tell us how it went? It takes one minute and helps us improve.' else 'We hope to see you again soon.' end || '</p>';
      if _f.id is not null then _url := rtrim(_s.app_url, '/') || '/feedback/' || _f.token; _btn := 'Rate your stay';
      end if;
      _text := format('Thank you for staying at %s.', _h.name) || coalesce(E'\nTell us how it went: ' || _url, '');

    else -- cancellation
      if not _preview and (_r.status <> 'cancelled') then return jsonb_build_object('skip', 'booking is not cancelled'); end if;
      _subject := format('Booking %s cancelled', _r.code);
      _title := 'Your booking has been cancelled';
      _body := '<table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse">'
        || email_row('Booking code', _r.code) || email_row('Was for', _stay) || email_row('Room', _t.name) || '</table>'
        || '<p style="font-size:14px;line-height:21px">If you did not ask for this, or would like to book again, please contact us'
        || coalesce(' on ' || html_esc(_h.phone), '') || '.</p>';
      _text := format('Your booking %s at %s (%s) has been cancelled.', _r.code, _h.name, _stay);
    end if;
  end if;

  return jsonb_build_object('to', _to, 'subject', _subject, 'html', email_layout(_h, _title, _body, _url, _btn),
    'text', _text || coalesce(E'\n\n' || _h.name || coalesce(', ' || _h.phone, ''), ''),
    'from_name', coalesce(nullif(trim(_s.from_name), ''), _h.name), 'reply_to', coalesce(_s.reply_to, _h.email));
end $$;

create or replace function public.email_render(_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select email_compose(o.hotel_id, o.reservation_id, o.kind, o.to_email) from email_outbox o where o.id = _id),
                  jsonb_build_object('skip', 'not found'))
$$;

-- ---------------------------------------------------------------------
-- For the sender (service role only)
-- ---------------------------------------------------------------------
create or replace function public.email_claim(_limit int default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _o email_outbox; _m jsonb; _out jsonb := '[]';
begin
  -- emails stuck in "sending" (sender crashed) go back to the queue
  update email_outbox set status = 'queued' where status = 'sending' and claimed_at < now() - interval '15 minutes';
  -- don't send things that are long overdue (e.g. emails were switched off for a while)
  update email_outbox set status = 'skipped', last_error = 'Too late to send'
   where status = 'queued' and kind in ('confirmation', 'prearrival') and send_after < now() - interval '2 days';
  for _o in select * from email_outbox where status = 'queued' and send_after <= now()
             order by send_after limit least(greatest(coalesce(_limit, 20), 1), 100) for update skip locked loop
    _m := email_render(_o.id);
    if _m ? 'skip' then
      update email_outbox set status = 'skipped', last_error = _m->>'skip' where id = _o.id;
    else
      update email_outbox set status = 'sending', attempts = attempts + 1, claimed_at = now(), to_email = _m->>'to', subject = _m->>'subject' where id = _o.id;
      _out := _out || jsonb_build_array(jsonb_build_object('id', _o.id) || _m);
    end if;
  end loop;
  return _out;
end $$;

create or replace function public.email_mark(_id uuid, _ok boolean, _provider_id text default null, _error text default null)
returns void language plpgsql security definer set search_path = public as $$
declare _o email_outbox;
begin
  select * into _o from email_outbox where id = _id for update;
  if not found then return; end if;
  if _ok then
    update email_outbox set status = 'sent', sent_at = now(), provider_id = _provider_id, last_error = null where id = _id;
    if _o.kind = 'thankyou' then update guest_feedback set shared_at = coalesce(shared_at, now()) where reservation_id = _o.reservation_id; end if;
    if _o.kind in ('confirmation', 'prearrival') then update prechecks set shared_at = coalesce(shared_at, now()) where reservation_id = _o.reservation_id; end if;
  elsif _o.attempts >= 3 then
    update email_outbox set status = 'failed', last_error = left(_error, 500) where id = _id;
  else
    update email_outbox set status = 'queued', send_after = now() + make_interval(mins => 10 * _o.attempts), last_error = left(_error, 500) where id = _id;
  end if;
end $$;

revoke execute on function public.email_claim(int) from public, anon, authenticated;
revoke execute on function public.email_mark(uuid, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.email_render(uuid) from public, anon, authenticated;
revoke execute on function public.email_compose(uuid, uuid, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.email_queue(public.reservations, text, timestamptz) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.email_claim(int) to service_role;
    grant execute on function public.email_mark(uuid, boolean, text, text) to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- For staff
-- ---------------------------------------------------------------------
-- Preview what a guest would get.
create or replace function public.email_preview(_reservation_id uuid, _kind text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _r reservations;
begin
  select * into _r from reservations where id = _reservation_id;
  if not found or not has_hotel_role(_r.hotel_id, array['owner','manager','front_desk']::hotel_role[]) then raise exception 'Reservation not found'; end if;
  if _kind not in ('confirmation', 'prearrival', 'thankyou', 'cancellation') then raise exception 'Unknown email'; end if;
  return email_compose(_r.hotel_id, _r.id, _kind, null, true);
end $$;
grant execute on function public.email_preview(uuid, text) to authenticated;

create or replace function public.email_send_test(_hotel_id uuid, _to text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_hotel_role(_hotel_id, array['owner','manager']::hotel_role[]) then raise exception 'Only owners and managers can send test emails'; end if;
  if _to is null or lower(trim(_to)) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address'; end if;
  if (select count(*) from email_outbox where hotel_id = _hotel_id and kind = 'test' and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many test emails; try again later';
  end if;
  insert into email_outbox (hotel_id, kind, to_email) values (_hotel_id, 'test', lower(trim(_to)));
end $$;
grant execute on function public.email_send_test(uuid, text) to authenticated;

-- Try a failed or skipped email again, or send a guest's email now.
create or replace function public.email_retry(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _o email_outbox;
begin
  select * into _o from email_outbox where id = _id for update;
  if not found or not has_hotel_role(_o.hotel_id, array['owner','manager','front_desk']::hotel_role[]) then raise exception 'Email not found'; end if;
  if _o.status = 'sending' then raise exception 'This email is being sent right now'; end if;
  update email_outbox set status = 'queued', send_after = now(), attempts = 0, last_error = null where id = _id;
end $$;
grant execute on function public.email_retry(uuid) to authenticated;
