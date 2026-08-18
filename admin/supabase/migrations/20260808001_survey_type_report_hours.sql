-- Adds the report-writing time component that was missing from the public
-- quote formula entirely. The form has only ever charged for on-site survey
-- time (hours_per_band x tree_count band) -- confirmed against Trevor's real
-- cost matrix that hours_per_band already correctly represents on-site time
-- alone, but there was never a column for the flat report-writing hours his
-- matrix adds on top per survey type. Net effect before this migration:
-- Planning Stage 1 and Stage 2 quoted identically, since both only ever
-- charged the shared on-site "BS Survey" time and nothing distinguished the
-- much larger Stage 2 report (AIA/AMS/TPP vs a single Tree Constraints
-- Report for Stage 1).
--
-- Values below come directly from Trevor's "Report costs" sheet (flat hours
-- per treatment, independent of tree count) -- bs_survey/resistograph are
-- unused by the public form already (not offered as options) so get 0.

ALTER TABLE survey_types ADD COLUMN IF NOT EXISTS report_hours NUMERIC(5,2) NOT NULL DEFAULT 0;

UPDATE survey_types SET report_hours = 1    WHERE survey_type = 'planning_stage1';
UPDATE survey_types SET report_hours = 3    WHERE survey_type = 'planning_stage2';
UPDATE survey_types SET report_hours = 0.75 WHERE survey_type = 'health_safety';
UPDATE survey_types SET report_hours = 0.75 WHERE survey_type = 'insurer_mortgage';
UPDATE survey_types SET report_hours = 2.5  WHERE survey_type = 'subsidence';
UPDATE survey_types SET report_hours = 0.5  WHERE survey_type = 'nhbc';
UPDATE survey_types SET report_hours = 0.25 WHERE survey_type = 'site_visit';
