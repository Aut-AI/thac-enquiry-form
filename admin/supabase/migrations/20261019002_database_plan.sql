-- Trevor, 19 Oct 2026: once a job's database is created, record whether it
-- was built from the digital plan or only a JPEG (still awaiting the digital
-- plan). NULL with axi_prepared = true means it was ticked before this existed.
-- Run BEFORE pushing: the jobs list and dashboard select this column.

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS database_plan text
  CHECK (database_plan IN ('digital', 'jpeg'));
