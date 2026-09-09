// ============================================================
// THAC — submit-enquiry
// Public HTTP endpoint, called directly from enquiry-form/index.html
// (the browser, with the public anon key).
//
// Why this exists: the public form used to INSERT straight into
// `enquiries` and `jobs` with the anon key. `jobs` has never had an
// anon INSERT policy at all -- that call always failed, silently
// (wrapped in its own try/catch, "non-blocking" by design). The
// `enquiries` insert had a permissive `with check (true)` policy, but
// the client also sent `Prefer: return=representation` to get the new
// row's id/job_number back -- and anon has no SELECT policy on
// enquiries, so Postgres refused to satisfy the RETURNING clause and
// rejected the whole insert. Net effect: every real customer
// submission silently failed with "Submission failed. Please try
// again," and nothing ever reached Trevor.
//
// This function does both inserts server-side with the service role
// key (bypassing RLS, safely -- it only ever inserts the caller's own
// submission and returns just id/job_number, never arbitrary rows), so
// the public anon key never needs write access to `jobs` at all, and
// never needs to read back its own enquiries insert either. The
// existing on_enquiry_insert DB trigger (-> notify-new-enquiry) still
// fires automatically on this insert, same as before, regardless of
// which role performs it.
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = await req.json();

    if (!payload.contact_name || !payload.contact_email) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    // 1. Insert the enquiry. The on_enquiry_insert DB trigger fires
    //    notify-new-enquiry automatically, same as always.
    const enqRes = await sbFetch("enquiries", {
      method: "POST",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify(payload),
    });

    if (!enqRes.ok) {
      console.error("Enquiry insert failed:", await enqRes.text());
      return jsonResponse({ error: "Could not save enquiry" }, 500);
    }

    const [enquiry] = await enqRes.json();

    // 2. Create the linked job (mirrors the old client-side
    //    createJobForEnquiry() -- anon has never had INSERT on jobs, so
    //    this step previously always failed silently).
    let jobData: Record<string, unknown> = {};

    if (enquiry.enquiry_type === "new") {
      // Jobs need their own site_lat/site_lng -- the surveyor-facing RLS
      // marketplace policy on jobs (dispatch_state='red' + earth_distance
      // vs a surveyor's home location and radius) requires them, and
      // nothing was ever setting them here. The enquiry form geocodes the
      // postcode client-side into enquiries.home_lat/home_lng, but that's
      // unreliable (fails silently on API errors, and the value never
      // gets copied onto the job anyway) -- confirmed against live data
      // that every job created since (roughly) July has NULL site_lat/lng,
      // meaning surveyors could never see them in the marketplace at all
      // regardless of RLS being correct. Geocoding here, server-side, with
      // the same free postcodes.io API already used for surveyor home
      // postcodes (geocode-postcode function), makes this reliable and
      // independent of whether the client-side geocode succeeded.
      let siteLat: number | null = null;
      let siteLng: number | null = null;
      if (enquiry.site_postcode) {
        try {
          const geoRes = await fetch(
            `https://api.postcodes.io/postcodes/${encodeURIComponent(enquiry.site_postcode.trim())}`
          );
          const geoData = await geoRes.json();
          if (geoData.status === 200 && geoData.result) {
            siteLat = geoData.result.latitude;
            siteLng = geoData.result.longitude;
          }
        } catch (e) {
          console.error("Site postcode geocoding failed:", e);
        }
      }

      const now = new Date();
      const daysToAdd = enquiry.deadline_tier === "3days" ? 3 :
                        enquiry.deadline_tier === "5days" ? 5 :
                        enquiry.deadline_tier === "7days" ? 7 :
                        enquiry.deadline_tier === "15days" ? 15 : 10;
      // Every deadline option is phrased as "N working days" -- skip
      // weekends so the SLA deadline actually lands N working days out,
      // not N calendar days (which used to run short whenever the window
      // crossed a weekend). Mirrors the same day-by-day skip used in
      // admin/job-detail.html's activateStage2().
      const slaDate = new Date(now);
      let daysCounted = 0;
      while (daysCounted < daysToAdd) {
        slaDate.setDate(slaDate.getDate() + 1);
        const day = slaDate.getDay();
        if (day !== 0 && day !== 6) daysCounted++;
      }
      const slaDeadline = slaDate.toISOString();

      jobData = {
        enquiry_id: enquiry.id,
        job_type: "new",
        survey_type: enquiry.survey_type,
        site_postcode: enquiry.site_postcode,
        site_lat: siteLat,
        site_lng: siteLng,
        tree_count_band: enquiry.tree_count_band,
        dispatch_state: "pending_approval",
        urgency_state: enquiry.deadline_tier === "3days" ? "red" :
                       enquiry.deadline_tier === "5days" ? "orange" :
                       enquiry.deadline_tier === "7days" ? "yellow" : "grey",
        sla_deadline: slaDeadline,
        quoted_amount: enquiry.quoted_price,
        agreed_amount: enquiry.quoted_price,
        billing_contact_name: enquiry.contact_name,
        billing_contact_email: enquiry.contact_email,
      };
    } else if (enquiry.enquiry_type === "amendment") {
      jobData = {
        enquiry_id: enquiry.id,
        job_type: "amendment",
        // jobs.survey_type is NOT NULL -- amendment jobs aren't tied to a
        // new survey, but need some value here. 'amendment' is already a
        // recognised SURVEY_TYPE_LABELS entry in the admin CRM.
        survey_type: "amendment",
        dispatch_state: "pending_approval",
        internal_notes: `Amendment request — customer-provided original job ref: "${enquiry.original_job_ref}". Scope: ${enquiry.amendment_scope}`,
      };
    }

    const jobRes = await sbFetch("jobs", {
      method: "POST",
      body: JSON.stringify(jobData),
    });
    if (!jobRes.ok) {
      // Non-blocking, matches previous behaviour: the enquiry itself is
      // already saved and admin is already notified. Unlike before,
      // this failure is now actually visible in the function logs.
      console.error("Job creation failed:", await jobRes.text());
    }

    // 3. Auto-send the quote email if a price was already computed.
    if (enquiry.quoted_price) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-quote-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            enquiry_id: enquiry.id,
            contact_email: enquiry.contact_email,
            contact_name: enquiry.contact_name,
            introducer_name: enquiry.introducer_name,
            introducer_email: enquiry.introducer_email,
            quoted_price: enquiry.quoted_price,
            deadline_tier: enquiry.deadline_tier,
            survey_type: enquiry.survey_type,
            job_number: enquiry.job_number,
            site_postcode: enquiry.site_postcode,
          }),
        });
      } catch (e) {
        console.error("Auto quote email failed:", e);
      }
    }

    return jsonResponse({ id: enquiry.id, job_number: enquiry.job_number });
  } catch (err) {
    console.error("submit-enquiry error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});
