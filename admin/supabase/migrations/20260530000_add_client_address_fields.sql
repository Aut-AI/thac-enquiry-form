-- Full contact/address structure for the three-party model:
-- (a) Arranger  — already on the enquiry (contact_name, contact_email, etc.)
-- (b) End client — new (when arranger is an architect/agent)
-- (c) Invoice recipient — billing_contact_name/email already added; now add address
-- Report addressee — name + address for the BS5837 report cover page

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS end_client_name          text,
  ADD COLUMN IF NOT EXISTS end_client_email         text,
  ADD COLUMN IF NOT EXISTS billing_address          text,
  ADD COLUMN IF NOT EXISTS report_addressee_name    text,
  ADD COLUMN IF NOT EXISTS report_addressee_address text;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS end_client_name          text,
  ADD COLUMN IF NOT EXISTS end_client_email         text,
  ADD COLUMN IF NOT EXISTS billing_address          text,
  ADD COLUMN IF NOT EXISTS report_addressee_name    text,
  ADD COLUMN IF NOT EXISTS report_addressee_address text;
