-- ============================================================
-- THAC CRM — Database Webhooks
-- Creates triggers that fire Supabase Edge Functions directly
-- Run via: Supabase SQL Editor
-- ============================================================

-- 1. Enable required extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA public;

-- 2. Create supabase_functions schema and http_request function
-- ============================================================
-- If you see "schema \"supabase_functions\" does not exist", run
-- admin/supabase/migrations/000_create_supabase_functions_schema.sql first.
CREATE SCHEMA IF NOT EXISTS supabase_functions;

-- Create the http_request function using the http extension
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
  -- Convert jsonb headers to text array for the http extension
  FOR header_rec IN SELECT key, value FROM jsonb_each_text(headers)
  LOOP
    header_array := array_append(header_array, header_rec.key || ': ' || header_rec.value);
  END LOOP;

  -- Convert body to string if provided
  body_str := COALESCE(body::text, '');

  -- Make the HTTP request asynchronously (fire and forget)
  PERFORM http_post(url, body_str, 'application/json'::text, header_array);
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the trigger
  RAISE WARNING 'http_request failed: %', SQLERRM;
END;
$$;

-- 3. Clean up old triggers (idempotent)
-- ============================================================
DROP TRIGGER IF EXISTS on_enquiry_insert ON enquiries;
DROP TRIGGER IF EXISTS on_job_insert ON jobs;
DROP TRIGGER IF EXISTS on_job_approved ON jobs;
DROP TRIGGER IF EXISTS on_surveyor_claimed ON jobs;
DROP TRIGGER IF EXISTS on_field_data_uploaded ON jobs;
DROP TRIGGER IF EXISTS on_report_sent ON jobs;

-- 4. notify-new-enquiry
--    Fires: INSERT on enquiries
-- ------------------------------------------------------------
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
  AFTER INSERT ON enquiries
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_new_enquiry();


-- 5. notify-job-created
--    Fires: INSERT on jobs
-- ------------------------------------------------------------
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
  AFTER INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_job_created();


-- 6. notify-job-approved
--    Fires: UPDATE on jobs where dispatch_state changes to 'red' (live/unallocated)
-- ------------------------------------------------------------
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
  AFTER UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_job_approved();


-- 7. notify-surveyor-claimed
--    Fires: UPDATE on jobs where dispatch_state changes to 'claimed'
-- ------------------------------------------------------------
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
  AFTER UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_surveyor_claimed();


-- 8. notify-field-data-uploaded
--    Fires: UPDATE on jobs where field_data_uploaded flips to true
-- ------------------------------------------------------------
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
  AFTER UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_field_data_uploaded();


-- 9. notify-report-sent
--    Fires: UPDATE on jobs where report_finalised flips to true
-- ------------------------------------------------------------
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
  AFTER UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_report_sent();
