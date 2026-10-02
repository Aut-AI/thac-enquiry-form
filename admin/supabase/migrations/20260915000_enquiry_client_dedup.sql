-- One deduplicated customer (clients row) per email, with every enquiry
-- and job hanging off it.
--
-- Before this, `clients` rows were only ever created at job approval
-- (admin/job-detail.html approveToMap() -> findOrCreateClient()), from the
-- job's billing contact, and never refreshed afterwards. Enquiries weren't
-- linked to a client at all, so a returning customer's new enquiry had no
-- connection to their history, and pending jobs had no client until
-- someone approved them.
--
-- Now, at the database level (so it covers every insert path -- the
-- submit-enquiry Edge Function, test-quote-generator, admin edits):
--   * Every enquiry is matched to a client by lower(contact_email) --
--     the existing idx_clients_email_unique index is the dedupe key. No
--     match -> a new client is created.
--   * The latest enquiry is the master for the client's contact details:
--     non-blank name/phone/company from a new enquiry overwrite what's
--     stored. Blank values never wipe existing data (the form doesn't
--     require phone/company, so a returning customer who skips them
--     shouldn't lose what we already had). An edit to an OLDER enquiry
--     only fills gaps, so it can't clobber details from a newer one.
--   * client_type/category/address are left alone on existing clients --
--     those are admin-curated, and the enquiry form's site address is the
--     survey site, not the customer's address.
--   * New jobs inherit arranging_client_id from their enquiry. paying/
--     report client are still resolved at approval from billing/end-client
--     details, which can legitimately be a different party.

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enquiries_client_id ON public.enquiries (client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_arranging_client_id ON public.jobs (arranging_client_id);

CREATE OR REPLACE FUNCTION public.upsert_client_by_email(
  p_email     text,
  p_name      text,
  p_phone     text,
  p_company   text,
  p_overwrite boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email   text := nullif(trim(p_email), '');
  v_name    text := nullif(trim(p_name), '');
  v_phone   text := nullif(trim(p_phone), '');
  v_company text := nullif(trim(p_company), '');
  v_id      uuid;
BEGIN
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO clients (client_type, client_category, full_name, company_name, email, phone)
  VALUES (
    CASE WHEN v_company IS NOT NULL THEN 'company' ELSE 'individual' END::client_type,
    'other',
    v_name, v_company, v_email, v_phone
  )
  ON CONFLICT ((lower(email))) WHERE email IS NOT NULL DO UPDATE SET
    full_name    = CASE WHEN p_overwrite THEN coalesce(EXCLUDED.full_name,    clients.full_name)
                        ELSE coalesce(clients.full_name,    EXCLUDED.full_name) END,
    company_name = CASE WHEN p_overwrite THEN coalesce(EXCLUDED.company_name, clients.company_name)
                        ELSE coalesce(clients.company_name, EXCLUDED.company_name) END,
    phone        = CASE WHEN p_overwrite THEN coalesce(EXCLUDED.phone,        clients.phone)
                        ELSE coalesce(clients.phone,        EXCLUDED.phone) END
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- SECURITY DEFINER + Supabase's default EXECUTE grants would otherwise
-- expose this as a public RPC, letting anyone overwrite any client's
-- name/phone just by knowing their email. Only the triggers below call it.
REVOKE EXECUTE ON FUNCTION public.upsert_client_by_email(text, text, text, text, boolean)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.link_enquiry_to_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.contact_email IS NOT DISTINCT FROM OLD.contact_email
     AND NEW.contact_name  IS NOT DISTINCT FROM OLD.contact_name
     AND NEW.contact_phone IS NOT DISTINCT FROM OLD.contact_phone
     AND NEW.company       IS NOT DISTINCT FROM OLD.company THEN
    RETURN NEW;
  END IF;

  NEW.client_id := upsert_client_by_email(
    NEW.contact_email, NEW.contact_name, NEW.contact_phone, NEW.company,
    NOT EXISTS (
      SELECT 1 FROM enquiries e
      WHERE lower(e.contact_email) = lower(trim(NEW.contact_email))
        AND e.id <> NEW.id
        AND e.submitted_at > NEW.submitted_at
    )
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_enquiry_to_client() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enquiries_link_client ON public.enquiries;
CREATE TRIGGER enquiries_link_client
  BEFORE INSERT OR UPDATE OF contact_email, contact_name, contact_phone, company
  ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.link_enquiry_to_client();

CREATE OR REPLACE FUNCTION public.link_job_to_enquiry_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.arranging_client_id IS NULL AND NEW.enquiry_id IS NOT NULL THEN
    SELECT client_id INTO NEW.arranging_client_id
    FROM enquiries WHERE id = NEW.enquiry_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_job_to_enquiry_client() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS jobs_link_client ON public.jobs;
CREATE TRIGGER jobs_link_client
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.link_job_to_enquiry_client();

-- ------------------------------------------------------------
-- Backfill existing enquiries, oldest first, so the most recent
-- enquiry per email ends up as the master copy of the details.
--
-- on_enquiry_accepted is a legacy, untracked trigger that POSTs to
-- notify-quote-accepted-to-customer on EVERY enquiries UPDATE (no status
-- guard). It currently fails harmlessly (wrong body shape, no auth
-- header), but it's disabled for the backfill so this can't send
-- anything regardless.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_enquiry_accepted'
             AND tgrelid = 'public.enquiries'::regclass) THEN
    EXECUTE 'ALTER TABLE public.enquiries DISABLE TRIGGER on_enquiry_accepted';
  END IF;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, contact_email, contact_name, contact_phone, company
    FROM enquiries
    WHERE client_id IS NULL AND nullif(trim(contact_email), '') IS NOT NULL
    ORDER BY submitted_at ASC, created_at ASC
  LOOP
    UPDATE enquiries
    SET client_id = upsert_client_by_email(r.contact_email, r.contact_name, r.contact_phone, r.company, true)
    WHERE id = r.id;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_enquiry_accepted'
             AND tgrelid = 'public.enquiries'::regclass) THEN
    EXECUTE 'ALTER TABLE public.enquiries ENABLE TRIGGER on_enquiry_accepted';
  END IF;
END $$;

-- Existing jobs created from an enquiry but not yet linked to a client.
UPDATE jobs j
SET arranging_client_id = e.client_id
FROM enquiries e
WHERE j.enquiry_id = e.id
  AND j.arranging_client_id IS NULL
  AND e.client_id IS NOT NULL;
