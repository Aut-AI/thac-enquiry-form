-- ============================================================
-- THAC CRM — Webhook trigger install
-- Run this first in Supabase SQL Editor to install webhook trigger
-- functions and the helper schema in one safe migration.
--
-- NOTE: Supabase SQL Editor expects SQL text, not a file path.
-- Copy and paste the contents of this file into the SQL Editor and then run it.
-- ============================================================

-- 1. Enable required extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA public;

-- 2. Ensure the helper schema exists
-- ============================================================
CREATE SCHEMA IF NOT EXISTS supabase_functions;

CREATE TABLE IF NOT EXISTS supabase_functions.webhook_request_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  url text NOT NULL,
  method text NOT NULL,
  headers jsonb,
  body jsonb,
  error text NOT NULL
);

-- 3. Create the http_request helper function
-- ============================================================
CREATE OR REPLACE FUNCTION supabase_functions.http_request(
  url text,
  method text,
  headers jsonb DEFAULT '{}'::jsonb,
  body jsonb DEFAULT NULL,
  timeout_ms integer DEFAULT 5000
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  header_array text[] := ARRAY[]::text[];
  header_rec record;
  body_str text;
BEGIN
  FOR header_rec IN SELECT key, value FROM jsonb_each_text(headers)
  LOOP
    header_array := array_append(header_array, header_rec.key || ': ' || header_rec.value);
  END LOOP;

  body_str := COALESCE(body::text, '');
  PERFORM http_post(url, body_str, 'application/json'::text, header_array);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO supabase_functions.webhook_request_logs(url, method, headers, body, error)
  VALUES (url, method, headers, body, SQLERRM);
  RAISE WARNING 'http_request failed: %', SQLERRM;
END;
$$;

-- 4. Clean up old triggers (idempotent)
-- ============================================================
DROP TRIGGER IF EXISTS on_enquiry_insert ON public.enquiries;
DROP TRIGGER IF EXISTS on_job_insert ON public.jobs;
DROP TRIGGER IF EXISTS on_job_approved ON public.jobs;
DROP TRIGGER IF EXISTS on_surveyor_claimed ON public.jobs;
DROP TRIGGER IF EXISTS on_field_data_uploaded ON public.jobs;
DROP TRIGGER IF EXISTS on_report_sent ON public.jobs;

-- 5. notify-new-enquiry
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_notify_new_enquiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM supabase_functions.http_request(
    'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/notify-new-enquiry',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbXBwYXFncG50YWRleWx6enduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTUzOTMsImV4cCI6MjA5NDg5MTM5M30.SU2M7e5OSwqIjRJfM15uKLHTqSrLadcY46MR51twosU"}'::jsonb,
    jsonb_build_object('type','INSERT','table','enquiries','record',row_to_json(NEW)),
    5000
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_enquiry_insert
  AFTER INSERT ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.trigger_notify_new_enquiry();

-- 6. notify-job-created
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_notify_job_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM supabase_functions.http_request(
    'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/notify-job-created',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbXBwYXFncG50YWRleWx6enduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTUzOTMsImV4cCI6MjA5NDg5MTM5M30.SU2M7e5OSwqIjRJfM15uKLHTqSrLadcY46MR51twosU"}'::jsonb,
    jsonb_build_object('type','INSERT','table','jobs','record',row_to_json(NEW)),
    5000
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_job_insert
  AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_notify_job_created();

-- 7. notify-job-approved
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_notify_job_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.dispatch_state IS DISTINCT FROM NEW.dispatch_state
     AND NEW.dispatch_state = 'red' THEN
    PERFORM supabase_functions.http_request(
      'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/notify-job-approved',
      'POST',
      '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbXBwYXFncG50YWRleWx6enduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTUzOTMsImV4cCI6MjA5NDg5MTM5M30.SU2M7e5OSwqIjRJfM15uKLHTqSrLadcY46MR51twosU"}'::jsonb,
      jsonb_build_object('type','UPDATE','table','jobs','record',row_to_json(NEW),'old_record',row_to_json(OLD)),
      5000
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_job_approved
  AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_notify_job_approved();

-- 8. notify-surveyor-claimed
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_notify_surveyor_claimed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.dispatch_state IS DISTINCT FROM NEW.dispatch_state
     AND NEW.dispatch_state = 'orange' THEN
    PERFORM supabase_functions.http_request(
      'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/notify-surveyor-claimed',
      'POST',
      '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbXBwYXFncG50YWRleWx6enduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTUzOTMsImV4cCI6MjA5NDg5MTM5M30.SU2M7e5OSwqIjRJfM15uKLHTqSrLadcY46MR51twosU"}'::jsonb,
      jsonb_build_object('type','UPDATE','table','jobs','record',row_to_json(NEW),'old_record',row_to_json(OLD)),
      5000
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_surveyor_claimed
  AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_notify_surveyor_claimed();

-- 9. notify-field-data-uploaded
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_notify_field_data_uploaded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (OLD.field_data_uploaded = false OR OLD.field_data_uploaded IS NULL)
     AND NEW.field_data_uploaded = true THEN
    PERFORM supabase_functions.http_request(
      'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/notify-field-data-uploaded',
      'POST',
      '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbXBwYXFncG50YWRleWx6enduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTUzOTMsImV4cCI6MjA5NDg5MTM5M30.SU2M7e5OSwqIjRJfM15uKLHTqSrLadcY46MR51twosU"}'::jsonb,
      jsonb_build_object('type','UPDATE','table','jobs','record',row_to_json(NEW),'old_record',row_to_json(OLD)),
      5000
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_field_data_uploaded
  AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_notify_field_data_uploaded();

-- 10. notify-report-sent
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_notify_report_sent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (OLD.report_finalised = false OR OLD.report_finalised IS NULL)
     AND NEW.report_finalised = true THEN
    PERFORM supabase_functions.http_request(
      'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/notify-report-sent',
      'POST',
      '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbXBwYXFncG50YWRleWx6enduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTUzOTMsImV4cCI6MjA5NDg5MTM5M30.SU2M7e5OSwqIjRJfM15uKLHTqSrLadcY46MR51twosU"}'::jsonb,
      jsonb_build_object('type','UPDATE','table','jobs','record',row_to_json(NEW),'old_record',row_to_json(OLD)),
      5000
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_report_sent
  AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_notify_report_sent();

-- 11. Verification
-- ============================================================
-- Run these queries in Supabase SQL Editor after applying the migration:
--
-- SELECT n.nspname, p.proname
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE p.proname LIKE 'trigger_notify_%'
-- ORDER BY p.proname;
--
-- SELECT tgname, tgrelid::regclass, pg_get_triggerdef(oid)
-- FROM pg_trigger
-- WHERE NOT tgisinternal
--   AND tgrelid::regclass::text IN ('public.enquiries', 'public.jobs')
-- ORDER BY tgname;
--
-- SELECT *
-- FROM supabase_functions.webhook_request_logs
-- ORDER BY created_at DESC
-- LIMIT 20;
