// ============================================================
// THAC — notify-quote-accepted
// Trigger: UPDATE on public.enquiries
//          WHERE old.status != 'accepted'
//            AND new.status  = 'accepted'
// Fires:   When a client accepts their quote (via one-click link or manual CRM update)
// Sends:   Email to admin — prompts immediate Convert to Job action
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, SURVEY_LABELS, ADMIN_EMAIL } from '../_shared/email-templates.ts';

const CRM_URL = 'https://thac-enquiry-form-production.up.railway.app/admin';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SB_THAC_SERVICE_ROLE_KEY')!;

// There's no enquiry-detail.html page in the admin CRM -- the job for this
// enquiry already exists (created immediately by submit-enquiry, sitting
// as Pending Approval), so link straight to it instead.
async function getLinkedJobId(enquiryId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/jobs?enquiry_id=eq.${enquiryId}&select=id&limit=1`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const rows = await res.json();
    return rows?.[0]?.id || null;
  } catch { return null; }
}

serve(async (req) => {
  try {
    const payload   = await req.json();
    const record    = payload.record;
    const oldRecord = payload.old_record;

    // Only fire when transitioning TO accepted
    if (record.status !== 'accepted') {
      return new Response('Not an acceptance transition', { status: 200 });
    }
    if (oldRecord?.status === 'accepted') {
      return new Response('Already accepted — skipping', { status: 200 });
    }

    const subject = `Quote Accepted — ${record.job_number || 'Enquiry'} | Review the Job`;

    const acceptedAt = record.accepted_at
      ? new Date(record.accepted_at).toLocaleString('en-GB')
      : new Date().toLocaleString('en-GB');

    const price = record.quoted_price
      ? `£${Number(record.quoted_price).toLocaleString()} + VAT`
      : 'Custom quote';

    const jobId = await getLinkedJobId(record.id);
    const crmLink = jobId ? `${CRM_URL}/job-detail.html?id=${jobId}` : `${CRM_URL}/jobs.html`;

    const html = emailWrapper(`
      <h2>Client Has Accepted Their Quote</h2>
      <p>A client has clicked <strong>Accept Quote</strong>.
         The job is already in the CRM as Pending Approval — review it and approve
         when ready.</p>

      <div class="detail-block">
        <div class="detail-row">
          <span class="detail-label">Reference</span>
          <span class="detail-value">${record.job_number || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Client</span>
          <span class="detail-value">${record.contact_name || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value">${record.contact_email || '—'}</span>
        </div>
        ${record.contact_phone ? `
        <div class="detail-row">
          <span class="detail-label">Phone</span>
          <span class="detail-value">${record.contact_phone}</span>
        </div>` : ''}
        <div class="detail-row">
          <span class="detail-label">Survey Type</span>
          <span class="detail-value">${SURVEY_LABELS[record.survey_type] || record.survey_type || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Site Postcode</span>
          <span class="detail-value">${record.site_postcode || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Quoted Amount</span>
          <span class="detail-value" style="color:#1a3a2a; font-size:16px; font-weight:700;">${price}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Accepted At</span>
          <span class="detail-value">${acceptedAt}</span>
        </div>
      </div>

      <p style="font-size:14px; color:#6b756f; margin-top:8px;">
        <strong>Next steps:</strong><br>
        1. Prepare the Axiscape database entry<br>
        2. Draft the initial report template<br>
        3. Approve the job — it goes live on the surveyor map
      </p>

      <a href="${crmLink}" class="cta-button">
        Open Job in CRM →
      </a>
    `);

    await sendEmail(ADMIN_EMAIL, subject, html);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('notify-quote-accepted error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
