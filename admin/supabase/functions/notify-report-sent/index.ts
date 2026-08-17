// ============================================================
// THAC — notify-report-sent
// Trigger: UPDATE on public.jobs
//          WHERE old.dispatch_state != 'report_sent'
//            AND new.dispatch_state  = 'report_sent'
// Fires:   When admin marks report as sent — dot turns green
// Sends:   Email to admin confirming + invoice reminder
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, SURVEY_LABELS, ADMIN_EMAIL } from '../_shared/email-templates.ts';

serve(async (req) => {
  try {
    const payload   = await req.json();
    const record    = payload.record;
    const oldRecord = payload.old_record;

    // Fires when report_finalised flips to true (DB trigger condition)
    if (!record.report_finalised) {
      return new Response('report_finalised not true — skipping', { status: 200 });
    }
    if (oldRecord?.report_finalised === true) {
      return new Response('Already finalised — skipping', { status: 200 });
    }

    const subject = `🟢 Report Finalised — ${record.reference} | Invoice Now Required`;

    const reportSentAt = record.report_finalised_at
      ? new Date(record.report_finalised_at).toLocaleString('en-GB')
      : new Date().toLocaleString('en-GB');

    const isStaged = record.billing_mode === 'staged';
    const invoiceAmount = record.agreed_amount ?? record.quoted_amount;
    const invoice1 = isStaged ? (invoiceAmount / 2).toFixed(2) : null;
    const invoice2 = isStaged ? (invoiceAmount / 2).toFixed(2) : invoiceAmount?.toFixed(2);

    const html = emailWrapper(`
      <h2>Report Sent to Client</h2>
      <p>The report has been marked as sent. The dot has turned 
         <strong style="color:#16a34a;">🟢 green</strong>. 
         Please now raise the invoice in QuickBooks and record it in the CRM.</p>

      <div class="detail-block">
        <div class="detail-row">
          <span class="detail-label">Job Reference</span>
          <span class="detail-value">${record.reference}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Survey Type</span>
          <span class="detail-value">${SURVEY_LABELS[record.survey_type] || record.survey_type || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Report Finalised At</span>
          <span class="detail-value">${reportSentAt}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Billing Mode</span>
          <span class="detail-value">${isStaged ? 'Staged 50/50' : 'Single Invoice'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Total Agreed</span>
          <span class="detail-value">£${invoiceAmount?.toFixed(2) ?? '—'}</span>
        </div>
        ${isStaged ? `
        <div class="detail-row">
          <span class="detail-label">Invoice 1 (survey stage)</span>
          <span class="detail-value" style="color:#666;">£${invoice1} — already raised</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Invoice 2 (report stage)</span>
          <span class="detail-value" style="color:#16a34a; font-weight:700;">£${invoice2} — raise now ✍️</span>
        </div>` : `
        <div class="detail-row">
          <span class="detail-label">Invoice Amount</span>
          <span class="detail-value" style="color:#16a34a; font-weight:700;">£${invoice2 ?? '—'} — raise now ✍️</span>
        </div>`}
        <div class="detail-row">
          <span class="detail-label">Payment Due</span>
          <span class="detail-value">30 days from invoice date</span>
        </div>
      </div>

      <p style="font-size:14px; color:#666; margin-top:8px;">
        <strong>Next steps:</strong><br>
        1. Raise invoice in QuickBooks<br>
        2. Record invoice date and amount in the CRM<br>
        3. Mark job as invoiced — it will drop off the active dashboard
      </p>

      <a href="https://thac-enquiry-form-production.up.railway.app/admin/job-detail.html?id=${record.id}" class="cta-button">
        Record Invoice in CRM →
      </a>
    `);

    await sendEmail(ADMIN_EMAIL, subject, html);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('notify-report-sent error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
