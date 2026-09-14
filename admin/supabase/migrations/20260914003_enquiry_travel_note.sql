-- Companion to enquiries.travel_cost (20260731_travel_cost_areas.sql).
-- travel_cost_areas.note is the customer-facing "consider a local
-- consultant" text shown live on the public form for £400/£500 areas, but
-- it was never persisted anywhere -- the quote email (send-quote-email,
-- sent both automatically on submit and on-demand via job-detail.html's
-- "Resend Quote Email") had no way to include it. Stored the same way
-- travel_cost already is, at submission time.

ALTER TABLE enquiries ADD COLUMN travel_note TEXT;
