-- HotelEasy: read every hotel's Booking.com / Airbnb calendars every 10 minutes.
-- (Without this, calendars are still read while someone has HotelEasy open, and with "Sync now".)
-- 1. Database → Extensions: enable pg_cron and pg_net.
-- 2. Give the ical Edge Function a CRON_SECRET secret, put the same value below, run this in the SQL Editor.
select cron.schedule(
  'hoteleasy-calendar-sync',
  '*/10 * * * *',
  $$ select net.http_post(
       url := 'https://qdmqdgslkbbzlwdjssmw.supabase.co/functions/v1/ical',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR-CRON-SECRET'),
       body := '{"action":"sync_due"}'::jsonb,
       timeout_milliseconds := 60000) $$
);
-- To stop it:  select cron.unschedule('hoteleasy-calendar-sync');
