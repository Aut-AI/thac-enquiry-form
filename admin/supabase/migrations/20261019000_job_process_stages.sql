-- Trevor's job process, 19 Oct 2026 -- PART 1 of 2.
-- Run this on its own first: Postgres can't use a new enum value in the same
-- transaction that adds it. Then run 20261019001_job_process.sql.
--
-- Two new job stages after the survey:
--   data_received   -- surveyor has put the data in SharePoint and tapped Data Sent
--                      ("Survey data received, report to complete")
--   awaiting_client -- tree data sent, waiting on the client (part invoiced or not)
-- plus a timestamp for the surveyor's new Survey Done tap.

ALTER TYPE dispatch_state ADD VALUE IF NOT EXISTS 'data_received';
ALTER TYPE dispatch_state ADD VALUE IF NOT EXISTS 'awaiting_client';

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS survey_done_at timestamptz;
