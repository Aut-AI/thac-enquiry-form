// ============================================================
// THAC — Email Templates
// Shared across all notification edge functions
// ============================================================

export const ADMIN_EMAIL = 'ciaran@aut-ai.com'; // ← testing — swap to Trevor's when ready
export const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
export const FROM_ADDRESS = 'THAC Notifications <onboarding@resend.dev>'; // ← Resend shared domain for testing

// ── Base wrapper ────────────────────────────────────────────
export function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
    .header { background: #1a3c2e; padding: 24px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; }
    .header p { color: #a8c5b5; margin: 4px 0 0; font-size: 13px; }
    .body { padding: 32px; color: #1a1a1a; }
    .body h2 { font-size: 18px; margin: 0 0 16px; color: #1a3c2e; }
    .detail-block { background: #f8faf9; border-left: 3px solid #1a3c2e; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e8eeeb; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #666; font-weight: 500; }
    .detail-value { color: #1a1a1a; font-weight: 600; text-align: right; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-urgent { background: #fee2e2; color: #dc2626; }
    .badge-elevated { background: #fff7ed; color: #ea580c; }
    .badge-standard { background: #fefce8; color: #ca8a04; }
    .badge-grey { background: #f3f4f6; color: #6b7280; }
    .cta-button { display: inline-block; margin: 24px 0 0; padding: 12px 28px; background: #1a3c2e; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; }
    .footer { background: #f8faf9; padding: 16px 32px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #e8eeeb; }
  </style>
</head>
<body>
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
</body>
</html>`;
}

// ── Send via Resend ─────────────────────────────────────────
export async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(data)}`);
  return data;
}

// ── Urgency badge helper ────────────────────────────────────
export function urgencyBadge(tier: string): string {
  const map: Record<string, string> = {
    red:    '<span class="badge badge-urgent">🔴 Urgent (1 day)</span>',
    orange: '<span class="badge badge-elevated">🟠 Elevated (3 days)</span>',
    yellow: '<span class="badge badge-standard">🟡 Standard (5 days)</span>',
    grey:   '<span class="badge badge-grey">⚪ Low Priority</span>',
  };
  return map[tier] || tier;
}
