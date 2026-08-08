-- Moves deadline surcharges out of a hardcoded JS object in
-- enquiry-form/index.html into an admin-editable table, matching the
-- pattern already used for pricing_settings/survey_types/travel_cost_areas.
-- Seeded with the values already live in the JS SURCHARGES constant, so
-- this is a no-op for pricing on deploy -- enquiry-form/index.html now
-- fetches from this table and only falls back to the old hardcoded values
-- if the fetch fails.

CREATE TABLE IF NOT EXISTS deadline_surcharges (
  tier TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  surcharge NUMERIC(8,2) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO deadline_surcharges (tier, label, surcharge) VALUES
  ('3days',  'Within 3 working days', 200),
  ('5days',  'Within 5 working days', 100),
  ('10days', 'Within 10 working days / No rush', 0)
ON CONFLICT (tier) DO NOTHING;

ALTER TABLE deadline_surcharges ENABLE ROW LEVEL SECURITY;

-- Public quote form reads this with the anon key, same as
-- pricing_settings/survey_types/travel_cost_areas.
CREATE POLICY "Allow public read deadline surcharges" ON deadline_surcharges
  FOR SELECT USING (true);

-- Matches survey_types/travel_cost_areas' write policy (any authenticated
-- CRM user, not admin-specific like pricing_settings -- the admin/settings.html
-- page itself is what's admin-gated via requireAdmin()).
CREATE POLICY "Allow authenticated write deadline surcharges" ON deadline_surcharges
  FOR ALL USING (auth.role() = 'authenticated');
