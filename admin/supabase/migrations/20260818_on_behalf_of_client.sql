-- Lets a rep/third party submitting the public enquiry form identify the
-- actual client the survey is for, separately from their own contact
-- details. contact_name/contact_email/contact_phone/company keep meaning
-- "whoever is filling out the form" -- when these new columns are null,
-- nothing about the enquiry differs from today's default (no-rep) flow.

ALTER TABLE enquiries
  ADD COLUMN IF NOT EXISTS on_behalf_of_client_name TEXT,
  ADD COLUMN IF NOT EXISTS on_behalf_of_client_email TEXT,
  ADD COLUMN IF NOT EXISTS on_behalf_of_client_phone TEXT;
