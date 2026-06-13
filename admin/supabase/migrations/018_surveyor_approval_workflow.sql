-- Add approval status tracking to surveyors
ALTER TABLE surveyors ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- Backfill existing paused surveyors
UPDATE surveyors SET status = 'paused' WHERE is_active = false;

-- Trigger function: notify admin when new surveyor registers
CREATE OR REPLACE FUNCTION on_surveyor_registered()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM supabase_functions.http_request(
      'POST',
      'https://iwvhtvmjmfbnsnxkcxdl.supabase.co/functions/v1/notify-new-surveyor-registered',
      '{"surveyor_id": "' || NEW.id || '"}'::jsonb,
      '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_surveyor_registered ON surveyors;
CREATE TRIGGER on_surveyor_registered
AFTER INSERT ON surveyors
FOR EACH ROW
EXECUTE FUNCTION on_surveyor_registered();

-- Trigger function: notify surveyor when approved
CREATE OR REPLACE FUNCTION on_surveyor_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    PERFORM supabase_functions.http_request(
      'POST',
      'https://iwvhtvmjmfbnsnxkcxdl.supabase.co/functions/v1/notify-surveyor-approved',
      '{"surveyor_id": "' || NEW.id || '"}'::jsonb,
      '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_surveyor_approved ON surveyors;
CREATE TRIGGER on_surveyor_approved
AFTER UPDATE ON surveyors
FOR EACH ROW
EXECUTE FUNCTION on_surveyor_approved();
