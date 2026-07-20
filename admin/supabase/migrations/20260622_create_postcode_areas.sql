-- Postcode areas coverage table
-- Stores UK postcode area codes (e.g. BS, GL) with their name, region, and whether Trevor covers them.
-- The enquiry form reads this (anon) to validate postcode coverage on submission.

CREATE TABLE IF NOT EXISTS public.postcode_areas (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  area_code    text        NOT NULL,
  area_name    text        NOT NULL,
  region       text        NOT NULL,
  is_covered   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT postcode_areas_area_code_key UNIQUE (area_code)
);

-- Normalise area codes to uppercase on insert/update
CREATE OR REPLACE FUNCTION public.normalise_area_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.area_code := upper(trim(NEW.area_code));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalise_area_code
  BEFORE INSERT OR UPDATE ON public.postcode_areas
  FOR EACH ROW EXECUTE FUNCTION public.normalise_area_code();

CREATE INDEX IF NOT EXISTS idx_postcode_areas_area_code ON public.postcode_areas (area_code);

-- RLS: public read (enquiry form), authenticated write (admin)
ALTER TABLE public.postcode_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "postcode_areas_public_read"
  ON public.postcode_areas FOR SELECT
  USING (true);

CREATE POLICY "postcode_areas_auth_write"
  ON public.postcode_areas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed all UK postcode areas (is_covered defaults to false — mark covered ones in the admin UI)
