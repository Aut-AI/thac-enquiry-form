// ============================================================
// THAC — notify-surveyor-claimed
// Trigger: UPDATE on public.jobs
//          WHERE old.dispatch_state = 'live_unallocated'
//            AND new.dispatch_state = 'claimed'
// Fires:   When a surveyor claims a job -- pin turns green (Allocated)
// Sends:   Email to admin
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

    // Fires when dispatch_state transitions to 'orange' (surveyor claimed)
    if (record.dispatch_state !== 'orange') {
      return new Response('Not a claim transition', { status: 200 });
    }
    if (oldRecord?.dispatch_state === 'orange') {
      return new Response('Already claimed — skipping', { status: 200 });
    }

    const surveyorName = await getSurveyorName(record.surveyor_id);
    // Trevor (19 Oct 2026): a claim is final, no approval -- and it's his cue
    // to get the database to the surveyor quickly.
    const subject = record.axi_prepared
      ? `Job Allocated — ${record.reference} | ${surveyorName} | Send the Database`
      : `Job Allocated — ${record.reference} | ${surveyorName} | Create the Database Now`;

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
      <h2>Job Allocated to ${surveyorName}</h2>
      <p>${surveyorName} has taken this job in the app. The pin is now
         <strong style="color:#16a34a;">${statusDot('#16a34a')}green (Allocated)</strong>
         and no other surveyor can claim it.</p>
      <p style="font-weight:600; color:${record.axi_prepared ? '#1a3a2a' : '#c0392b'};">
        ${record.axi_prepared
          ? 'The database is already created. Send it to the surveyor.'
          : 'The database has not been created yet. Create it and get it to the surveyor as soon as possible.'}
      </p>

      ${detailBlock([
        detailRow('Job Reference', record.reference),
        detailRow('Assigned Surveyor', surveyorName),
        detailRow('Survey Type', SURVEY_LABELS[record.survey_type] || record.survey_type || '—'),
        detailRow('Site Postcode', record.site_postcode || '—'),
        detailRow('Urgency', urgencyStateBadge(record.urgency_state)),
        detailRow('SLA Deadline', slaDate),
        detailRow('Proposed Survey Date', surveyDate),
        detailRow('Surveyor Pay', `£${record.surveyor_pay_amount?.toFixed(2) ?? '—'}`),
        detailRow('Database', !record.axi_prepared ? '<span style="color:#c0392b;">To create</span>'
          : record.database_plan === 'jpeg' ? '<span style="color:#c8773a;">Created from a JPEG, awaiting digital plan</span>'
          : record.database_plan === 'digital' ? 'Created from the digital plan' : 'Created'),
        detailRow('Report', record.report_drafted ? 'Drafted' : 'To draft'),
      ].join(''))}

      <p style="font-size:14px; color:#666; margin-top:8px;">
        The surveyor now has the full site details, client address, parking/access notes and plans.
        When they have been to site they tap Survey Done, then Data Sent once the data is in SharePoint.
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
