-- Track when a quote was accepted via the one-click link.

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS accepted_at timestamp;
