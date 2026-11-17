-- Allocation hides the job (Trevor, 16 Nov call).
-- While a red job is allocated to a surveyor who hasn't accepted, rejected or
-- timed out (allocation_timeout_hours, default 48), other surveyors can't see
-- or claim it. Extends first_pick_blocks() from 20261116004, which both the
-- surveyor RLS policies and claim_job already call, so no policy changes.
-- Needs the 004 migration to have run first.

CREATE OR REPLACE FUNCTION first_pick_blocks(p_job_id uuid, p_surveyor_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hours NUMERIC;
  j RECORD;
BEGIN
  SELECT dispatch_state, deadline_tier, red_at, site_lat, site_lng,
         surveyor_id, allocated_surveyor_id, allocated_at,
         allocation_rejected_at, allocation_timeout_hours
    INTO j FROM jobs WHERE id = p_job_id;
  IF NOT FOUND OR j.dispatch_state <> 'red' THEN RETURN false; END IF;

  -- Allocated to someone else and still live: hidden from everyone else.
  IF j.allocated_surveyor_id IS NOT NULL
     AND j.surveyor_id IS NULL
     AND j.allocation_rejected_at IS NULL
     AND j.allocated_at IS NOT NULL
     AND j.allocated_at + make_interval(hours => COALESCE(j.allocation_timeout_hours, 48)) > now() THEN
    RETURN j.allocated_surveyor_id <> p_surveyor_id;
  END IF;

  -- First pick window.
  SELECT COALESCE(first_pick_hours, 0) INTO v_hours FROM pricing_settings LIMIT 1;
  IF COALESCE(v_hours, 0) <= 0 THEN RETURN false; END IF;
  IF j.deadline_tier = '1day' THEN RETURN false; END IF;
  IF j.red_at IS NULL OR j.red_at + make_interval(secs => v_hours * 3600) <= now() THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM surveyors WHERE id = p_surveyor_id AND first_pick = true) THEN RETURN false; END IF;

  RETURN EXISTS (
    SELECT 1 FROM surveyors fp
    WHERE fp.first_pick = true AND fp.is_active = true AND fp.is_paused = false
      AND j.site_lat IS NOT NULL AND j.site_lng IS NOT NULL
      AND fp.home_lat IS NOT NULL AND fp.home_lng IS NOT NULL
      AND (earth_distance(
             ll_to_earth(fp.home_lat::double precision, fp.home_lng::double precision),
             ll_to_earth(j.site_lat::double precision, j.site_lng::double precision)
           ) / 1609.34) <= fp.radius_miles::double precision
  );
END;
$$;
