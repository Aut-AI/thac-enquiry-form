-- Add quoted_price to enquiries table.
-- The enquiry form calculates a price (BASE_PRICES + SURCHARGES) but was not
-- saving it. This column stores the system-generated quote shown to the client.
-- NULL = custom quote (100+ trees) or amendment (time-and-materials).

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS quoted_price numeric(10,2);
