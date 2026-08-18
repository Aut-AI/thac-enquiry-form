-- Operating outcodes: postcode AREA prefixes (1-2 letters) Trevor covers.
-- Used by the public enquiry form to gate-check postcodes before intake,
-- and auto-expanded when a surveyor is approved (status -> active).

CREATE TABLE operating_outcodes (
  id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  outcode    TEXT UNIQUE NOT NULL,
  region     TEXT,
  source     TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'surveyor_signup')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_operating_outcodes_outcode ON operating_outcodes (outcode);

-- Enable RLS
ALTER TABLE operating_outcodes ENABLE ROW LEVEL SECURITY;

-- Policy: anyone (incl. anon, for the public enquiry form) can read
CREATE POLICY "Allow public read" ON operating_outcodes
  FOR SELECT USING (true);

-- Policy: only authenticated admins can add/remove rows manually
CREATE POLICY "Allow authenticated insert" ON operating_outcodes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete" ON operating_outcodes
  FOR DELETE USING (auth.role() = 'authenticated');

-- Seed: Trevor's 48 reference rows (blank region kept NULL for MK)
INSERT INTO operating_outcodes (outcode, region, source) VALUES
  ('AL', 'Southeast England', 'manual'),
  ('BA', 'South West', 'manual'),
  ('BH', 'South & South East', 'manual'),
  ('BN', 'South & South East', 'manual'),
  ('BR', 'South & South East', 'manual'),
  ('BS', 'South West', 'manual'),
  ('CM', 'Southeast England', 'manual'),
  ('CR', 'London', 'manual'),
  ('CT', 'South & South East', 'manual'),
  ('DA', 'South & South East', 'manual'),
  ('DT', 'South & South East', 'manual'),
  ('E', 'London', 'manual'),
  ('EC', 'London', 'manual'),
  ('EN', 'London', 'manual'),
  ('EX', 'South West', 'manual'),
  ('GL', 'South West', 'manual'),
  ('GU', 'Southeast England', 'manual'),
  ('HA', 'London', 'manual'),
  ('HP', 'Southeast England', 'manual'),
  ('IG', 'London', 'manual'),
  ('KT', 'Southeast England', 'manual'),
  ('LU', 'Southeast England', 'manual'),
  ('ME', 'South & South East', 'manual'),
  ('MK', 'East Midlands', 'manual'),
  ('N', 'London', 'manual'),
  ('NW', 'London', 'manual'),
  ('OX', 'Southeast England', 'manual'),
  ('PO', 'South & South East', 'manual'),
  ('RG', 'Southeast England', 'manual'),
  ('RH', 'Southeast England', 'manual'),
  ('RM', 'London', 'manual'),
  ('SE', 'London', 'manual'),
  ('SG', 'Southeast England', 'manual'),
  ('SL', 'Southeast England', 'manual'),
  ('SM', 'Southeast England', 'manual'),
  ('SN', 'South West', 'manual'),
  ('SO', 'South & South East', 'manual'),
  ('SP', 'South & South East', 'manual'),
  ('SS', 'Southeast England', 'manual'),
  ('SW', 'London', 'manual'),
  ('TA', 'South West', 'manual'),
  ('TN', 'South & South East', 'manual'),
  ('TQ', 'South West', 'manual'),
  ('TW', 'London', 'manual'),
  ('UB', 'London', 'manual'),
  ('W', 'London', 'manual'),
  ('WC', 'London', 'manual'),
  ('WD', 'Southeast England', 'manual')
ON CONFLICT (outcode) DO NOTHING;

-- Trigger: auto-add the surveyor's home outcode when status transitions to 'active'
CREATE OR REPLACE FUNCTION on_surveyor_approved_add_outcode()
RETURNS TRIGGER AS $$
DECLARE
  v_outcode TEXT;
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    IF NEW.home_postcode IS NOT NULL AND trim(NEW.home_postcode) <> '' THEN
      -- Strip spaces, uppercase, take leading 1-2 alpha chars before the first digit
      v_outcode := substring(
        upper(regexp_replace(NEW.home_postcode, '\s+', '', 'g'))
        FROM '^[A-Z]{1,2}'
      );

      IF v_outcode IS NOT NULL THEN
        INSERT INTO operating_outcodes (outcode, region, source)
        VALUES (v_outcode, NULL, 'surveyor_signup')
        ON CONFLICT (outcode) DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the surveyor status update because of an outcode problem
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_surveyor_approved_add_outcode ON surveyors;
CREATE TRIGGER on_surveyor_approved_add_outcode
AFTER UPDATE ON surveyors
FOR EACH ROW
EXECUTE FUNCTION on_surveyor_approved_add_outcode();
