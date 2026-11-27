-- Trevor's notes + scenarios (27 Nov 2026). Run BEFORE pushing the CRM pages
-- that use these columns (job page, New job, customers).

-- Job: end client phone(s), who to bill, which person at the introducer firm
-- asked, and how a direct client found us.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS end_client_phone TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS bill_to TEXT;           -- 'introducer' | 'end_client'
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS introducer_contact_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS lead_source TEXT;       -- Google, Instagram, AA website...
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS lead_source TEXT;

-- Contacts: archive instead of delete, extra emails, introducer defaults, and
-- people who belong to a firm (Heritage Trees -> the 2-3 people who ask).
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS other_emails TEXT;   -- comma separated
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS default_fee NUMERIC; -- e.g. Plus Rooms 200
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS default_bill_to TEXT; -- 'introducer' | 'end_client'
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS parent_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS clients_parent_idx ON public.clients (parent_client_id);

-- How many rows point at a contact (jobs, enquiries, child contacts...).
-- Found from the foreign keys so new links are counted automatically.
CREATE OR REPLACE FUNCTION public.client_link_count(p_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE fk RECORD; n integer; total integer := 0; saw_arranging boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','user') AND u.is_active) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  FOR fk IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.clients'::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', fk.tbl, fk.col) INTO n USING p_id;
    total := total + n;
    IF fk.tbl = 'public.jobs'::regclass AND fk.col = 'arranging_client_id' THEN saw_arranging := true; END IF;
  END LOOP;
  -- jobs.arranging_client_id may have no foreign key; count it anyway.
  IF NOT saw_arranging THEN
    SELECT count(*) INTO n FROM jobs WHERE arranging_client_id = p_id;
    total := total + n;
  END IF;
  RETURN total;
END $$;

-- Move everything from one contact onto another, then delete the first.
-- Admin only. Fills gaps on the kept record (phone, email...) but never
-- overwrites what it already has; the merged email is kept in other_emails.
CREATE OR REPLACE FUNCTION public.merge_client(p_from uuid, p_into uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE fk RECORD; f clients%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin' AND u.is_active) THEN
    RAISE EXCEPTION 'Only admins can merge contacts';
  END IF;
  IF p_from = p_into THEN RAISE EXCEPTION 'Pick a different contact to merge into'; END IF;
  SELECT * INTO f FROM clients WHERE id = p_from;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM clients WHERE id = p_into) THEN RAISE EXCEPTION 'Contact not found'; END IF;

  FOR fk IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.clients'::regclass
  LOOP
    EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', fk.tbl, fk.col, fk.col) USING p_into, p_from;
  END LOOP;
  -- jobs.arranging_client_id may have no foreign key; move it explicitly.
  UPDATE jobs SET arranging_client_id = p_into WHERE arranging_client_id = p_from;
  UPDATE clients SET parent_client_id = NULL WHERE id = p_into AND parent_client_id = p_into;

  UPDATE clients SET
    phone = COALESCE(phone, f.phone),
    company_name = COALESCE(company_name, f.company_name),
    full_name = COALESCE(full_name, f.full_name),
    email = COALESCE(email, f.email),
    other_emails = NULLIF(concat_ws(', ', other_emails, f.other_emails,
                     CASE WHEN f.email IS NOT NULL AND lower(f.email) <> lower(COALESCE(email, '')) THEN f.email END), ''),
    notes = COALESCE(notes, f.notes)
  WHERE id = p_into;

  DELETE FROM clients WHERE id = p_from;
END $$;

GRANT EXECUTE ON FUNCTION public.client_link_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_client(uuid, uuid) TO authenticated;
