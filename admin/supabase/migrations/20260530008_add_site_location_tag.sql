-- Add structured location tag to jobs.
-- Stores what3words address (///word.word.word), Google Maps URL,
-- or plain coordinates alongside the free-text site_access_notes.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS site_location_tag text;
