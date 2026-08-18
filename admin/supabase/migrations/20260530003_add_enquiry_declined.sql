-- Capture decline reason and timestamp when a client declines their quote.

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS declined_reason text,
  ADD COLUMN IF NOT EXISTS declined_at     timestamp;
