// ============================================================
// THAC — notify-field-data-uploaded
// Trigger: UPDATE on public.jobs
//          WHERE old.field_data_uploaded = false
//            AND new.field_data_uploaded = true
// Fires:   When surveyor marks field data as uploaded — dot turns yellow
// Sends:   Email to admin — report finalisation needed
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, urgencyStateBadge, statusDot, detailBlock, detailRow, SURVEY_LABELS, ADMIN_EMAIL } from '../_shared/email-templates.ts';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SB_THAC_SERVICE_ROLE_KEY')!;

async function getSurveyorName(surveyorId: string): Promise<string> {
  if (!surveyorId) return 'Unassigned';
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/surveyors?id=eq.${surveyorId}&select=full_name`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
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
    const subject = `Field Data Ready — ${record.reference} | Finalise Report Now`;

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
      <h2>Field Data Uploaded — Report Finalisation Required</h2>
      <p>The surveyor has completed the site visit and uploaded field data, photos, and notes.
         The dot has turned <strong style="color:#b8960a;">${statusDot('#b8960a')}yellow</strong>.
         The draft report now needs to be finalised.</p>

      ${detailBlock([
        detailRow('Job Reference', record.reference),
        detailRow('Survey Type', SURVEY_LABELS[record.survey_type] || record.survey_type || '—'),
        detailRow('Surveyor', surveyorName),
        detailRow('Data Uploaded At', uploadedAt),
        detailRow('SLA Deadline', slaDate),
        daysRemaining ? detailRow('Time Remaining', daysRemaining) : '',
        detailRow('Urgency', urgencyStateBadge(record.urgency_state)),
        detailRow('Axiscape DB Prepared', `<span style="color:${record.axi_prepared ? '#1a3a2a' : '#c8773a'};">${record.axi_prepared ? 'Yes' : 'Pending'}</span>`),
        detailRow('Report Drafted', `<span style="color:${record.report_drafted ? '#1a3a2a' : '#c8773a'};">${record.report_drafted ? 'Yes' : 'Pending'}</span>`),
      ].join(''))}

      <p style="font-size:14px; color:#666; margin-top:8px;">
        <strong>Next steps:</strong><br>
        1. Incorporate surveyor's field data into the draft report<br>
        2. Submit to Trevor for final sign-off<br>
        3. Send completed report to client — dot turns green
      </p>

      <a href="https://thac-enquiry-form-production.up.railway.app/admin/job-detail.html?id=${record.id}" class="cta-button">
        Open Job & Finalise Report →
      </a>
    `);

    await sendEmail(ADMIN_EMAIL, subject, html);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('notify-field-data-uploaded error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
