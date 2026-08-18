-- Lets admin manually add or exclude specific outcodes for a surveyor on
-- top of their auto-computed radius coverage (e.g. "will also cover SP
-- even though it's just outside their radius" or "won't cross the river
-- into BS despite it being in range"). surveyor_service_outcodes is fully
-- owned by two existing triggers (sync_surveyor_service_outcodes on
-- home_lat/home_lng/radius_miles changes, sync_outcodes_on_activation_change
-- on is_active changes) that DELETE and rebuild it from scratch, so a
-- manual edit made directly there would silently vanish the next time either
-- fires. Overrides are recorded separately here and re-applied by both
-- triggers (via a shared resync function) plus a new trigger on this table
-- itself, so surveyor_service_outcodes stays the single source of truth
-- every consumer (mobile app, JobListScreen/JobMapScreen, enquiry-form)
-- already reads from -- nothing downstream needs to change.

CREATE TABLE surveyor_outcode_overrides (
  id BIGSERIAL PRIMARY KEY,
  surveyor_id UUID NOT NULL REFERENCES surveyors(id) ON DELETE CASCADE,
  outcode TEXT NOT NULL REFERENCES uk_outcodes(outcode) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK (override_type IN ('include', 'exclude')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (surveyor_id, outcode)
);

ALTER TABLE surveyor_outcode_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read overrides" ON surveyor_outcode_overrides
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated write overrides" ON surveyor_outcode_overrides
  FOR ALL USING (auth.role() = 'authenticated');

-- Shared rebuild logic: radius coverage, then overrides applied on top.
-- Called from both existing rebuild triggers plus the new overrides
-- trigger below, so all three paths that can touch this surveyor's
-- outcodes stay consistent instead of three copies of this logic drifting
-- apart the way sync_surveyor_service_outcodes and
-- sync_outcodes_on_activation_change already had (the latter never
-- applied overrides at all until now).
CREATE OR REPLACE FUNCTION public.resync_surveyor_outcodes(p_surveyor_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_home_lat NUMERIC;
  v_home_lng NUMERIC;
  v_radius_miles NUMERIC;
  v_is_active BOOLEAN;
BEGIN
  SELECT home_lat, home_lng, radius_miles, is_active
    INTO v_home_lat, v_home_lng, v_radius_miles, v_is_active
  FROM surveyors WHERE id = p_surveyor_id;

  IF v_home_lat IS NULL OR v_home_lng IS NULL OR v_radius_miles IS NULL OR NOT v_is_active THEN
    RETURN;
  END IF;

  DELETE FROM surveyor_service_outcodes WHERE surveyor_id = p_surveyor_id;
  INSERT INTO surveyor_service_outcodes (surveyor_id, outcode, distance_miles)
  SELECT p_surveyor_id, outcode, distance_miles FROM get_surveyor_coverage(p_surveyor_id);

  DELETE FROM surveyor_service_outcodes sso
  USING surveyor_outcode_overrides ov
  WHERE sso.surveyor_id = p_surveyor_id
    AND ov.surveyor_id = p_surveyor_id
    AND ov.outcode = sso.outcode
    AND ov.override_type = 'exclude';

  INSERT INTO surveyor_service_outcodes (surveyor_id, outcode, distance_miles)
  SELECT p_surveyor_id, ov.outcode,
         ROUND((3958.8 * acos(
           cos(radians(v_home_lat)) * cos(radians(o.latitude)) *
           cos(radians(o.longitude) - radians(v_home_lng)) +
           sin(radians(v_home_lat)) * sin(radians(o.latitude))
         ))::numeric, 2)
  FROM surveyor_outcode_overrides ov
  JOIN uk_outcodes o ON o.outcode = ov.outcode
  WHERE ov.surveyor_id = p_surveyor_id
    AND ov.override_type = 'include'
  ON CONFLICT (surveyor_id, outcode) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_surveyor_service_outcodes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.home_lat IS NOT NULL AND NEW.home_lng IS NOT NULL AND NEW.radius_miles IS NOT NULL AND NEW.is_active = true THEN
    PERFORM resync_surveyor_outcodes(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_outcodes_on_activation_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.is_active = false AND OLD.is_active IS DISTINCT FROM false THEN
    DELETE FROM surveyor_service_outcodes WHERE surveyor_id = NEW.id;
  ELSIF NEW.is_active = true AND OLD.is_active IS DISTINCT FROM true THEN
    IF NEW.home_lat IS NOT NULL AND NEW.home_lng IS NOT NULL AND NEW.radius_miles IS NOT NULL THEN
      PERFORM resync_surveyor_outcodes(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Applying/removing an override takes effect immediately, not just on the
-- next unrelated surveyor edit.
CREATE OR REPLACE FUNCTION public.apply_surveyor_outcode_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  PERFORM resync_surveyor_outcodes(COALESCE(NEW.surveyor_id, OLD.surveyor_id));
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE TRIGGER trg_apply_outcode_override
  AFTER INSERT OR UPDATE OR DELETE ON surveyor_outcode_overrides
  FOR EACH ROW EXECUTE FUNCTION apply_surveyor_outcode_override();
