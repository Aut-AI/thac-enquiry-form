-- Treatment/Tree-Band Hours Pricing Matrix
-- Implements Trevor's pricing structure: hours_per_band defines both customer price (hours × £100/hr) and surveyor pay

-- 1. Add hours_per_band column to survey_types (hours required per 20-tree band increment)
ALTER TABLE survey_types
  ADD COLUMN hours_per_band NUMERIC(5, 2) NOT NULL DEFAULT 1;

-- 2. Add new BS Survey type (maps to Trevor's "1 - BS Survey" treatment)
INSERT INTO survey_types (survey_type, label, hours_on_site, hours_per_band)
VALUES ('bs_survey', 'BS Survey', 1, 1);

-- 3. Set hours_per_band values for Trevor's treatments (from spreadsheet)
UPDATE survey_types SET hours_per_band = 0.75 WHERE survey_type = 'health_safety'; -- Tree Condition survey
UPDATE survey_types SET hours_per_band = 1 WHERE survey_type = 'insurer_mortgage'; -- Insurance / Mortgage
UPDATE survey_types SET hours_per_band = 1 WHERE survey_type = 'subsidence'; -- Building Damage / Subsidence
UPDATE survey_types SET hours_per_band = 1 WHERE survey_type = 'nhbc'; -- Foundation depth
UPDATE survey_types SET hours_per_band = 0.5 WHERE survey_type = 'site_visit'; -- Site Visit & Advice

-- Planning types stay at default 1 (not in Trevor's matrix, unchanged behavior)
UPDATE survey_types SET hours_per_band = 1 WHERE survey_type IN ('planning_stage1', 'planning_stage2');

-- Resistograph stays at default 1 (not in Trevor's matrix, excluded from public quote form)
UPDATE survey_types SET hours_per_band = 1 WHERE survey_type = 'resistograph';

-- 4. Function to convert tree_count_band (e.g. '1-20', '21-40') to band index (1-5)
--    Used to calculate hours = hours_per_band × band_index, then price = hours × hourly_rate
CREATE OR REPLACE FUNCTION band_index_from_tree_count(p_band TEXT)
RETURNS INT IMMUTABLE AS $$
BEGIN
  CASE p_band
    WHEN '1-20'   THEN RETURN 1;
    WHEN '21-40'  THEN RETURN 2;
    WHEN '41-60'  THEN RETURN 3;
    WHEN '61-80'  THEN RETURN 4;
    WHEN '81-100' THEN RETURN 5;
    ELSE RETURN NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- 5. Pricing settings table: editable £/hour rates for THAC (customer-facing) and default surveyor rate
CREATE TABLE pricing_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  thac_hourly_rate NUMERIC(8, 2) NOT NULL DEFAULT 100,
  default_surveyor_hourly_rate NUMERIC(8, 2) NOT NULL DEFAULT 40,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO pricing_settings (id, thac_hourly_rate, default_surveyor_hourly_rate)
VALUES (1, 100, 40);

-- Enable RLS on pricing_settings
ALTER TABLE pricing_settings ENABLE ROW LEVEL SECURITY;

-- Public read (the public enquiry form needs to fetch thac_hourly_rate unauthenticated)
CREATE POLICY "Allow public read pricing settings" ON pricing_settings
  FOR SELECT USING (true);

-- Authenticated users (admin) can update
CREATE POLICY "Allow authenticated update pricing settings" ON pricing_settings
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 6. Update claim_job RPC to use hours_per_band × band_index, remove urgency bonus (×1.2)
CREATE OR REPLACE FUNCTION claim_job(p_job_id uuid, p_surveyor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_survey_type TEXT;
  v_urgency_state TEXT;
  v_hourly_rate NUMERIC;
  v_tree_count_band TEXT;
  v_hours_per_band NUMERIC;
  v_band_index INT;
  v_survey_hours NUMERIC;
  v_base_pay NUMERIC;
BEGIN
  -- Fetch job details and surveyor hourly rate
  SELECT j.survey_type, j.urgency_state, j.tree_count_band, s.hourly_rate
  INTO v_survey_type, v_urgency_state, v_tree_count_band, v_hourly_rate
  FROM jobs j
  JOIN surveyors s ON s.id = p_surveyor_id
  WHERE j.id = p_job_id
    AND j.dispatch_state = 'red'
    AND j.surveyor_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job is no longer available or surveyor not found';
  END IF;

  -- Fetch survey hours per band, calculate band index
  SELECT hours_per_band INTO v_hours_per_band
  FROM survey_types
  WHERE survey_type = v_survey_type;

  v_band_index := band_index_from_tree_count(v_tree_count_band);

  -- Calculate actual survey hours: hours_per_band × band_index
  -- Fallback to hours_on_site if band_index is null (legacy data safety)
  v_survey_hours := COALESCE(
    v_hours_per_band * v_band_index,
    (SELECT hours_on_site FROM survey_types WHERE survey_type = v_survey_type)
  );

  -- Calculate pay: (1 travel + survey_hours) × hourly_rate (NO urgency bonus)
  v_base_pay := (1 + COALESCE(v_survey_hours, 1)) * COALESCE(v_hourly_rate, 0);

  -- Update job with surveyor and calculated pay
  UPDATE public.jobs
  SET
    surveyor_id         = p_surveyor_id,
    surveyor_pay_amount = v_base_pay,
    dispatch_state      = 'orange',
    claimed_at          = now(),
    handed_back_at      = NULL,
    handed_back_note    = NULL
  WHERE id = p_job_id;
END;
$$;
