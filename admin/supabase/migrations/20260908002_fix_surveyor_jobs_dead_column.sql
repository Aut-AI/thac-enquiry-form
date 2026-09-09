-- Surveyors currently cannot see or update ANY job, including their own.
--
-- Root cause: "Surveyor job visibility" (SELECT) and "Surveyor update own
-- jobs" (UPDATE) on jobs, and "Surveyor access to own job files" (ALL) on
-- job_files, all gate on jobs.assigned_surveyor_id. That column exists but
-- the app has never written to it -- confirmed NULL on all 67 live job
-- rows. The app actually uses jobs.surveyor_id (set when a surveyor claims
-- or is confirmed on a job -- 11 jobs currently) and
-- jobs.allocated_surveyor_id (set when admin proactively offers a specific
-- job to a specific surveyor via job-detail.html's "Allocate to Surveyor"
-- action, pending accept/reject -- 0 currently set, but a real live flow).
--
-- These policies were apparently correct once, before the app was
-- refactored onto surveyor_id/allocated_surveyor_id, and nobody caught
-- that the RLS side was left behind -- policies here are hand-edited in
-- the Dashboard, not tracked in migrations (see 20260818002's own note).
--
-- The marketplace radius-match logic (dispatch_state = 'red' + earth_distance
-- vs the surveyor's home location and radius_miles) is untouched -- it was
-- already correct, just unreachable because the whole USING clause is one
-- OR'd condition and evaluating it never even got past the dead column
-- check mattering for the "is this MY job" half.

DROP POLICY IF EXISTS "Surveyor job visibility" ON public.jobs;
CREATE POLICY "Surveyor job visibility" ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN surveyors s ON s.user_id = u.id
      WHERE u.id = auth.uid()
        AND u.role = 'surveyor'
        AND u.is_active = true
        AND s.is_paused = false
        AND (
          jobs.surveyor_id = s.id
          OR jobs.allocated_surveyor_id = s.id
          OR (
            jobs.dispatch_state = 'red'
            AND jobs.site_lat IS NOT NULL AND jobs.site_lng IS NOT NULL
            AND s.home_lat IS NOT NULL AND s.home_lng IS NOT NULL
            AND (earth_distance(
                   ll_to_earth(s.home_lat::double precision, s.home_lng::double precision),
                   ll_to_earth(jobs.site_lat::double precision, jobs.site_lng::double precision)
                 ) / 1609.34) <= s.radius_miles::double precision
          )
        )
    )
  );

DROP POLICY IF EXISTS "Surveyor update own jobs" ON public.jobs;
CREATE POLICY "Surveyor update own jobs" ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN surveyors s ON s.user_id = u.id
      WHERE u.id = auth.uid()
        AND u.role = 'surveyor'
        AND u.is_active = true
        AND s.is_paused = false
        AND (
          jobs.surveyor_id = s.id
          OR jobs.allocated_surveyor_id = s.id
          OR (
            jobs.dispatch_state = 'red'
            AND jobs.site_lat IS NOT NULL AND jobs.site_lng IS NOT NULL
            AND s.home_lat IS NOT NULL AND s.home_lng IS NOT NULL
            AND (earth_distance(
                   ll_to_earth(s.home_lat::double precision, s.home_lng::double precision),
                   ll_to_earth(jobs.site_lat::double precision, jobs.site_lng::double precision)
                 ) / 1609.34) <= s.radius_miles::double precision
          )
        )
    )
  );

DROP POLICY IF EXISTS "Surveyor access to own job files" ON public.job_files;
CREATE POLICY "Surveyor access to own job files" ON public.job_files
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN surveyors s ON s.user_id = u.id
      JOIN jobs j ON j.id = job_files.job_id
      WHERE u.id = auth.uid()
        AND u.role = 'surveyor'
        AND (j.surveyor_id = s.id OR j.allocated_surveyor_id = s.id)
    )
  );
