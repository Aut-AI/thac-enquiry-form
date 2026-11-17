-- Surveyor emails (Trevor, 16 Nov call): tell surveyors when a job is available
-- in their area, and when a job is allocated to them. Sent by the
-- notify-surveyors Edge Function, run every 5 minutes by pg_cron.
-- Respects first pick (20261116004): first-pick surveyors are emailed straight
-- away, everyone else once the window has passed.
-- Needs pg_cron + pg_net (enabled by 20261116002).

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS first_pick_alerted_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS surveyors_alerted_at  TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS allocation_alerted_at TIMESTAMPTZ;

-- Don't email about jobs that already exist.
UPDATE jobs SET surveyors_alerted_at = now() WHERE dispatch_state = 'red' AND surveyors_alerted_at IS NULL;
UPDATE jobs SET allocation_alerted_at = now() WHERE allocated_surveyor_id IS NOT NULL AND allocation_alerted_at IS NULL;

-- A job that goes red again (hand-back, take-back, plans) gets a fresh round of emails.
CREATE OR REPLACE FUNCTION stamp_job_red_at() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.dispatch_state = 'red'
     AND (TG_OP = 'INSERT' OR OLD.dispatch_state IS DISTINCT FROM 'red') THEN
    NEW.red_at := now();
    NEW.first_pick_alerted_at := NULL;
    NEW.surveyors_alerted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'notify-surveyors';
SELECT cron.schedule(
  'notify-surveyors',
  '*/5 * * * *',
  $$ SELECT net.http_post(
       url := 'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/notify-surveyors',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);
