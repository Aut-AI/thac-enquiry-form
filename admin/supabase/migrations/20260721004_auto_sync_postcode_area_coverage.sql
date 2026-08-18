-- Three gaps, found together while checking what happens to area coverage
-- when a surveyor is removed:
--
-- 1. "Removing" a surveyor in admin (surveyor-detail.html's toggleActive())
--    only flips is_active/status -- it never touches
--    surveyor_service_outcodes. A deactivated surveyor's outcodes stay in
--    that table forever, so they'd keep counting as covering their area,
--    which would also silently break the enquiry-form's granular outcode
--    gate (fixed in 20260721_*), not just postcode_areas.
-- 2. postcode_areas.is_covered was purely admin-toggled with no link back
--    to actual surveyor coverage at all, so even once (1) is fixed, nothing
--    would update it when the last surveyor covering an area disappears.
-- 3. The other direction of the same problem: sync_surveyor_service_outcodes
--    (from 20260630_surveyor_radius_coverage.sql) populates
--    surveyor_service_outcodes as soon as a surveyor is geocoded, with no
--    check on is_active/status at all -- so a brand-new, still-pending,
--    not-yet-approved registration already counts as coverage the moment
--    the geocode callback lands, before Trevor has approved anyone.
--
-- Fix: sync_surveyor_service_outcodes now only populates rows for active
-- surveyors; deactivating a surveyor removes their service outcodes;
-- reactivating (which is also how approval turns on coverage for the first
-- time) repopulates them from their current geocoded location; and a
-- trigger on surveyor_service_outcodes keeps postcode_areas.is_covered in
-- sync automatically in both directions, keyed off whether *any* surveyor
-- still covers that outcode's area -- no manual toggle needed going forward.

CREATE OR REPLACE FUNCTION sync_surveyor_service_outcodes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.home_lat IS NOT NULL AND NEW.home_lng IS NOT NULL AND NEW.radius_miles IS NOT NULL AND NEW.is_active = true THEN
    DELETE FROM surveyor_service_outcodes WHERE surveyor_id = NEW.id;
    INSERT INTO surveyor_service_outcodes (surveyor_id, outcode, distance_miles)
    SELECT NEW.id, outcode, distance_miles FROM get_surveyor_coverage(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION sync_outcodes_on_activation_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = false AND OLD.is_active IS DISTINCT FROM false THEN
    DELETE FROM surveyor_service_outcodes WHERE surveyor_id = NEW.id;
  ELSIF NEW.is_active = true AND OLD.is_active IS DISTINCT FROM true THEN
    IF NEW.home_lat IS NOT NULL AND NEW.home_lng IS NOT NULL AND NEW.radius_miles IS NOT NULL THEN
      INSERT INTO surveyor_service_outcodes (surveyor_id, outcode, distance_miles)
      SELECT NEW.id, outcode, distance_miles FROM get_surveyor_coverage(NEW.id)
      ON CONFLICT (surveyor_id, outcode) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_outcodes_on_activation_change ON surveyors;
CREATE TRIGGER trg_sync_outcodes_on_activation_change
AFTER UPDATE OF is_active ON surveyors
FOR EACH ROW EXECUTE FUNCTION sync_outcodes_on_activation_change();

CREATE OR REPLACE FUNCTION sync_postcode_area_coverage()
RETURNS TRIGGER AS $$
DECLARE
  affected_area_code text;
BEGIN
  affected_area_code := upper(substring(COALESCE(NEW.outcode, OLD.outcode) FROM '^[A-Za-z]{1,2}'));

  UPDATE postcode_areas
  SET is_covered = EXISTS (
    SELECT 1 FROM surveyor_service_outcodes sso
    WHERE upper(substring(sso.outcode FROM '^[A-Za-z]{1,2}')) = affected_area_code
  )
  WHERE area_code = affected_area_code;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_postcode_area_coverage ON surveyor_service_outcodes;
CREATE TRIGGER trg_sync_postcode_area_coverage
AFTER INSERT OR UPDATE OR DELETE ON surveyor_service_outcodes
FOR EACH ROW EXECUTE FUNCTION sync_postcode_area_coverage();

-- One-time cleanup: remove stale outcodes for any surveyor already inactive
-- (the trigger above only fires on future is_active changes), then recompute
-- is_covered for every area so the current state is correct immediately
-- rather than only from the next change onward.
DELETE FROM surveyor_service_outcodes sso
USING surveyors s
WHERE sso.surveyor_id = s.id AND s.is_active = false;

UPDATE postcode_areas pa
SET is_covered = EXISTS (
  SELECT 1 FROM surveyor_service_outcodes sso
  WHERE upper(substring(sso.outcode FROM '^[A-Za-z]{1,2}')) = pa.area_code
);
