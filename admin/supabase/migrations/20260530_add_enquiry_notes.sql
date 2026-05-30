-- Add internal notes to enquiries table.
-- Used by admin to log calls, follow-ups, and quote discussions
-- during the pre-acceptance stage.

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS internal_notes text;
