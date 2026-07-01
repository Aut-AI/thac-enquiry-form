import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')
const ADMIN_EMAIL = 'ciaran@aut-ai.com'

serve(async (req) => {
  const { record } = await req.json()

  if (record.status !== 'accepted') return new Response('Not an acceptance', { status: 200 })

  const confirmLink = `https://ciaran-aut-ai.github.io/thac-enquiry-form/enquiry-form/confirm-quote.html?id=${record.id}`

  const emailHtml = `
    <h2>Your Quote Has Been Accepted</h2>
    <p>Hi ${record.contact_name},</p>
    <p>Great news! We're ready to proceed with your tree survey.</p>

    <p><strong>Please complete the following by clicking the button below:</strong></p>
    <ul>
      <li>Confirm the end client (property owner) details</li>
      <li>Provide billing contact information</li>
      <li>Specify where the report should be addressed</li>
      <li>Share any site access information (gate codes, contact numbers, etc)</li>
    </ul>

    <p style="margin: 24px 0;">
      <a href="${confirmLink}" style="display: inline-block; background: #1a3a2a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Confirm Your Details →
      </a>
    </p>

    <p>Reference: <strong>${record.job_number}</strong></p>
    <p style="color: #666; font-size: 13px; margin-top: 24px;">
      If you have any questions, please reply to this email or call us.
    </p>
  `

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: record.contact_email }] }],
        from: { email: 'ciaran@aut-ai.com' },
        subject: `Confirm Your Quote Details — Reference ${record.job_number}`,
        content: [{ type: 'text/html', value: emailHtml }],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`SendGrid API error: ${error}`)
    }

    return new Response('Email sent', { status: 200 })
  } catch (error) {
    console.error('Email error:', error)
    return new Response('Email failed', { status: 500 })
  }
})
