-- Sprint 6: Two-stage BS5837 report handling.
--
-- Stage 1: Survey carried out. Field data uploaded. Draft report started.
-- Stage 2: Plans arrive from architect. Final report completed and sent.
--
-- Stage 2 jobs sit in 'waiting_for_plans' until admin activates them.
-- On activation, SLA timer starts and job goes live on the map (red dot).

-- 1. Link Stage 2 jobs back to their Stage 1 parent
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS parent_job_id uuid REFERENCES public.jobs(id);

-- 2. Add 'waiting_for_plans' to the dispatch_state enum (safe — IF NOT EXISTS)
DO $$
BEGIN
  BEGIN
    ALTER TYPE dispatch_state ADD VALUE IF NOT EXISTS 'waiting_for_plans';
  EXCEPTION WHEN others THEN
    NULL;
  END;
END $$;
