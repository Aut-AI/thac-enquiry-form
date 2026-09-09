-- Nick/Trevor decision 2026-09-09: now that 20260901001 split "15 working
-- days or more" out as its own free tier (same £0 as no_rush, but unlike
-- no_rush it still tracks a real SLA deadline rather than none at all --
-- see that migration's own comment), no_rush is fully redundant. Removing
-- it as a selectable option everywhere (enquiry-form/index.html's two
-- deadline selectors, admin/test-quote-generator.html) and here from the
-- admin-editable deadline_surcharges table, so Settings doesn't show a
-- phantom tier nothing can produce any more.
--
-- deadline_tier is a plain text column on enquiries/jobs, not FK-constrained
-- to this table, so this is safe: historical rows already stamped
-- deadline_tier = 'no_rush' are untouched and keep rendering correctly via
-- the DEADLINE_LABELS lookups in admin/js/thac.js, email-templates.ts, and
-- enquiry-form/accept-quote.html -- deliberately left in place since they
-- serve old data, not the live picker.

DELETE FROM deadline_surcharges WHERE tier = 'no_rush';
