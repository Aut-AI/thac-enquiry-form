-- Surveyor service outcodes: tracks which postcode areas each surveyor is willing to work in.
-- When a surveyor is approved (status='active'), their home outcode is auto-added.
-- Surveyors can then add/remove additional outcodes from their profile.
-- Job visibility: jobs only appear on a surveyor's map if the job's outcode matches one they've selected.

CREATE TABLE surveyor_service_outcodes (
  id           BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  surveyor_id  BIGINT NOT NULL REFERENCES surveyors(id) ON DELETE CASCADE,
  outcode      TEXT NOT NULL REFERENCES operating_outcodes(outcode) ON DELETE CASCADE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(surveyor_id, outcode)
);

CREATE INDEX idx_surveyor_service_outcodes_surveyor_id ON surveyor_service_outcodes (surveyor_id);
CREATE INDEX idx_surveyor_service_outcodes_outcode ON surveyor_service_outcodes (outcode);

-- Enable RLS
ALTER TABLE surveyor_service_outcodes ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read their own records
CREATE POLICY "Allow users to read own service outcodes" ON surveyor_service_outcodes
  FOR SELECT USING (
    auth.uid()::text = (SELECT auth_user_id FROM surveyors WHERE id = surveyor_id)
  );

-- Policy: authenticated users can manage (insert/delete) their own service outcodes
CREATE POLICY "Allow users to manage own service outcodes" ON surveyor_service_outcodes
  FOR INSERT WITH CHECK (
    auth.uid()::text = (SELECT auth_user_id FROM surveyors WHERE id = surveyor_id)
  );

CREATE POLICY "Allow users to delete own service outcodes" ON surveyor_service_outcodes
  FOR DELETE USING (
    auth.uid()::text = (SELECT auth_user_id FROM surveyors WHERE id = surveyor_id)
  );

-- Trigger: auto-add surveyor's home outcode to their service list when approved
CREATE OR REPLACE FUNCTION on_surveyor_approved_add_home_outcode_to_service_list()
RETURNS TRIGGER AS $$
DECLARE
  v_outcode TEXT;
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    IF NEW.home_postcode IS NOT NULL AND trim(NEW.home_postcode) <> '' THEN
      v_outcode := substring(
        upper(regexp_replace(NEW.home_postcode, '\s+', '', 'g'))
        FROM '^[A-Z]{1,2}'
      );

      IF v_outcode IS NOT NULL THEN
        INSERT INTO surveyor_service_outcodes (surveyor_id, outcode)
        VALUES (NEW.id, v_outcode)
        ON CONFLICT (surveyor_id, outcode) DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_surveyor_approved_add_home_outcode_to_service_list ON surveyors;
CREATE TRIGGER on_surveyor_approved_add_home_outcode_to_service_list
AFTER UPDATE ON surveyors
FOR EACH ROW
EXECUTE FUNCTION on_surveyor_approved_add_home_outcode_to_service_list();
