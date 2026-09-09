-- 20260908002 fixed the dead assigned_surveyor_id column reference on the
-- surveyor policies for jobs/job_files, but left them still broken for a
-- deeper reason: every one of them also required
--   EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'surveyor' ...)
-- and public.users has never had a single row with role = 'surveyor' --
-- confirmed empty on the live table. Surveyor accounts are never given a
-- public.users row at all: surveyor-detail.html's "Link account" action
-- (line ~524) writes straight to surveyors.user_id, and the surveyor
-- mobile app (surveyor-app/) never reads public.users either -- it
-- identifies "am I this surveyor" purely via surveyors.user_id = auth.uid()
-- (see src/screens/JobListScreen.tsx, JobDetailScreen.tsx, ProfileScreen.tsx).
-- public.users is exclusively for CRM logins (admin/user roles); it was
-- never the right table to gate surveyor access on.
--
-- Rewritten to check the surveyors table directly, with no users join at
-- all. is_active/is_paused come straight off the surveyors row, which is
-- also what the admin CRM's own deactivate/reactivate flows keep in sync
-- (surveyors.html, surveyor-detail.html) -- there is no separate
-- "surveyor's account is active" signal anywhere else to check.

DROP POLICY IF EXISTS "Surveyor job visibility" ON public.jobs;
CREATE POLICY "Surveyor job visibility" ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM surveyors s
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
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
      SELECT 1 FROM surveyors s
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
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
      SELECT 1 FROM surveyors s
      JOIN jobs j ON j.id = job_files.job_id
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND (j.surveyor_id = s.id OR j.allocated_surveyor_id = s.id)
    )
  );
