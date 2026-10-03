import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-service "Delete my account" for surveyor-new (Profile screen) and
// the web fallback page (delete-account.html) Google/Apple require for any
// app that lets people register in-app. Deleting the auth.users row needs
// the Auth Admin API, so (like admin-users) this has to run server-side
// with the service role key.
//
// We anonymise the surveyors row rather than deleting it outright:
// jobs.surveyor_id has no ON DELETE rule (defaults to RESTRICT), and a
// surveyor who's done paid work has job/payment history Trevor needs to
// keep for his own accounting -- deleting the row would either fail
// outright (if they've claimed a job) or silently blow a hole in that
// history. Wiping every personal field and cutting the auth link achieves
// the same privacy outcome (no PII left, can't log in again) without
// breaking that.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("OK", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing Authorization header" }, 401);

  const { data: { user: caller }, error: authError } = await anon.auth.getUser(token);
  if (authError || !caller) return json({ error: "Invalid or expired session" }, 401);

  try {
    const { data: surveyor, error: lookupError } = await admin
      .from("surveyors")
      .select("id")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    // No surveyor row (e.g. still pending admin approval) -- nothing to
    // anonymise, but the account itself still needs deleting.
    if (surveyor) {
      const surveyorId = surveyor.id;

      // Preference/schedule rows with no standalone value once the
      // surveyor's gone -- not cascaded automatically since we're not
      // deleting the parent row. job_nda_acceptance is deliberately left
      // alone: it's a per-job compliance record (which NDA version, when),
      // not meaningfully personal, and still useful tied to the job.
      await Promise.all([
        admin.from("surveyor_availability").delete().eq("surveyor_id", surveyorId),
        admin.from("surveyor_time_off").delete().eq("surveyor_id", surveyorId),
        admin.from("surveyor_service_outcodes").delete().eq("surveyor_id", surveyorId),
        admin.from("surveyor_outcode_overrides").delete().eq("surveyor_id", surveyorId),
      ]);

      // Certificate files (PI/PL/DBS) live under {surveyor_id}/ in the
      // private surveyor-documents bucket.
      const { data: files } = await admin.storage.from("surveyor-documents").list(surveyorId);
      if (files?.length) {
        await admin.storage.from("surveyor-documents").remove(files.map((f) => `${surveyorId}/${f.name}`));
      }

      // admin/surveyor-detail.html already totals jobs by surveyor_id (not
      // name), so pay/job history for this surveyor stays correctly
      // grouped even once anonymised -- the row keeps its id, only the
      // personal fields are wiped. But every admin list, search and export
      // (surveyors.html, job-detail.html's "Allocate to Surveyor" dropdown,
      // any CSV) goes by full_name text, and a flat "Deleted Surveyor"
      // string would make two or more deleted surveyors indistinguishable
      // there. Tagging the name with a fragment of its own id keeps it
      // unique and lets Trevor trace it back to surveyor-detail.html?id=...
      // without storing anything personal.
      const idTag = surveyorId.replace(/-/g, "").slice(-4).toUpperCase();
      const { error: anonError } = await admin
        .from("surveyors")
        .update({
          full_name: `Deleted Surveyor #${idTag}`,
          email: null,
          phone: null,
          home_postcode: null,
          home_lat: null,
          home_lng: null,
          pi_policy_number: null,
          pi_expiry_date: null,
          pl_policy_number: null,
          pl_expiry_date: null,
          dbs_number: null,
          dbs_expiry_date: null,
          pi_certificate_path: null,
          pl_certificate_path: null,
          dbs_certificate_path: null,
          professional_memberships: null,
          qualifications: null,
          notes: null,
          is_active: false,
          status: "archived",
          user_id: null,
        })
        .eq("id", surveyorId);
      if (anonError) throw anonError;
    }

    // Cuts off login for good -- the part that actually satisfies "delete
    // my account", everything above is just making sure nothing personal
    // is left behind once it does.
    const { error: deleteError } = await admin.auth.admin.deleteUser(caller.id);
    if (deleteError) throw deleteError;

    return json({ success: true });
  } catch (e) {
    console.error("delete-surveyor-account failed:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
