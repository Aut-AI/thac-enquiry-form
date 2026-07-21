-- geocode_surveyor_postcode called supabase_functions.http_request() with its
-- arguments shifted by one position. The helper's real signature (defined in
-- 000_create_webhooks_and_schema.sql) is:
--   http_request(url, method, headers, body, timeout_ms)
-- but this trigger called it as (method, url, body, headers) -- e.g. passing
-- the literal string 'POST' as the url and the real URL as the method. Every
-- other trigger in this codebase (trigger_notify_new_enquiry etc.) calls it
-- correctly; this one didn't, and the mistake survived both the 20260719
-- JSON-injection fix and the 20260719b SECURITY DEFINER fix because neither
-- touched argument order.
--
-- Since url ended up as 'POST', http_post() failed immediately -- but
-- http_request()'s catch-all EXCEPTION handler swallows that into
-- webhook_request_logs and RAISE WARNING, so the surveyor INSERT/UPDATE
-- always succeeded silently and home_lat/home_lng were simply never set.
--
-- Also adds the Authorization header every sibling trigger includes (the
-- edge functions are deployed with JWT verification on, so a request with
-- no bearer token would 401 at the gateway before reaching the function).

CREATE OR REPLACE FUNCTION geocode_surveyor_postcode()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.home_postcode IS NOT NULL AND (OLD.home_postcode IS NULL OR NEW.home_postcode != OLD.home_postcode) THEN
    PERFORM supabase_functions.http_request(
      'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/geocode-postcode',
      'POST',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbXBwYXFncG50YWRleWx6enduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTUzOTMsImV4cCI6MjA5NDg5MTM5M30.SU2M7e5OSwqIjRJfM15uKLHTqSrLadcY46MR51twosU'
      ),
      jsonb_build_object('postcode', NEW.home_postcode, 'surveyor_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
