-- Fixes a regression I (Claude) introduced in 20260908004. That migration
-- fixed a real, critical bug (claim_job/hand_back_job callable by anyone
-- with the bare anon key, no authorization check at all) but in doing so
-- copied the pay-calculation body from the OLDEST version of claim_job
-- (002_update_claim_job_with_pay_calc.sql) rather than the version that
-- was actually last live -- reintroducing a 20% "urgency uplift" bonus
-- for red-urgency jobs that Trevor had already explicitly decided to
-- remove (see 20260703001_treatment_pricing_matrix.sql: "remove urgency
-- bonus (x1.2)").
--
-- This does NOT restore 20260703001's hours_per_band x band_index scaling
-- -- that version referenced jobs.tree_count_band, a column that has never
-- existed on the jobs table (confirmed against the live schema), so it
-- would have hard-failed on every single claim attempt had it actually
-- been live. Separately, jobs.survey_type uses a different vocabulary
-- (bs5837, vta, bc, mortgage...) than survey_types.survey_type (bs_survey,
-- insurer_mortgage...), so the hours lookup silently misses for most real
-- jobs regardless. Both are real, deeper problems flagged to Nick
-- separately -- not fixed here, since correcting them means deciding how
-- jobs.survey_type should map to the pricing matrix, a product decision,
-- not something to guess at inside an authorization-focused hotfix.
--
-- This migration only removes the reintroduced urgency bonus, restoring
-- exactly the flat (1 + hours_on_site) x hourly_rate formula with no
-- multiplier -- the narrowest fix that undoes just the regression.

CREATE OR REPLACE FUNCTION claim_job(p_job_id uuid, p_surveyor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_survey_type TEXT;
  v_hourly_rate NUMERIC;
  v_survey_hours NUMERIC;
  v_base_pay NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM surveyors s
    WHERE s.id = p_surveyor_id AND s.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to claim jobs as this surveyor';
  END IF;

  SELECT j.survey_type, s.hourly_rate
  INTO v_survey_type, v_hourly_rate
  FROM jobs j
  JOIN surveyors s ON s.id = p_surveyor_id
  WHERE j.id = p_job_id
    AND j.dispatch_state = 'red'
    AND j.surveyor_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job is no longer available or surveyor not found';
  END IF;

  SELECT COALESCE(hours_on_site, 1)
  INTO v_survey_hours
  FROM survey_types
  WHERE survey_type = v_survey_type;

  v_base_pay := (1 + COALESCE(v_survey_hours, 1)) * COALESCE(v_hourly_rate, 0);

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
