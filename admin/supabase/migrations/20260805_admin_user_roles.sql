-- Adds a distinct 'user' role for admin CRM staff who should keep full
-- operational access (jobs, clients, quotes, pricing lookups, surveyors)
-- but not be able to change system-level settings or manage other users'
-- CRM access. Previously the only roles were 'admin' (full access,
-- including settings) and 'surveyor' (the mobile app's own restricted
-- view) -- there was no way to give someone regular CRM access without
-- also giving them settings/user-management access.
--
-- Applied directly against production via `supabase db query --linked`
-- (this repo's admin/ directory has no `supabase link` history and this
-- project's migrations have historically been run by hand in the SQL
-- editor -- see the "public.users" table itself, which predates this
-- migration but was never captured in this migrations folder). This file
-- exists so the schema change has a record here going forward.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'user';

-- Lets the admin CRM sidebar (and anything else) read a user's own
-- full_name/role/is_active without going through a service-role function.
-- RLS was already enabled on this table but had zero policies, so it was
-- previously unreadable via the anon key + user JWT entirely.
CREATE POLICY "Users can view own row" ON public.users
  FOR SELECT USING (id = auth.uid());

-- Broaden the existing admin-only policies (previously role = 'admin' only)
-- to also accept the new 'user' role, so assigning someone 'user' doesn't
-- silently lock them out of jobs/clients/quotes/pricing/surveyors -- the
-- new role is meant to differ from 'admin' only in settings/user-management
-- access, handled separately below and in the admin-users Edge Function.
ALTER POLICY "Admins full access on clients" ON public.clients
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'user') AND u.is_active = true));

ALTER POLICY "Admin full access on jobs" ON public.jobs
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'user') AND users.is_active = true));

ALTER POLICY "Admin write modifiers" ON public.pricing_modifiers
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'user') AND u.is_active = true));

ALTER POLICY "Admins full access on quotes" ON public.quotes
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'user') AND u.is_active = true));

ALTER POLICY "Admin write pricing" ON public.survey_type_pricing
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'user') AND u.is_active = true));

ALTER POLICY "Admins can view all surveyors" ON public.surveyors
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'user') AND u.is_active = true));

ALTER POLICY "Admins can update any surveyor" ON public.surveyors
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'user') AND u.is_active = true));

ALTER POLICY "Admins can insert surveyors" ON public.surveyors
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'user') AND u.is_active = true));

-- Settings stays admin-only: this is the one thing that actually
-- distinguishes 'admin' from 'user'. Previously any authenticated CRM
-- account (which today means anyone in auth.users, including surveyor
-- logins) could update the customer pricing rate.
DROP POLICY IF EXISTS "Allow authenticated update pricing settings" ON public.pricing_settings;

CREATE POLICY "Allow admin update pricing settings" ON public.pricing_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'::user_role AND u.is_active = true)
  );

-- Backfill: fix placeholder full_name values (was literally the email
-- string) and add Ciaran, who was missing from this table entirely --
-- meaning he had no admin/user row satisfying any of the policies above,
-- i.e. no RLS-level access to jobs/clients/quotes/pricing/surveyors admin
-- ops despite being an active CRM user.
UPDATE public.users SET full_name = 'Nick Abraham' WHERE email = 'nick@aut-ai.com';
UPDATE public.users SET full_name = 'Trevor Heaps' WHERE email = 'trevor@trevorheaps.co.uk';

INSERT INTO public.users (id, role, full_name, email, is_active)
VALUES ('714db803-e67c-4c6f-b23e-a6fd3b05fcf0', 'admin', 'Ciaran Murphy', 'ciaran@aut-ai.com', true)
ON CONFLICT (id) DO NOTHING;
