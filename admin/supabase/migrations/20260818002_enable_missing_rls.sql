-- Supabase's automated security advisor flagged 6 public tables with RLS
-- disabled: clients, enquiries, jobs, pricing_settings, job_files, resources.
-- All 6 were created by hand via the dashboard (never captured in this
-- migrations folder -- see 20260805_admin_user_roles.sql's own note about
-- this), and RLS enabling was apparently missed when each was created.
-- Anyone holding the public anon key (embedded in enquiry-form/index.html
-- and admin/js/supabase.js, intentionally per CLAUDE.md) currently has
-- unrestricted read/write/delete on all of them.

-- clients, jobs already have correct, complete policies (admin/user full
-- access, surveyor access scoped to their own jobs) -- confirmed via
-- pg_policies against the live DB. Enabling RLS just starts enforcing
-- what's already written; no policy changes needed.
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- enquiries already has anon_insert_enquiries (anon, INSERT-only, matches
-- the public form's only legitimate need) plus authenticated select/update.
-- No anon SELECT policy exists, so enabling RLS correctly stops anyone from
-- reading back other people's enquiries via the anon key.
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- pricing_settings only has one policy (admin-only UPDATE) -- no SELECT
-- policy at all. enquiry-form/index.html fetches thac_hourly_rate and
-- coverage_mode via the anon key on every page load to compute quotes, so
-- enabling RLS without adding a SELECT policy would silently break the
-- public form for every visitor. The table only holds non-sensitive config
-- (hourly rate, coverage mode), so public read is the correct policy, not
-- just a workaround.
CREATE POLICY "Public read pricing settings" ON public.pricing_settings
  FOR SELECT USING (true);
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

-- job_files has zero policies. Modeled directly on the existing jobs
-- pattern (admin/user full access; surveyor access scoped to jobs assigned
-- to them), joined through job_files.job_id -> jobs.assigned_surveyor_id,
-- so surveyors keep the ability to view/upload files on their own jobs
-- exactly like they already can view/update the jobs themselves.
CREATE POLICY "Admin full access on job_files" ON public.job_files
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'user') AND u.is_active = true
    )
  );

CREATE POLICY "Surveyor access to own job files" ON public.job_files
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN surveyors s ON s.user_id = u.id
      JOIN jobs j ON j.id = job_files.job_id
      WHERE u.id = auth.uid() AND u.role = 'surveyor' AND j.assigned_surveyor_id = s.id
    )
  );

ALTER TABLE public.job_files ENABLE ROW LEVEL SECURITY;

-- resources has zero policies and is not referenced anywhere in
-- admin/, enquiry-form/, or supabase/functions/ -- an orphaned/unused
-- table (4 rows). Enabling bare RLS with no policies locks it down
-- completely; nothing in the live app touches it, so there's no
-- functional impact.
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
