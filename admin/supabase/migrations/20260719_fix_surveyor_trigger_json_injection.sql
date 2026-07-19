-- Fix JSON-injection bug in surveyor triggers: they built jsonb bodies via raw
-- string concatenation ('{"key": "' || NEW.col || '"}'::jsonb), which breaks
-- (invalid input syntax for type json / 22P02) whenever the interpolated value
-- contains a quote, backslash, or other JSON-special character -- e.g. any
-- home_postcode with an unusual character breaks new-surveyor registration.
-- jsonb_build_object() escapes values safely regardless of content.

CREATE OR REPLACE FUNCTION geocode_surveyor_postcode()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.home_postcode IS NOT NULL AND (OLD.home_postcode IS NULL OR NEW.home_postcode != OLD.home_postcode) THEN
    PERFORM supabase_functions.http_request(
      'POST',
      'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/geocode-postcode',
      jsonb_build_object('postcode', NEW.home_postcode, 'surveyor_id', NEW.id),
      jsonb_build_object('Content-Type', 'application/json')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION on_surveyor_registered()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM supabase_functions.http_request(
      'POST',
      'https://iwvhtvmjmfbnsnxkcxdl.supabase.co/functions/v1/notify-new-surveyor-registered',
      jsonb_build_object('surveyor_id', NEW.id),
      jsonb_build_object('Content-Type', 'application/json')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION on_surveyor_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    PERFORM supabase_functions.http_request(
      'POST',
      'https://iwvhtvmjmfbnsnxkcxdl.supabase.co/functions/v1/notify-surveyor-approved',
      jsonb_build_object('surveyor_id', NEW.id),
      jsonb_build_object('Content-Type', 'application/json')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
