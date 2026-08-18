-- Webhook: fire notify-quote-accepted when enquiry status flips to 'accepted'.
-- Uses the same supabase_functions.http_request() pattern as all other triggers.

CREATE OR REPLACE FUNCTION trigger_notify_quote_accepted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM 'accepted') AND NEW.status = 'accepted' THEN
    PERFORM supabase_functions.http_request(
      'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/notify-quote-accepted',
      'POST',
      '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbXBwYXFncG50YWRleWx6enduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTUzOTMsImV4cCI6MjA5NDg5MTM5M30.SU2M7e5OSwqIjRJfM15uKLHTqSrLadcY46MR51twosU"}'::jsonb,
      jsonb_build_object('record', row_to_json(NEW), 'old_record', row_to_json(OLD)),
      5000
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_quote_accepted ON public.enquiries;
CREATE TRIGGER on_quote_accepted
  AFTER UPDATE ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_quote_accepted();
