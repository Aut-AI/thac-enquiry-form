-- Sprint 3: Track whether the survey date has been confirmed by the client.
-- false = proposed (admin suggested, client not yet confirmed) → shown in orange
-- true  = confirmed (client confirmed) → shown in green

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS survey_date_confirmed boolean NOT NULL DEFAULT false;
