// ============================================================
// THAC — check-unaccepted-allocations
// Trigger: pg_cron, hourly (see migration 20261116002)
// Sends:   ONE email to admin per job that has been allocated to a surveyor
//          for 2+ days without the surveyor accepting it in the app
//          (Trevor, 16 Nov 2026). Marks the job so it is not emailed again;
//          re-allocating or taking back clears the mark.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { serviceKeyHeaders } from '../_shared/service-key.ts';
import { sendEmail, emailWrapper, detailBlock, detailRow, SURVEY_LABELS, ADMIN_EMAIL } from '../_shared/email-templates.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SB_THAC_SERVICE_ROLE_KEY')!;
const AFTER_HOURS = 48;

serve(async () => {
  try {
    const cutoff = new Date(Date.now() - AFTER_HOURS * 3600 * 1000).toISOString();
    const headers = { ...serviceKeyHeaders(SERVICE_ROLE_KEY), 'Content-Type': 'application/json' };
    const q = `${SUPABASE_URL}/rest/v1/jobs?select=id,reference,survey_type,site_postcode,allocated_at,allocated_surveyor_id` +
      `&allocated_surveyor_id=not.is.null&surveyor_id=is.null&allocation_rejected_at=is.null` +
      `&unaccepted_alert_sent_at=is.null&is_archived=not.eq.true&allocated_at=lt.${cutoff}`;
    const res = await fetch(q, { headers });
    if (!res.ok) throw new Error('Query failed: ' + await res.text());
    const jobs = await res.json();
    if (!jobs.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

    const ids = [...new Set(jobs.map((j: any) => j.allocated_surveyor_id))];
    const sRes = await fetch(`${SUPABASE_URL}/rest/v1/surveyors?select=id,full_name&id=in.(${ids.join(',')})`, { headers });
    const names: Record<string, string> = {};
    for (const s of (await sRes.json()) || []) names[s.id] = s.full_name;

    const rows = jobs.map((j: any) => {
      const days = Math.floor((Date.now() - new Date(j.allocated_at).getTime()) / 86400000);
      return detailBlock([
        detailRow('Job', `<a href="https://thac-enquiry-form-production.up.railway.app/admin/job-detail.html?id=${j.id}">${j.reference || j.id}</a>`),
        detailRow('Survey Type', SURVEY_LABELS[j.survey_type] || j.survey_type || '—'),
        detailRow('Postcode', j.site_postcode || '—'),
        detailRow('Allocated to', names[j.allocated_surveyor_id] || 'Unknown surveyor'),
        detailRow('Waiting', `${days} days`),
      ].join(''));
    }).join('<br>');

    const html = emailWrapper(`
      <h2>Allocated, but not accepted</h2>
      <p>${jobs.length === 1 ? 'This job has' : 'These jobs have'} been allocated to a surveyor for over 2 days, and they
         have not accepted ${jobs.length === 1 ? 'it' : 'them'} in the app yet. Chase them, or open the job and Take Back to put it on the map again.</p>
      ${rows}
      <a href="https://thac-enquiry-form-production.up.railway.app/admin/jobs.html?dispatch=unaccepted" class="cta-button">View in CRM →</a>
    `);
    await sendEmail(ADMIN_EMAIL, `Allocated, not accepted — ${jobs.length} job${jobs.length === 1 ? '' : 's'} waiting 2+ days`, html);

    const idList = jobs.map((j: any) => j.id).join(',');
    await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=in.(${idList})`, {
      method: 'PATCH', headers, body: JSON.stringify({ unaccepted_alert_sent_at: new Date().toISOString() }),
    });
    return new Response(JSON.stringify({ sent: jobs.length }), { status: 200 });
  } catch (err) {
    console.error('check-unaccepted-allocations error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
