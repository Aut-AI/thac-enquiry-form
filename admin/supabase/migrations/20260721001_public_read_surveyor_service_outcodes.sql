-- surveyor_service_outcodes only had a "surveyors read own rows" SELECT policy,
-- which silently returns zero rows to anonymous requests (RLS filters rows,
-- it doesn't error) and to authenticated non-surveyor users (e.g. admin staff).
-- This broke two consumers that need to read across all surveyors:
--   - the public enquiry form's postcode gate (anon key)
--   - admin/outcodes.html's coverage table (authenticated staff, not a surveyor)
-- The data itself (outcode, distance_miles, surveyor_id) isn't sensitive —
-- same reasoning as the existing public policy on uk_outcodes.

CREATE POLICY "Public read service outcodes" ON public.surveyor_service_outcodes
  FOR SELECT USING (true);
