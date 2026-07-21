-- Same argument-shift bug as geocode_surveyor_postcode (see
-- 20260721c_fix_geocode_surveyor_postcode_args.sql), plus these two also
-- pointed at project ref iwvhtvmjmfbnsnxkcxdl instead of this project's own
-- lemppaqgpntadeylzzwn -- even though notify-new-surveyor-registered and
-- notify-surveyor-approved are both deployed right here in
-- admin/supabase/functions/. Both bugs meant admin was never actually
-- emailed about new registrations or getting the approval confirmation
-- sent to the surveyor, silently, for the same reason: http_request()'s
-- catch-all EXCEPTION handler swallows the failure.

CREATE OR REPLACE FUNCTION on_surveyor_registered()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
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

CREATE OR REPLACE FUNCTION on_surveyor_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    PERFORM supabase_functions.http_request(
      'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/notify-surveyor-approved',
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
