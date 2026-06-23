-- Sprint 4: Parking location coordinates (pin drop) replaces polygon drawing
-- Run in Supabase SQL Editor.
--
-- Customer drops a single pin on the map to indicate parking location.
-- Replaces the site_boundary_polygon drawing feature.

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS parking_lat numeric(10,7),
  ADD COLUMN IF NOT EXISTS parking_lng numeric(10,7);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS parking_lat numeric(10,7),
  ADD COLUMN IF NOT EXISTS parking_lng numeric(10,7);
