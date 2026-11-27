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
//
// Admin mode (Trevor, 27 Nov 2026): a CRM admin can send { surveyor_id } to
// delete any surveyor the same way. Refused while they hold a live job
// (allocated or survey done), so it is reallocated or taken back first. The
// login is found by user_id, or by email for surveyors archived before this
// existed (archiving cleared user_id but left the login, which kept the
// email in use).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SB_THAC_SERVICE_ROLE_KEY")!;

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("OK", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing Authorization header" }, 401);

  const { data: { user: caller }, error: authError } = await admin.auth.getUser(token);
  if (authError || !caller) return json({ error: "Invalid or expired session" }, 401);

  let body: { surveyor_id?: string } = {};
  try { body = await req.json(); } catch { /* self-delete sends no body */ }

  try {
    let surveyor: { id: string } | null = null;
    let loginId: string | null = caller.id;

    if (body.surveyor_id) {
      const { data: me } = await admin.from("users").select("role,is_active").eq("id", caller.id).maybeSingle();
      if (!me || me.role !== "admin" || !me.is_active) return json({ error: "Only admins can delete surveyors" }, 403);

      const { data: target, error: tErr } = await admin
        .from("surveyors").select("id,user_id,email").eq("id", body.surveyor_id).maybeSingle();
      if (tErr) throw tErr;
      if (!target) return json({ error: "Surveyor not found" }, 404);

      const { data: live } = await admin.from("jobs").select("reference")
        .or(`surveyor_id.eq.${target.id},allocated_surveyor_id.eq.${target.id}`)
        .in("dispatch_state", ["red", "orange", "yellow"]);
      const holding = (live || []).filter(Boolean);
      if (holding.length) {
        return json({ error: `Still holds ${holding.length} live job(s): ${holding.map((j) => j.reference || "?").join(", ")}. Reallocate or take them back first.` }, 409);
      }

      surveyor = { id: target.id };
      loginId = target.user_id;
      if (!loginId && target.email && !target.email.endsWith("@deleted.invalid")) {
        for (let page = 1; page <= 10 && !loginId; page++) {
          const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          const hit = list?.users?.find((u) => (u.email || "").toLowerCase() === target.email.toLowerCase());
          if (hit) loginId = hit.id;
          if (!list?.users?.length || list.users.length < 200) break;
        }
      }
      // Never delete the login of a CRM user (someone who is both).
      if (loginId) {
        const { data: crm } = await admin.from("users").select("id").eq("id", loginId).maybeSingle();
        if (crm) loginId = null;
      }
    } else {
      const { data, error: lookupError } = await admin
        .from("surveyors")
        .select("id")
        .eq("user_id", caller.id)
        .maybeSingle();
      if (lookupError) throw lookupError;
      surveyor = data;
    }

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
          // home_postcode is NOT NULL on prod (deletes failed with 23502 until
          // 7 Nov 2026), so blank it rather than null it. An empty postcode
          // makes geocode-postcode return early. email gets a unique dummy in
          // case it is NOT NULL or unique too.
          full_name: `Deleted Surveyor #${idTag}`,
          email: `deleted-${surveyorId}@deleted.invalid`,
          phone: null,
          home_postcode: "",
          home_lat: null,
          home_lng: null,
          area_name: null,
          pi_policy_number: null,
          pi_expiry_date: null,
          pl_policy_number: null,
          pl_expiry_date: null,
          dbs_number: null,
          dbs_expiry_date: null,
          pi_certificate_path: null,
          pl_certificate_path: null,
          dbs_certificate_path: null,
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
    if (loginId) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(loginId);
      if (deleteError) throw deleteError;
    }

    return json({ success: true });
  } catch (e) {
    console.error("delete-surveyor-account failed:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
