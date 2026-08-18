-- Sprint 4: Document links on jobs (§8.3 post-acceptance form).
-- Admin pastes Google Drive sharing links after client submits documents.
-- Surveyors access these links after claiming the job.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS topo_survey_provided  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS doc_block_plan_url    text,
  ADD COLUMN IF NOT EXISTS doc_topo_survey_url   text,
  ADD COLUMN IF NOT EXISTS doc_other_urls        text;
