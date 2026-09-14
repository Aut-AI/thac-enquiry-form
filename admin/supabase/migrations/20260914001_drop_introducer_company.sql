-- The "Agency / Company" field was removed from the public enquiry form
-- (no code path ever writes it, and no existing row has a value), so drop
-- the column rather than leave it dead.

ALTER TABLE enquiries
  DROP COLUMN IF EXISTS introducer_company;
