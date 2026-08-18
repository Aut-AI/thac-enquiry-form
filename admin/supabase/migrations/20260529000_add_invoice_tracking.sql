-- Sprint 2: Invoice tracking columns on jobs table
-- Run in Supabase SQL Editor.
--
-- Supports two billing modes (matching job.billing_mode):
--   'single'  — one invoice raised when report is sent; job archives on invoice
--   'staged'  — invoice1 after field data uploaded, invoice2 after report sent;
--               job archives after invoice2 is raised

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS invoice1_date     date,
  ADD COLUMN IF NOT EXISTS invoice1_amount   numeric(10,2),
  ADD COLUMN IF NOT EXISTS invoice1_paid     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice1_paid_at  timestamptz,
  ADD COLUMN IF NOT EXISTS invoice2_date     date,
  ADD COLUMN IF NOT EXISTS invoice2_amount   numeric(10,2),
  ADD COLUMN IF NOT EXISTS invoice2_paid     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice2_paid_at  timestamptz;

-- Verification
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'jobs'
--   AND column_name LIKE 'invoice%'
-- ORDER BY column_name;
