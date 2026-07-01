-- Surveyor radius-based service area coverage
-- Replaces manual outcode picking with automatic Haversine-based calculation
-- New table: uk_outcodes (2,872 granular outcodes with lat/lon centroids)
-- Rewritten: surveyor_service_outcodes (UUID PKs, references uk_outcodes instead of operating_outcodes)
-- New functions: get_surveyor_coverage (Haversine), sync_surveyor_service_outcodes (auto-populate)
-- Fixed trigger: geocode_surveyor_postcode (correct project ref, writes lat/lng)

-- 1. Create uk_outcodes table (imported via CSV from outcodes.csv)
CREATE TABLE IF NOT EXISTS uk_outcodes (
  outcode TEXT PRIMARY KEY,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  postcode_count INTEGER,
  area_name TEXT
);

ALTER TABLE uk_outcodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read uk_outcodes" ON uk_outcodes FOR SELECT USING (true);

-- 2. Drop broken surveyor_service_outcodes table and recreate correctly
DROP TABLE IF EXISTS surveyor_service_outcodes CASCADE;

CREATE TABLE surveyor_service_outcodes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  surveyor_id UUID NOT NULL REFERENCES surveyors(id) ON DELETE CASCADE,
  outcode TEXT NOT NULL REFERENCES uk_outcodes(outcode) ON DELETE CASCADE,
  distance_miles NUMERIC(6,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(surveyor_id, outcode)
);

CREATE INDEX idx_surveyor_service_outcodes_surveyor_id ON surveyor_service_outcodes (surveyor_id);
CREATE INDEX idx_surveyor_service_outcodes_outcode ON surveyor_service_outcodes (outcode);

ALTER TABLE surveyor_service_outcodes ENABLE ROW LEVEL SECURITY;

-- RLS: surveyors read their own service outcodes
CREATE POLICY "Surveyors read own service outcodes" ON surveyor_service_outcodes
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM surveyors WHERE id = surveyor_id));

-- 3. Haversine distance function: compute all outcodes within a surveyor's radius
CREATE OR REPLACE FUNCTION get_surveyor_coverage(p_surveyor_id UUID)
RETURNS TABLE(outcode TEXT, distance_miles NUMERIC) AS $$
  SELECT o.outcode,
         ROUND((3958.8 * acos(
           cos(radians(s.home_lat)) * cos(radians(o.latitude)) *
           cos(radians(o.longitude) - radians(s.home_lng)) +
           sin(radians(s.home_lat)) * sin(radians(o.latitude))
         ))::numeric, 2) AS distance_miles
  FROM surveyors s, uk_outcodes o
  WHERE s.id = p_surveyor_id
    AND s.home_lat IS NOT NULL AND s.home_lng IS NOT NULL
    AND (3958.8 * acos(
           cos(radians(s.home_lat)) * cos(radians(o.latitude)) *
           cos(radians(o.longitude) - radians(s.home_lng)) +
           sin(radians(s.home_lat)) * sin(radians(o.latitude))
         )) <= s.radius_miles;
$$ LANGUAGE sql STABLE;

-- 4. Trigger: auto-recompute surveyor_service_outcodes whenever home_lat/home_lng/radius_miles change
CREATE OR REPLACE FUNCTION sync_surveyor_service_outcodes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.home_lat IS NOT NULL AND NEW.home_lng IS NOT NULL AND NEW.radius_miles IS NOT NULL THEN
    DELETE FROM surveyor_service_outcodes WHERE surveyor_id = NEW.id;
    INSERT INTO surveyor_service_outcodes (surveyor_id, outcode, distance_miles)
    SELECT NEW.id, outcode, distance_miles FROM get_surveyor_coverage(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_surveyor_service_outcodes ON surveyors;
CREATE TRIGGER sync_surveyor_service_outcodes
AFTER INSERT OR UPDATE OF home_lat, home_lng, radius_miles ON surveyors
FOR EACH ROW EXECUTE FUNCTION sync_surveyor_service_outcodes();

-- 5. Fix the geocode trigger: correct project ref + pass surveyor_id to Edge Function
CREATE OR REPLACE FUNCTION geocode_surveyor_postcode()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.home_postcode IS NOT NULL AND (OLD.home_postcode IS NULL OR NEW.home_postcode != OLD.home_postcode) THEN
    PERFORM supabase_functions.http_request(
      'POST',
      'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/geocode-postcode',
      '{"postcode": "' || NEW.home_postcode || '", "surveyor_id": "' || NEW.id || '"}'::jsonb,
      '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS geocode_surveyor_postcode ON surveyors;
CREATE TRIGGER geocode_surveyor_postcode
AFTER INSERT OR UPDATE OF home_postcode ON surveyors
FOR EACH ROW EXECUTE FUNCTION geocode_surveyor_postcode();
