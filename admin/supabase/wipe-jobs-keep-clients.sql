-- WIPE ALL JOBS, KEEP CUSTOMERS (clients table). Nick, 2026-11-26.
-- NOT a migration: run by hand in the Supabase SQL editor. Irreversible.
--
-- Deletes: every row in jobs, plus any table that has a foreign key to jobs
-- and would block the delete (found automatically). Rows whose FK is
-- ON DELETE CASCADE (e.g. job_nda_acceptance) go with the jobs; rows with
-- ON DELETE SET NULL (e.g. other tables pointing at a job) just lose the link.
-- Also deletes every enquiry (Trevor wants to start fresh, and each job comes from
-- one), plus any rows that block that delete.
-- Keeps: clients, surveyors, users, settings, pricing, work_log.
--
-- BEFORE YOU RUN IT: GitHub Actions > "Database Backup" > Run workflow, so
-- there is a restore point. Job files in the storage bucket THAC-CRM_Bucket
-- are NOT removed by this; delete them by hand in the dashboard if wanted.
--
-- STEP 1: run just this SELECT to see what is about to go.
SELECT
  (SELECT count(*) FROM public.jobs)                          AS jobs,
  (SELECT count(*) FROM public.clients)                       AS clients_kept,
  (SELECT count(*) FROM public.enquiries)                     AS enquiries_deleted,
  (SELECT count(*) FROM public.surveyors)                     AS surveyors_kept;

-- STEP 2: run this block to do it. It is one transaction: any error rolls
-- everything back and nothing is deleted.
BEGIN;

DO $$
DECLARE
  fk RECORD;
  n  BIGINT;
BEGIN
  -- Tables that reference jobs without cascade / set null (would block the delete).
  FOR fk IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.jobs'::regclass
      AND c.conrelid <> 'public.jobs'::regclass
      AND c.confdeltype IN ('a', 'r')   -- NO ACTION / RESTRICT
  LOOP
    EXECUTE format('DELETE FROM %s WHERE %I IN (SELECT id FROM public.jobs)', fk.tbl, fk.col);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'deleted % rows from %', n, fk.tbl;
  END LOOP;

  -- Self reference (parent_job_id): a single DELETE of all rows is fine.
  DELETE FROM public.jobs;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'deleted % jobs', n;

  -- Enquiries: same approach for anything that would block the delete.
  FOR fk IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.enquiries'::regclass
      AND c.conrelid <> 'public.enquiries'::regclass
      AND c.confdeltype IN ('a', 'r')
  LOOP
    EXECUTE format('DELETE FROM %s WHERE %I IN (SELECT id FROM public.enquiries)', fk.tbl, fk.col);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'deleted % rows from %', n, fk.tbl;
  END LOOP;
  DELETE FROM public.enquiries;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'deleted % enquiries', n;
END $$;

-- Check before committing: jobs and enquiries should be 0, clients unchanged from step 1.
SELECT
  (SELECT count(*) FROM public.jobs)      AS jobs_now,
  (SELECT count(*) FROM public.enquiries) AS enquiries_now,
  (SELECT count(*) FROM public.clients)   AS clients_now,
  (SELECT count(*) FROM public.surveyors) AS surveyors_now;

COMMIT;   -- change to ROLLBACK; if the numbers above look wrong
