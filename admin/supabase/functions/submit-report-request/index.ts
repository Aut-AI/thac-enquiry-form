// ============================================================
// THAC — submit-report-request
// Public HTTP endpoint, called from enquiry-form/report-request.html:
// the quick form Trevor sends regular clients who need (A) an existing
// report amended or (B) a report completed (AIA, AMS and TPP) after
// the survey (Trevor's email, 26 Oct 2026; his answers, 2 Nov 2026).
//
// Unlike submit-enquiry, which inserts the caller's payload as-is, this
// takes a fixed set of fields and builds the rows itself, so the public
// page can't set status, prices or anything else on the enquiry/job.
//
// The client accepts the T&Cs on the form, so the request is instructed
// work: the enquiry is saved as accepted and the job goes straight onto
// the CRM as an amendment (off the map, finishable from the job page at
// any point, same as amendments from the website quote form). The
// on_enquiry_insert trigger emails Trevor via notify-new-enquiry; this
// function emails the client a confirmation.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceKeyHeaders } from "../_shared/service-key.ts";
import { urgencyFromTier } from "../_shared/urgency.ts";
import { dueDate, loadBankHolidays } from "../_shared/working-days.ts";
import { sendEmail, emailWrapper, detailBlock, detailRow } from "../_shared/email-templates.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SB_THAC_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

type Option = { tier: string; label: string; surcharge: number; is_available: boolean; days: number };

// Used if the report_request_options table can't be read (e.g. before its
// migration has run). Same values as the migration seeds.
const DEFAULT_OPTIONS: Option[] = [
  { tier: "1day",  label: "Next working day",      surcharge: 150, is_available: true, days: 1 },
  { tier: "3days", label: "Within 3 working days", surcharge: 100, is_available: true, days: 3 },
  { tier: "5days", label: "Within 5 working days", surcharge: 0,   is_available: true, days: 5 },
];

// (A) amend: hourly, no fixed price. (B) complete: AIA + AMS + TPP.
const REQUEST_TYPES: Record<string, { survey_type: string | null; job_survey_type: string; label: string; pricing: string }> = {
  amend: {
    survey_type: null, job_survey_type: "amendment", label: "Amend an existing report",
    pricing: "£100 + VAT per hour, minimum £25 + VAT",
  },
  complete: {
    survey_type: "planning_stage2", job_survey_type: "planning_stage2", label: "Complete a report (AIA, AMS, TPP)",
    pricing: "As already quoted, or standard £300 + VAT (£100 + VAT each for AIA, AMS, TPP)",
  },
};

const OFFICE_EMAIL = "hello@heapsarboriculture.co.uk";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function sbFetch(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...serviceKeyHeaders(SERVICE_ROLE_KEY),
      ...(init.headers || {}),
    },
  });
}

// Trimmed, length-capped string, or null if blank
function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s || null;
}

const isEmail = (s: string | null) => !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function loadOptions(): Promise<Option[]> {
  try {
    const res = await sbFetch("report_request_options?select=tier,label,surcharge,is_available");
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length) {
        return rows.map((r) => ({
          tier: r.tier, label: r.label, surcharge: Number(r.surcharge), is_available: r.is_available !== false,
          days: Number(/^(\d+)days?$/.exec(r.tier)?.[1] ?? 5),
        }));
      }
    }
  } catch (e) {
    console.warn("report_request_options unavailable, using defaults:", e);
  }
  return DEFAULT_OPTIONS;
}

// The digits of a TH reference the client typed: "th1234", "TH-1234 Rev B",
// "1234" -> "1234". Null if there's no number to go on.
function refNumber(ref: string): string | null {
  return /^\s*(?:TH)?[\s\-_]*(\d+)/i.exec(ref)?.[1] ?? null;
}

