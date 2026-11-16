-- Trevor, 2026-11-16: email him when a job has been allocated to a surveyor for
-- 2+ days without being accepted. One email per allocation.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS unaccepted_alert_sent_at TIMESTAMPTZ;

-- Hourly check. Needs the pg_cron and pg_net extensions (Database > Extensions).
-- The function is deployed with --no-verify-jwt like the other notify functions.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'check-unaccepted-allocations';
SELECT cron.schedule(
  'check-unaccepted-allocations',
  '15 * * * *',
  $$ SELECT net.http_post(
       url := 'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/check-unaccepted-allocations',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);
