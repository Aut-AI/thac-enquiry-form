// ============================================================
// THAC — respond-to-quote
// Public HTTP endpoint, called directly from enquiry-form/accept-quote.html
// and confirm-quote.html (the browser, with the public anon key).
//
// Why this exists: those pages used to read and write `enquiries`/`jobs`
// directly with the anon key. anon has never had a SELECT policy on
// enquiries at all (only `authenticated` does), so accept-quote.html's very
// first fetch -- reading the quote to display it -- has always returned an
// empty result, showing "Quote not found" for every real customer. Worse,
// anon also has no UPDATE policy on enquiries: the accept/decline PATCH
// calls returned HTTP 204 (which looks like success) but matched zero rows
// under RLS and silently changed nothing -- confirmed by re-reading a
// "successfully accepted" test enquiry straight after and finding it still
// sitting at status 'quoted'. The entire customer accept/decline flow has
// never actually worked.
//
// This function does the read and both writes server-side with the
// service role key (bypassing RLS, safely -- every action is scoped to the
// single enquiry id the caller already has from their own email link, and
// the 'get' action only ever returns the same small, non-sensitive field
// set the page already displayed today).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SB_THAC_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

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
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      ...(init.headers || {}),
    },
  });
}

async function getLinkedJob(enquiryId: string) {
  const res = await sbFetch(`jobs?enquiry_id=eq.${enquiryId}&select=id&limit=1`);
  const rows = await res.json();
  return rows?.[0]?.id || null;
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
    const { action, id } = body;

    if (!id) return jsonResponse({ error: "Missing id" }, 400);

    // ── Read the quote for display ────────────────────────────
    // Union of the fields accept-quote.html and confirm-quote.html each
    // need -- the latter pre-fills from whatever the former already
    // collected, since a real customer only reaches it after accepting.
    if (action === "get") {
      const fields = [
        "id", "job_number", "contact_name", "survey_type", "site_postcode",
        "deadline_tier", "quoted_price", "travel_cost", "status", "submitted_at",
        "end_client_name", "end_client_email",
        "billing_contact_name", "billing_contact_email", "billing_address",
        "report_addressee_name", "report_addressee_address",
        "access_details", "client_site_access",
      ].join(",");
      const res = await sbFetch(`enquiries?id=eq.${id}&select=${fields}&limit=1`);
      const rows = await res.json();
      if (!rows?.length) return jsonResponse({ error: "Not found" }, 404);
      return jsonResponse(rows[0]);
    }

    // ── Accept: enquiry details + linked job ──────────────────
    // Shared by both accept-quote.html's step 2 and confirm-quote.html --
    // two independently-built forms that collect an overlapping but not
    // identical field set (see the comment on client_site_access below).
    // Fields are only included in the PATCH when actually present in this
    // request, so one form's submission never wipes data the other form
    // already saved by overwriting it with null.
    if (action === "accept") {
      const nowIso = new Date().toISOString();
      const present = (key: string, value: unknown) =>
        value !== undefined ? { [key]: value || null } : {};

      const enquiryUpdate = {
        status: "accepted",
        accepted_at: nowIso,
        tc_accepted: true,
        tc_accepted_at: nowIso,
        client_details_at: nowIso,
        ...present("billing_contact_name", body.billing_contact_name),
        ...present("billing_contact_email", body.billing_contact_email),
        ...present("billing_address", body.billing_address),
        ...present("end_client_name", body.end_client_name),
        ...present("end_client_email", body.end_client_email),
        ...present("report_addressee_name", body.report_addressee_name),
        ...present("report_addressee_address", body.report_addressee_address),
        ...present("report_title", body.report_title),
        ...present("access_details", body.access_details),
        // confirm-quote.html writes site access notes to this separate
        // column instead of access_details -- both are real columns, an
        // artefact of the two forms having been built independently.
        ...present("client_site_access", body.client_site_access),
        ...present("parking_details", body.parking_details),
        ...(body.parking_lat != null && body.parking_lng != null
          ? { parking_lat: body.parking_lat, parking_lng: body.parking_lng }
          : {}),
      };

      const enqRes = await sbFetch(`enquiries?id=eq.${id}`, {
        method: "PATCH",
        headers: { "Prefer": "return=representation" },
        body: JSON.stringify(enquiryUpdate),
      });
      if (!enqRes.ok) {
        console.error("Accept: enquiry update failed:", await enqRes.text());
        return jsonResponse({ error: "Could not save your details" }, 500);
      }
      const [enquiry] = await enqRes.json();

      // The job's site_access_notes is a single field (unlike the two on
      // enquiries) -- fed from whichever of the two the caller sent.
      const siteAccess = body.access_details ?? body.client_site_access;
      const jobUpdate = {
        ...present("site_access_notes", siteAccess),
        ...present("billing_contact_name", body.billing_contact_name),
        ...present("billing_contact_email", body.billing_contact_email),
        ...present("billing_address", body.billing_address),
        ...present("report_addressee_name", body.report_addressee_name),
        ...present("report_addressee_address", body.report_addressee_address),
        ...present("report_title", body.report_title),
        extended_info_received: true,
        extended_info_received_at: nowIso,
        ...(body.parking_lat != null && body.parking_lng != null
          ? { parking_lat: body.parking_lat, parking_lng: body.parking_lng }
          : {}),
      };

      const jobId = await getLinkedJob(id);
      if (jobId) {
        const jobRes = await sbFetch(`jobs?id=eq.${jobId}`, {
          method: "PATCH",
          body: JSON.stringify(jobUpdate),
        });
        if (!jobRes.ok) console.error("Accept: job update failed:", await jobRes.text());
      } else {
        // Defensive fallback -- submit-enquiry always creates the job
        // immediately now, so this should be unreachable in practice.
        console.error("Accept: no linked job found for enquiry", id, "-- creating fallback job");
        const urgency = body.deadline_tier === "3days" ? "red"
          : body.deadline_tier === "5days" ? "orange"
          : body.deadline_tier === "7days" ? "yellow" : "grey";
        await sbFetch("jobs", {
          method: "POST",
          body: JSON.stringify({
            enquiry_id: id,
            survey_type: enquiry.survey_type,
            site_postcode: enquiry.site_postcode,
            dispatch_state: "pending_approval",
            urgency_state: urgency,
            quoted_amount: enquiry.quoted_price,
            agreed_amount: enquiry.quoted_price,
            ...jobUpdate,
          }),
        });
      }

      return jsonResponse({ success: true, job_number: enquiry.job_number });
    }

    // ── Decline: enquiry status + archive linked job ──────────
    if (action === "decline") {
      const enqRes = await sbFetch(`enquiries?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "declined",
          declined_reason: body.reason || null,
          declined_at: new Date().toISOString(),
        }),
      });
      if (!enqRes.ok) {
        console.error("Decline: enquiry update failed:", await enqRes.text());
        return jsonResponse({ error: "Could not save your response" }, 500);
      }

      const jobId = await getLinkedJob(id);
      if (jobId) {
        const jobRes = await sbFetch(`jobs?id=eq.${jobId}`, {
          method: "PATCH",
          body: JSON.stringify({ dispatch_state: "archived" }),
        });
        if (!jobRes.ok) console.error("Decline: job archive failed:", await jobRes.text());
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("respond-to-quote error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});
