import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { sendEmail, emailWrapper } from '../_shared/email-templates.ts'

serve(async (req) => {
  const { record } = await req.json()

  if (record.status !== 'accepted') return new Response('Not an acceptance', { status: 200 })

  const confirmLink = `https://aut-ai.github.io/thac-enquiry-form/confirm-quote.html?id=${record.id}`

  const emailHtml = emailWrapper(`
    <h2>Your Quote Has Been Accepted</h2>
    <p>Hi ${record.contact_name},</p>
    <p>Great news — we're ready to proceed with your tree survey. Please complete
       a few last details so we can get started.</p>

    <div class="detail-block">
      <div class="detail-row">
        <span class="detail-label">End client details</span>
        <span class="detail-value">the property owner</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Billing contact</span>
        <span class="detail-value">who receives the invoice</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Report addressee</span>
        <span class="detail-value">who the report is for</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Site access</span>
        <span class="detail-value">gate codes, contact on arrival</span>
      </div>
    </div>

    <a href="${confirmLink}" class="cta-button">
      Confirm Your Details →
    </a>

    <p style="margin-top:26px;">Reference: <strong>${record.job_number}</strong></p>
    <p style="color: #6b756f; font-size: 13px; margin-top: 20px;">
      If you have any questions, just reply to this email or give us a call.
    </p>
  `)

  try {
    await sendEmail(record.contact_email, `Confirm Your Quote Details — Reference ${record.job_number}`, emailHtml)
    return new Response('Email sent', { status: 200 })
  } catch (error) {
    console.error('Email error:', error)
    return new Response('Email failed', { status: 500 })
  }
})
