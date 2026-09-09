-- Restores real, job-size-scaled surveyor pay, properly this time.
--
-- Investigated the "does pay scale with job size" question raised in
-- 20260909001 further. Turns out the vocabulary mismatch between
-- jobs.survey_type and survey_types.survey_type isn't a live production
-- problem at all: every job created through the real public form (i.e.
-- has enquiry_id set) already uses survey_types' exact vocabulary
-- (planning_stage1, planning_stage2, subsidence, amendment...). The
-- mismatched codes (bs5837, vta, bc, mortgage, subs, other) only appear
-- on 55 jobs that are unambiguously bulk test/seed data -- all share one
-- of two created_at timestamps (2026-08-05 14:39/15:30) and cycle through
-- the same ~10 fake contact names (Sarah Whitfield, Riverside
-- Developments Ltd, etc.), created via admin/test-quote-generator.html.
--
-- The real, still-live problem: jobs has no tree_count_band column, so
-- hours could never scale by job size even for correctly-coded jobs.
-- Fix: join through enquiries (jobs.enquiry_id -> enquiries.tree_count_band)
-- when available -- true for every form-submitted job -- and fall back to
-- the flat hours_on_site default otherwise (admin-created jobs with no
-- enquiry_id, or a tree_count_band that predates the current 5-band
-- scheme). Matches surveyor pay to exactly the on-site-hours component
-- Trevor's pricing matrix defines (hours_per_band x band index) -- not
-- report_hours, which is office/report-writing time, not field time.

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

  -- Prefer real band-scaled hours; fall back to the flat per-type default
  -- (unrecognised/missing band, or a survey_type not in survey_types at
  -- all); ultimate fallback of 1 hour if even that's missing.
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
