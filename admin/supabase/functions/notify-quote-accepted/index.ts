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

const CRM_URL = 'https://ciaran-aut-ai.github.io/thac-admin';

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

    const subject = `✅ Quote Accepted — ${record.job_number || 'Enquiry'} | Convert to Job Now`;

    const acceptedAt = record.accepted_at
      ? new Date(record.accepted_at).toLocaleString('en-GB')
      : new Date().toLocaleString('en-GB');

    const price = record.quoted_price
      ? `£${Number(record.quoted_price).toLocaleString()} + VAT`
      : 'Custom quote';

    const html = emailWrapper(`
      <h2>🎉 Client Has Accepted Their Quote</h2>
      <p>A client has clicked <strong>Accept Quote</strong>.
         Please convert this enquiry to a job as soon as possible.</p>

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
          <span class="detail-value" style="color:#16a34a; font-size:16px; font-weight:700;">${price}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Accepted At</span>
          <span class="detail-value">${acceptedAt}</span>
        </div>
      </div>

      <p style="font-size:14px; color:#666; margin-top:8px;">
        <strong>Next steps:</strong><br>
        1. Open the enquiry and click <strong>Convert to Job</strong><br>
        2. Prepare the Axiscape database entry<br>
        3. Draft the initial report template<br>
        4. Submit to Trevor for approval
      </p>

      <a href="${CRM_URL}/enquiry-detail.html?id=${record.id}" class="cta-button">
        Open Enquiry — Convert to Job →
      </a>
    `);

    await sendEmail(ADMIN_EMAIL, subject, html);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('notify-quote-accepted error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
