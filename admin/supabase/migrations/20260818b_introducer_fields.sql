-- Supersedes 20260818_on_behalf_of_client.sql -- that migration modeled the
-- new fields backwards (client info as a secondary block, submitter as
-- primary). The right model: contact_name/contact_email/contact_phone/
-- company already mean "the client" everywhere downstream (job creation,
-- billing default, accept-quote.html) and should keep meaning that. What's
-- actually new is an optional secondary "who introduced this" block for a
-- rep/broker/agent submitting on a client's behalf. No real data was ever
-- written with the old columns (this shipped and was corrected same-day),
-- so a straight drop-and-replace is safe.

ALTER TABLE enquiries
  DROP COLUMN IF EXISTS on_behalf_of_client_name,
  DROP COLUMN IF EXISTS on_behalf_of_client_email,
  DROP COLUMN IF EXISTS on_behalf_of_client_phone,
  ADD COLUMN IF NOT EXISTS introducer_name TEXT,
  ADD COLUMN IF NOT EXISTS introducer_email TEXT,
  ADD COLUMN IF NOT EXISTS introducer_company TEXT;