// Trevor (2 Nov 2026): an amendment keeps the report's reference with a
// revision letter, "TH 1234 Rev B", "Rev C", ...; a completed report gets
// "AMS" after it. Works out the next one not already used in the CRM, and
// whether the original job is there to link to. `typedRev` is a revision
// letter the client gave ("TH 1234 Rev B" means they're on B already).
async function planReference(num: string, type: string, typedRev: string | null = null): Promise<{ reference: string; originalId: string | null }> {
  const base = `TH ${num}`;
  let rows: { id: string; reference: string }[] = [];
  try {
    const res = await sbFetch(`jobs?reference=ilike.*${num}*&select=id,reference&limit=200`);
    if (res.ok) rows = await res.json();
  } catch { /* plan from nothing */ }

  // Only this report's refs: "TH 1234" + optional suffix, not "TH 12345"
  const same = rows
    .map((r) => ({ id: r.id, ref: (r.reference || "").trim(), m: new RegExp(`^TH\\s*${num}(?!\\d)\\s*(.*)$`, "i").exec(r.reference || "") }))
    .filter((r) => r.m);
  const used = new Set(same.map((r) => r.ref.toLowerCase().replace(/\s+/g, " ")));
  const originals = same.filter((r) => r.m![1] === "");
  const originalId = originals.length === 1 ? originals[0].id : null;

  if (type === "complete" && !used.has(`${base} ams`.toLowerCase())) {
    return { reference: `${base} AMS`, originalId };
  }
  const stem = type === "complete" ? `${base} AMS` : base;
  // Highest revision letter already on the CRM for this stem; Rev B first
  let letter = Math.max("A".charCodeAt(0), type === "amend" && typedRev ? typedRev.toUpperCase().charCodeAt(0) : 0);
  for (const r of same) {
    const rev = new RegExp(`^${stem.replace(/ /g, "\\s*")}\\s*rev\\s*([a-y])$`, "i").exec(r.ref);
    if (rev) letter = Math.max(letter, rev[1].toUpperCase().charCodeAt(0));
  }
  let ref = `${stem} Rev ${String.fromCharCode(letter + 1)}`;
  while (used.has(ref.toLowerCase()) && letter < 89) {
    letter++;
    ref = `${stem} Rev ${String.fromCharCode(letter + 1)}`;
  }
  return { reference: ref, originalId };
}

