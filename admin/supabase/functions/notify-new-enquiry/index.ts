// ============================================================
// THAC — notify-new-enquiry
// Trigger: INSERT on public.enquiries
// Fires:   Immediately when a new enquiry form is submitted
// Sends:   Email to admin
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, ADMIN_EMAIL } from '../_shared/email-templates.ts';

const SURVEY_LABELS: Record<string, string> = {
  planning_stage1:  'Planning — Stage 1 (BS5837)',
  planning_stage2:  'Planning — Stage 2 (AIA/AMS/TPP)',
  health_safety:    'Tree Condition / Risk Survey',
  insurer_mortgage: 'Insurer / Mortgage Lender',
  subsidence:       'Building Damage / Subsidence',
  nhbc:             'Foundation Depths (NHBC)',
  site_visit:       'Site Visit & Advice',
  resistograph:     'Resistograph Testing',
  bs5837:           'BS5837 Tree Survey',
  vta:              'Visual Tree Assessment',
  amendment:        'Amendment',
  other:            'Other',
};

const DEADLINE_LABELS: Record<string, string> = {
  '3days':  'Within 3 working days',
  '5days':  'Within 5 working days',
  '7days':  'Within 7 working days',
  '10days': 'Within 10 working days / No rush',
};

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;

    const isAmendment = record.enquiry_type === 'amendment';
    const subject = isAmendment
      ? `📋 New Amendment Enquiry — ${record.contact_name}`
      : `📬 New Enquiry Received — ${record.contact_name}`;

    const quotedPrice = record.quoted_price
      ? `£${Number(record.quoted_price).toLocaleString('en-GB')} excl VAT`
      : 'Custom quote (100+ trees)';

    const html = emailWrapper(`
      <h2>${isAmendment ? 'New Amendment Enquiry' : 'New Enquiry Received'}</h2>
      <p>A new enquiry has been submitted and is awaiting your review in the CRM.</p>

      <div class="detail-block">
        <div class="detail-row">
          <span class="detail-label">Reference</span>
          <span class="detail-value">${record.job_number || 'Pending assignment'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Contact Name</span>
          <span class="detail-value">${record.contact_name}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value">${record.contact_email}</span>
        </div>
        ${record.contact_phone ? `
        <div class="detail-row">
          <span class="detail-label">Phone</span>
          <span class="detail-value">${record.contact_phone}</span>
        </div>` : ''}
        ${record.company ? `
        <div class="detail-row">
          <span class="detail-label">Company</span>
          <span class="detail-value">${record.company}</span>
        </div>` : ''}
        <div class="detail-row">
          <span class="detail-label">Type</span>
          <span class="detail-value">${isAmendment ? 'Amendment to existing job' : 'New survey'}</span>
        </div>
        ${!isAmendment ? `
        <div class="detail-row">
          <span class="detail-label">Survey Type</span>
          <span class="detail-value">${SURVEY_LABELS[record.survey_type] || record.survey_type || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Tree Count Band</span>
          <span class="detail-value">${record.tree_count_band ? record.tree_count_band + ' trees' : '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Site Postcode</span>
          <span class="detail-value">${record.site_postcode || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Deadline</span>
          <span class="detail-value">${DEADLINE_LABELS[record.deadline_tier] || record.deadline_tier || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Quoted Price</span>
          <span class="detail-value" style="color:#1a3c2e;">${quotedPrice}</span>
        </div>` : ''}
        ${isAmendment ? `
        <div class="detail-row">
          <span class="detail-label">Original Job Ref</span>
          <span class="detail-value">${record.original_job_ref || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Amendment Scope</span>
          <span class="detail-value">${record.amendment_scope || '—'}</span>
        </div>` : ''}
        <div class="detail-row">
          <span class="detail-label">Submitted</span>
          <span class="detail-value">${new Date(record.submitted_at).toLocaleString('en-GB')}</span>
        </div>
      </div>

      <a href="https://ciaran-aut-ai.github.io/thac-admin/enquiry-detail.html?id=${record.id}" class="cta-button">
        View Enquiry in CRM →
      </a>
    `);

    await sendEmail(ADMIN_EMAIL, subject, html);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('notify-new-enquiry error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
