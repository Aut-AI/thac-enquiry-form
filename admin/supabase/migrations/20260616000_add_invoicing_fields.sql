-- Add invoicing method and report generation tracking to jobs
-- Supports 50/50 split invoicing on survey fee or single bill invoicing
-- invoicing_method: 'split' (default) or 'single'
-- report_generated: tracks if survey report was generated (determines if 2nd 50% of survey fee is invoiced)

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS invoicing_method text DEFAULT 'split' CHECK (invoicing_method IN ('split', 'single')),
  ADD COLUMN IF NOT EXISTS report_generated boolean DEFAULT false;
