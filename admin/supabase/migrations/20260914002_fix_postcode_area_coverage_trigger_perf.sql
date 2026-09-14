-- sync_postcode_area_coverage (from 20260721004) is a FOR EACH ROW trigger
-- on surveyor_service_outcodes: every single row inserted/deleted re-runs a
-- table-scanning UPDATE on postcode_areas. resync_surveyor_outcodes (from
-- 20260808002) deletes and re-inserts a surveyor's whole outcode set as two
-- set-based statements, which is fine on its own -- but a large radius
-- (e.g. 50mi ~ 1000 matched outcodes) means ~1000 row-level trigger firings
-- in that one transaction, each scanning surveyor_service_outcodes again.
-- That's what was blowing through the statement timeout on Save Location.
--
-- Fix: same logic, but as statement-level triggers using transition
-- tables, so a whole batch of changed rows is reduced to its distinct area
-- codes and postcode_areas is updated once per statement instead of once
-- per row. Postgres won't let one trigger combine multiple events with
-- transition tables ("transition tables cannot be specified for triggers
-- with more than one event"), so this is three single-event triggers
-- instead of one -- INSERT only ever gets NEW TABLE, DELETE only ever gets
-- OLD TABLE, UPDATE (unused today, but resync_surveyor_outcodes deletes +
-- inserts rather than updating in place) gets both.

DROP TRIGGER IF EXISTS trg_sync_postcode_area_coverage ON surveyor_service_outcodes;
DROP FUNCTION IF EXISTS public.sync_postcode_area_coverage();

CREATE OR REPLACE FUNCTION public._sync_postcode_area_coverage_for(p_area_codes text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE postcode_areas pa
  SET is_covered = EXISTS (
    SELECT 1 FROM surveyor_service_outcodes sso
    WHERE upper(substring(sso.outcode FROM '^[A-Za-z]{1,2}')) = pa.area_code
  )
  WHERE pa.area_code = ANY(p_area_codes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_postcode_area_coverage_ins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  PERFORM public._sync_postcode_area_coverage_for(
    (SELECT array_agg(DISTINCT upper(substring(outcode FROM '^[A-Za-z]{1,2}'))) FROM new_rows)
  );
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_postcode_area_coverage_del()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  PERFORM public._sync_postcode_area_coverage_for(
    (SELECT array_agg(DISTINCT upper(substring(outcode FROM '^[A-Za-z]{1,2}'))) FROM old_rows)
  );
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_postcode_area_coverage_upd()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  PERFORM public._sync_postcode_area_coverage_for(
    (SELECT array_agg(DISTINCT upper(substring(outcode FROM '^[A-Za-z]{1,2}')))
     FROM (SELECT outcode FROM new_rows UNION SELECT outcode FROM old_rows) x)
  );
  RETURN NULL;
END;
$function$;

CREATE TRIGGER trg_sync_postcode_area_coverage_ins
AFTER INSERT ON surveyor_service_outcodes
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION sync_postcode_area_coverage_ins();

CREATE TRIGGER trg_sync_postcode_area_coverage_del
AFTER DELETE ON surveyor_service_outcodes
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION sync_postcode_area_coverage_del();

CREATE TRIGGER trg_sync_postcode_area_coverage_upd
AFTER UPDATE ON surveyor_service_outcodes
REFERENCING NEW TABLE AS new_rows OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION sync_postcode_area_coverage_upd();
