-- Run this first if you see "schema \"supabase_functions\" does not exist" in Supabase SQL Editor.

CREATE SCHEMA IF NOT EXISTS supabase_functions;

-- The webhook migration script depends on this schema.
-- After this completes, run:
--   admin/supabase/migrations/000_create_webhooks_and_schema.sql
