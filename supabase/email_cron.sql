-- HotelEasy: run the email sender every two minutes.
-- 1. Database → Extensions: enable pg_cron and pg_net.
-- 2. Replace YOUR-CRON-SECRET with the same value you set as the CRON_SECRET secret
--    of the send-emails Edge Function, then run this in the SQL Editor.
select cron.schedule(
  'hoteleasy-send-emails',
  '*/2 * * * *',
  $$ select net.http_post(
       url := 'https://qdmqdgslkbbzlwdjssmw.supabase.co/functions/v1/send-emails',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR-CRON-SECRET'),
       body := '{}'::jsonb,
       timeout_milliseconds := 30000) $$
);
-- To stop it:  select cron.unschedule('hoteleasy-send-emails');
