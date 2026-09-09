-- CRITICAL: claim_job() and hand_back_job() (20260530011, updated by
-- 002_update_claim_job_with_pay_calc) are SECURITY DEFINER with no internal
-- authorization check at all, and no GRANT/REVOKE was ever applied to them
-- -- Supabase's default privilege model means anon (the public key embedded
-- in enquiry-form/index.html, visible to anyone) can call both:
--
--   claim_job(p_job_id, p_surveyor_id) -- assigns ANY unclaimed job to
--     ANY surveyor id the caller supplies, no check that the caller has
--     any relationship to that surveyor. Confirmed callable with the bare
--     anon key, zero login.
--
--   hand_back_job(p_job_id, p_note) -- un-claims ANY currently-claimed
--     ('orange') job, wiping surveyor_id/claimed_at and writing an
--     arbitrary p_note into handed_back_note, regardless of who claimed
--     it. Also confirmed callable with the bare anon key.
--
-- Both were meant to be called by the surveyor mobile app (surveyor-app/)
-- on behalf of the logged-in surveyor -- claim_job's p_surveyor_id
-- parameter was always supposed to be "me", never an arbitrary target.
--
-- Fixed two ways (defense in depth, since Dashboard-level GRANT changes
-- are exactly the kind of thing that's gone unnoticed here before):
--   1. Revoke EXECUTE from anon and PUBLIC; grant only to authenticated.
--   2. Add an explicit ownership check inside each function body so even
--      an authenticated-but-unrelated caller (or a future grant mistake)
--      can't act on someone else's surveyor identity or someone else's job.

REVOKE ALL ON FUNCTION public.claim_job(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hand_back_job(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_job(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hand_back_job(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION claim_job(p_job_id uuid, p_surveyor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_survey_type TEXT;
  v_urgency_state TEXT;
  v_hourly_rate NUMERIC;
  v_survey_hours NUMERIC;
  v_base_pay NUMERIC;
  v_final_pay NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM surveyors s
    WHERE s.id = p_surveyor_id AND s.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to claim jobs as this surveyor';
  END IF;

  SELECT j.survey_type, j.urgency_state, s.hourly_rate
  INTO v_survey_type, v_urgency_state, v_hourly_rate
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

  v_final_pay := CASE
    WHEN v_urgency_state = 'red' THEN v_base_pay * 1.2
    ELSE v_base_pay
  END;

  UPDATE public.jobs
  SET
    surveyor_id         = p_surveyor_id,
    surveyor_pay_amount = v_final_pay,
    dispatch_state      = 'orange',
    claimed_at          = now(),
    handed_back_at      = NULL,
    handed_back_note    = NULL
  WHERE id = p_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION hand_back_job(p_job_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.jobs
  SET
    surveyor_id      = NULL,
    dispatch_state   = 'red',
    claimed_at       = NULL,
    handed_back_at   = now(),
    handed_back_note = p_note
  WHERE id = p_job_id
    AND dispatch_state IN ('orange')
    AND surveyor_id = (SELECT id FROM surveyors WHERE user_id = auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job cannot be handed back from its current state';
  END IF;
END;
$$;