INSERT INTO public.postcode_areas (area_code, area_name, region) VALUES
  ('AB', 'Aberdeen',                    'Scotland'),
  ('AL', 'St. Albans',                  'East of England'),
  ('B',  'Birmingham',                  'West Midlands'),
  ('BA', 'Bath',                        'South West'),
  ('BB', 'Blackburn',                   'North West'),
  ('BD', 'Bradford',                    'North West'),
  ('BH', 'Bournemouth',                 'South West'),
  ('BL', 'Bolton',                      'North West'),
  ('BN', 'Brighton',                    'South East'),
  ('BR', 'Bromley',                     'Greater London'),
  ('BS', 'Bristol',                     'South West'),
  ('BT', 'Belfast',                     'Northern Ireland'),
  ('CA', 'Carlisle',                    'North West'),
  ('CB', 'Cambridge',                   'East of England'),
  ('CF', 'Cardiff',                     'Wales'),
  ('CH', 'Chester',                     'North West'),
  ('CM', 'Chelmsford',                  'East of England'),
  ('CO', 'Colchester',                  'East of England'),
  ('CR', 'Croydon',                     'Greater London'),
  ('CT', 'Canterbury',                  'South East'),
  ('CV', 'Coventry',                    'West Midlands'),
  ('CW', 'Crewe',                       'North West'),
  ('DA', 'Dartford',                    'Greater London'),
  ('DD', 'Dundee',                      'Scotland'),
  ('DE', 'Derby',                       'East Midlands'),
  ('DG', 'Dumfries',                    'Scotland'),
  ('DH', 'Durham',                      'North East'),
  ('DL', 'Darlington',                  'North East'),
  ('DN', 'Doncaster',                   'East Midlands'),
  ('DT', 'Dorchester',                  'South West'),
  ('DY', 'Dudley',                      'West Midlands'),
  ('E',  'London',                      'Greater London'),
  ('EC', 'London',                      'Greater London'),
  ('EH', 'Edinburgh',                   'Scotland'),
  ('EN', 'Enfield',                     'Greater London'),
  ('EX', 'Exeter',                      'South West'),
  ('FK', 'Falkirk',                     'Scotland'),
  ('FY', 'Blackpool',                   'North West'),
  ('G',  'Glasgow',                     'Scotland'),
  ('GL', 'Gloucester',                  'South West'),
  ('GU', 'Guilford',                    'South East'),
  ('GY', 'Guernsey',                    'Channel Islands'),
  ('HA', 'Harrow',                      'Greater London'),
  ('HD', 'Huddersfield',                'North West'),
  ('HG', 'Harrogate',                   'North East'),
  ('HP', 'Hemel',                       'East of England'),
  ('HR', 'Hereford',                    'West Midlands'),
  ('HS', 'Comhairle nan Eilean Siar',   'Scotland'),
  ('HU', 'Hull',                        'North East'),
  ('HX', 'Halifax',                     'North West'),
  ('IG', 'Ilford',                      'Greater London'),
  ('IM', 'Isle of Man',                 'Isle of Man'),
  ('IP', 'Ipswich',                     'East of England'),
  ('IV', 'Inverness',                   'Scotland'),
  ('JE', 'Jersey',                      'Channel Islands'),
  ('KA', 'Kilmarnock',                  'Scotland'),
  ('KT', 'Kingston',                    'Greater London'),
  ('KW', 'Kirkwall',                    'Scotland'),
  ('KY', 'Kirkaldy',                    'Scotland'),
  ('L',  'Liverpool',                   'North West'),
  ('LA', 'Lancaster',                   'North West'),
  ('LD', 'Llandrindod',                 'Wales'),
  ('LE', 'Leicester',                   'East Midlands'),
  ('LL', 'Llandudno',                   'Wales'),
  ('LN', 'Lincoln',                     'East Midlands'),
  ('LS', 'Leeds',                       'North East'),
  ('LU', 'Luton',                       'East of England'),
  ('M',  'Manchester',                  'North West'),
  ('ME', 'Medway',                      'South East'),
  ('MK', 'Milton Keynes',               'South East'),
  ('ML', 'Motherwell',                  'Scotland'),
  ('N',  'London',                      'Greater London'),
  ('NE', 'Newcastle',                   'North East'),
  ('NG', 'Nottingham',                  'East Midlands'),
  ('NN', 'Northampton',                 'West Midlands'),
  ('NP', 'Newport',                     'Wales'),
  ('NR', 'Norwich',                     'East of England'),
  ('NW', 'London',                      'Greater London'),
  ('OL', 'Oldham',                      'North West'),
  ('OX', 'Oxford',                      'South East'),
  ('PA', 'Paisley',                     'Scotland'),
  ('PE', 'Peterborough',                'East England'),
  ('PH', 'Perth',                       'Scotland'),
  ('PL', 'Plymouth',                    'South West'),
  ('PO', 'Portsmouth',                  'South East'),
  ('PR', 'Preston',                     'North West'),
  ('QC', 'Awarding Bodies',             'Non-geographic'),
  ('RG', 'Reading',                     'South East'),
  ('RH', 'Redhill',                     'South East'),
  ('RM', 'Romford',                     'Greater London'),
  ('S',  'Sheffield',                   'East Midlands'),
  ('SA', 'Swansea',                     'Wales'),
  ('SE', 'London',                      'Greater London'),
  ('SG', 'Stevenage',                   'East of England'),
  ('SK', 'Stockport',                   'North West'),
  ('SL', 'Slough',                      'South East'),
  ('SM', 'Sutton',                      'Greater London'),
  ('SN', 'Swindon',                     'South West'),
  ('SO', 'Southampton',                 'South East'),
  ('SP', 'Salisbury',                   'South West'),
  ('SR', 'Sunderland',                  'North East'),
  ('SS', 'Southend',                    'East of England'),
  ('ST', 'Stoke on Trent',              'West Midlands'),
  ('SW', 'London',                      'Greater London'),
  ('SY', 'Shrewsbury',                  'Wales'),
  ('TA', 'Taunton',                     'South West'),
  ('TD', 'Galashiels',                  'Scotland'),
  ('TF', 'Telford',                     'West Midlands'),
  ('TN', 'Tonbridge',                   'South East'),
  ('TQ', 'Torquay',                     'South West'),
  ('TR', 'Truro',                       'South West'),
  ('TS', 'Cleveland',                   'North East'),
  ('TW', 'Twickenham',                  'Greater London'),
  ('UB', 'Southall',                    'Greater London'),
  ('W',  'London',                      'Greater London'),
  ('WA', 'Warrington',                  'North West'),
  ('WC', 'London',                      'Greater London'),
  ('WD', 'Watford',                     'Greater London'),
  ('WF', 'Wakefield',                   'North East'),
  ('WN', 'Wigan',                       'North West'),
  ('WR', 'Worcester',                   'West Midlands'),
  ('WS', 'Walsall',                     'West Midlands'),
  ('WV', 'Wolverhampton',               'West Midlands'),
  ('YO', 'York',                        'North East'),
  ('ZE', 'Shetland',                    'Scotland')
ON CONFLICT (area_code) DO NOTHING;
