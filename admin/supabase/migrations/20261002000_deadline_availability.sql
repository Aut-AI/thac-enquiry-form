-- Lets Trevor switch individual turnaround options (3/5/10/15 working days)
-- off on the public enquiry form while he clears a backlog, and show
-- customers a custom message under the options explaining why.
--
-- Both are edited from admin/settings.html. The form treats a missing
-- column as "everything available, no message", so it keeps working if it
-- deploys before this migration is applied.

ALTER TABLE public.deadline_surcharges
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS deadline_notice text;
