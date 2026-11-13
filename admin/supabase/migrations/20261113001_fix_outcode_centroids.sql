-- Fix wrong outcode centre points in uk_outcodes (13 Nov 2026)
--
-- Found when NW1W (central London) showed as 7.95 miles from Reading in the app's
-- Coverage Area screen. All 2,872 rows were checked against postcodes.io:
--   * 6 rows were 10-480 km out (NW1W, N1P, BD98, WV98, EH42, PA42)
--   * 6 rows were 3-10 km out (large rural outcodes); set to postcodes.io's centre
--   * 9 PO Box / business-only outcodes postcodes.io doesn't list were all parked on one
--     dummy point in the Atlantic (49.7668, -7.5572); moved to the middle of their own postcode area
--   * the other 2851 agree with postcodes.io to within 3 km and are left alone
-- Then every active surveyor's matched outcodes are recalculated, which also refreshes
-- postcode_areas.is_covered (the website form's coverage check) through its triggers.

BEGIN;

UPDATE uk_outcodes o
SET latitude = v.lat, longitude = v.lng
FROM (VALUES
  ('BD98', 53.7960340, -1.7506020),  -- Bradford: was 479.8 km out
  ('WV98', 52.4048855, -2.2202036),  -- Wolverhampton: was 137.1 km out
  ('N1P', 51.5390149, -0.1033965),  -- London North: was 134.2 km out
  ('NW1W', 51.5307927, -0.1354095),  -- London North West: was 62.3 km out
  ('EH42', 55.9935553, -2.5252833),  -- Edinburgh: was 22.6 km out
  ('PA42', 55.6368064, -6.1894538),  -- Paisley: was 11.3 km out
  ('DG10', 55.3203793, -3.4385214),  -- Dumfries: was 6.1 km out
  ('KY5', 56.1459378, -3.2932864),  -- Kirkcaldy: was 4.6 km out
  ('SK2', 53.3943214, -2.1321967),  -- Stockport: was 3.7 km out
  ('AB43', 57.6572492, -2.0439344),  -- Aberdeen: was 3.7 km out
  ('IV51', 57.4745902, -6.2431994),  -- Inverness: was 3.7 km out
  ('KA26', 55.2169004, -4.8359745),  -- Kilmarnock: was 3.1 km out
  ('BN91', 50.8265902, -0.1617255),  -- Brighton: placeholder in the Atlantic -> middle of BN area
  ('CH90', 53.3342155, -3.0412750),  -- Chester: placeholder in the Atlantic -> middle of CH area
  ('EN77', 51.6962910, -0.0678947),  -- Enfield: placeholder in the Atlantic -> middle of EN area
  ('LS78', 53.8106201, -1.5484078),  -- Leeds: placeholder in the Atlantic -> middle of LS area
  ('PO24', 50.7950224, -1.1015819),  -- Portsmouth: placeholder in the Atlantic -> middle of PO area
  ('S94', 53.3799796, -1.4284277),  -- Sheffield: placeholder in the Atlantic -> middle of S area
  ('SN80', 51.5539771, -1.8095113),  -- Swindon: placeholder in the Atlantic -> middle of SN area
  ('SR43', 54.8930157, -1.3785763),  -- Sunderland: placeholder in the Atlantic -> middle of SR area
  ('TW98', 51.4493755, -0.3871582)   -- Twickenham: placeholder in the Atlantic -> middle of TW area
) AS v(outcode, lat, lng)
WHERE o.outcode = v.outcode;

SELECT public.resync_surveyor_outcodes(id)
FROM surveyors
WHERE is_active AND home_lat IS NOT NULL AND home_lng IS NOT NULL;

COMMIT;

-- Check: NW1W should now be about 51.53, -0.14 (Camden)
SELECT outcode, area_name, round(latitude::numeric, 4) AS lat, round(longitude::numeric, 4) AS lng
FROM uk_outcodes
WHERE outcode IN ('BD98', 'WV98', 'N1P', 'NW1W', 'EH42', 'PA42', 'DG10', 'KY5', 'SK2', 'AB43', 'IV51', 'KA26', 'BN91', 'CH90', 'EN77', 'LS78', 'PO24', 'S94', 'SN80', 'SR43', 'TW98')
ORDER BY outcode;
