// ============================================================
// THAC — notify-job-created
// Trigger: INSERT on public.jobs
// Fires:   When a job is added straight onto the map (New job in the CRM)
// Sends:   Email to admin -- job is on the map, database to create
//
// Website jobs are created when the enquiry comes in, but wait as Awaiting
// Go-ahead until the quote is accepted. Those are covered by the new-enquiry
// and quote-accepted emails, so they (and Stage 2 jobs waiting for plans)
// are skipped here.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, urgencyStateBadge, statusDot, detailBlock, detailRow, SURVEY_LABELS, ADMIN_EMAIL } from '../_shared/email-templates.ts';

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;

    if (record.dispatch_state !== 'red') {
      return new Response('Not on the map yet -- skipping', { status: 200 });
    }

    const subject = `New Job on Map — ${record.reference || 'New Job'} | Database to Create`;

    const slaDate = record.sla_deadline
      ? new Date(record.sla_deadline).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'Not yet set';

    const html = emailWrapper(`
      <h2>New Job on the Map</h2>
      <p>A new job is on the surveyor map as
         <strong style="color:#c0392b;">${statusDot('#c0392b')}Unallocated</strong>.
         Its database needs creating. Nothing can happen until it goes to the surveyor.</p>

      ${detailBlock([
        detailRow('Job Reference', record.reference || 'Being assigned...'),
        detailRow('Survey Type', SURVEY_LABELS[record.survey_type] || record.survey_type || '—'),
        detailRow('Site Postcode', record.site_postcode || '—'),
        detailRow('Urgency', urgencyStateBadge(record.urgency_state)),
        detailRow('SLA Deadline', slaDate),
        detailRow('Agreed Amount', `£${record.agreed_amount?.toFixed(2) ?? record.quoted_amount?.toFixed(2) ?? '—'}`),
        detailRow('Created', new Date(record.created_at).toLocaleString('en-GB')),
      ].join(''))}

      <p style="font-size:14px; color:#6b756f; margin-top:16px;">
        <strong>Next steps:</strong><br>
        1. Create the database (urgent jobs first) and tick Database created<br>
        2. Draft the report if you can, and tick Report drafted<br>
        3. A surveyor claims the job in the app. You'll be emailed when they do
      </p>

      <a href="https://thac-enquiry-form-production.up.railway.app/admin/job-detail.html?id=${record.id}" class="cta-button">
        Open Job in CRM →
      </a>
    `);

    await sendEmail(ADMIN_EMAIL, subject, html);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('notify-job-created error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
