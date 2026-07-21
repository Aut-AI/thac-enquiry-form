-- Backfill postcode_areas.is_covered from existing surveyor coverage.
-- postcode_areas was seeded with is_covered=false for every area and nothing
-- ever flipped it, so the enquiry form's area-level gate would reject every
-- postcode. Mark any area that already has an active surveyor outcode as
-- covered so behaviour doesn't regress; ongoing changes are managed from the
-- admin "Postcode Areas" page (admin/outcodes.html).

UPDATE public.postcode_areas pa
SET is_covered = true
WHERE EXISTS (
  SELECT 1
  FROM public.surveyor_service_outcodes sso
  WHERE upper(substring(sso.outcode FROM '^[A-Za-z]{1,2}')) = pa.area_code
);
