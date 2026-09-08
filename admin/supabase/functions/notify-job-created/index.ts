// ============================================================
// THAC — notify-job-created
// Trigger: INSERT on public.jobs
// Fires:   When a job record is created (enquiry accepted)
// Sends:   Email to admin — job needs DB prep + Trevor approval
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, urgencyStateBadge, detailBlock, detailRow, SURVEY_LABELS, ADMIN_EMAIL } from '../_shared/email-templates.ts';

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;

    const subject = `Job Created — ${record.reference || 'New Job'} | Ready for Preparation`;

    const slaDate = record.sla_deadline
      ? new Date(record.sla_deadline).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'Not yet set';

    const html = emailWrapper(`
      <h2>New Job Created — Ready for Preparation</h2>
      <p>A new job has been created and is sitting as Pending Approval in the CRM.
         Prepare the Axiscape database and draft the initial report template, then approve
         the job to put it live on the surveyor map.</p>

      ${detailBlock([
        detailRow('Job Reference', record.reference || 'Being assigned...'),
        detailRow('Survey Type', SURVEY_LABELS[record.survey_type] || record.survey_type || '—'),
        detailRow('Job Type', record.job_type === 'amendment' ? 'Amendment' : 'New Survey'),
        detailRow('Site Postcode', record.site_postcode || '—'),
        detailRow('Urgency', urgencyStateBadge(record.urgency_state)),
        detailRow('SLA Deadline', slaDate),
        detailRow('Quoted Amount', `£${record.quoted_amount?.toFixed(2) || '—'}`),
        detailRow('Billing Mode', record.billing_mode === 'staged' ? 'Staged 50/50' : 'Single Invoice'),
        detailRow('Two-Stage BS5837?', record.is_two_stage ? 'Yes' : 'No'),
        detailRow('Created', new Date(record.created_at).toLocaleString('en-GB')),
      ].join(''))}

      <p style="font-size:14px; color:#6b756f; margin-top:16px;">
        <strong>Next steps:</strong><br>
        1. Prepare Axiscape survey database<br>
        2. Draft initial report template<br>
        3. Approve the job — it goes live on the surveyor map
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
