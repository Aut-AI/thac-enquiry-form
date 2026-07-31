-- Trevor's static working-area list with per-area travel costs.
-- Powers the 'travel_cost_areas' coverage mode (pricing_settings.coverage_mode):
-- a simple alternative to the auto-computed surveyor-radius coverage gate. When
-- active, the public enquiry form gates on membership in this table and adds
-- travel_cost to the quote. The surveyor-coverage machinery (postcode_areas,
-- surveyor_service_outcodes) is untouched and keeps running in both modes.
-- The mode switch is developer-only (changed via SQL, not exposed in admin UI).

-- 1. Area -> travel cost table (postcode areas, e.g. "GL", not full outcodes)
CREATE TABLE travel_cost_areas (
  area_code TEXT PRIMARY KEY,
  area_name TEXT,
  travel_cost NUMERIC(8, 2) NOT NULL,
  note TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE travel_cost_areas ENABLE ROW LEVEL SECURITY;

-- Public read (the enquiry form gates and prices unauthenticated)
CREATE POLICY "Allow public read travel cost areas" ON travel_cost_areas
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated write travel cost areas" ON travel_cost_areas
  FOR ALL USING (auth.role() = 'authenticated');

-- 2. Coverage mode switch. Default keeps current live behavior; flip with:
--    UPDATE pricing_settings SET coverage_mode = 'travel_cost_areas';
ALTER TABLE pricing_settings
  ADD COLUMN coverage_mode TEXT NOT NULL DEFAULT 'surveyor_coverage'
  CHECK (coverage_mode IN ('surveyor_coverage', 'travel_cost_areas'));

-- 3. Record the applied travel cost on each enquiry (quote breakdown for admin)
ALTER TABLE enquiries ADD COLUMN travel_cost NUMERIC(8, 2);

-- 4. Seed from Trevor's list (costs excl. VAT)
INSERT INTO travel_cost_areas (area_code, area_name, travel_cost, note) VALUES
  ('AL', 'Home Counties', 300, NULL),
  ('BA', 'South West', 300, NULL),
  ('BH', 'South & South East', 300, NULL),
  ('BN', 'South & South East', 300, NULL),
  ('BR', 'South & South East', 300, NULL),
  ('BS', 'South West', 300, NULL),
  ('CM', 'Home Counties', 400, 'This area is a little further than we''d normally go these days, so this is reflected in the quote (due to extra travelling time). It may be worth looking for a more local consultant (try www.trees.org.uk) who may provide your tree survey and report cheaper.'),
  ('CR', 'London', 300, NULL),
  ('CT', 'South & South East', 500, 'This area is much further than we''d normally go these days, so this is reflected in the quote (due to extra travelling time). It may be worth looking for a more local consultant (try www.trees.org.uk) who may provide your tree survey and report cheaper.'),
  ('DA', 'South & South East', 400, 'This area is a little further than we''d normally go these days, so this is reflected in the quote (due to extra travelling time). It may be worth looking for a more local consultant (try www.trees.org.uk) who may provide your tree survey and report cheaper.'),
  ('DT', 'South & South East', 300, NULL),
  ('E',  'London', 300, NULL),
  ('EC', 'London', 300, NULL),
  ('EN', 'London', 300, NULL),
  ('EX', 'South West', 500, 'This area is much further than we''d normally go these days, so this is reflected in the quote (due to extra travelling time). It may be worth looking for a more local consultant (try www.trees.org.uk) who may provide your tree survey and report cheaper.'),
  ('GL', 'South West', 400, 'This area is a little further than we''d normally go these days, so this is reflected in the quote (due to extra travelling time). It may be worth looking for a more local consultant (try www.trees.org.uk) who may provide your tree survey and report cheaper.'),
  ('GU', 'Home Counties', 300, NULL),
  ('HA', 'London', 300, NULL),
  ('HP', 'Home Counties', 300, NULL),
  ('IG', 'London', 400, 'This area is a little further than we''d normally go these days, so this is reflected in the quote (due to extra travelling time). It may be worth looking for a more local consultant (try www.trees.org.uk) who may provide your tree survey and report cheaper.'),
  ('KT', 'Home Counties', 300, NULL),
  ('LU', 'Home Counties', 300, NULL),
  ('ME', 'South & South East', 400, 'This area is a little further than we''d normally go these days, so this is reflected in the quote (due to extra travelling time). It may be worth looking for a more local consultant (try www.trees.org.uk) who may provide your tree survey and report cheaper.'),
  ('MK', NULL, 300, NULL),
  ('N',  'London', 300, NULL),
  ('NW', 'London', 300, NULL),
  ('OX', 'Home Counties', 300, NULL),
  ('PO', 'South & South East', 300, NULL),
  ('RG', 'Home Counties', 300, NULL),
  ('RH', 'Home Counties', 300, NULL),
  ('RM', 'London', 400, 'This area is a little further than we''d normally go these days, so this is reflected in the quote (due to extra travelling time). It may be worth looking for a more local consultant (try www.trees.org.uk) who may provide your tree survey and report cheaper.'),
  ('SE', 'London', 300, NULL),
  ('SG', 'Home Counties', 300, NULL),
  ('SL', 'Home Counties', 300, NULL),
  ('SM', 'Home Counties', 300, NULL),
  ('SN', 'South West', 300, NULL),
  ('SO', 'South & South East', 300, NULL),
  ('SP', 'South & South East', 300, NULL),
  ('SS', 'Home Counties', 400, 'This area is a little further than we''d normally go these days, so this is reflected in the quote (due to extra travelling time). It may be worth looking for a more local consultant (try www.trees.org.uk) who may provide your tree survey and report cheaper.'),
  ('SW', 'London', 300, NULL),
  ('TA', 'South West', 400, 'This area is a little further than we''d normally go these days, so this is reflected in the quote (due to extra travelling time). It may be worth looking for a more local consultant (try www.trees.org.uk) who may provide your tree survey and report cheaper.'),
  ('TN', 'South & South East', 400, 'This area is a little further than we''d normally go these days, so this is reflected in the quote (due to extra travelling time). It may be worth looking for a more local consultant (try www.trees.org.uk) who may provide your tree survey and report cheaper.'),
  ('TQ', 'South West', 500, 'This area is much further than we''d normally go these days, so this is reflected in the quote (due to extra travelling time). It may be worth looking for a more local consultant (try www.trees.org.uk) who may provide your tree survey and report cheaper.'),
  ('TW', 'London', 300, NULL),
  ('UB', 'London', 300, NULL),
  ('W',  'London', 300, NULL),
  ('WC', 'London', 300, NULL),
  ('WD', 'Home Counties', 300, NULL);
