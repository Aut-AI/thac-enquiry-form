-- CRITICAL: found while auditing the surveyor apps' write paths. The
-- "Surveyors can update own profile" RLS policy (USING/WITH CHECK:
-- user_id = auth.uid()) has no restriction on which columns can change --
-- only that the row belongs to the caller. Confirmed live: a freshly
-- self-registered surveyor (status='pending', is_active=false, exactly
-- what RegisterScreen.tsx/CompleteProfileScreen.tsx send) can immediately
-- PATCH their own row to status='active', is_active=true, and set their
-- own hourly_rate to any value at all (tested: set to £9999/hr, it
-- stuck) -- completely bypassing admin review. This defeats the entire
-- point of the approval workflow and the 20260909004 fix, which only
-- closed the equivalent bypass on INSERT, not UPDATE.
--
-- Fixed with a BEFORE UPDATE trigger rather than tightening the RLS WITH
-- CHECK, since RLS can't compare old vs new values on a single row --
-- the trigger reverts status/is_active/hourly_rate/is_paused to their
-- prior values whenever the caller isn't an admin (checked via the same
-- users.role pattern every admin policy already uses) or the trusted
-- service_role. Neither the surveyor apps nor admin/job-detail.html
-- (which uses the browser's authenticated admin session, not
-- service_role, for its own writes) currently touch is_paused from the
-- surveyor side, but it's protected too as the same class of field --
-- there's no legitimate self-service path that should ever change it.

CREATE OR REPLACE FUNCTION prevent_surveyor_self_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'user')
      AND u.is_active = true
  ) THEN
    NEW.status := OLD.status;
    NEW.is_active := OLD.is_active;
    NEW.is_paused := OLD.is_paused;
    NEW.hourly_rate := OLD.hourly_rate;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_surveyor_self_approval ON public.surveyors;
CREATE TRIGGER trg_prevent_surveyor_self_approval
  BEFORE UPDATE ON public.surveyors
  FOR EACH ROW EXECUTE FUNCTION prevent_surveyor_self_approval();
