// ============================================================
// THAC — Email Templates
// Shared across all notification edge functions
// ============================================================

export const ADMIN_EMAIL = 'trevor@heapsarboriculture.co.uk';
export const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
// heapsarboriculture.co.uk is verified in Trevor's own Resend account
// (as of 2026-09-08) -- sending from his real mailbox, not an alias.
export const FROM_ADDRESS = 'Heaps Arboriculture <trevor@heapsarboriculture.co.uk>';
// FROM_ADDRESS is now Trevor's real mailbox (unlike the old send-only
// sends.aut-ai.com setup), so replies would land there by default anyway --
// this override still points them at Nick's inbox while testing. Worth
// revisiting once Trevor's cutover is confirmed working: this may no longer
// need to differ from FROM_ADDRESS.
export const REPLY_TO_ADDRESS = 'nick@aut-ai.com';
// TESTING ONLY -- CC every outbound email (both admin-facing notifications
// and customer-facing quote/acceptance emails) to Nick while validating the
// new Resend account and the Trevor cutover. Set to null once testing is
// done and this should stop.
export const TESTING_CC: string | null = 'nick@aut-ai.com';

// ── Base wrapper ────────────────────────────────────────────
// Email clients don't render SVG or run CSS the way browsers do (Outlook
// desktop in particular is Word's rendering engine), so icons here are
// small CSS-drawn dots/badges rather than the site's SVG icon set -- same
// "colour = status, no decorative emoji" principle, executed in a way that
// actually survives Gmail/Outlook/Apple Mail. Layout is a fluid div (not a
// table) capped at 600px, with a single media query to stack the detail
// rows on narrow screens -- works in every modern client; falls back to
// the (still readable) desktop layout on ancient Outlook, which ignores
// the media query.
export function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #eef3ef; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .bg { width: 100%; background: #eef3ef; padding: 36px 16px; }
    .container { max-width: 600px; width: 100%; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 3px rgba(26,58,42,0.09), 0 8px 24px rgba(26,58,42,0.06); }
    .header { background: #1a3a2a; padding: 26px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
    .header p { color: #9fc2ac; margin: 4px 0 0; font-size: 12.5px; letter-spacing: 0.01em; }
    .body { padding: 32px; color: #1a1a1a; font-size: 15px; line-height: 1.65; }
    .body h2 { font-size: 19px; margin: 0 0 18px; color: #1a3a2a; font-weight: 700; letter-spacing: -0.01em; }
    .body p { margin: 0 0 14px; }
    .detail-block { background: #f7faf8; border: 1px solid #e2ebe4; border-radius: 10px; padding: 4px 20px; margin: 22px 0; }
    .detail-row { display: flex; justify-content: space-between; align-items: baseline; gap: 24px; padding: 13px 0; border-bottom: 1px solid #e6ede8; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #6b756f; font-weight: 500; flex-shrink: 0; }
    .detail-value { color: #1a1a1a; font-weight: 600; text-align: right; }
    .badge { display: inline-flex; align-items: center; gap: 7px; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .badge-urgent { background: #fde8e8; color: #c0392b; }
    .badge-elevated { background: #f5e6d8; color: #c8773a; }
    .badge-standard { background: #fefce8; color: #b8960a; }
    .badge-grey { background: #f0f0ee; color: #666666; }
    .badge-complete { background: #e8f2ec; color: #1a3a2a; }
    .callout { background: #f5e6d8; border: 1px solid #e8cfb0; border-radius: 10px; padding: 14px 18px; margin: 20px 0; font-size: 13.5px; color: #6b4321; }
    .cta-button { display: inline-block; margin: 26px 0 6px; padding: 13px 30px; background: #1a3a2a; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-size: 14.5px; font-weight: 600; }
    .footer { background: #f7faf8; padding: 20px 32px; text-align: center; font-size: 12px; color: #8a938d; border-top: 1px solid #e6ede8; }
    .footer a { color: #6b756f; }
    @media (max-width: 520px) {
      .bg { padding: 20px 6px; }
      .header, .body, .footer { padding-left: 22px !important; padding-right: 22px !important; }
      .detail-block { padding-left: 16px; padding-right: 16px; }
      .detail-row { flex-direction: column; align-items: flex-start; gap: 3px; padding: 11px 0; }
      .detail-value { text-align: left; }
      .cta-button { display: block; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="bg">
    <div class="container">
      <div class="header">
        <h1>🌳 Heaps Arboriculture</h1>
        <p>CRM Notification System</p>
      </div>
      <div class="body">
        ${content}
      </div>
      <div class="footer">
        Heaps Arboriculture &nbsp;·&nbsp; This is an automated notification.
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Send via Resend ─────────────────────────────────────────
export async function sendEmail(to: string | string[], subject: string, html: string) {
  const toList = Array.isArray(to) ? to : [to];
  const cc = TESTING_CC && !toList.includes(TESTING_CC) ? [TESTING_CC] : undefined;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: toList,
      ...(cc ? { cc } : {}),
      reply_to: REPLY_TO_ADDRESS,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Resend error: ${error}`);
  }
  return { success: true };
}

// ── Survey type labels ──────────────────────────────────────
export const SURVEY_LABELS: Record<string, string> = {
  bs5837:           'BS5837 Tree Survey (Planning)',
  vta:              'Visual Tree Assessment',
  bc:               'BS5837 Stage 2 (AIA/AMS/TPP)',
  subs:             'Subsidence / Building Damage',
  ams:              'Arboricultural Method Statement',
  tpp:              'Tree Protection Plan',
  tpo:              'TPO Application',
  lscp:             'Landscaping Plans',
  mortgage:         'Mortgage / Insurer Report',
  supervision:      'Site Supervision',
  amendment:        'Amendment',
  planning_stage1:  'Planning — Stage 1 (BS5837)',
  planning_stage2:  'Planning — Stage 2 (AIA/AMS/TPP)',
  health_safety:    'Tree Condition / Risk Survey',
  insurer_mortgage: 'Insurer / Mortgage Lender',
  subsidence:       'Building Damage / Subsidence',
  nhbc:             'Foundation Depths (NHBC)',
  site_visit:       'Site Visit & Advice',
  resistograph:     'Resistograph Testing',
  other:            'Other',
};

// ── A small solid-colour dot, replacing 🔴🟠🟡🟢⚫ -- renders reliably in
// every email client, unlike SVG or the site's own icon() helper.
export function statusDot(hex: string): string {
  return `<span class="dot" style="background:${hex};"></span>`;
}

// ── Urgency state badge (uses urgency_state values: red/orange/yellow/grey)
const URGENCY_META: Record<string, { cls: string; hex: string; label: string }> = {
  red:    { cls: 'badge-urgent',   hex: '#c0392b', label: 'Urgent — within 3 working days' },
  orange: { cls: 'badge-elevated', hex: '#c8773a', label: 'Elevated — within 5 working days' },
  yellow: { cls: 'badge-standard', hex: '#b8960a', label: 'Standard — within 7 working days' },
  grey:   { cls: 'badge-grey',     hex: '#666666', label: 'Low Priority — 10 working days / No rush' },
  green:  { cls: 'badge-complete', hex: '#1a3a2a', label: 'Complete' },
};

export function urgencyStateBadge(state: string): string {
  const m = URGENCY_META[state];
  if (!m) return `<span class="badge badge-grey">${state || '—'}</span>`;
  return `<span class="badge ${m.cls}">${statusDot(m.hex)}${m.label}</span>`;
}
