// ============================================================
// THAC — notify-surveyor-claimed
// Trigger: UPDATE on public.jobs
//          WHERE old.dispatch_state = 'live_unallocated'
//            AND new.dispatch_state = 'claimed'
// Fires:   When a surveyor claims a job — dot turns orange
// Sends:   Email to admin
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

    // Fires when dispatch_state transitions to 'orange' (surveyor claimed)
    if (record.dispatch_state !== 'orange') {
      return new Response('Not a claim transition', { status: 200 });
    }
    if (oldRecord?.dispatch_state === 'orange') {
      return new Response('Already claimed — skipping', { status: 200 });
    }

    const surveyorName = await getSurveyorName(record.surveyor_id);
    const subject = `Job Claimed — ${record.reference} | ${surveyorName}`;

    const slaDate = record.sla_deadline
      ? new Date(record.sla_deadline).toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
      : 'Not set';

    const surveyDate = record.survey_date
      ? new Date(record.survey_date).toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
      : 'Not yet set';

    const html = emailWrapper(`
      <h2>Job Claimed by Surveyor</h2>
      <p>A surveyor has claimed this job on the marketplace.
         The dot has turned <strong style="color:#c8773a;">${statusDot('#c8773a')}orange</strong>.
         The job is now locked — no other surveyor can claim it.</p>

      ${detailBlock([
        detailRow('Job Reference', record.reference),
        detailRow('Assigned Surveyor', surveyorName),
        detailRow('Survey Type', SURVEY_LABELS[record.survey_type] || record.survey_type || '—'),
        detailRow('Site Postcode', record.site_postcode || '—'),
        detailRow('Urgency', urgencyStateBadge(record.urgency_state)),
        detailRow('SLA Deadline', slaDate),
        detailRow('Proposed Survey Date', surveyDate),
        detailRow('Surveyor Pay', `£${record.surveyor_pay_amount?.toFixed(2) ?? '—'}`),
      ].join(''))}

      <p style="font-size:14px; color:#666; margin-top:8px;">
        The surveyor now has access to full site details, client address, parking/access notes, and uploaded plans.
      </p>

      <a href="https://thac-enquiry-form-production.up.railway.app/admin/job-detail.html?id=${record.id}" class="cta-button">
        View Job in CRM →
      </a>
    `);

    await sendEmail(ADMIN_EMAIL, subject, html);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('notify-surveyor-claimed error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
