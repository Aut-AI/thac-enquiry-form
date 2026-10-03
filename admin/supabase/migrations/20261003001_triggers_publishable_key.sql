-- Swap the legacy anon JWT baked into the webhook trigger functions
-- (pg_net calls to Edge Functions) for the new publishable key, ahead of
-- deactivating Supabase's legacy API keys -- the legacy service_role key
-- leaked via a public commit. The target functions are deployed with
-- --no-verify-jwt, so the key is only passed along, not checked as a JWT.
--
-- Rewrites each function from its live definition (several were edited in
-- the Dashboard and don't match the migrations folder), changing only the
-- key string.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosrc LIKE '%eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbXBwYXFncG50YWRleWx6enduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTUzOTMsImV4cCI6MjA5NDg5MTM5M30.SU2M7e5OSwqIjRJfM15uKLHTqSrLadcY46MR51twosU%'
  LOOP
    EXECUTE replace(pg_get_functiondef(r.oid),
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbXBwYXFncG50YWRleWx6enduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTUzOTMsImV4cCI6MjA5NDg5MTM5M30.SU2M7e5OSwqIjRJfM15uKLHTqSrLadcY46MR51twosU',
                    'sb_publishable_yZaRUopPFonGWdUPr_k6dQ_QtvLW5nn');
    RAISE NOTICE 'Updated %', r.proname;
  END LOOP;
END $$;

-- Should return no rows.
SELECT p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosrc LIKE '%eyJhbGci%';
