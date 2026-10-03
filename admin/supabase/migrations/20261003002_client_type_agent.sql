-- 20261003000_job_introducer.sql stores introducers as clients with
-- client_type 'agent' (and client-detail.html has always offered 'agent'
-- and 'developer' in its type dropdown), but the client_type enum never
-- had those values -- so the jobs list's introducer lookup 400'd, and any
-- enquiry with an introducer email would have failed to insert.
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'agent';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'developer';

-- Check afterwards in a SEPARATE run (new enum values can't be read back
-- in the same transaction that adds them):
--   SELECT unnest(enum_range(NULL::public.client_type));
