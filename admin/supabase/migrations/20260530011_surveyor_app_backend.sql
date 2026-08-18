-- Surveyor app backend preparation.
-- Links surveyors to Supabase auth users and adds surveyor-facing job fields.

-- 1. Link surveyors table to Supabase auth.users
--    Admin creates the auth account then sets this FK to link the profile.
ALTER TABLE public.surveyors
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS surveyors_user_id_idx ON public.surveyors(user_id);

-- 2. Job fields needed by the surveyor app
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS claimed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS surveyor_notes   text,
  ADD COLUMN IF NOT EXISTS handed_back_at   timestamptz,
  ADD COLUMN IF NOT EXISTS handed_back_note text;

-- 3. Helper function: claim a job (surveyor_id + dispatch_state → orange)
CREATE OR REPLACE FUNCTION claim_job(p_job_id uuid, p_surveyor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.jobs
  SET
    surveyor_id    = p_surveyor_id,
    dispatch_state = 'orange',
    claimed_at     = now(),
    handed_back_at = NULL,
    handed_back_note = NULL
  WHERE id = p_job_id
    AND dispatch_state = 'red'
    AND surveyor_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job is no longer available';
  END IF;
END;
$$;

-- 4. Helper function: hand back a job (clears surveyor, returns to red)
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
    AND dispatch_state IN ('orange');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job cannot be handed back from its current state';
  END IF;
END;
$$;
