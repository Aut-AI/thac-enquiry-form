// ============================================================
// THAC — notify-job-approved
// Trigger: UPDATE on public.jobs
//          WHERE old.dispatch_state != 'live_unallocated'
//            AND new.dispatch_state  = 'live_unallocated'
// Fires:   When Trevor approves a job — red dot goes live on map
// Sends:   Email to admin confirming job is live
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, urgencyBadge, ADMIN_EMAIL } from '../_shared/email-templates.ts';

serve(async (req) => {
  try {
    const payload = await req.json();
    const record  = payload.record;       // new row state
    const oldRecord = payload.old_record; // previous row state

    // Only fire when transitioning TO live_unallocated
    if (record.dispatch_state !== 'live_unallocated') {
      return new Response('Not a job-approval transition', { status: 200 });
    }
    if (oldRecord?.dispatch_state === 'live_unallocated') {
      return new Response('Already live — skipping', { status: 200 });
    }

    const subject = `✅ Job Live on Map — ${record.reference} | Awaiting Surveyor Claim`;

    const slaDate = record.sla_deadline
      ? new Date(record.sla_deadline).toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
      : 'Not set';

    const html = emailWrapper(`
      <h2>Job Approved & Live on Marketplace</h2>
      <p>Trevor has approved this job. It is now visible as a 
         <strong style="color:#dc2626;">🔴 red dot</strong> on the surveyor marketplace map 
         and awaiting a surveyor claim.</p>

      <div class="detail-block">
        <div class="detail-row">
          <span class="detail-label">Job Reference</span>
          <span class="detail-value">${record.reference}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Survey Type</span>
          <span class="detail-value">${record.survey_type || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Site Postcode</span>
          <span class="detail-value">${record.site_postcode || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Urgency</span>
          <span class="detail-value">${urgencyBadge(record.urgency_state)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">SLA Deadline</span>
          <span class="detail-value">${slaDate}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Agreed Amount</span>
          <span class="detail-value">£${record.agreed_amount?.toFixed(2) ?? record.quoted_amount?.toFixed(2) ?? '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Approved</span>
          <span class="detail-value">${new Date(record.approved_at || Date.now()).toLocaleString('en-GB')}</span>
        </div>
      </div>

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
