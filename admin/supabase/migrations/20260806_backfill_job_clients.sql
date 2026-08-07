-- Backfills `clients` rows for existing jobs that were approved before the
-- client-linking pipeline existed. clients.html's empty-state copy has
-- always claimed "Clients are created when jobs are approved", but no code
-- path anywhere in this repo (or any untracked SQL-editor trigger) actually
-- did this -- confirmed live: 62/62 jobs had a null arranging_client_id
-- before this migration. The app-side fix (admin/job-detail.html's
-- approveToMap(), via the new findOrCreateClient() helper in
-- admin/js/thac.js) now creates/links a client at approval time going
-- forward; this migration catches up the jobs that were approved before
-- that existed.
--
-- Only jobs with actual billing contact data are backfilled -- of the 62
-- existing jobs, 58 are placeholder/demo rows seeded for map testing with
-- no billing_contact_name/email at all, so there's nothing real to derive
-- a client from. Those are deliberately left unlinked rather than given
-- fabricated client names.
--
-- Applied directly against production via `supabase db query --linked`,
-- matching this repo's existing migration convention (see
-- 20260805_admin_user_roles.sql).

-- One client per distinct billing email among jobs that don't have one yet.
-- The NOT EXISTS guard is a no-op safeguard in case a matching client (by
-- email) was already created by the app-side path for a different job in
-- the same household/company by the time this runs.
INSERT INTO clients (client_type, client_category, full_name, email, address_line_1)
SELECT DISTINCT ON (lower(j.billing_contact_email))
  'individual', 'other', j.billing_contact_name, j.billing_contact_email, j.billing_address
FROM jobs j
WHERE j.arranging_client_id IS NULL
  AND j.billing_contact_email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM clients c WHERE lower(c.email) = lower(j.billing_contact_email)
  )
ORDER BY lower(j.billing_contact_email), j.created_at ASC;

-- Link every unlinked job to the (now-existing) client matching its
-- billing email, covering both the rows just inserted above and any
-- client that already existed with a matching email.
UPDATE jobs j
SET arranging_client_id = c.id,
    paying_client_id    = c.id,
    report_client_id    = c.id
FROM clients c
WHERE j.arranging_client_id IS NULL
  AND j.billing_contact_email IS NOT NULL
  AND lower(c.email) = lower(j.billing_contact_email);

-- Jobs with a billing name but no email can't be deduped/linked by email --
-- the enquiry form has always required an email, so in practice this
-- branch should match nothing, but it's handled defensively rather than
-- left to silently skip. Ties each new client back to the specific job it
-- was created for via a CTE, instead of re-joining on name (which could
-- mismatch jobs that happen to share a billing name).
WITH candidate_jobs AS (
  SELECT id, billing_contact_name, billing_address
  FROM jobs
  WHERE arranging_client_id IS NULL
    AND billing_contact_email IS NULL
    AND billing_contact_name IS NOT NULL
),
new_clients AS (
  INSERT INTO clients (client_type, client_category, full_name, address_line_1)
  SELECT 'individual', 'other', billing_contact_name, billing_address
  FROM candidate_jobs
  RETURNING id, full_name, address_line_1
),
matched AS (
  SELECT cj.id AS job_id, nc.id AS client_id,
         row_number() OVER (PARTITION BY cj.id ORDER BY nc.id) AS rn
  FROM candidate_jobs cj
  JOIN new_clients nc
    ON nc.full_name = cj.billing_contact_name
   AND nc.address_line_1 IS NOT DISTINCT FROM cj.billing_address
)
UPDATE jobs j
SET arranging_client_id = m.client_id,
    paying_client_id    = m.client_id,
    report_client_id    = m.client_id
FROM matched m
WHERE j.id = m.job_id AND m.rn = 1;
