-- Sprint 4: Site access details on jobs.
-- Free text captured by admin after client accepts quote (§8.3).
-- Shown to surveyor after they claim the job (orange dot unlock).

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS site_access_notes text,
  ADD COLUMN IF NOT EXISTS billing_contact_name  text,
  ADD COLUMN IF NOT EXISTS billing_contact_email text;
