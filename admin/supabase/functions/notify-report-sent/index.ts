// ============================================================
// THAC — notify-report-sent
// Trigger: UPDATE on public.jobs
//          WHERE old.dispatch_state != 'report_sent'
//            AND new.dispatch_state  = 'report_sent'
// Fires:   When admin marks report as sent — dot turns green
// Sends:   Email to admin confirming + invoice reminder
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, statusDot, detailBlock, detailRow, SURVEY_LABELS, ADMIN_EMAIL } from '../_shared/email-templates.ts';

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

    const subject = `Report Finalised — ${record.reference} | Invoice Now Required`;

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
         <strong style="color:#1a3a2a;">${statusDot('#1a3a2a')}green</strong>.
         Please now raise the invoice in QuickBooks and record it in the CRM.</p>

      ${detailBlock([
        detailRow('Job Reference', record.reference),
        detailRow('Survey Type', SURVEY_LABELS[record.survey_type] || record.survey_type || '—'),
        detailRow('Report Finalised At', reportSentAt),
        detailRow('Billing Mode', isStaged ? 'Staged 50/50' : 'Single Invoice'),
        detailRow('Total Agreed', `£${invoiceAmount?.toFixed(2) ?? '—'}`),
        isStaged
          ? detailRow('Invoice 1 (survey stage)', `<span style="color:#6b756f;">£${invoice1} — already raised</span>`)
            + detailRow('Invoice 2 (report stage)', `<span style="color:#1a3a2a; font-weight:700;">£${invoice2} — raise now</span>`)
          : detailRow('Invoice Amount', `<span style="color:#1a3a2a; font-weight:700;">£${invoice2 ?? '—'} — raise now</span>`),
        detailRow('Payment Due', '30 days from invoice date'),
      ].join(''))}

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
