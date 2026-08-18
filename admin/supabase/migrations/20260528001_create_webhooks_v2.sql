-- ============================================================
-- THAC CRM — Database Webhooks
-- Creates triggers that fire Supabase Edge Functions directly
-- Run via: Supabase SQL Editor
-- ============================================================
-- NOTE: This file is a placeholder/test variant.
-- The real migration to run is `000_create_webhooks_and_schema.sql`.

-- 1. Create supabase_functions schema (must come first)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS supabase_functions;

-- 2. Create http_request function (placeholder that just accepts calls)
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
AS $$
BEGIN
  -- Placeholder: accepts the request but doesn't do anything
  -- In production, this would be the Supabase-provided http function
  NULL;
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
  AFTER INSERT ON enquiries
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_new_enquiry();


-- 5. notify-job-created
--    Fires: INSERT on jobs
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
  AFTER INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_job_created();


-- 6. notify-job-approved
--    Fires: UPDATE on jobs where dispatch_state changes to 'red' (live/unallocated)
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
  AFTER UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_job_approved();


-- 7. notify-surveyor-claimed
--    Fires: UPDATE on jobs where dispatch_state changes to 'claimed'
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
  AFTER UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_surveyor_claimed();


-- 8. notify-field-data-uploaded
--    Fires: UPDATE on jobs where field_data_uploaded flips to true
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
  AFTER UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_field_data_uploaded();


-- 9. notify-report-sent
--    Fires: UPDATE on jobs where report_finalised flips to true
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
  AFTER UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_report_sent();
