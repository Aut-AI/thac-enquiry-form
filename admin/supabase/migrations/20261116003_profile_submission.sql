-- Trevor, 2026-11-16: a surveyor must not reach him for approval until the whole
-- profile is filled in (insurance certificates, dates, amounts, DBS). The app
-- now lets them save a draft and submit when complete.
--
--   profile_submitted_at  NULL = still a draft; set = submitted for approval
--   pi_cover_amount / pl_cover_amount  insurance cover in pounds
--
-- The "New surveyor registered" email now fires on SUBMISSION, not on sign-up.
-- Every existing surveyor is treated as already submitted.

BEGIN;

ALTER TABLE surveyors ADD COLUMN IF NOT EXISTS profile_submitted_at TIMESTAMPTZ;
ALTER TABLE surveyors ADD COLUMN IF NOT EXISTS pi_cover_amount NUMERIC(12,2);
ALTER TABLE surveyors ADD COLUMN IF NOT EXISTS pl_cover_amount NUMERIC(12,2);

UPDATE surveyors SET profile_submitted_at = coalesce(created_at, now()) WHERE profile_submitted_at IS NULL;

CREATE OR REPLACE FUNCTION on_surveyor_registered()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending'
     AND NEW.profile_submitted_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.profile_submitted_at IS NULL) THEN
    PERFORM supabase_functions.http_request(
      'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/notify-new-surveyor-registered',
      'POST',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbXBwYXFncG50YWRleWx6enduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTUzOTMsImV4cCI6MjA5NDg5MTM5M30.SU2M7e5OSwqIjRJfM15uKLHTqSrLadcY46MR51twosU'
      ),
      jsonb_build_object('surveyor_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_surveyor_profile_submitted ON surveyors;
CREATE TRIGGER on_surveyor_profile_submitted
AFTER UPDATE OF profile_submitted_at ON surveyors
FOR EACH ROW
EXECUTE FUNCTION on_surveyor_registered();

COMMIT;
