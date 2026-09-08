// ============================================================
// THAC — notify-new-enquiry
// Trigger: INSERT on public.enquiries
// Fires:   Immediately when a new enquiry form is submitted
// Sends:   Email to admin
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper, ADMIN_EMAIL } from '../_shared/email-templates.ts';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY  = Deno.env.get('SB_THAC_SERVICE_ROLE_KEY')!;

// The job for this enquiry is created immediately by submit-enquiry, but
// this webhook only receives the enquiry row -- look up the job it's
// linked to so the CTA can go straight to job-detail.html. There's no
// enquiry-detail.html page in the admin CRM; that link 404'd for every
// single enquiry until this was added.
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
  '3days':   'Within 3 working days',
  '5days':   'Within 5 working days',
  '7days':   'Within 7 working days',
  '10days':  'Within 10 working days',
  '15days':  'Within 15 working days or more',
  'no_rush': 'No rush (just looking)',
};

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;

    const isAmendment = record.enquiry_type === 'amendment';
    const subject = isAmendment
      ? `New Amendment Enquiry — ${record.contact_name}`
      : `New Enquiry Received — ${record.contact_name}`;

    const jobId = await getLinkedJobId(record.id);
    const crmLink = jobId
      ? `https://thac-enquiry-form-production.up.railway.app/admin/job-detail.html?id=${jobId}`
      : `https://thac-enquiry-form-production.up.railway.app/admin/jobs.html`;

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
        ${record.introducer_name ? `
        <div class="detail-row">
          <span class="detail-label">Introduced By</span>
          <span class="detail-value">${record.introducer_name}</span>
        </div>` : ''}
        ${record.introducer_email ? `
        <div class="detail-row">
          <span class="detail-label">Also Copied On Quote</span>
          <span class="detail-value">${record.introducer_email}</span>
        </div>` : ''}
        ${record.introducer_company ? `
        <div class="detail-row">
          <span class="detail-label">Introducer Company</span>
          <span class="detail-value">${record.introducer_company}</span>
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
          <span class="detail-value" style="color:#1a3a2a;">${quotedPrice}</span>
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