function formatDue(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();

    // Honeypot: a hidden field people never see. Bots fill it in; pretend
    // it worked so they don't retry.
    if (clean(body.website, 200)) return jsonResponse({ success: true });

    const options = await loadOptions();
    const type = REQUEST_TYPES[body.request_type];
    const option = options.find((o) => o.tier === body.deadline_tier);
    const reportRef = clean(body.report_ref, 40);
    const site = clean(body.site, 300);
    const description = clean(body.description, 5000);
    const contactName = clean(body.contact_name, 200);
    const contactEmail = clean(body.contact_email, 200);
    const contactPhone = clean(body.contact_phone, 40);
    const billingName = clean(body.billing_name, 200);
    const billingEmail = clean(body.billing_email, 200);
    const billingAddress = clean(body.billing_address, 1000);
    const reportName = clean(body.report_name, 200);

    if (!type || !option || !reportRef || !site || !description || !contactName ||
        !isEmail(contactEmail) || !contactPhone || !billingName || !isEmail(billingEmail) || !billingAddress) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }
    if (body.tc_accepted !== true) {
      return jsonResponse({ error: "Terms and conditions must be accepted" }, 400);
    }
    if (!option.is_available) {
      // Switched off in Settings after the page was loaded
      return jsonResponse({ error: "unavailable", message: `${option.label} is not available at the moment. Please choose another option.` }, 409);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const due = dueDate(now, option.days, await loadBankHolidays());
    const num = refNumber(reportRef);
    const typedRev = /\brev\.?\s*([a-y])\b/i.exec(reportRef)?.[1] ?? null;
    const plan = num ? await planReference(num, body.request_type, typedRev) : null;
    const typedRef = num ? `TH ${num}` : reportRef.toUpperCase();

    // 1. The enquiry. on_enquiry_insert -> notify-new-enquiry emails Trevor.
    const enqRes = await sbFetch("enquiries", {
      method: "POST",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify({
        enquiry_type: "amendment",
        survey_type: type.survey_type,
        original_job_ref: typedRef,
        amendment_scope: description,
        deadline_tier: option.tier,
        site_street: site,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        billing_contact_name: billingName,
        billing_contact_email: billingEmail,
        billing_address: billingAddress,
        report_addressee_name: reportName,
        status: "accepted",
        accepted_at: nowIso,
        tc_accepted: true,
        tc_accepted_at: nowIso,
        submitted_at: nowIso,
      }),
    });
    if (!enqRes.ok) {
      console.error("Report request: enquiry insert failed:", await enqRes.text());
      return jsonResponse({ error: "Could not save request" }, 500);
    }
    const [enquiry] = await enqRes.json();

    // 2. The job, ready to work on.
    const notes = [
      `Report request (client form): ${type.label}.`,
      `Client's report ref: ${reportRef}${plan?.originalId ? "" : " (original job not found in the CRM, check the reference)"}.`,
      `Price: ${type.pricing}${option.surcharge ? `, plus £${option.surcharge} + VAT urgency` : ""}.`,
      `Details: ${description}`,
    ].join("\n");

    const jobRes = await sbFetch("jobs", {
      method: "POST",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify({
        enquiry_id: enquiry.id,
        reference: plan?.reference ?? null,
        job_type: "amendment",
        survey_type: type.job_survey_type,
        parent_job_id: plan?.originalId ?? null,
        site_street: site,
        dispatch_state: "pending_approval",
        urgency_state: urgencyFromTier(option.tier),
        deadline_tier: option.tier,
        // Noon UTC on the due date: the CRM shows the date
        sla_deadline: `${due}T12:00:00.000Z`,
        urgency_surcharge: option.surcharge,
        billing_contact_name: billingName,
        billing_contact_email: billingEmail,
        billing_address: billingAddress,
        report_addressee_name: reportName,
        extended_info_received: true,
        extended_info_received_at: nowIso,
        internal_notes: notes,
      }),
    });

    let jobRef: string | null = null;
    if (!jobRes.ok) {
      // The enquiry is saved and Trevor is emailed either way; the job can
      // be added by hand. Logged so it shows up in the function logs.
      console.error("Report request: job insert failed:", await jobRes.text());
    } else {
      const [job] = await jobRes.json();
      jobRef = job?.reference ?? null;
      // If the database numbered the job itself, put Trevor's reference back
      if (plan && job?.id && jobRef !== plan.reference) {
        const fix = await sbFetch(`jobs?id=eq.${job.id}`, {
          method: "PATCH",
          body: JSON.stringify({ reference: plan.reference }),
        });
        if (fix.ok) jobRef = plan.reference;
        else console.error("Report request: could not set reference", plan.reference, await fix.text());
      }
    }
    const reference = jobRef ?? plan?.reference ?? typedRef;

    // 3. Confirmation to the client (and the payer, if someone else)
    try {
      const recipients = [contactEmail!];
      if (billingEmail!.toLowerCase() !== contactEmail!.toLowerCase()) recipients.push(billingEmail!);
      const html = emailWrapper(`
        <h2>We've booked in your request</h2>
        <p>Dear ${esc(contactName)},</p>
        <p>Thank you. Your request has been added to our database and will be carried out within your requested timescale.</p>
        ${detailBlock([
          detailRow("Reference", esc(reference)),
          detailRow("Request", esc(type.label)),
          detailRow("Site", esc(site)),
          detailRow("Due by", esc(formatDue(due))),
          detailRow("Cost", esc(type.pricing + (option.surcharge ? `, plus £${option.surcharge} + VAT for ${option.label.toLowerCase()}` : ""))),
          detailRow("Invoice to", esc([billingName, billingAddress].join(", "))),
          detailRow("Details", esc(description)),
        ].join(""))}
        <p>If you haven't already, please email your plans to <a href="mailto:${OFFICE_EMAIL}">${OFFICE_EMAIL}</a>, quoting the reference above.</p>
        <p>Kind regards,<br>Heaps Arboriculture</p>
      `);
      await sendEmail(recipients, `Request received — ${reference}`, html);
    } catch (e) {
      console.error("Report request: confirmation email failed:", e);
    }

    return jsonResponse({ success: true, reference, due_date: due });
  } catch (err) {
    console.error("submit-report-request error:", err);
    return jsonResponse({ error: "Could not save request" }, 500);
  }
});
