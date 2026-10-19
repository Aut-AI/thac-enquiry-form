// ============================================================
// THAC — notify-report-sent  (RETIRED 19 Oct 2026)
// Trigger: UPDATE on public.jobs when report_finalised flips to true
//
// Used to email the office "Report finalised, invoice now required". Sending
// the report and invoicing are now one step in the CRM (Report & Invoice
// Sent records both and completes the job), so that reminder would always
// arrive after the invoice was already recorded. The DB trigger still calls
// this function, so it stays deployed and simply doesn't email. The client
// has never been emailed from here; Trevor sends the report himself.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(() => new Response('Retired: report and invoice are recorded together', { status: 200 }));
