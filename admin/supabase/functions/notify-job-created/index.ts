// ============================================================
// THAC — notify-job-created
// Trigger: INSERT on public.jobs
// Fires:   When a job record is created (enquiry accepted)
// Sends:   Email to admin — job needs DB prep + Trevor approval
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, urgencyStateBadge, SURVEY_LABELS, ADMIN_EMAIL } from '../_shared/email-templates.ts';

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;

    const subject = `🆕 Job Created — ${record.reference || 'New Job'} | Ready for Preparation`;

    const slaDate = record.sla_deadline
      ? new Date(record.sla_deadline).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'Not yet set';

    const html = emailWrapper(`
      <h2>New Job Created — Ready for Preparation</h2>
      <p>A client has accepted their quote and a job has been automatically created and approved.
         Please proceed with preparing the Axiscape database and drafting the initial report template.</p>

      <div class="detail-block">
        <div class="detail-row">
          <span class="detail-label">Job Reference</span>
          <span class="detail-value">${record.reference || 'Being assigned...'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Survey Type</span>
          <span class="detail-value">${SURVEY_LABELS[record.survey_type] || record.survey_type || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Job Type</span>
          <span class="detail-value">${record.job_type === 'amendment' ? 'Amendment' : 'New Survey'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Site Postcode</span>
          <span class="detail-value">${record.site_postcode || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Urgency</span>
          <span class="detail-value">${urgencyStateBadge(record.urgency_state)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">SLA Deadline</span>
          <span class="detail-value">${slaDate}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Quoted Amount</span>
          <span class="detail-value">£${record.quoted_amount?.toFixed(2) || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Billing Mode</span>
          <span class="detail-value">${record.billing_mode === 'staged' ? 'Staged 50/50' : 'Single Invoice'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Two-Stage BS5837?</span>
          <span class="detail-value">${record.is_two_stage ? 'Yes' : 'No'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Created</span>
          <span class="detail-value">${new Date(record.created_at).toLocaleString('en-GB')}</span>
        </div>
      </div>

      <p style="font-size:14px; color:#666; margin-top:16px;">
        <strong>Next steps:</strong><br>
        1. Prepare Axiscape survey database<br>
        2. Draft initial report template<br>
        3. Job is now live on the surveyor map and ready for allocation
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
