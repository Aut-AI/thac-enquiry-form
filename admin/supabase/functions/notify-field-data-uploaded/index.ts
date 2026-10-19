// ============================================================
// THAC — notify-field-data-uploaded
// Trigger: UPDATE on public.jobs
//          WHERE old.field_data_uploaded = false
//            AND new.field_data_uploaded = true
// Fires:   When the surveyor taps Data Sent (data is in SharePoint) -- Data Received
// Sends:   Email to admin — report finalisation needed
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, urgencyStateBadge, statusDot, detailBlock, detailRow, SURVEY_LABELS, ADMIN_EMAIL } from '../_shared/email-templates.ts';
import { serviceKeyHeaders } from "../_shared/service-key.ts";

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SB_THAC_SERVICE_ROLE_KEY')!;

async function getSurveyorName(surveyorId: string): Promise<string> {
  if (!surveyorId) return 'Unassigned';
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/surveyors?id=eq.${surveyorId}&select=full_name`,
      { headers: serviceKeyHeaders(SUPABASE_SERVICE_KEY) }
    );
    const data = await res.json();
    return data?.[0]?.full_name || 'Unknown Surveyor';
  } catch { return 'Unknown Surveyor'; }
}

serve(async (req) => {
  try {
    const payload   = await req.json();
    const record    = payload.record;
    const oldRecord = payload.old_record;

    // Only fire when field_data_uploaded flips to true
    if (!record.field_data_uploaded || oldRecord?.field_data_uploaded === true) {
      return new Response('Not a field-data-upload transition', { status: 200 });
    }

    const surveyorName = await getSurveyorName(record.surveyor_id);
    const subject = `Survey Data Received — ${record.reference} | Report to Complete`;

    const uploadedAt = record.field_data_uploaded_at
      ? new Date(record.field_data_uploaded_at).toLocaleString('en-GB')
      : new Date().toLocaleString('en-GB');

    const slaDate = record.sla_deadline
      ? new Date(record.sla_deadline).toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
      : 'Not set';

    // Calculate days remaining until SLA
    let daysRemaining = '';
    if (record.sla_deadline) {
      const now = new Date();
      const sla = new Date(record.sla_deadline);
      const diff = Math.ceil((sla.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      daysRemaining = diff > 0
        ? `<span style="color:#b8960a; font-weight:600;">${diff} day${diff !== 1 ? 's' : ''} remaining</span>`
        : `<span style="color:#c0392b; font-weight:600;">SLA overdue by ${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''}</span>`;
    }

    const html = emailWrapper(`
      <h2>Survey Data Received — Report to Complete</h2>
      <p>${surveyorName} has put the database, photos and site notes in SharePoint and marked the job
         <strong style="color:#c8773a;">${statusDot('#c8773a')}Data Received</strong>.
         The job is ready for you to finalise.</p>

      ${detailBlock([
        detailRow('Job Reference', record.reference),
        detailRow('Survey Type', SURVEY_LABELS[record.survey_type] || record.survey_type || '—'),
        detailRow('Surveyor', surveyorName),
        detailRow('Data Sent At', uploadedAt),
        detailRow('SLA Deadline', slaDate),
        daysRemaining ? detailRow('Time Remaining', daysRemaining) : '',
        detailRow('Urgency', urgencyStateBadge(record.urgency_state)),
        detailRow('Database', `<span style="color:${record.axi_prepared && record.database_plan !== 'jpeg' ? '#1a3a2a' : '#c8773a'};">${
          !record.axi_prepared ? 'Not created yet'
          : record.database_plan === 'jpeg' ? 'From a JPEG, awaiting digital plan'
          : record.database_plan === 'digital' ? 'From the digital plan' : 'Created'}</span>`),
        detailRow('Report Drafted', `<span style="color:${record.report_drafted ? '#1a3a2a' : '#c8773a'};">${record.report_drafted ? 'Yes' : 'Pending'}</span>`),
      ].join(''))}

      <p style="font-size:14px; color:#666; margin-top:8px;">
        <strong>Next steps:</strong><br>
        1. Pick up the data from SharePoint and complete the report<br>
        2. On the job page, finish the job one of three ways:<br>
        &nbsp;&nbsp;&bull; Report &amp; Invoice Sent: the job is complete<br>
        &nbsp;&nbsp;&bull; Tree Data Sent, Part Invoiced: waits for the client<br>
        &nbsp;&nbsp;&bull; Tree Data Sent, Not Invoiced: waits for the client
      </p>

      <a href="https://thac-enquiry-form-production.up.railway.app/admin/job-detail.html?id=${record.id}" class="cta-button">
        Open Job in CRM →
      </a>
    `);

    await sendEmail(ADMIN_EMAIL, subject, html);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('notify-field-data-uploaded error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
