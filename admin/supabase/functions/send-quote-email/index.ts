import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { sendEmail, emailWrapper } from '../_shared/email-templates.ts'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('OK', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  }

  const { enquiry_id, contact_email, contact_name, introducer_email, quoted_price, deadline_tier, survey_type, job_number, site_postcode } = await req.json()

  if (!contact_email || !quoted_price) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }

  const acceptLink = `https://aut-ai.github.io/thac-enquiry-form/accept-quote.html?id=${enquiry_id}`
  const declineLink = `https://aut-ai.github.io/thac-enquiry-form/accept-quote.html?id=${enquiry_id}&action=decline`
  const price = '£' + Number(quoted_price).toLocaleString() + ' + VAT'

  const emailHtml = emailWrapper(`
    <h2>Your Tree Survey Quote</h2>
    <p>Dear ${contact_name || 'there'},</p>
    <p>Thank you for your enquiry — please find your quote below.</p>

    <div class="detail-block">
      <div class="detail-row">
        <span class="detail-label">Reference</span>
        <span class="detail-value">${job_number || 'Pending'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Survey Type</span>
        <span class="detail-value">${survey_type || '—'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Site Postcode</span>
        <span class="detail-value">${site_postcode || '—'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Deadline</span>
        <span class="detail-value">${deadline_tier || '—'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Quote</span>
        <span class="detail-value" style="color:#1a3a2a; font-size:16px; font-weight:700;">${price}</span>
      </div>
    </div>

    <p style="margin: 26px 0 14px;">To proceed, click one of the buttons below:</p>

    <div style="margin: 0 0 8px;">
      <a href="${acceptLink}" style="display:inline-block; background:#1a3a2a; color:#ffffff !important; padding:13px 28px; text-decoration:none; border-radius:8px; font-weight:600; font-size:14.5px; margin:0 10px 10px 0;">
        Accept Quote
      </a><a href="${declineLink}" style="display:inline-block; background:#ffffff; color:#c0392b !important; padding:12px 27px; text-decoration:none; border-radius:8px; font-weight:600; font-size:14.5px; border:1.5px solid #e8b8b3; margin:0 0 10px 0;">
        Decline
      </a>
    </div>

    <p style="color: #6b756f; font-size: 13px; margin-top: 22px;">
      This quote is valid for 30 days from today. Payment is due 30 days from invoice date.<br/>
      If you have any questions, just reply to this email.
    </p>

    <p style="color: #6b756f; font-size: 13px;">
      Kind regards,<br/>
      Trevor Heaps<br/>
      Heaps Arboriculture
    </p>
  `)

  // contact_email is always the client. When an introducer (rep/broker/
  // agent) submitted on their behalf, they get a copy of the same quote too.
  const recipients = [...new Set([contact_email, introducer_email].filter(Boolean))]

  try {
    await sendEmail(recipients, `Your Tree Survey Quote — ${job_number || 'THAC'} | ${price}`, emailHtml)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (error) {
    console.error('Email error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
})
