-- Sprint 3: Lat/lng coordinates on jobs for Google Maps
-- Run in Supabase SQL Editor.
--
-- Populated via the Geocoding API when admin saves a job postcode
-- (geocode button on job-detail, or auto-geocode on job creation in future).

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS site_lat numeric(10,7),
  ADD COLUMN IF NOT EXISTS site_lng numeric(10,7);
