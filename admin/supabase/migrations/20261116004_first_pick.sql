-- First pick (Trevor, 16 Nov 2026 call; generalised from "Antony" to any surveyor).
--
-- Trevor marks any surveyor as "First pick" in the CRM (admin only). When a job
-- goes red (unallocated), first-pick surveyors whose coverage includes the job
-- get it to themselves for pricing_settings.first_pick_hours (default 1).
-- After that it opens to everyone in coverage, as today. Next-working-day jobs
-- (deadline_tier = '1day') are never held back. Set first_pick_hours to 0 to
-- switch the whole thing off.
--
-- If no first-pick surveyor covers the job, nothing is held back.
-- Enforced in RLS (what surveyors can see/update) AND in claim_job (which is
-- SECURITY DEFINER and would otherwise bypass RLS).

ALTER TABLE public.surveyors ADD COLUMN IF NOT EXISTS first_pick BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.pricing_settings ADD COLUMN IF NOT EXISTS first_pick_hours NUMERIC NOT NULL DEFAULT 1;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS red_at TIMESTAMPTZ;

-- Existing red jobs: treat as long since available so nothing vanishes on deploy.
UPDATE public.jobs SET red_at = COALESCE(created_at, now()) WHERE dispatch_state = 'red' AND red_at IS NULL;

-- Stamp red_at each time a job becomes red (new, hand-back, plans, accepted...).
CREATE OR REPLACE FUNCTION stamp_job_red_at() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.dispatch_state = 'red'
     AND (TG_OP = 'INSERT' OR OLD.dispatch_state IS DISTINCT FROM 'red') THEN
    NEW.red_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stamp_job_red_at ON public.jobs;
CREATE TRIGGER trg_stamp_job_red_at
  BEFORE INSERT OR UPDATE OF dispatch_state ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION stamp_job_red_at();

-- Only CRM admins/users can change first_pick (surveyors can't give themselves it).
CREATE OR REPLACE FUNCTION protect_surveyor_first_pick() RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.role IN ('admin', 'user') AND u.is_active = true
  ) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.first_pick := false;
    ELSE
      NEW.first_pick := OLD.first_pick;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_surveyor_first_pick ON public.surveyors;
CREATE TRIGGER trg_protect_surveyor_first_pick
  BEFORE INSERT OR UPDATE ON public.surveyors
  FOR EACH ROW EXECUTE FUNCTION protect_surveyor_first_pick();

-- TRUE when this job is still inside its first-pick window AND this surveyor
-- is not a first-pick surveyor, i.e. they must not see or claim it yet.
CREATE OR REPLACE FUNCTION first_pick_blocks(p_job_id uuid, p_surveyor_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hours NUMERIC;
  j RECORD;
BEGIN
  SELECT COALESCE(first_pick_hours, 0) INTO v_hours FROM pricing_settings LIMIT 1;
  IF COALESCE(v_hours, 0) <= 0 THEN RETURN false; END IF;

  SELECT dispatch_state, deadline_tier, red_at, site_lat, site_lng INTO j FROM jobs WHERE id = p_job_id;
  IF NOT FOUND OR j.dispatch_state <> 'red' THEN RETURN false; END IF;
  IF j.deadline_tier = '1day' THEN RETURN false; END IF;
  IF j.red_at IS NULL OR j.red_at + make_interval(secs => v_hours * 3600) <= now() THEN RETURN false; END IF;

  -- The asking surveyor is itself first pick: not blocked.
  IF EXISTS (SELECT 1 FROM surveyors WHERE id = p_surveyor_id AND first_pick = true) THEN RETURN false; END IF;

  -- Only hold the job back if a first-pick surveyor actually covers it.
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

-- Surveyor job policies: same as 20260908003 plus the first-pick hold on open red jobs.
DROP POLICY IF EXISTS "Surveyor job visibility" ON public.jobs;
CREATE POLICY "Surveyor job visibility" ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM surveyors s
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.is_paused = false
        AND (
          jobs.surveyor_id = s.id
          OR jobs.allocated_surveyor_id = s.id
          OR (
            jobs.dispatch_state = 'red'
            AND jobs.site_lat IS NOT NULL AND jobs.site_lng IS NOT NULL
            AND s.home_lat IS NOT NULL AND s.home_lng IS NOT NULL
            AND (earth_distance(
                   ll_to_earth(s.home_lat::double precision, s.home_lng::double precision),
                   ll_to_earth(jobs.site_lat::double precision, jobs.site_lng::double precision)
                 ) / 1609.34) <= s.radius_miles::double precision
            AND NOT first_pick_blocks(jobs.id, s.id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "Surveyor update own jobs" ON public.jobs;
CREATE POLICY "Surveyor update own jobs" ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM surveyors s
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.is_paused = false
        AND (
          jobs.surveyor_id = s.id
          OR jobs.allocated_surveyor_id = s.id
          OR (
            jobs.dispatch_state = 'red'
            AND jobs.site_lat IS NOT NULL AND jobs.site_lng IS NOT NULL
            AND s.home_lat IS NOT NULL AND s.home_lng IS NOT NULL
            AND (earth_distance(
                   ll_to_earth(s.home_lat::double precision, s.home_lng::double precision),
                   ll_to_earth(jobs.site_lat::double precision, jobs.site_lng::double precision)
                 ) / 1609.34) <= s.radius_miles::double precision
            AND NOT first_pick_blocks(jobs.id, s.id)
          )
        )
    )
  );

-- claim_job: unchanged (20260909002) except for the first-pick check.
CREATE OR REPLACE FUNCTION claim_job(p_job_id uuid, p_surveyor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_survey_type TEXT;
  v_enquiry_id UUID;
  v_hourly_rate NUMERIC;
  v_tree_count_band TEXT;
  v_hours_per_band NUMERIC;
  v_hours_on_site NUMERIC;
  v_band_index INT;
  v_survey_hours NUMERIC;
  v_base_pay NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM surveyors s
    WHERE s.id = p_surveyor_id AND s.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to claim jobs as this surveyor';
  END IF;

  IF first_pick_blocks(p_job_id, p_surveyor_id) THEN
    RAISE EXCEPTION 'This job is being offered to a first-pick surveyor first. Try again later.';
  END IF;

  SELECT j.survey_type, j.enquiry_id, s.hourly_rate
  INTO v_survey_type, v_enquiry_id, v_hourly_rate
  FROM jobs j
  JOIN surveyors s ON s.id = p_surveyor_id
  WHERE j.id = p_job_id
    AND j.dispatch_state = 'red'
    AND j.surveyor_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job is no longer available or surveyor not found';
  END IF;

  IF v_enquiry_id IS NOT NULL THEN
    SELECT tree_count_band INTO v_tree_count_band
    FROM enquiries WHERE id = v_enquiry_id;
  END IF;

  SELECT hours_per_band, hours_on_site
  INTO v_hours_per_band, v_hours_on_site
  FROM survey_types
  WHERE survey_type = v_survey_type;

  v_band_index := band_index_from_tree_count(v_tree_count_band);
  v_survey_hours := COALESCE(v_hours_per_band * v_band_index, v_hours_on_site, 1);
  v_base_pay := (1 + v_survey_hours) * COALESCE(v_hourly_rate, 0);

  UPDATE public.jobs
  SET
    surveyor_id         = p_surveyor_id,
    surveyor_pay_amount = v_base_pay,
    dispatch_state      = 'orange',
    claimed_at          = now(),
    handed_back_at      = NULL,
    handed_back_note    = NULL
  WHERE id = p_job_id;
END;
$$;
