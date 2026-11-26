-- Trevor's historic "Work log / Accounts" spreadsheet (26 Nov 2026), searchable
-- from the job page's Work log panel. Reference data only: nothing else reads it.
-- Loaded by admin/import-worklog.html (CSV picked in the browser, so the data
-- never goes into the public repo). Re-running the import replaces everything.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.work_log (
  id            BIGSERIAL PRIMARY KEY,
  stage         TEXT,
  date_instructed TEXT,
  job_date      TEXT,
  surveyor      TEXT,
  client        TEXT,
  introducer    TEXT,
  site          TEXT,
  notes         TEXT,
  axi_dwg       TEXT,
  report_drafted TEXT,
  progress      TEXT,
  survey_type   TEXT,
  quote         NUMERIC,
  ref           TEXT,
  cost          NUMERIC,
  vat           NUMERIC,
  total         NUMERIC,
  date_invoiced TEXT,
  search_text   TEXT GENERATED ALWAYS AS (
    lower(concat_ws(' ', ref, client, introducer, site, surveyor, notes, progress, survey_type, stage))
  ) STORED
);

CREATE INDEX IF NOT EXISTS work_log_search_trgm ON public.work_log USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS work_log_ref_idx ON public.work_log (ref);

ALTER TABLE public.work_log ENABLE ROW LEVEL SECURITY;

-- CRM staff only (admin or user roles), same test the other admin tables use.
DROP POLICY IF EXISTS "work_log staff read" ON public.work_log;
CREATE POLICY "work_log staff read" ON public.work_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','user') AND u.is_active = true));

DROP POLICY IF EXISTS "work_log admin write" ON public.work_log;
CREATE POLICY "work_log admin write" ON public.work_log FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin' AND u.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin' AND u.is_active = true));
