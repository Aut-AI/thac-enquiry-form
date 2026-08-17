-- Trevor's 2026-08-13 decision: split "no rush" out of the 10-day band into
-- its own free tier, since some enquirers are just researching rather than
-- wanting a fast turnaround. 10 days now carries a real (small) surcharge
-- since it's no longer sharing the free tier with "no rush".
--
-- Old:  3days £200, 5days £100, 10days £0 ("Within 10 working days / No rush")
-- New:  3days £200, 5days £150, 10days £75, no_rush £0 ("No rush (just looking)")

INSERT INTO deadline_surcharges (tier, label, surcharge) VALUES
  ('no_rush', 'No rush (just looking)', 0)
ON CONFLICT (tier) DO NOTHING;

UPDATE deadline_surcharges SET label = 'Within 10 working days', surcharge = 75, updated_at = NOW()
  WHERE tier = '10days';

UPDATE deadline_surcharges SET surcharge = 150, updated_at = NOW()
  WHERE tier = '5days';
