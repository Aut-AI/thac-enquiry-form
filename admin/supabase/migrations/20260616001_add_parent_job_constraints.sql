-- Ensure parent_job_id has proper foreign key constraint and indexing
-- This supports the job linking system for parent-child relationships

-- Add foreign key constraint if it doesn't exist
ALTER TABLE public.jobs
  ADD CONSTRAINT fk_parent_job_id
  FOREIGN KEY (parent_job_id)
  REFERENCES public.jobs(id)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Add index for fast parent lookups
CREATE INDEX IF NOT EXISTS idx_jobs_parent_job_id ON public.jobs(parent_job_id);
