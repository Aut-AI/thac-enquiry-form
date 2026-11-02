// ============================================================
// THAC — notify-new-enquiry
// Trigger: INSERT on public.enquiries
// Fires:   Immediately when a new enquiry form is submitted
// Sends:   Email to admin
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, detailBlock, detailRow, SURVEY_LABELS, DEADLINE_LABELS, ADMIN_EMAIL } from '../_shared/email-templates.ts';
import { serviceKeyHeaders } from "../_shared/service-key.ts";

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY  = Deno.env.get('SB_THAC_SERVICE_ROLE_KEY')!;

// The job for this enquiry is created immediately by submit-enquiry, but
// this webhook only receives the enquiry row -- look up the job it's
// linked to so the CTA can go straight to job-detail.html. There's no
// enquiry-detail.html page in the admin CRM; that link 404'd for every
// single enquiry until this was added.
async function getLinkedJob(enquiryId: string): Promise<{ id: string; reference: string | null } | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/jobs?enquiry_id=eq.${enquiryId}&select=id,reference&limit=1`,
      { headers: serviceKeyHeaders(SUPABASE_SERVICE_KEY) }
    );
    const rows = await res.json();
    return rows?.[0] || null;
  } catch { return null; }
}

// Report requests: submit-report-request creates the job just after the
// enquiry, then sets its "TH 1234 Rev B" reference, so give it a moment
// rather than reporting the enquiry's own auto-number.
async function waitForReportRequestJob(enquiryId: string, wanted: string | null) {
  let job = null;
  for (let i = 0; i < 4; i++) {
    job = await getLinkedJob(enquiryId);
    if (job && (!wanted || (job.reference || '').toUpperCase().startsWith(wanted.toUpperCase()))) return job;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return job;
}

// Customer-typed text goes into an HTML email
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;

    const isAmendment = record.enquiry_type === 'amendment';
    // From the report request form (report-request.html): instructed work,
    // either an amendment or completing a report (survey_type planning_stage2)
    const isReportRequest = isAmendment && record.tc_accepted === true;
    const requestLabel = record.survey_type === 'planning_stage2' ? 'Complete Report' : 'Amendment';
    const subject = isReportRequest
      ? `New ${requestLabel} Request — ${record.original_job_ref || record.contact_name}`
      : isAmendment
      ? `New Amendment Enquiry — ${record.contact_name}`
      : `New Enquiry Received — ${record.contact_name}`;

    const job = isReportRequest
      ? await waitForReportRequestJob(record.id, record.original_job_ref)
      : await getLinkedJob(record.id);
    const jobId = job?.id || null;
    const crmLink = jobId
      ? `https://thac-enquiry-form-production.up.railway.app/admin/job-detail.html?id=${jobId}`
      : `https://thac-enquiry-form-production.up.railway.app/admin/jobs.html`;

    const quotedPrice = record.quoted_price
      ? `£${Number(record.quoted_price).toLocaleString('en-GB')} excl VAT`
      : 'Custom quote (100+ trees)';

    const rows = [
      detailRow('Reference', esc((isReportRequest && job?.reference) || record.job_number || 'Pending assignment')),
      detailRow('Contact Name', esc(record.contact_name)),
      detailRow('Email', esc(record.contact_email)),
      record.contact_phone ? detailRow('Phone', esc(record.contact_phone)) : '',
      record.company ? detailRow('Company', esc(record.company)) : '',
      record.introducer_name ? detailRow('Introduced By', esc(record.introducer_name)) : '',
      record.introducer_email ? detailRow('Also Copied On Quote', esc(record.introducer_email)) : '',
      detailRow('Type', isReportRequest
        ? (record.survey_type === 'planning_stage2' ? 'Complete a report (AIA, AMS, TPP)' : 'Amend an existing report')
        : isAmendment ? 'Amendment to existing job' : 'New survey'),
      !isAmendment ? detailRow('Survey Type', SURVEY_LABELS[record.survey_type] || record.survey_type || '—') : '',
      !isAmendment ? detailRow('Tree Count Band', record.tree_count_band ? record.tree_count_band + ' trees' : '—') : '',
      !isAmendment ? detailRow('Site Postcode', esc(record.site_postcode || '—')) : '',
      !isAmendment ? detailRow('Deadline', DEADLINE_LABELS[record.deadline_tier] || record.deadline_tier || '—') : '',
      !isAmendment ? detailRow('Quoted Price', `<span style="color:#1a3a2a;">${quotedPrice}</span>`) : '',
      isAmendment ? detailRow('Original Job Ref', esc(record.original_job_ref || '—')) : '',
      isReportRequest ? detailRow('Site', esc(record.site_street || '—')) : '',
      isReportRequest ? detailRow('Needed', DEADLINE_LABELS[record.deadline_tier] || record.deadline_tier || '—') : '',
      isAmendment ? detailRow(isReportRequest ? 'Details' : 'Amendment Scope', esc(record.amendment_scope || '—')) : '',
      isReportRequest ? detailRow('Invoice To', [record.billing_contact_name, record.billing_contact_email, record.billing_address].filter(Boolean).map(esc).join(', ')) : '',
      isReportRequest && record.report_addressee_name ? detailRow('Name On Report', esc(record.report_addressee_name)) : '',
      detailRow('Submitted', new Date(record.submitted_at).toLocaleString('en-GB')),
    ].join('');

    const html = emailWrapper(`
      <h2>${isReportRequest ? `New ${requestLabel} Request` : isAmendment ? 'New Amendment Enquiry' : 'New Enquiry Received'}</h2>
      <p>${isReportRequest
        ? 'A client has accepted the terms and booked this work in. It is on the CRM as a job, ready to work on.'
        : 'A new enquiry has been submitted and is awaiting your review in the CRM.'}</p>

      ${detailBlock(rows)}

      <a href="${crmLink}" class="cta-button">
        View in CRM →
      </a>
    `);

    await sendEmail(ADMIN_EMAIL, subject, html);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('notify-new-enquiry error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
