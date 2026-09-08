// ============================================================
// THAC — notify-job-approved
// Trigger: UPDATE on public.jobs
//          WHERE old.dispatch_state IS DISTINCT FROM new.dispatch_state
//            AND new.dispatch_state = 'red'
// Fires:   When Trevor approves a job — red dot goes live on map
// Sends:   Email to admin confirming job is live
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, urgencyStateBadge, statusDot, detailBlock, detailRow, ADMIN_EMAIL } from '../_shared/email-templates.ts';

serve(async (req) => {
  try {
    const payload = await req.json();
    const record  = payload.record;       // new row state
    const oldRecord = payload.old_record; // previous row state

    // Only fire when transitioning TO 'red' (the DB trigger already filters
    // on this, but keep the check here as a defensive second layer).
    if (record.dispatch_state !== 'red') {
      return new Response('Not a job-approval transition', { status: 200 });
    }
    if (oldRecord?.dispatch_state === 'red') {
      return new Response('Already live — skipping', { status: 200 });
    }

    const subject = `Job Live on Map — ${record.reference} | Awaiting Surveyor Claim`;

    const slaDate = record.sla_deadline
      ? new Date(record.sla_deadline).toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
      : 'Not set';

    const html = emailWrapper(`
      <h2>Job Approved & Live on Marketplace</h2>
      <p>Trevor has approved this job. It is now visible as a
         <strong style="color:#c0392b;">${statusDot('#c0392b')}red dot</strong> on the surveyor marketplace map
         and awaiting a surveyor claim.</p>

      ${detailBlock([
        detailRow('Job Reference', record.reference),
        detailRow('Survey Type', record.survey_type || '—'),
        detailRow('Site Postcode', record.site_postcode || '—'),
        detailRow('Urgency', urgencyStateBadge(record.urgency_state)),
        detailRow('SLA Deadline', slaDate),
        detailRow('Agreed Amount', `£${record.agreed_amount?.toFixed(2) ?? record.quoted_amount?.toFixed(2) ?? '—'}`),
        detailRow('Approved', new Date(record.approved_at || Date.now()).toLocaleString('en-GB')),
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
