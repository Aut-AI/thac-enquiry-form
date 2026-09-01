-- New deadline tier: "Within 15 working days or more" -- the slowest
-- paid-commitment option, sitting between "No rush (just looking)" (open
-- ended, not really a commitment) and "Within 10 working days". Per
-- Trevor's existing logic that anything at or beyond his normal capacity
-- doesn't need an urgency premium (see 20260817_deadline_surcharge_restructure.sql),
-- this carries the same £0 surcharge as no_rush -- but unlike no_rush it
-- still gets a real SLA deadline tracked (see enquiry-form/index.html's
-- daysToAdd calculation), since the customer has committed to an actual
-- timeframe rather than "just looking."
INSERT INTO deadline_surcharges (tier, label, surcharge) VALUES
  ('15days', 'Within 15 working days or more', 0)
ON CONFLICT (tier) DO NOTHING;
