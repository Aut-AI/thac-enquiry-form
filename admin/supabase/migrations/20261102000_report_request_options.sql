-- Turnaround options for the amend / complete a report form
-- (enquiry-form/report-request.html, Trevor's request of 26 Oct 2026).
--
-- Separate from deadline_surcharges: those are the survey turnaround
-- prices (3 days = £200), these are the report request ones (3 days =
-- £100), and Trevor switches them on and off independently (2 Nov 2026:
-- "yes please" to turning off next-day / 3-day when busy).
--
-- Read by the public form (anon) and the submit-report-request Edge
-- Function; edited from admin/settings.html. Both the form and the
-- function fall back to the seeded values below if this table is missing,
-- so they can deploy before this migration runs.

CREATE TABLE IF NOT EXISTS public.report_request_options (
  tier         text PRIMARY KEY,
  label        text NOT NULL,
  surcharge    numeric(8,2) NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  sort_order   int NOT NULL DEFAULT 0,
  updated_at   timestamptz DEFAULT now()
);

INSERT INTO public.report_request_options (tier, label, surcharge, sort_order) VALUES
  ('1day',  'Next working day',      150, 1),
  ('3days', 'Within 3 working days', 100, 2),
  ('5days', 'Within 5 working days', 0,   3)
ON CONFLICT (tier) DO NOTHING;

ALTER TABLE public.report_request_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read report request options" ON public.report_request_options;
CREATE POLICY "Public read report request options" ON public.report_request_options
  FOR SELECT USING (true);

-- Admin-only, like pricing_settings: "authenticated" alone would include
-- surveyor app logins.
DROP POLICY IF EXISTS "Admin update report request options" ON public.report_request_options;
CREATE POLICY "Admin update report request options" ON public.report_request_options
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'::user_role AND u.is_active = true)
  );
