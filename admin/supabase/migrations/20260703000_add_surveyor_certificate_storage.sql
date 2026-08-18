-- Add certificate file storage for surveyor PI/PL/DBS compliance documents.

-- 1. Path columns on surveyors (latest uploaded certificate for each type)
ALTER TABLE public.surveyors
  ADD COLUMN IF NOT EXISTS pi_certificate_path  text,
  ADD COLUMN IF NOT EXISTS pl_certificate_path  text,
  ADD COLUMN IF NOT EXISTS dbs_certificate_path text;

-- 2. Private bucket for surveyor compliance documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('surveyor-documents', 'surveyor-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS: surveyors manage files under their own surveyor_id folder
--    Path convention: {surveyor_id}/{pi|pl|dbs}_certificate_<timestamp>.<ext>
CREATE POLICY "Surveyors manage own certificate files"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'surveyor-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.surveyors WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'surveyor-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.surveyors WHERE user_id = auth.uid()
    )
  );

-- 4. RLS: any authenticated user (admin dashboard login) can read all certificate files
CREATE POLICY "Admins read all certificate files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'surveyor-documents'
    AND auth.role() = 'authenticated'
  );
