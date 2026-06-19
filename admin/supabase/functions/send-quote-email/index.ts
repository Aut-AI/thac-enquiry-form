import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

console.log('Function initialized. RESEND_API_KEY set:', !!RESEND_API_KEY)

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

  const { enquiry_id, contact_email, contact_name, quoted_price, deadline_tier, survey_type, job_number, site_postcode } = await req.json()

  if (!contact_email || !quoted_price) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }

  const acceptLink = `https://ciaran-aut-ai.github.io/thac-enquiry-form/accept-quote.html?id=${enquiry_id}`
  const declineLink = `https://ciaran-aut-ai.github.io/thac-enquiry-form/accept-quote.html?id=${enquiry_id}&action=decline`
  const price = '£' + Number(quoted_price).toLocaleString() + ' + VAT'

  const emailHtml = `
    <h2>Your Tree Survey Quote</h2>
    <p>Dear ${contact_name || 'there'},</p>
    <p>Thank you for your enquiry. Please find your quote below:</p>

    <table style="margin: 20px 0; border-collapse: collapse; width: 100%;">
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Reference:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${job_number || 'Pending'}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Survey Type:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${survey_type || '—'}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Site Postcode:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${site_postcode || '—'}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Deadline:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${deadline_tier || '—'}</td></tr>
      <tr><td style="padding: 8px;"><strong>Quote:</strong></td><td style="padding: 8px; font-weight: 600; color: #1a3a2a;">${price}</td></tr>
    </table>

    <p style="margin: 24px 0;">To proceed with this quote, simply click one of the buttons below:</p>

    <p style="margin: 16px 0;">
      <a href="${acceptLink}" style="display: inline-block; background: #1a3a2a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 12px;">
        ✅ Accept Quote
      </a>
      <a href="${declineLink}" style="display: inline-block; background: #fee2e2; color: #dc2626; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        ❌ Decline
      </a>
    </p>

    <p style="color: #666; font-size: 13px; margin-top: 24px;">
      This quote is valid for 30 days from today. Payment is due 30 days from invoice date.<br/>
      If you have any questions, please reply to this email.
    </p>

    <p style="color: #666; font-size: 13px;">
      Kind regards,<br/>
      Trevor Heaps<br/>
      Trevor Heaps Arboricultural Consultancy Ltd.
    </p>
  `

  try {
    console.log('Sending email to:', contact_email)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'THAC <onboarding@resend.dev>',
        to: contact_email,
        subject: `Your Tree Survey Quote — ${job_number || 'THAC'} | ${price}`,
        html: emailHtml,
      }),
    })

    console.log('Resend response status:', response.status)
    if (!response.ok) {
      const error = await response.text()
      console.log('Resend error:', error)
      throw new Error(`Resend API error: ${error}`)
    }
    console.log('Email sent successfully')

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
