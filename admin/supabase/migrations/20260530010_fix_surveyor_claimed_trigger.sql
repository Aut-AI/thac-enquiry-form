-- Fix: trigger_notify_surveyor_claimed used 'claimed' which is not a valid
-- dispatch_state enum value. The correct value is 'orange' (surveyor claimed).
-- This caused a 22P02 error on every jobs UPDATE.

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
