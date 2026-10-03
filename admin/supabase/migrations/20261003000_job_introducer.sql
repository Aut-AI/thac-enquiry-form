-- Introducer (who sent Trevor the work) as a first-class link on every
-- enquiry and job, so work can be grouped by source: "all Trinity jobs",
-- "what's outstanding for Heritage Trees", etc.
--
-- Analysis of Trevor's CRM export (208 live jobs, 2026-10-03) showed end
-- clients almost never repeat (~200 distinct for 208 jobs) -- the repeat
-- relationships are the introducers: Trinity Claims/Policy Expert ~120,
-- Plus Rooms 9, Heritage Trees 8, UPP 7, White Planning 4. The free-text
-- enquiries.introducer_name/introducer_email captured by the public form
-- couldn't be grouped or filtered on.
--
-- Introducers are rows in `clients` (client_type 'agent') rather than a
-- separate table: an introducer is often also the payer (paying_client_id),
-- and this reuses the existing one-row-per-email dedupe index and the
-- client-detail page.
--
--   * enquiries.introducer_client_id is set by trigger from
--     introducer_email (dedupe by lower(email), same as the end client).
--     An existing client row is reused as-is -- only gaps are filled and
--     its client_type is left alone, so a homeowner who later refers
--     someone isn't relabelled.
--   * jobs.introducer_client_id is inherited from the enquiry on insert,
--     and editable by admin on job-detail.html afterwards (also how
--     imported jobs with no enquiry get one).

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS introducer_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS introducer_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enquiries_introducer_client_id ON public.enquiries (introducer_client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_introducer_client_id ON public.jobs (introducer_client_id);

CREATE OR REPLACE FUNCTION public.upsert_introducer_by_email(
  p_email text,
  p_name  text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := nullif(trim(p_email), '');
  v_name  text := nullif(trim(p_name), '');
  v_id    uuid;
BEGIN
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO clients (client_type, client_category, full_name, email)
  VALUES ('agent'::client_type, 'other', v_name, v_email)
  ON CONFLICT ((lower(email))) WHERE email IS NOT NULL DO UPDATE SET
    full_name = coalesce(clients.full_name, EXCLUDED.full_name)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Same reasoning as upsert_client_by_email: never a public RPC.
REVOKE EXECUTE ON FUNCTION public.upsert_introducer_by_email(text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.link_enquiry_to_introducer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.introducer_email IS NOT DISTINCT FROM OLD.introducer_email
     AND NEW.introducer_name  IS NOT DISTINCT FROM OLD.introducer_name THEN
    RETURN NEW;
  END IF;

  -- Someone filling in the "on behalf of" block with their own email
  -- isn't an introducer.
  IF lower(trim(NEW.introducer_email)) IS NOT DISTINCT FROM lower(trim(NEW.contact_email)) THEN
    NEW.introducer_client_id := NULL;
  ELSE
    NEW.introducer_client_id := upsert_introducer_by_email(NEW.introducer_email, NEW.introducer_name);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_enquiry_to_introducer() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enquiries_link_introducer ON public.enquiries;
CREATE TRIGGER enquiries_link_introducer
  BEFORE INSERT OR UPDATE OF introducer_email, introducer_name
  ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.link_enquiry_to_introducer();

-- Extends the 20260915000 version: also carry the introducer across.
CREATE OR REPLACE FUNCTION public.link_job_to_enquiry_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.enquiry_id IS NOT NULL
     AND (NEW.arranging_client_id IS NULL OR NEW.introducer_client_id IS NULL) THEN
    SELECT coalesce(NEW.arranging_client_id, e.client_id),
           coalesce(NEW.introducer_client_id, e.introducer_client_id)
      INTO NEW.arranging_client_id, NEW.introducer_client_id
    FROM enquiries e WHERE e.id = NEW.enquiry_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- Backfill. on_enquiry_accepted (legacy trigger, fires on every enquiries
-- UPDATE) is disabled around it, as in 20260915000.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_enquiry_accepted'
             AND tgrelid = 'public.enquiries'::regclass) THEN
    EXECUTE 'ALTER TABLE public.enquiries DISABLE TRIGGER on_enquiry_accepted';
  END IF;
END $$;

UPDATE enquiries
SET introducer_client_id = upsert_introducer_by_email(introducer_email, introducer_name)
WHERE introducer_client_id IS NULL
  AND nullif(trim(introducer_email), '') IS NOT NULL
  AND lower(trim(introducer_email)) IS DISTINCT FROM lower(trim(contact_email));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_enquiry_accepted'
             AND tgrelid = 'public.enquiries'::regclass) THEN
    EXECUTE 'ALTER TABLE public.enquiries ENABLE TRIGGER on_enquiry_accepted';
  END IF;
END $$;

UPDATE jobs j
SET introducer_client_id = e.introducer_client_id
FROM enquiries e
WHERE j.enquiry_id = e.id
  AND j.introducer_client_id IS NULL
  AND e.introducer_client_id IS NOT NULL;
