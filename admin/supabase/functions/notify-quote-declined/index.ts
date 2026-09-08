// ============================================================
// THAC — notify-quote-declined
// Trigger: UPDATE on public.enquiries
//          WHERE old.status != 'declined' AND new.status = 'declined'
// Fires:   When a client declines their quote
// Sends:   Email to admin with decline reason (if given)
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, detailBlock, detailRow, SURVEY_LABELS, ADMIN_EMAIL } from '../_shared/email-templates.ts';

const CRM_URL = 'https://thac-enquiry-form-production.up.railway.app/admin';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SB_THAC_SERVICE_ROLE_KEY')!;

// There's no enquiry-detail.html page in the admin CRM -- look up the
// linked job (created immediately by submit-enquiry) and go there instead.
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

    if (record.status !== 'declined') {
      return new Response('Not a decline transition', { status: 200 });
    }
    if (oldRecord?.status === 'declined') {
      return new Response('Already declined — skipping', { status: 200 });
    }

    const subject = `Quote Declined — ${record.job_number || 'Enquiry'} | ${record.contact_name || 'Client'}`;

    const price = record.quoted_price
      ? `£${Number(record.quoted_price).toLocaleString()} + VAT`
      : 'Custom quote';

    const jobId = await getLinkedJobId(record.id);
    const crmLink = jobId ? `${CRM_URL}/job-detail.html?id=${jobId}` : `${CRM_URL}/jobs.html`;

    const html = emailWrapper(`
      <h2>Client Has Declined Their Quote</h2>
      <p>A client has declined their quote. You may wish to follow up to understand
         their decision or offer an alternative.</p>

      ${detailBlock([
        detailRow('Reference', record.job_number || '—'),
        detailRow('Client', record.contact_name || '—'),
        detailRow('Email', record.contact_email || '—'),
        record.contact_phone ? detailRow('Phone', record.contact_phone) : '',
        detailRow('Survey Type', SURVEY_LABELS[record.survey_type] || record.survey_type || '—'),
        detailRow('Quoted Amount', price),
        detailRow('Reason Given', `<span style="color:${record.declined_reason ? '#c0392b' : '#8a938d'};">${record.declined_reason || 'No reason provided'}</span>`),
        detailRow('Declined At', record.declined_at
          ? new Date(record.declined_at).toLocaleString('en-GB')
          : new Date().toLocaleString('en-GB')),
      ].join(''))}

      ${record.declined_reason?.toLowerCase().includes('price') ? `
      <div class="callout">
        <strong>Price objection detected.</strong> Consider whether a revised quote
        or payment terms discussion might bring this client back.
      </div>` : ''}

      <a href="${crmLink}" class="cta-button">
        View in CRM →
      </a>
    `);

    await sendEmail(ADMIN_EMAIL, subject, html);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('notify-quote-declined error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
