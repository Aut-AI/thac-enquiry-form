-- "Report to generate" flag, next to the existing jobs.report_generated.
-- Both are only meaningful once a surveyor is allocated; the admin UI disables the
-- tickboxes (job detail + jobs list) and the dashboard only counts allocated jobs.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS report_to_generate boolean NOT NULL DEFAULT false;

-- Dashboard "Reports" counts
CREATE INDEX IF NOT EXISTS idx_jobs_report_flags
  ON public.jobs (report_to_generate, report_generated)
  WHERE surveyor_id IS NOT NULL;
