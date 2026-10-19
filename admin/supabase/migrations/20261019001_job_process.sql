-- Trevor's job process, 19 Oct 2026 -- PART 2 of 2 (run 20261019000 first).
--
--   1. Accepted quote / new job  -> straight onto the map as Unallocated (red)
--   2. Surveyor claims            -> Allocated (orange; a green pin on the map)
--   3. Surveyor taps Survey Done  -> yellow, off the map
--   4. Surveyor taps Data Sent    -> data_received (data is in SharePoint)
--   5. Office finishes the job    -> archived (Report & Invoice Sent) or
--                                    awaiting_client (tree data sent, part / not invoiced)
--
-- Run AFTER the code is deployed (git push): the backfill in step 3 moves
-- jobs onto the map, and the deployed emails know not to send for that.

BEGIN;

-- 1. SURVEYOR APP: Survey Done and Data Sent ---------------------------------
-- Replaces guard_surveyor_job_update (db-logic-fixes, 5 Oct). Surveyors may
-- still only change: their notes, the two progress taps on their own jobs,
-- and rejecting an offer. App builds 1.0.7 and older have one button ("Mark
-- Field Data Uploaded", orange -> yellow with field_data_uploaded): that
-- means the data has been sent, so it lands on data_received.
CREATE OR REPLACE FUNCTION public.guard_surveyor_job_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me uuid;
  v_allowed jsonb;
  v_now text := to_jsonb(now())#>>'{}';
BEGIN
  -- Only direct API calls by signed-in non-admins (not service role, not SECURITY DEFINER RPCs)
  IF current_user <> 'authenticated' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','user') AND u.is_active) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_me FROM surveyors WHERE user_id = auth.uid();

  v_allowed := jsonb_build_object('updated_at', NEW.updated_at);
  IF OLD.surveyor_id = v_me THEN
    v_allowed := v_allowed || jsonb_build_object('surveyor_notes', NEW.surveyor_notes);

    IF OLD.dispatch_state = 'orange' AND NEW.dispatch_state = 'yellow' THEN
      IF NEW.field_data_uploaded THEN
        -- Old app: survey done and data sent in one tap
        v_allowed := v_allowed || jsonb_build_object(
          'dispatch_state',         'data_received',
          'survey_done_at',         coalesce(to_jsonb(NEW.field_data_uploaded_at)#>>'{}', v_now),
          'field_data_uploaded',    true,
          'field_data_uploaded_at', coalesce(to_jsonb(NEW.field_data_uploaded_at)#>>'{}', v_now));
      ELSE
        -- Survey Done
        v_allowed := v_allowed || jsonb_build_object(
          'dispatch_state', 'yellow',
          'survey_done_at', coalesce(to_jsonb(NEW.survey_done_at)#>>'{}', v_now));
      END IF;
    END IF;

    IF OLD.dispatch_state = 'yellow' AND NEW.dispatch_state = 'data_received' THEN
      -- Data Sent (fires notify-field-data-uploaded via field_data_uploaded)
      v_allowed := v_allowed || jsonb_build_object(
        'dispatch_state',         'data_received',
        'field_data_uploaded',    true,
        'field_data_uploaded_at', coalesce(to_jsonb(NEW.field_data_uploaded_at)#>>'{}', v_now));
    END IF;
  END IF;
  IF OLD.allocated_surveyor_id = v_me AND NEW.allocated_surveyor_id IS NULL THEN
    v_allowed := v_allowed || jsonb_build_object(
      'allocated_surveyor_id',  NULL,
      'allocation_rejected_at', NEW.allocation_rejected_at);
  END IF;

  NEW := jsonb_populate_record(OLD, v_allowed);
  RETURN NEW;
END;
$$;

-- 2. URGENCY: no SLA clock while waiting on the client ------------------------
-- Same as enable-cron.sql (5 Oct) plus awaiting_client in the exclusions.
CREATE OR REPLACE FUNCTION public.recalculate_urgency_states()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE jobs j SET urgency_state = x.u
  FROM (
    SELECT id, (CASE
      WHEN working_days_until(sla_deadline) <= 3  THEN 'red'
      WHEN working_days_until(sla_deadline) <= 5  THEN 'orange'
      WHEN working_days_until(sla_deadline) <= 10 THEN 'yellow'
      ELSE 'grey' END)::urgency_state AS u
    FROM jobs
    WHERE sla_deadline IS NOT NULL            -- no SLA: keep what admin set
      AND is_archived = false
      AND dispatch_state NOT IN ('archived', 'green', 'awaiting_client')
  ) x
  WHERE j.id = x.id AND j.urgency_state IS DISTINCT FROM x.u;
END;
$$;

-- 3. EXISTING JOBS -------------------------------------------------------------
-- See what will move before it moves.
SELECT 'to map (red)' AS change, count(*) FROM jobs j
 WHERE j.dispatch_state = 'pending_approval' AND j.job_type IS DISTINCT FROM 'amendment' AND NOT coalesce(j.is_archived, false)
   AND (j.enquiry_id IS NULL OR EXISTS (SELECT 1 FROM enquiries e WHERE e.id = j.enquiry_id AND e.status = 'accepted'))
UNION ALL
SELECT 'attended -> data received', count(*) FROM jobs WHERE dispatch_state = 'yellow' AND field_data_uploaded
UNION ALL
SELECT 'report generated -> drafted', count(*) FROM jobs WHERE report_generated AND NOT coalesce(report_drafted, false);

-- Waiting for approval but already accepted (or added by hand): onto the map.
-- Website jobs whose quote isn't accepted yet stay as Awaiting Go-ahead.
UPDATE jobs j SET dispatch_state = 'red'
 WHERE j.dispatch_state = 'pending_approval' AND j.job_type IS DISTINCT FROM 'amendment' AND NOT coalesce(j.is_archived, false)
   AND (j.enquiry_id IS NULL OR EXISTS (SELECT 1 FROM enquiries e WHERE e.id = j.enquiry_id AND e.status = 'accepted'));

-- "Attended" meant the field data was uploaded, which is now Data Received.
UPDATE jobs SET dispatch_state = 'data_received', survey_done_at = coalesce(survey_done_at, field_data_uploaded_at)
 WHERE dispatch_state = 'yellow' AND field_data_uploaded;

-- The old "Report generated" tick becomes Trevor's "Report drafted".
UPDATE jobs SET report_drafted = true, report_drafted_at = coalesce(report_drafted_at, now())
 WHERE report_generated AND NOT coalesce(report_drafted, false);

COMMIT;

-- AFTER: stage counts
SELECT dispatch_state, count(*) FROM jobs WHERE NOT coalesce(is_archived, false) GROUP BY 1 ORDER BY 1;
