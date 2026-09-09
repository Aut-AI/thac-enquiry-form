-- Two storage buckets found during the field audit with no ownership
-- scoping -- confirmed live (see exhaustive_field_audit_sept9 memory).
--
-- surveyor-documents (PI/PL/DBS compliance certificates, uploaded via
-- surveyor-new's InsuranceScreen.tsx -- a real, working, actively-used
-- feature): both existing policies only checked auth.role() =
-- 'authenticated', no folder scoping at all. Verified live: a different
-- authenticated surveyor could read another surveyor's real certificate
-- file, and could upload into another surveyor's folder path outright.
-- Fixed with folder-scoped policies -- certificateUpload.ts already
-- uploads to `${surveyorId}/...`, so storage.foldername(name)[1] is
-- reliably the owning surveyor's id.
--
-- THAC-CRM_Bucket (job files -- block plans, topo surveys, site
-- documents): "Anyone can read files" had NO auth check at all (roles
-- {anon,authenticated}, qual only bucket_id) -- fully public,
-- unauthenticated read of any object. "Users can delete their files" let
-- any authenticated account (any role, not just admin) delete anything in
-- the bucket. Confirmed via job_files (0 rows) and the bucket's own
-- contents (one non-conforming object, no folder structure) that no real
-- upload feature is built yet -- surveyor-new's uploadFile() is still a
-- stub -- so nothing sensitive is exposed today, but both gaps needed
-- closing before that changes. Not attempting job-ownership-scoped
-- policies here since no path convention exists yet to scope against;
-- narrowed to remove the worst exposure (public read, arbitrary delete)
-- without guessing at an unbuilt feature's eventual design.

DROP POLICY IF EXISTS "Allow authenticated users read" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users upload" ON storage.objects;

CREATE POLICY "Surveyors read own certificates, admins read all" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'surveyor-documents'
    AND (
      EXISTS (
        SELECT 1 FROM surveyors s
        WHERE s.user_id = auth.uid()
          AND s.id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid() AND u.role IN ('admin', 'user') AND u.is_active = true
      )
    )
  );

CREATE POLICY "Surveyors upload own certificates" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'surveyor-documents'
    AND EXISTS (
      SELECT 1 FROM surveyors s
      WHERE s.user_id = auth.uid()
        AND s.id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Anyone can read files" ON storage.objects;
CREATE POLICY "Authenticated users read job files" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'THAC-CRM_Bucket');

-- Delete is scoped the same way the job_files TABLE's own RLS already is
-- (see 20260818002_enable_missing_rls.sql's "Surveyor access to own job
-- files") -- admins delete anything, a surveyor only deletes files
-- attached to a job they're assigned to. Matches surveyor-new's real
-- deleteFile() button (JobDetailScreen.tsx), which is only ever shown on
-- a surveyor's own ("isMine") job.
DROP POLICY IF EXISTS "Users can delete their files" ON storage.objects;
CREATE POLICY "Admins and assigned surveyors delete job files" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'THAC-CRM_Bucket'
    AND (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid() AND u.role IN ('admin', 'user') AND u.is_active = true
      )
      OR EXISTS (
        SELECT 1 FROM job_files jf
        JOIN jobs j ON j.id = jf.job_id
        JOIN surveyors s ON s.id = j.surveyor_id
        WHERE jf.file_path = storage.objects.name AND s.user_id = auth.uid()
      )
    )
  );
