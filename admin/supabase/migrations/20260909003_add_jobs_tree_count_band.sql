-- admin/job-detail.html has a permanent "Tree Count Band" edit feature on
-- every job (view/edit toggle, Set/Edit button, save handler) that has
-- always written straight to jobs.tree_count_band -- a column that has
-- never existed on the jobs table. Every attempt to set/edit tree count
-- band directly on a job (as opposed to it arriving via a linked enquiry)
-- has always failed with a "column not found" error from PostgREST.
--
-- Adds the column so that UI actually works, and re-points claim_job
-- (fixed for band-scaled pay in 20260909002, which only read
-- enquiries.tree_count_band via the enquiry_id join) to prefer this
-- column when set, falling back to the enquiry join, then the flat
-- default -- so an admin manually setting tree count on a CRM-created job
-- (no enquiry_id) now actually feeds into surveyor pay too.

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS tree_count_band TEXT;

CREATE OR REPLACE FUNCTION claim_job(p_job_id uuid, p_surveyor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_survey_type TEXT;
  v_enquiry_id UUID;
  v_job_tree_count_band TEXT;
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

  SELECT j.survey_type, j.enquiry_id, j.tree_count_band, s.hourly_rate
  INTO v_survey_type, v_enquiry_id, v_job_tree_count_band, v_hourly_rate
  FROM jobs j
  JOIN surveyors s ON s.id = p_surveyor_id
  WHERE j.id = p_job_id
    AND j.dispatch_state = 'red'
    AND j.surveyor_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job is no longer available or surveyor not found';
  END IF;

  v_tree_count_band := v_job_tree_count_band;

  IF v_tree_count_band IS NULL AND v_enquiry_id IS NOT NULL THEN
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
