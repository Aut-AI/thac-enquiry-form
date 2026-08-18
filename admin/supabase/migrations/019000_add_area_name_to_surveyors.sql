-- Add area_name column to cache geocoded area
ALTER TABLE surveyors ADD COLUMN area_name TEXT;

-- Trigger function to geocode postcode when saved
CREATE OR REPLACE FUNCTION geocode_surveyor_postcode()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.home_postcode IS NOT NULL AND (OLD.home_postcode IS NULL OR NEW.home_postcode != OLD.home_postcode) THEN
    PERFORM supabase_functions.http_request(
      'POST',
      'https://iwvhtvmjmfbnsnxkcxdl.supabase.co/functions/v1/geocode-postcode',
      '{"postcode": "' || NEW.home_postcode || '"}'::jsonb,
      '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS geocode_surveyor_postcode ON surveyors;
CREATE TRIGGER geocode_surveyor_postcode
AFTER INSERT OR UPDATE ON surveyors
FOR EACH ROW
EXECUTE FUNCTION geocode_surveyor_postcode();
