-- Trevor, 2026-11-16 call: a job goes on the map as soon as it exists, even if
-- the plans are still to come. Surveyors can claim it, it shows a different pin
-- colour, the SLA clock starts when it goes on the map, and the CRM flags it.
--
-- Implemented as a flag on an ordinary map job (dispatch_state 'red') rather
-- than a stage, so claim_job, RLS and app builds already on phones need no
-- change. The old 'waiting_for_plans' stage is retired for new jobs (the enum
-- value stays).

BEGIN;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS plans_outstanding BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS plans_received_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS unaccepted_alert_sent_at TIMESTAMPTZ;   -- used by Allocate/Take Back and the 2-day email

-- Preview: jobs that will move
SELECT reference, site_postcode, surveyor_id, sla_deadline FROM jobs
 WHERE dispatch_state = 'waiting_for_plans' AND NOT coalesce(is_archived, false);

-- Existing waiting-for-plans jobs go onto the map flagged. A surveyor-assigned
-- one goes straight to Allocated.
UPDATE jobs
   SET plans_outstanding = true,
       dispatch_state = CASE WHEN surveyor_id IS NOT NULL THEN 'orange' ELSE 'red' END::dispatch_state
 WHERE dispatch_state = 'waiting_for_plans';

COMMIT;
