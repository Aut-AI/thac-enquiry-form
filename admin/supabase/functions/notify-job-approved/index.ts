// ============================================================
// THAC — notify-job-approved  (now: "job back on the map")
// Trigger: UPDATE on public.jobs
//          WHERE old.dispatch_state IS DISTINCT FROM new.dispatch_state
//            AND new.dispatch_state = 'red'
// Fires:   When a job that a surveyor had goes back on the map
// Sends:   Email to admin -- the job needs a new surveyor
//
// There is no approval step any more (Trevor, 19 Oct 2026): jobs go on the
// map when a quote is accepted (the quote-accepted email covers that) or when
// the office adds or activates one. So only a hand-back is worth an email.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, urgencyStateBadge, statusDot, detailBlock, detailRow, SURVEY_LABELS, ADMIN_EMAIL } from '../_shared/email-templates.ts';

serve(async (req) => {
  try {
    const payload = await req.json();
    const record  = payload.record;       // new row state
    const oldRecord = payload.old_record; // previous row state

    if (record.dispatch_state !== 'red' || oldRecord?.dispatch_state !== 'orange') {
      return new Response('Not a hand-back -- skipping', { status: 200 });
    }

    const subject = `Job Back on Map — ${record.reference} | Surveyor Handed It Back`;

    const slaDate = record.sla_deadline
      ? new Date(record.sla_deadline).toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
      : 'Not set';

    const html = emailWrapper(`
      <h2>Job Back on the Map</h2>
      <p>The surveyor no longer has this job. It is back on the map as
         <strong style="color:#c0392b;">${statusDot('#c0392b')}Unallocated</strong>
         and needs another surveyor.</p>

      ${detailBlock([
        detailRow('Job Reference', record.reference),
        detailRow('Survey Type', SURVEY_LABELS[record.survey_type] || record.survey_type || '—'),
        detailRow('Site Postcode', record.site_postcode || '—'),
        detailRow('Urgency', urgencyStateBadge(record.urgency_state)),
        detailRow('SLA Deadline', slaDate),
        detailRow('Reason given', record.handed_back_note || '—'),
      ].join(''))}

      <a href="https://thac-enquiry-form-production.up.railway.app/admin/job-detail.html?id=${record.id}" class="cta-button">
        View Job in CRM →
      </a>
    `);

    await sendEmail(ADMIN_EMAIL, subject, html);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('notify-job-approved error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
