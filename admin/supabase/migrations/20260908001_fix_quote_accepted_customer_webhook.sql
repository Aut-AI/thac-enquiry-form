-- on_enquiry_status_accepted_customer (added in
-- 20260531_webhook_quote_accepted_customer.sql) had the same
-- supabase_functions.http_request() argument-shift bug fixed for
-- geocode_surveyor_postcode in 20260721002: it called http_request() as
-- (method, url, headers, body, timeout) instead of the real signature
-- (url, method, headers, body, timeout_ms), passing the literal string
-- 'POST' as the url. It also had no Authorization header, so even with the
-- argument order fixed it would 401 at the gateway (the edge function is
-- deployed with JWT verification on, like every sibling function). Both
-- together mean the customer never actually got the "quote accepted -- now
-- tell us more" follow-up email; the enquiry status update itself always
-- succeeded silently because http_request()'s catch-all EXCEPTION handler
-- swallows the failure into webhook_request_logs.
--
-- Rewritten to match the wrapper-function style every other trigger in this
-- codebase uses (trigger_notify_new_enquiry etc.) instead of the one-off
-- direct EXECUTE FUNCTION style the original migration used, so the
-- Authorization header can be added and behaviour matches its siblings.

DROP TRIGGER IF EXISTS on_enquiry_status_accepted_customer ON public.enquiries;

CREATE OR REPLACE FUNCTION trigger_notify_quote_accepted_customer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    PERFORM supabase_functions.http_request(
      'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/notify-quote-accepted-to-customer',
      'POST',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbXBwYXFncG50YWRleWx6enduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTUzOTMsImV4cCI6MjA5NDg5MTM5M30.SU2M7e5OSwqIjRJfM15uKLHTqSrLadcY46MR51twosU'
      ),
      to_jsonb(NEW),
      1000
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_enquiry_status_accepted_customer
  AFTER UPDATE OF status ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_quote_accepted_customer();
