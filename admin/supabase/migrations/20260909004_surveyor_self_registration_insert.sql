-- Self-registration (surveyor-new/'s RegisterScreen.tsx) has been broken
-- since the surveyors table's admin_full_access policy was dropped fixing
-- the CRITICAL public PII leak (see full_system_audit_sept2026 memory) --
-- that catch-all policy was apparently the only thing that ever let a
-- brand-new authenticated user insert their own surveyors row. Confirmed
-- via pg_policies: the only INSERT policy on surveyors is admin-only
-- ("Admins can insert surveyors"). A real signUp()'d user gets
-- "42501: new row violates row-level security policy" trying to create
-- their own profile.
--
-- Adds a dedicated self-registration INSERT policy, scoped tightly:
-- user_id must match the caller's own auth uid (so nobody can create a
-- profile "as" someone else), and is_active/status are pinned to
-- false/'pending' regardless of what the client sends -- RegisterScreen.tsx
-- already sends exactly this, but RLS shouldn't rely on client good
-- behaviour alone. Without this pin, a crafted request could self-insert
-- with is_active=true, status='active' and skip admin approval entirely.

CREATE POLICY "Surveyors can self-register" ON public.surveyors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_active = false
    AND status = 'pending'
  );
