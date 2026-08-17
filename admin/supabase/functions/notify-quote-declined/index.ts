// ============================================================
// THAC — notify-quote-declined
// Trigger: UPDATE on public.enquiries
//          WHERE old.status != 'declined' AND new.status = 'declined'
// Fires:   When a client declines their quote
// Sends:   Email to admin with decline reason (if given)
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, SURVEY_LABELS, ADMIN_EMAIL } from '../_shared/email-templates.ts';

const CRM_URL = 'https://thac-enquiry-form-production.up.railway.app/admin';

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

    const subject = `❌ Quote Declined — ${record.job_number || 'Enquiry'} | ${record.contact_name || 'Client'}`;

    const price = record.quoted_price
      ? `£${Number(record.quoted_price).toLocaleString()} + VAT`
      : 'Custom quote';

    const html = emailWrapper(`
      <h2>❌ Client Has Declined Their Quote</h2>
      <p>A client has declined their quote. You may wish to follow up to understand
         their decision or offer an alternative.</p>

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
          <span class="detail-label">Quoted Amount</span>
          <span class="detail-value">${price}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Reason Given</span>
          <span class="detail-value" style="color:${record.declined_reason ? '#dc2626' : '#999'};">
            ${record.declined_reason || 'No reason provided'}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Declined At</span>
          <span class="detail-value">${record.declined_at
            ? new Date(record.declined_at).toLocaleString('en-GB')
            : new Date().toLocaleString('en-GB')}</span>
        </div>
      </div>

      ${record.declined_reason?.toLowerCase().includes('price') ? `
      <p style="font-size:14px;color:#666;margin-top:8px;">
        💡 <strong>Price objection detected.</strong> Consider whether a revised quote
        or payment terms discussion might bring this client back.
      </p>` : ''}

      <a href="${CRM_URL}/enquiry-detail.html?id=${record.id}" class="cta-button">
        View Enquiry →
      </a>
    `);

    await sendEmail(ADMIN_EMAIL, subject, html);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('notify-quote-declined error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
