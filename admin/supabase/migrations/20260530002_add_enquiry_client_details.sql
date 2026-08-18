-- Post-acceptance client details collected via accept-quote.html Step 2.
-- Flows through to the job on Convert to Job.

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS billing_contact_name  text,
  ADD COLUMN IF NOT EXISTS billing_contact_email text,
  ADD COLUMN IF NOT EXISTS client_site_access    text,
  ADD COLUMN IF NOT EXISTS client_details_at     timestamp;
