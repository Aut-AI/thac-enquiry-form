-- These trigger functions call supabase_functions.http_request, which the
-- authenticated role (a newly-registered surveyor) has no grant on. Without
-- SECURITY DEFINER, the trigger runs as the inserting role and fails with
-- "permission denied for schema supabase_functions" (42501). Run as the
-- function owner instead, matching sync_surveyor_service_outcodes in
-- 20260630_surveyor_radius_coverage.sql which already does this correctly.

ALTER FUNCTION geocode_surveyor_postcode() SECURITY DEFINER;
ALTER FUNCTION on_surveyor_registered() SECURITY DEFINER;
ALTER FUNCTION on_surveyor_approved() SECURITY DEFINER;
