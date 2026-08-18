-- Sync operating_outcodes with surveyor_service_outcodes
-- Master list of all active service areas across all surveyors

CREATE TABLE IF NOT EXISTS operating_outcodes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  outcode TEXT NOT NULL UNIQUE,
  area_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE operating_outcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read operating_outcodes" ON operating_outcodes
  FOR SELECT USING (true);

-- Auto-sync: whenever a surveyor_service_outcodes row is inserted, add to master list
CREATE OR REPLACE FUNCTION sync_operating_outcodes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO operating_outcodes (outcode, area_name)
  SELECT DISTINCT NEW.outcode, (SELECT area_name FROM uk_outcodes WHERE outcode = NEW.outcode)
  ON CONFLICT (outcode) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_operating_outcodes_on_insert ON surveyor_service_outcodes;
CREATE TRIGGER sync_operating_outcodes_on_insert
AFTER INSERT ON surveyor_service_outcodes
FOR EACH ROW
EXECUTE FUNCTION sync_operating_outcodes();
